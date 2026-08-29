import React, { useCallback, useMemo, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  TextInput, ActivityIndicator, Alert, Modal, ScrollView, Dimensions,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/AuthContext';
import { COLORS } from '../../constants';

const { height: SCREEN_H } = Dimensions.get('window');

const AVATAR_COLORS = ['#FF6B6B', '#845EF7', '#20C997', '#F59E0B', '#3B82F6', '#EC4899'];

const AGE_GROUPS = ['Under 10', '10–14', '15–18', '19–25', '26–35', '36+'];

function getAgeGroup(age: number): string {
  if (age < 10)  return 'Under 10';
  if (age <= 14) return '10–14';
  if (age <= 18) return '15–18';
  if (age <= 25) return '19–25';
  if (age <= 35) return '26–35';
  return '36+';
}

const SITUATION_TAGS = [
  'Non-verbal', 'Minimally verbal', 'AAC user',
  'First-year guardian', 'Experienced guardian',
  'Autism', 'Down syndrome', 'Cerebral palsy',
  'Works independently', 'Needs full support',
  'School-age', 'Transitioning to adult services',
];

function toggle<T>(arr: T[], val: T): T[] {
  return arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val];
}

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
  status: Status;
  connectionId: string | null;
}

// ── SheetSection ──────────────────────────────────────────────────────────────

interface SectionProps {
  id: string; emoji: string; title: string;
  options: string[]; selected: string[];
  onToggle: (val: string) => void;
  openId: string | null; setOpenId: (id: string | null) => void;
}

function SheetSection({ id, emoji, title, options, selected, onToggle, openId, setOpenId }: SectionProps) {
  const open = openId === id;
  return (
    <View style={s.sheetSec}>
      <TouchableOpacity style={s.sheetSecHdr} onPress={() => setOpenId(open ? null : id)} activeOpacity={0.7}>
        <Text style={s.sheetSecTitle}>{emoji}  {title}</Text>
        <View style={s.sheetSecRight}>
          {selected.length > 0 && (
            <View style={s.sheetSecBadge}><Text style={s.sheetSecBadgeTxt}>{selected.length}</Text></View>
          )}
          <Text style={s.sheetSecArr}>{open ? '▲' : '▼'}</Text>
        </View>
      </TouchableOpacity>
      {open && (
        <View>
          {options.map(opt => {
            const on = selected.includes(opt);
            return (
              <TouchableOpacity key={opt} style={s.optRow} onPress={() => onToggle(opt)} activeOpacity={0.7}>
                <Text style={[s.optTxt, on && s.optTxtOn]}>{opt}</Text>
                <View style={[s.optCheck, on && s.optCheckOn]}>
                  {on && <Text style={s.optCheckMark}>✓</Text>}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </View>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function GuardianConnectionsScreen() {
  const { guardian } = useAuth();

  const [results, setResults]     = useState<GuardianResult[]>([]);
  const [loading, setLoading]     = useState(true);
  const [sending, setSending]     = useState<string | null>(null);
  const [processing, setProcessing] = useState<string | null>(null);

  // Search
  const [searchName, setSearchName] = useState('');
  const [searchCity, setSearchCity] = useState('');

  // Applied filters
  const [filterAgeGroups, setFilterAgeGroups] = useState<string[]>([]);
  const [filterTags,      setFilterTags]      = useState<string[]>([]);

  // Draft filters (edited in sheet)
  const [draftAgeGroups, setDraftAgeGroups] = useState<string[]>([]);
  const [draftTags,      setDraftTags]      = useState<string[]>([]);

  const [sheetOpen, setSheetOpen] = useState(false);
  const [openSec,   setOpenSec]   = useState<string | null>('situation');

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

    const learnerMap: Record<string, any> = {};
    (learners ?? []).forEach((l: any) => { if (!learnerMap[l.guardian_id]) learnerMap[l.guardian_id] = l; });

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
        requester_id: guardian.id, addressee_id: item.guardianId, status: 'pending',
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

  function openSheet() {
    setDraftAgeGroups([...filterAgeGroups]);
    setDraftTags([...filterTags]);
    setOpenSec('situation');
    setSheetOpen(true);
  }

  function applySheet() {
    setFilterAgeGroups([...draftAgeGroups]);
    setFilterTags([...draftTags]);
    setSheetOpen(false);
  }

  function clearSheet() {
    setDraftAgeGroups([]);
    setDraftTags([]);
  }

  const totalActive = filterAgeGroups.length + filterTags.length;

  const filtered = useMemo(() => {
    return results.filter(r => {
      const matchName = !searchName || r.guardianName.toLowerCase().includes(searchName.toLowerCase());
      const matchCity = !searchCity || r.region.toLowerCase().includes(searchCity.toLowerCase());
      const matchAge  = filterAgeGroups.length === 0 || filterAgeGroups.includes(getAgeGroup(r.learnerAge));
      const matchTags = filterTags.length === 0 || filterTags.every(t => r.situationTags.includes(t));
      return matchName && matchCity && matchAge && matchTags;
    });
  }, [results, searchName, searchCity, filterAgeGroups, filterTags]);

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
          {item.situationTags.length > 0 && (
            <Text style={s.tags} numberOfLines={1}>{item.situationTags.join(' · ')}</Text>
          )}
        </View>
        <View style={s.actions}>
          {isProcessing || isSending ? (
            <ActivityIndicator color={COLORS.bloomAccent} />
          ) : item.status === 'accepted' ? (
            <View style={s.connectedBadge}><Text style={s.connectedText}>✓ Connected</Text></View>
          ) : item.status === 'pending_sent' ? (
            <View style={s.pendingBadge}><Text style={s.pendingText}>Pending</Text></View>
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
      {/* Search row */}
      <View style={s.searchRow}>
        <TextInput
          style={s.searchInput}
          value={searchName}
          onChangeText={setSearchName}
          placeholder="Guardian name…"
          placeholderTextColor={COLORS.bloomMuted}
          clearButtonMode="while-editing"
        />
        <TextInput
          style={s.searchInput}
          value={searchCity}
          onChangeText={setSearchCity}
          placeholder="Guardian city or region…"
          placeholderTextColor={COLORS.bloomMuted}
          clearButtonMode="while-editing"
        />
      </View>

      {/* Filter button */}
      <View style={s.filterRow}>
        <TouchableOpacity style={[s.filterBtn, totalActive > 0 && s.filterBtnActive]} onPress={openSheet} activeOpacity={0.8}>
          <Text style={[s.filterBtnTxt, totalActive > 0 && s.filterBtnTxtActive]}>
            {totalActive > 0 ? `Filters  ·  ${totalActive}` : 'Filters'}
          </Text>
          <Text style={[s.filterBtnIcon, totalActive > 0 && s.filterBtnTxtActive]}>⊟</Text>
        </TouchableOpacity>
        <Text style={s.resultCount}>{filtered.length} result{filtered.length !== 1 ? 's' : ''}</Text>
      </View>

      {/* Results list */}
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

      {/* Filter sheet */}
      <Modal visible={sheetOpen} transparent animationType="slide" onRequestClose={() => setSheetOpen(false)}>
        <TouchableOpacity style={s.sheetBackdrop} activeOpacity={1} onPress={() => setSheetOpen(false)}>
          <View style={s.sheet} onStartShouldSetResponder={() => true}>
            {/* Sheet header */}
            <View style={s.sheetHdr}>
              <TouchableOpacity onPress={clearSheet} activeOpacity={0.7}>
                <Text style={s.sheetClear}>Clear all</Text>
              </TouchableOpacity>
              <Text style={s.sheetTitle}>Filters</Text>
              <TouchableOpacity onPress={() => setSheetOpen(false)} activeOpacity={0.7}>
                <Text style={s.sheetClose}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={s.sheetBody} showsVerticalScrollIndicator={false}>
              <SheetSection
                id="situation" emoji="🎯" title="Situation"
                options={SITUATION_TAGS} selected={draftTags}
                onToggle={v => setDraftTags(t => toggle(t, v))}
                openId={openSec} setOpenId={setOpenSec}
              />
              <SheetSection
                id="age" emoji="👤" title="Learner age"
                options={AGE_GROUPS} selected={draftAgeGroups}
                onToggle={v => setDraftAgeGroups(g => toggle(g, v))}
                openId={openSec} setOpenId={setOpenSec}
              />
            </ScrollView>

            <TouchableOpacity style={s.sheetApply} onPress={applySheet} activeOpacity={0.85}>
              <Text style={s.sheetApplyTxt}>Show results</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bloomBody },
  center:    { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 40 },

  searchRow:   { padding: 14, gap: 8 },
  searchInput: {
    backgroundColor: COLORS.bloomCard, borderRadius: 14, borderWidth: 1.5,
    borderColor: COLORS.bloomBorder, paddingHorizontal: 16, paddingVertical: 13,
    fontSize: 15, fontWeight: '500', color: COLORS.bloomText,
  },

  filterRow:       { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingBottom: 10, gap: 10 },
  filterBtn:       { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: COLORS.bloomCard, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1.5, borderColor: COLORS.bloomBorder },
  filterBtnActive: { backgroundColor: COLORS.bloomNavy, borderColor: COLORS.bloomNavy },
  filterBtnTxt:    { fontSize: 13, fontWeight: '700', color: COLORS.bloomMuted },
  filterBtnTxtActive: { color: '#fff' },
  filterBtnIcon:   { fontSize: 16, color: COLORS.bloomMuted },
  resultCount:     { fontSize: 13, color: COLORS.bloomMuted, fontWeight: '600' },

  list: { padding: 14, gap: 10, paddingBottom: 40 },

  card: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: COLORS.bloomCard, borderRadius: 18, padding: 14,
    borderWidth: 1, borderColor: COLORS.bloomBorder,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },
  avatar:        { width: 52, height: 52, borderRadius: 26, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  avatarInitial: { fontSize: 20, fontWeight: '800', color: '#fff' },
  info:          { flex: 1, minWidth: 0, gap: 3 },
  guardianName:  { fontSize: 15, fontWeight: '800', color: COLORS.bloomText },
  meta:          { fontSize: 12, color: COLORS.bloomMuted },
  tags:          { fontSize: 11, color: COLORS.bloomMuted, marginTop: 1 },
  actions:       { alignItems: 'center', gap: 6 },

  connectBtn:     { backgroundColor: COLORS.bloomNavy, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 7 },
  connectText:    { color: '#fff', fontWeight: '700', fontSize: 13 },
  connectedBadge: { backgroundColor: '#D4F0DE', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6 },
  connectedText:  { fontSize: 12, fontWeight: '700', color: '#065F46' },
  pendingBadge:   { backgroundColor: COLORS.bloomBorder, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6 },
  pendingText:    { fontSize: 12, fontWeight: '600', color: COLORS.bloomMuted },
  acceptBtn:      { backgroundColor: COLORS.bloomNavy, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6 },
  acceptText:     { color: '#fff', fontWeight: '700', fontSize: 12 },
  declineBtn:     { backgroundColor: COLORS.bloomBorder, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6 },
  declineText:    { color: COLORS.bloomMuted, fontWeight: '700', fontSize: 12 },

  empty:      { alignItems: 'center', paddingTop: 60, gap: 12 },
  emptyEmoji: { fontSize: 56 },
  emptyText:  { fontSize: 20, fontWeight: '800', color: COLORS.bloomText },
  emptyHint:  { fontSize: 14, color: COLORS.bloomMuted },

  // Filter sheet
  sheetBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: COLORS.bloomCard, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    maxHeight: SCREEN_H * 0.75,
  },
  sheetHdr: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 16,
    borderBottomWidth: 1, borderBottomColor: COLORS.bloomBorder,
  },
  sheetTitle: { fontSize: 16, fontWeight: '800', color: COLORS.bloomText },
  sheetClear: { fontSize: 14, fontWeight: '600', color: COLORS.bloomAccent },
  sheetClose: { fontSize: 18, color: COLORS.bloomMuted },
  sheetBody:  { paddingHorizontal: 16 },

  sheetSec:    { borderBottomWidth: 1, borderBottomColor: COLORS.bloomBorder, paddingVertical: 4 },
  sheetSecHdr: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14 },
  sheetSecTitle: { fontSize: 15, fontWeight: '700', color: COLORS.bloomText },
  sheetSecRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sheetSecBadge: { backgroundColor: COLORS.bloomNavy, borderRadius: 10, paddingHorizontal: 7, paddingVertical: 2 },
  sheetSecBadgeTxt: { fontSize: 11, fontWeight: '800', color: '#fff' },
  sheetSecArr: { fontSize: 11, color: COLORS.bloomMuted },

  optRow:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 11 },
  optTxt:   { fontSize: 14, color: COLORS.bloomMuted, flex: 1 },
  optTxtOn: { color: COLORS.bloomText, fontWeight: '700' },
  optCheck: {
    width: 22, height: 22, borderRadius: 6,
    borderWidth: 2, borderColor: COLORS.bloomBorder,
    justifyContent: 'center', alignItems: 'center',
  },
  optCheckOn:   { backgroundColor: COLORS.bloomNavy, borderColor: COLORS.bloomNavy },
  optCheckMark: { fontSize: 12, color: '#fff', fontWeight: '900' },

  sheetApply: {
    margin: 16, backgroundColor: COLORS.bloomNavy,
    borderRadius: 14, paddingVertical: 15, alignItems: 'center',
  },
  sheetApplyTxt: { fontSize: 16, fontWeight: '800', color: '#fff' },
});
