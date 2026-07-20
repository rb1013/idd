import React, { useCallback, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  TextInput, Image, ActivityIndicator, Alert,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/AuthContext';
import { COLORS, COMPREHENSION_LEVELS, US_STATES } from '../../constants';
import { GuardianNavParamList } from '../../navigation';

type Nav = NativeStackNavigationProp<GuardianNavParamList>;

const AVATAR_COLORS = ['#FF6B6B', '#845EF7', '#20C997', '#F59E0B', '#3B82F6', '#EC4899'];

const AGE_RANGES = [
  { label: 'All Ages', min: 0,  max: 999 },
  { label: '5–12',    min: 5,  max: 12  },
  { label: '13–17',   min: 13, max: 17  },
  { label: '18–25',   min: 18, max: 25  },
  { label: '26–35',   min: 26, max: 35  },
  { label: '36+',     min: 36, max: 999 },
];

interface LearnerResult {
  id: string;
  name: string;
  age: number;
  photo_url: string | null;
  city: string;
  region: string;
  comprehension_level: string | null;
  likes: string[];
  connectionStatus: 'none' | 'pending_sent' | 'pending_received' | 'accepted';
}

export default function LearnerDiscoveryScreen() {
  const navigation = useNavigation<Nav>();
  const { guardian } = useAuth();

  const [learners, setLearners] = useState<LearnerResult[]>([]);
  const [myLearnerIds, setMyLearnerIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterState, setFilterState] = useState('');
  const [filterAge, setFilterAge] = useState(0); // index into AGE_RANGES
  const [filterLevel, setFilterLevel] = useState('');
  const [sending, setSending] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (guardian) load(guardian.id);
    }, [guardian]),
  );

  async function load(guardianId: string) {
    setLoading(true);

    // Get my learners' IDs so we can exclude them and check friendship status
    const { data: mine } = await supabase
      .from('user_profiles')
      .select('id')
      .eq('guardian_id', guardianId);
    const myIds = (mine ?? []).map((r: any) => r.id);
    setMyLearnerIds(myIds);

    // Fetch all other learners
    const { data: profiles } = await supabase
      .from('user_profiles')
      .select('id, name, age, photo_url, city, region, auth_user_id')
      .neq('guardian_id', guardianId)
      .order('name');

    if (!profiles) { setLoading(false); return; }

    const otherIds = profiles.map((p: any) => p.id);

    // Fetch chat preferences (for comprehension level)
    const { data: chatPrefs } = otherIds.length > 0
      ? await supabase.from('chat_preferences').select('user_id, comprehension_level').in('user_id', otherIds)
      : { data: [] };

    // Fetch likes
    const { data: likesData } = otherIds.length > 0
      ? await supabase.from('user_likes').select('user_id, categories(name)').in('user_id', otherIds)
      : { data: [] };

    // Fetch existing friendships involving my learners
    const { data: friendships } = myIds.length > 0
      ? await supabase
          .from('friendships')
          .select('requester_id, addressee_id, status')
          .or(
            myIds.map((id: string) => `requester_id.eq.${id},addressee_id.eq.${id}`).join(',')
          )
      : { data: [] };

    // Build lookup maps
    const levelMap: Record<string, string> = {};
    (chatPrefs ?? []).forEach((c: any) => { levelMap[c.user_id] = c.comprehension_level; });

    const likesMap: Record<string, string[]> = {};
    (likesData ?? []).forEach((r: any) => {
      if (!likesMap[r.user_id]) likesMap[r.user_id] = [];
      if (r.categories?.name) likesMap[r.user_id].push(r.categories.name);
    });

    // Determine connection status for each other learner vs any of my learners
    function getStatus(otherId: string): LearnerResult['connectionStatus'] {
      const f = (friendships ?? []).find((fr: any) =>
        (myIds.includes(fr.requester_id) && fr.addressee_id === otherId) ||
        (myIds.includes(fr.addressee_id) && fr.requester_id === otherId)
      );
      if (!f) return 'none';
      if (f.status === 'accepted') return 'accepted';
      const iSent = myIds.includes(f.requester_id);
      return iSent ? 'pending_sent' : 'pending_received';
    }

    const results: LearnerResult[] = profiles.map((p: any) => ({
      id: p.id,
      name: p.name,
      age: p.age,
      photo_url: p.photo_url,
      city: p.city,
      region: p.region,
      comprehension_level: levelMap[p.id] ?? null,
      likes: (likesMap[p.id] ?? []).slice(0, 3),
      connectionStatus: getStatus(p.id),
    }));

    setLearners(results);
    setLoading(false);
  }

  async function sendRequest(learner: LearnerResult) {
    if (!guardian || myLearnerIds.length === 0) {
      Alert.alert('No learners', 'You need to add a learner before connecting with others.');
      return;
    }

    // If guardian has multiple learners, for simplicity pick the first one
    // (future: show a picker)
    const myLearnerId = myLearnerIds[0];

    setSending(learner.id);
    try {
      // Insert pending friendship
      const { error: friendErr } = await supabase.from('friendships').insert({
        requester_id: myLearnerId,
        addressee_id: learner.id,
        status: 'pending',
        requested_by_guardian_id: guardian.id,
      });
      if (friendErr) throw new Error(friendErr.message);

      // Look up addressee's guardian to notify
      const { data: addresseeProfile } = await supabase
        .from('user_profiles')
        .select('guardian_id')
        .eq('id', learner.id)
        .single();

      if (addresseeProfile?.guardian_id) {
        await supabase.from('notifications').insert({
          guardian_id: addresseeProfile.guardian_id,
          user_id: learner.id,
          type: 'friend_request',
          message: `${guardian.full_name} wants to connect their learner with ${learner.name}.`,
        });
      }

      // Update local state
      setLearners(prev =>
        prev.map(l => l.id === learner.id ? { ...l, connectionStatus: 'pending_sent' } : l)
      );
      Alert.alert('Request sent!', `A friend request has been sent to ${learner.name}'s guardian.`);
    } catch (err: any) {
      Alert.alert('Error', err.message ?? 'Something went wrong.');
    }
    setSending(null);
  }

  const ageRange = AGE_RANGES[filterAge];

  const filtered = learners.filter(l => {
    const q = search.toLowerCase();
    const matchSearch = !q || l.name.toLowerCase().includes(q) || l.city.toLowerCase().includes(q);
    const matchState = !filterState || l.region === filterState;
    const matchAge = l.age >= ageRange.min && l.age <= ageRange.max;
    const matchLevel = !filterLevel || l.comprehension_level === filterLevel;
    return matchSearch && matchState && matchAge && matchLevel;
  });

  return (
    <View style={s.container}>
      {/* Search */}
      <View style={s.searchRow}>
        <TextInput
          style={s.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Search by name or city…"
          placeholderTextColor={COLORS.bloomMuted}
          clearButtonMode="while-editing"
        />
      </View>

      {/* Filter row 1 — age range */}
      <FlatList
        horizontal
        data={AGE_RANGES}
        keyExtractor={r => r.label}
        style={s.filterBar}
        contentContainerStyle={s.filterBarContent}
        showsHorizontalScrollIndicator={false}
        renderItem={({ item, index }) => {
          const active = filterAge === index;
          return (
            <TouchableOpacity
              style={[s.chip, active && s.chipActive]}
              onPress={() => setFilterAge(index)}
            >
              <Text style={[s.chipText, active && s.chipTextActive]}>{item.label}</Text>
            </TouchableOpacity>
          );
        }}
      />

      {/* Filter row 2 — comprehension level */}
      <FlatList
        horizontal
        data={[{ label: 'All Levels', value: '' }, ...COMPREHENSION_LEVELS.map(c => ({ label: c.label, value: c.value }))]}
        keyExtractor={r => r.value}
        style={s.filterBar}
        contentContainerStyle={s.filterBarContent}
        showsHorizontalScrollIndicator={false}
        renderItem={({ item }) => {
          const active = filterLevel === item.value;
          return (
            <TouchableOpacity
              style={[s.chip, active && s.chipActive]}
              onPress={() => setFilterLevel(item.value)}
            >
              <Text style={[s.chipText, active && s.chipTextActive]}>{item.label}</Text>
            </TouchableOpacity>
          );
        }}
      />

      {loading ? (
        <View style={s.center}><ActivityIndicator size="large" color={COLORS.bloomAccent} /></View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={l => l.id}
          contentContainerStyle={s.list}
          renderItem={({ item: l, index }) => {
            const color = AVATAR_COLORS[index % AVATAR_COLORS.length];
            const isSending = sending === l.id;
            return (
              <TouchableOpacity
                style={s.card}
                onPress={() => navigation.navigate('LearnerPublicProfile', { learnerId: l.id })}
                activeOpacity={0.85}
              >
                {/* Avatar */}
                {l.photo_url ? (
                  <Image source={{ uri: l.photo_url }} style={s.avatar} />
                ) : (
                  <View style={[s.avatar, { backgroundColor: color }]}>
                    <Text style={s.avatarInitial}>{l.name[0]?.toUpperCase()}</Text>
                  </View>
                )}

                {/* Info */}
                <View style={s.info}>
                  <Text style={s.name}>{l.name}</Text>
                  <Text style={s.meta}>
                    {l.age} yrs · {l.city}, {l.region}
                    {l.comprehension_level ? ` · ${l.comprehension_level}` : ''}
                  </Text>
                  {l.likes.length > 0 && (
                    <Text style={s.likes} numberOfLines={1}>
                      Likes: {l.likes.join(', ')}
                    </Text>
                  )}
                </View>

                {/* Action */}
                {l.connectionStatus === 'accepted' && (
                  <View style={s.statusBadge}>
                    <Text style={s.statusBadgeText}>✓ Friends</Text>
                  </View>
                )}
                {l.connectionStatus === 'pending_sent' && (
                  <View style={[s.statusBadge, s.statusBadgePending]}>
                    <Text style={[s.statusBadgeText, { color: COLORS.bloomMuted }]}>Pending</Text>
                  </View>
                )}
                {l.connectionStatus === 'pending_received' && (
                  <TouchableOpacity
                    style={s.connectBtn}
                    onPress={() => navigation.navigate('LearnerFriendRequests')}
                  >
                    <Text style={s.connectBtnText}>Respond</Text>
                  </TouchableOpacity>
                )}
                {l.connectionStatus === 'none' && (
                  <TouchableOpacity
                    style={[s.connectBtn, isSending && { opacity: 0.6 }]}
                    onPress={() => sendRequest(l)}
                    disabled={isSending}
                  >
                    {isSending
                      ? <ActivityIndicator size="small" color="#fff" />
                      : <Text style={s.connectBtnText}>Connect</Text>
                    }
                  </TouchableOpacity>
                )}
              </TouchableOpacity>
            );
          }}
          ListEmptyComponent={
            <View style={s.empty}>
              <Text style={s.emptyEmoji}>🔍</Text>
              <Text style={s.emptyText}>No learners found</Text>
              <Text style={s.emptyHint}>Try adjusting your filters</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bloomBody },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 60 },

  searchRow: { padding: 14, paddingBottom: 6 },
  searchInput: {
    backgroundColor: COLORS.bloomCard, borderRadius: 14, borderWidth: 1.5,
    borderColor: COLORS.bloomBorder, paddingHorizontal: 16, paddingVertical: 13,
    fontSize: 15, fontWeight: '500', color: COLORS.bloomText,
  },

  filterBar: { maxHeight: 44 },
  filterBarContent: { paddingHorizontal: 14, paddingVertical: 6, gap: 8 },
  chip: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 18,
    backgroundColor: COLORS.bloomCard, borderWidth: 1.5, borderColor: COLORS.bloomBorder,
  },
  chipActive: { backgroundColor: COLORS.bloomNavy, borderColor: COLORS.bloomNavy },
  chipText: { fontSize: 13, fontWeight: '600', color: COLORS.bloomMuted },
  chipTextActive: { color: '#fff', fontWeight: '700' },

  list: { padding: 14, gap: 12 },

  card: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: COLORS.bloomCard, borderRadius: 18, padding: 14,
    borderWidth: 1, borderColor: COLORS.bloomBorder,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },
  avatar: { width: 56, height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  avatarInitial: { fontSize: 22, fontWeight: '800', color: '#fff' },
  info: { flex: 1, minWidth: 0, gap: 3 },
  name: { fontSize: 16, fontWeight: '800', color: COLORS.bloomText },
  meta: { fontSize: 12, color: COLORS.bloomMuted, fontWeight: '500' },
  likes: { fontSize: 12, color: COLORS.bloomAccent, fontWeight: '600' },

  connectBtn: {
    backgroundColor: COLORS.bloomNavy, borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 8, minWidth: 80, alignItems: 'center',
  },
  connectBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },

  statusBadge: {
    backgroundColor: '#D4F0DE', borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 7, minWidth: 80, alignItems: 'center',
  },
  statusBadgePending: { backgroundColor: COLORS.bloomBorder },
  statusBadgeText: { fontSize: 12, fontWeight: '700', color: '#065F46' },

  empty: { alignItems: 'center', paddingTop: 80, gap: 12 },
  emptyEmoji: { fontSize: 56 },
  emptyText: { fontSize: 20, fontWeight: '800', color: COLORS.bloomText },
  emptyHint: { fontSize: 14, color: COLORS.bloomMuted },
});
