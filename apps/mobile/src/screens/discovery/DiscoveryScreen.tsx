import React, { useEffect, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  Image, TextInput, ActivityIndicator, Alert,
} from 'react-native';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/AuthContext';
import { COLORS } from '../../constants';
import { UserWithDetails } from '../../types';

export default function DiscoveryScreen() {
  const { activeUser } = useAuth();
  const [users, setUsers] = useState<UserWithDetails[]>([]);
  const [suggestions, setSuggestions] = useState<UserWithDetails[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'suggested' | 'search'>('suggested');
  const [sentRequests, setSentRequests] = useState<Set<string>>(new Set());
  const [excludedIds, setExcludedIds] = useState<string[]>([]);

  useEffect(() => {
    if (activeUser) loadExcludedThenSuggestions();
  }, [activeUser]);

  async function loadExcludedThenSuggestions() {
    const excluded = await fetchExcluded();
    await fetchSuggestions(excluded);
  }

  async function fetchExcluded(): Promise<string[]> {
    const userId = activeUser!.id;

    const { data } = await supabase
      .from('friendships')
      .select('requester_id, addressee_id, status')
      .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`);

    const sent = new Set<string>();
    const accepted = new Set<string>();

    for (const f of data || []) {
      const otherId = f.requester_id === userId ? f.addressee_id : f.requester_id;
      if (f.status === 'pending' && f.requester_id === userId) sent.add(otherId);
      if (f.status === 'accepted') accepted.add(otherId);
    }

    setSentRequests(sent);
    const excluded = [userId, ...Array.from(accepted)];
    setExcludedIds(excluded);
    return excluded;
  }

  async function fetchSuggestions(excluded: string[]) {
    setLoading(true);
    const { data: myLikes } = await supabase
      .from('user_likes')
      .select('category_id')
      .eq('user_id', activeUser!.id);

    const likeIds = (myLikes || []).map(l => l.category_id);

    let query = supabase
      .from('user_profiles')
      .select('*, user_likes(category_id)')
      .not('id', 'in', `(${excluded.join(',')})`)
      .eq('city', activeUser!.city)
      .limit(20);

    const { data, error } = await query;
    if (error) { Alert.alert('Error', error.message); setLoading(false); return; }

    const scored = (data || []).map(u => ({
      ...u,
      score: (u.user_likes || []).filter((l: any) => likeIds.includes(l.category_id)).length,
    })).sort((a, b) => b.score - a.score);

    setSuggestions(scored);
    setLoading(false);
  }

  async function searchUsers() {
    if (!search.trim()) return;
    setLoading(true);
    const excluded = excludedIds.length > 0 ? excludedIds : [activeUser!.id];
    const { data } = await supabase
      .from('user_profiles')
      .select('*')
      .not('id', 'in', `(${excluded.join(',')})`)
      .ilike('name', `%${search}%`)
      .limit(20);
    setUsers(data || []);
    setLoading(false);
  }

  async function sendFriendRequest(userId: string) {
    const { error } = await supabase.from('friendships').insert({
      requester_id: activeUser!.id,
      addressee_id: userId,
      status: 'pending',
    });
    if (error) Alert.alert('Error', error.message);
    else setSentRequests(prev => new Set([...prev, userId]));
  }

  const displayList = tab === 'suggested' ? suggestions : users;

  return (
    <View style={styles.container}>
      <View style={styles.tabs}>
        <TouchableOpacity style={[styles.tab, tab === 'suggested' && styles.tabActive]} onPress={() => setTab('suggested')}>
          <Text style={[styles.tabText, tab === 'suggested' && styles.tabTextActive]}>Suggested</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tab, tab === 'search' && styles.tabActive]} onPress={() => setTab('search')}>
          <Text style={[styles.tabText, tab === 'search' && styles.tabTextActive]}>Search</Text>
        </TouchableOpacity>
      </View>

      {tab === 'search' && (
        <View style={styles.searchRow}>
          <TextInput
            style={styles.searchInput}
            placeholder="Search by name..."
            value={search}
            onChangeText={setSearch}
            onSubmitEditing={searchUsers}
            returnKeyType="search"
            placeholderTextColor={COLORS.textLight}
          />
          <TouchableOpacity style={styles.searchBtn} onPress={searchUsers}>
            <Text style={styles.searchBtnText}>Go</Text>
          </TouchableOpacity>
        </View>
      )}

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} size="large" color={COLORS.primary} />
      ) : (
        <FlatList
          data={displayList}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <View style={styles.card}>
              {item.photo_url
                ? <Image source={{ uri: item.photo_url }} style={styles.avatar} />
                : <View style={styles.avatarPlaceholder}><Text style={styles.avatarInitial}>{item.name[0]}</Text></View>
              }
              <View style={styles.info}>
                <Text style={styles.name}>{item.name}</Text>
                <Text style={styles.meta}>{item.age} yrs • {item.city}</Text>
                {item.languages?.length > 0 && (
                  <Text style={styles.lang}>{item.languages.join(', ')}</Text>
                )}
              </View>
              <TouchableOpacity
                style={[styles.connectBtn, sentRequests.has(item.id) && styles.connectBtnSent]}
                onPress={() => !sentRequests.has(item.id) && sendFriendRequest(item.id)}
                disabled={sentRequests.has(item.id)}
              >
                <Text style={styles.connectBtnText}>{sentRequests.has(item.id) ? 'Sent' : 'Connect'}</Text>
              </TouchableOpacity>
            </View>
          )}
          ListEmptyComponent={
            <Text style={styles.empty}>
              {tab === 'suggested' ? 'No suggestions in your area yet.' : 'No results found.'}
            </Text>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  tabs: { flexDirection: 'row', backgroundColor: COLORS.surface, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  tab: { flex: 1, paddingVertical: 14, alignItems: 'center' },
  tabActive: { borderBottomWidth: 2, borderBottomColor: COLORS.primary },
  tabText: { fontSize: 15, color: COLORS.textLight },
  tabTextActive: { color: COLORS.primary, fontWeight: '600' },
  searchRow: { flexDirection: 'row', padding: 16, gap: 8 },
  searchInput: {
    flex: 1, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border,
    borderRadius: 12, padding: 12, fontSize: 16, color: COLORS.text,
  },
  searchBtn: { backgroundColor: COLORS.primary, borderRadius: 12, paddingHorizontal: 18, justifyContent: 'center' },
  searchBtnText: { color: '#fff', fontWeight: '600' },
  list: { padding: 16, gap: 12 },
  card: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.surface, borderRadius: 16,
    padding: 14, borderWidth: 1, borderColor: COLORS.border,
  },
  avatar: { width: 52, height: 52, borderRadius: 26 },
  avatarPlaceholder: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: COLORS.primaryLight, justifyContent: 'center', alignItems: 'center',
  },
  avatarInitial: { fontSize: 20, fontWeight: '700', color: COLORS.primary },
  info: { flex: 1, marginLeft: 12 },
  name: { fontSize: 16, fontWeight: '600', color: COLORS.text },
  meta: { fontSize: 13, color: COLORS.textLight, marginTop: 2 },
  lang: { fontSize: 12, color: COLORS.secondary, marginTop: 2 },
  connectBtn: { backgroundColor: COLORS.primary, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8 },
  connectBtnSent: { backgroundColor: COLORS.border },
  connectBtnText: { color: '#fff', fontWeight: '600', fontSize: 13 },
  empty: { textAlign: 'center', color: COLORS.textLight, marginTop: 40, fontSize: 15 },
});
