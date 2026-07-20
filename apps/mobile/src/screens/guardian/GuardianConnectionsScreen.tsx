import React, { useCallback, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  TextInput, ActivityIndicator, Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/AuthContext';
import { COLORS, COMPREHENSION_LEVELS } from '../../constants';

const AVATAR_COLORS = ['#FF6B6B', '#845EF7', '#20C997', '#F59E0B', '#3B82F6', '#EC4899'];

const AGE_RANGES = [
  { label: 'All Ages', min: 0,   max: 999 },
  { label: '5–12',     min: 5,   max: 12  },
  { label: '13–17',    min: 13,  max: 17  },
  { label: '18–25',    min: 18,  max: 25  },
  { label: '26–35',    min: 26,  max: 35  },
  { label: '36+',      min: 36,  max: 999 },
];

const SITUATION_TAGS = [
  'Non-verbal', 'Minimally verbal', 'AAC user',
  'First-year guardian', 'Experienced guardian',
  'Autism', 'Down syndrome', 'Cerebral palsy',
  'Works independently', 'Needs full support',
  'School-age', 'Transitioning to adult services',
];

type Status = 'none' | 'pending_sent' | 'pending_received' | 'accepted';

interface GuardianResult {
  guardianId: string;
  guardianName: string;
  guardianEmail: string;
  region: string;
  situationTags: string[];
  learnerName: string;
  learnerRegion: string;
  learnerAge: number;
  comprehensionLevel: string | null;
  status: Status;
  connectionId: string | null;
}

export default function GuardianConnectionsScreen() {
  const { guardian } = useAuth();

  const [results, setResults]           = useState<GuardianResult[]>([]);
  const [loading, setLoading]           = useState(true);
  const [search, setSearch]             = useState('');
  const [filterAge, setFilterAge]       = useState(0);
  const [filterLevel, setFilterLevel]   = useState('');
  const [filterTags, setFilterTags]     = useState<string[]>([]);
  const [filterRegion, setFilterRegion] = useState('');
  const [sending, setSending]           = useState<string | null>(null);
  const [processing, setProcessing]     = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (guardian) load(guardian.id);
    }, [guardian]),
  );

  async function load(myId: string) {
    setLoading(true);

    const { data: guardians } = await supabase
      .from('guardians')
      .select('id, full_name, email, region, situation_tags')
      .neq('id', myId);

    if (!guardians || guardians.length === 0) { setLoading(false); return; }

    const otherIds = guardians.map((g: any) => g.id);

    const [{ data: learners }, { data: connections }] = await Promise.all([
      supabase
        .from('user_profiles')
        .select('id, name, age, region, guardian_id')
        .in('guardian_id', otherIds),
      supabase
        .from('guardian_connections')
        .select('id, requester_id, addressee_id, status')
        .or(`requester_id.eq.${myId},addressee_id.eq.${myId}`),
    ]);

    const learnerIds = (learners ?? []).map((l: any) => l.id);
    const { data: chatPrefs } = learnerIds.length > 0
      ? await supabase.from('chat_preferences').select('user_id, comprehension_level').in('user_id', learnerIds)
      : { data: [] };

    const learnerMap: Record<string, any>  = {};
    (learners ?? []).forEach((l: any) => { if (!learnerMap[l.guardian_id]) learnerMap[l.guardian_id] = l; });

    const levelMap: Record<string, string> = {};
    (chatPrefs ?? []).forEach((c: any) => { levelMap[c.user_id] = c.comprehension_level; });

    function getStatus(otherId: string): { status: Status; connectionId: string | null } {
      const c = (connections ?? []).find((r: any) =>
        (r.requester_id === myId && r.addressee_id === otherId) ||
        (r.addressee_id === myId && r.requester_id === otherId)
      );
      if (!c) return { status: 'none', connectionId: null };
      if (c.status === 'accepted') return { status: 'accepted', connectionId: c.id };
      return { status: c.requester_id === myId ? 'pending_sent' : 'pending_received', connectionId: c.id };
    }

    const list: GuardianResult[] = guardians.map((g: any) => {
      const l = learnerMap[g.id];
      const { status, connectionId } = getStatus(g.id);
      return {
        guardianId: g.id,
        guardianName: g.full_name ?? 'Unknown',
        guardianEmail: g.email ?? '',
        region: g.region ?? '',
        situationTags: g.situation_tags ?? [],
        learnerName: l?.name ?? '',
        learnerRegion: l?.region ?? '',
        learnerAge: l?.age ?? 0,
        comprehensionLevel: l ? (levelMap[l.id] ?? null) : null,
        status,
        connectionId,
      };
    });

    setResults(list);
    setLoading(false);
  }

  async function sendRequest(item: GuardianResult) {
    if (!guardian) return;
    setSending(item.guardianId);
    try {
      const { error } = await supabase.from('guardian_connections').insert({
        requester_id: guardian.id,
        addressee_id: item.guardianId,
        status: 'pending',
      });
      if (error) throw new Error(error.message);
      setResults(prev => prev.map(r =>
        r.guardianId === item.guardianId ? { ...r, status: 'pending_sent' } : r
      ));
      Alert.alert('Request sent!', `A connection request has been sent to ${item.guardianName}.`);
    } catch (err: any) {
      Alert.alert('Error', err.message ?? 'Something went wrong.');
    }
    setSending(null);
  }

  async function accept(item: GuardianResult) {
    if (!item.connectionId) return;
    setProcessing(item.guardianId);
    await supabase.from('guardian_connections').update({ status: 'accepted' }).eq('id', item.connectionId);
    setResults(prev => prev.map(r =>
      r.guardianId === item.guardianId ? { ...r, status: 'accepted' } : r
    ));
    setProcessing(null);
    Alert.alert('Connected!', `You are now connected with ${item.guardianName}.`);
  }

  async function decline(item: GuardianResult) {
    if (!item.connectionId) return;
    Alert.alert('Decline', `Decline connection request from ${item.guardianName}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Decline', style: 'destructive', onPress: async () => {
          setProcessing(item.guardianId);
          await supabase.from('guardian_connections').delete().eq('id', item.connectionId!);
          setResults(prev => prev.map(r =>
            r.guardianId === item.guardianId ? { ...r, status: 'none', connectionId: null } : r
          ));
          setProcessing(null);
        },
      },
    ]);
  }

  function toggleTag(tag: string) {
    setFilterTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  }

  // Unique learner regions from data (for location filter)
  const regions = ['All', ...Array.from(new Set(results.map(r => r.learnerRegion).filter(Boolean))).sort()];

  const ageRange = AGE_RANGES[filterAge];

  const filtered = results.filter(r => {
    const q = search.toLowerCase();
    const matchSearch  = !q || r.guardianName.toLowerCase().includes(q) || r.learnerRegion.toLowerCase().includes(q);
    const matchRegion  = !filterRegion || r.learnerRegion === filterRegion;
    const matchAge     = r.learnerAge === 0 || (r.learnerAge >= ageRange.min && r.learnerAge <= ageRange.max);
    const matchLevel   = !filterLevel || r.comprehensionLevel === filterLevel;
    const matchTags    = filterTags.length === 0 || filterTags.every(t => r.situationTags.includes(t));
    return matchSearch && matchRegion && matchAge && matchLevel && matchTags;
  });

  function renderCard(item: GuardianResult) {
    const color = AVATAR_COLORS[item.guardianName.charCodeAt(0) % AVATAR_COLORS.length];
    const isProcessing = processing === item.guardianId;
    const isSending    = sending === item.guardianId;

    return (
      <View key={item.guardianId} style={s.card}>
        <View style={[s.avatar, { backgroundColor: color }]}>
          <Text style={s.avatarInitial}>{item.guardianName[0]?.toUpperCase()}</Text>
        </View>

        <View style={s.info}>
          <Text style={s.guardianName}>{item.guardianName}</Text>
          <Text style={s.meta}>
            {item.learnerName ? `${item.learnerName}, ${item.learnerAge} yrs` : ''}
            {item.learnerRegion ? `  ·  ${item.learnerRegion}` : ''}
          </Text>
          {item.comprehensionLevel && (
            <View style={s.levelRow}>
              <Text style={s.levelBadge}>{item.comprehensionLevel}</Text>
            </View>
          )}
          {item.situationTags.length > 0 && (
            <Text style={s.tags} numberOfLines={1}>
              {item.situationTags.join(' · ')}
            </Text>
          )}
        </View>

        <View style={s.actions}>
          {isProcessing || isSending ? (
            <ActivityIndicator color={COLORS.bloomAccent} />
          ) : item.status === 'accepted' ? (
            <View style={s.connectedBadge}>
              <Text style={s.connectedText}>✓ Connected</Text>
            </View>
          ) : item.status === 'pending_sent' ? (
            <View style={s.pendingBadge}>
              <Text style={s.pendingText}>Pending</Text>
            </View>
          ) : item.status === 'pending_received' ? (
            <>
              <TouchableOpacity style={s.acceptBtn} onPress={() => accept(item)}>
                <Text style={s.acceptText}>✓ Accept</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.declineBtn} onPress={() => decline(item)}>
                <Text style={s.declineText}>✕</Text>
              </TouchableOpacity>
            </>
          ) : (
            <TouchableOpacity style={s.connectBtn} onPress={() => sendRequest(item)}>
              <Text style={s.connectText}>Connect</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  }

  return (
    <View style={s.container}>
      {/* Search */}
      <View style={s.searchRow}>
        <TextInput
          style={s.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Search by name or location…"
          placeholderTextColor={COLORS.bloomMuted}
          clearButtonMode="while-editing"
        />
      </View>

      {/* Filter: Location */}
      <View style={s.filterLabel}><Text style={s.filterLabelText}>📍 Location</Text></View>
      <FlatList
        horizontal
        data={regions}
        keyExtractor={r => r}
        style={s.filterBar}
        contentContainerStyle={s.filterBarContent}
        showsHorizontalScrollIndicator={false}
        renderItem={({ item }) => {
          const active = item === 'All' ? !filterRegion : filterRegion === item;
          return (
            <TouchableOpacity
              style={[s.chip, active && s.chipActive]}
              onPress={() => setFilterRegion(item === 'All' ? '' : item)}
            >
              <Text style={[s.chipText, active && s.chipTextActive]}>{item}</Text>
            </TouchableOpacity>
          );
        }}
      />

      {/* Filter: Situation */}
      <View style={s.filterLabel}><Text style={s.filterLabelText}>🎯 Situation</Text></View>
      <FlatList
        horizontal
        data={SITUATION_TAGS}
        keyExtractor={t => t}
        style={s.filterBar}
        contentContainerStyle={s.filterBarContent}
        showsHorizontalScrollIndicator={false}
        renderItem={({ item }) => {
          const active = filterTags.includes(item);
          return (
            <TouchableOpacity
              style={[s.chip, active && s.chipActive]}
              onPress={() => toggleTag(item)}
            >
              <Text style={[s.chipText, active && s.chipTextActive]}>{item}</Text>
            </TouchableOpacity>
          );
        }}
      />

      {/* Filter: Learner age */}
      <View style={s.filterLabel}><Text style={s.filterLabelText}>👤 Learner age</Text></View>
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

      {/* Filter: Comprehension level */}
      <View style={s.filterLabel}><Text style={s.filterLabelText}>📚 Level</Text></View>
      <FlatList
        horizontal
        data={[{ label: 'All', value: '' }, ...COMPREHENSION_LEVELS.map(c => ({ label: c.label, value: c.value }))]}
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

      {/* Results */}
      {loading ? (
        <View style={s.center}><ActivityIndicator size="large" color={COLORS.bloomAccent} /></View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={r => r.guardianId}
          contentContainerStyle={s.list}
          renderItem={({ item }) => renderCard(item)}
          ListEmptyComponent={
            <View style={s.empty}>
              <Text style={s.emptyEmoji}>🔍</Text>
              <Text style={s.emptyText}>No guardians found</Text>
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
  center:    { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 40 },

  searchRow:   { padding: 14, paddingBottom: 4 },
  searchInput: {
    backgroundColor: COLORS.bloomCard, borderRadius: 14, borderWidth: 1.5,
    borderColor: COLORS.bloomBorder, paddingHorizontal: 16, paddingVertical: 13,
    fontSize: 15, fontWeight: '500', color: COLORS.bloomText,
  },

  filterLabel:     { paddingHorizontal: 14, paddingTop: 8, paddingBottom: 2 },
  filterLabelText: { fontSize: 11, fontWeight: '700', color: COLORS.bloomMuted, letterSpacing: 0.5 },

  filterBar:        { maxHeight: 40 },
  filterBarContent: { paddingHorizontal: 14, paddingVertical: 4, gap: 8 },
  chip: {
    paddingHorizontal: 14, paddingVertical: 6, borderRadius: 18,
    backgroundColor: COLORS.bloomCard, borderWidth: 1.5, borderColor: COLORS.bloomBorder,
  },
  chipActive:     { backgroundColor: COLORS.bloomNavy, borderColor: COLORS.bloomNavy },
  chipText:       { fontSize: 13, fontWeight: '600', color: COLORS.bloomMuted },
  chipTextActive: { color: '#fff', fontWeight: '700' },

  list: { padding: 14, gap: 10, paddingBottom: 40 },

  card: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: COLORS.bloomCard, borderRadius: 18, padding: 14,
    borderWidth: 1, borderColor: COLORS.bloomBorder,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },
  avatar:       { width: 52, height: 52, borderRadius: 26, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  avatarInitial: { fontSize: 20, fontWeight: '800', color: '#fff' },

  info:         { flex: 1, minWidth: 0, gap: 3 },
  guardianName: { fontSize: 15, fontWeight: '800', color: COLORS.bloomText },
  meta:         { fontSize: 12, color: COLORS.bloomMuted },
  levelRow:     { flexDirection: 'row' },
  levelBadge:   {
    fontSize: 11, fontWeight: '700', color: COLORS.bloomAccent,
    backgroundColor: '#DAEAFF', borderRadius: 20,
    paddingHorizontal: 8, paddingVertical: 2, textTransform: 'capitalize',
  },
  tags: { fontSize: 11, color: COLORS.bloomMuted, marginTop: 1 },

  actions: { alignItems: 'center', gap: 6 },

  connectBtn:   { backgroundColor: COLORS.bloomNavy, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 7 },
  connectText:  { color: '#fff', fontWeight: '700', fontSize: 13 },

  connectedBadge: { backgroundColor: '#D4F0DE', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6 },
  connectedText:  { fontSize: 12, fontWeight: '700', color: '#065F46' },

  pendingBadge: { backgroundColor: COLORS.bloomBorder, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6 },
  pendingText:  { fontSize: 12, fontWeight: '600', color: COLORS.bloomMuted },

  acceptBtn:  { backgroundColor: COLORS.bloomNavy, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6 },
  acceptText: { color: '#fff', fontWeight: '700', fontSize: 12 },
  declineBtn: { backgroundColor: COLORS.bloomBorder, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6 },
  declineText: { color: COLORS.bloomMuted, fontWeight: '700', fontSize: 12 },

  empty:      { alignItems: 'center', paddingTop: 60, gap: 12 },
  emptyEmoji: { fontSize: 56 },
  emptyText:  { fontSize: 20, fontWeight: '800', color: COLORS.bloomText },
  emptyHint:  { fontSize: 14, color: COLORS.bloomMuted },
});
