import React, { useCallback, useMemo, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  TextInput, Image, ActivityIndicator, Alert, Modal,
  ScrollView, Dimensions, Platform,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/AuthContext';
import { COLORS, COMPREHENSION_LEVELS } from '../../constants';
import { GuardianNavParamList } from '../../navigation';

type Nav = NativeStackNavigationProp<GuardianNavParamList>;

const { width, height: SCREEN_H } = Dimensions.get('window');

const AVATAR_COLORS = ['#FF6B6B', '#845EF7', '#20C997', '#F59E0B', '#3B82F6', '#EC4899'];
const AGE_GROUPS   = ['Under 10', '10–14', '15–18', '19–25', '26–35', '36+'];

function getAgeGroup(age: number): string {
  if (age < 10)  return 'Under 10';
  if (age <= 14) return '10–14';
  if (age <= 18) return '15–18';
  if (age <= 25) return '19–25';
  if (age <= 35) return '26–35';
  return '36+';
}

function toggle<T>(arr: T[], val: T): T[] {
  return arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val];
}

interface LearnerResult {
  id: string;
  name: string;
  age: number;
  photo_url: string | null;
  city: string;
  region: string;
  comprehension_level: string | null;
  likes:             string[];
  dislikes:          string[];
  abilities:         string[];
  medicalConditions: string[];
  connectionStatus: 'none' | 'pending_sent' | 'pending_received' | 'accepted';
}

// ── SheetSection ─────────────────────────────────────────────────────────────

interface SectionProps {
  id: string;
  emoji: string;
  title: string;
  options: string[];
  selected: string[];
  onToggle: (val: string) => void;
  openId: string | null;
  setOpenId: (id: string | null) => void;
}

function SheetSection({ id, emoji, title, options, selected, onToggle, openId, setOpenId }: SectionProps) {
  const open = openId === id;
  return (
    <View style={s.sheetSec}>
      <TouchableOpacity
        style={s.sheetSecHdr}
        onPress={() => setOpenId(open ? null : id)}
        activeOpacity={0.7}
      >
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
              <TouchableOpacity
                key={opt}
                style={s.optRow}
                onPress={() => onToggle(opt)}
                activeOpacity={0.7}
              >
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

export default function LearnerDiscoveryScreen() {
  const navigation = useNavigation<Nav>();
  const { guardian } = useAuth();

  const [learners, setLearners]         = useState<LearnerResult[]>([]);
  const [catLikes, setCatLikes]         = useState<string[]>([]);
  const [catDislikes, setCatDislikes]   = useState<string[]>([]);
  const [catAbilities, setCatAbilities] = useState<string[]>([]);
  const [catMedical, setCatMedical]     = useState<string[]>([]);
  const [myLearnerIds, setMyLearnerIds] = useState<string[]>([]);
  const [loading, setLoading]           = useState(true);
  const [sending, setSending]           = useState<string | null>(null);

  // Search
  const [searchName, setSearchName] = useState('');
  const [searchCity, setSearchCity] = useState('');

  // Applied filters (used for actual filtering)
  const [filterAgeGroups, setFilterAgeGroups] = useState<string[]>([]);
  const [filterLevels,    setFilterLevels]    = useState<string[]>([]);
  const [filterLikes,     setFilterLikes]     = useState<string[]>([]);
  const [filterDislikes,  setFilterDislikes]  = useState<string[]>([]);
  const [filterAbilities, setFilterAbilities] = useState<string[]>([]);
  const [filterMedical,   setFilterMedical]   = useState<string[]>([]);

  // Draft filters (edited in sheet, applied on "Show Results")
  const [draftAgeGroups, setDraftAgeGroups] = useState<string[]>([]);
  const [draftLevels,    setDraftLevels]    = useState<string[]>([]);
  const [draftLikes,     setDraftLikes]     = useState<string[]>([]);
  const [draftDislikes,  setDraftDislikes]  = useState<string[]>([]);
  const [draftAbilities, setDraftAbilities] = useState<string[]>([]);
  const [draftMedical,   setDraftMedical]   = useState<string[]>([]);

  const [sheetOpen,  setSheetOpen]  = useState(false);
  const [openSec,    setOpenSec]    = useState<string | null>('age');

  useFocusEffect(useCallback(() => {
    if (guardian) load(guardian.id);
  }, [guardian]));

  async function load(guardianId: string) {
    setLoading(true);

    const { data: mine } = await supabase
      .from('user_profiles').select('id').eq('guardian_id', guardianId);
    const myIds = (mine ?? []).map((r: any) => r.id);
    setMyLearnerIds(myIds);

    const { data: profiles } = await supabase
      .from('user_profiles')
      .select('id, name, age, photo_url, city, region')
      .neq('guardian_id', guardianId)
      .order('name');
    if (!profiles) { setLoading(false); return; }

    const otherIds = profiles.map((p: any) => p.id);

    const none = Promise.resolve({ data: [] });
    const [
      { data: categories },
      { data: chatPrefs },
      { data: likesData },
      { data: dislikesData },
      { data: abilitiesData },
      { data: friendships },
      { data: medicalOptions },
      { data: medicalData },
    ] = await Promise.all([
      supabase.from('categories').select('name, type').order('name'),
      otherIds.length > 0
        ? supabase.from('chat_preferences').select('user_id, comprehension_level').in('user_id', otherIds)
        : none,
      otherIds.length > 0
        ? supabase.from('user_likes').select('user_id, categories(name)').in('user_id', otherIds)
        : none,
      otherIds.length > 0
        ? supabase.from('user_dislikes').select('user_id, categories(name)').in('user_id', otherIds)
        : none,
      otherIds.length > 0
        ? supabase.from('user_abilities').select('user_id, categories(name)').in('user_id', otherIds)
        : none,
      myIds.length > 0
        ? supabase.from('friendships').select('requester_id, addressee_id, status')
            .or(myIds.map((id: string) => `requester_id.eq.${id},addressee_id.eq.${id}`).join(','))
        : none,
      supabase.from('medical_conditions').select('label').order('label'),
      otherIds.length > 0
        ? supabase.from('user_medical_conditions')
            .select('user_id, medical_conditions(label)')
            .in('user_id', otherIds)
        : none,
    ]);

    const cats = (categories ?? []) as { name: string; type: string }[];
    setCatLikes(cats.filter(c => c.type === 'like').map(c => c.name));
    setCatDislikes(cats.filter(c => c.type === 'dislike').map(c => c.name));
    setCatAbilities(cats.filter(c => c.type === 'ability').map(c => c.name));
    setCatMedical((medicalOptions ?? []).map((r: any) => r.label));

    const levelMap: Record<string, string> = {};
    (chatPrefs ?? []).forEach((c: any) => { levelMap[c.user_id] = c.comprehension_level; });

    function buildMap(rows: any[]): Record<string, string[]> {
      const m: Record<string, string[]> = {};
      (rows ?? []).forEach((r: any) => {
        if (!m[r.user_id]) m[r.user_id] = [];
        if (r.categories?.name) m[r.user_id].push(r.categories.name);
      });
      return m;
    }
    const likesMap    = buildMap(likesData    ?? []);
    const dislikesMap = buildMap(dislikesData ?? []);
    const abilitiesMap= buildMap(abilitiesData?? []);

    const medicalMap: Record<string, string[]> = {};
    (medicalData ?? []).forEach((r: any) => {
      if (!medicalMap[r.user_id]) medicalMap[r.user_id] = [];
      if (r.medical_conditions?.label) medicalMap[r.user_id].push(r.medical_conditions.label);
    });

    function getStatus(otherId: string): LearnerResult['connectionStatus'] {
      const f = (friendships ?? []).find((fr: any) =>
        (myIds.includes(fr.requester_id) && fr.addressee_id === otherId) ||
        (myIds.includes(fr.addressee_id) && fr.requester_id === otherId),
      );
      if (!f) return 'none';
      if (f.status === 'accepted') return 'accepted';
      return myIds.includes(f.requester_id) ? 'pending_sent' : 'pending_received';
    }

    const results: LearnerResult[] = profiles.map((p: any) => ({
      id: p.id, name: p.name, age: p.age, photo_url: p.photo_url,
      city: p.city, region: p.region,
      comprehension_level: levelMap[p.id] ?? null,
      likes:             (likesMap[p.id]     ?? []).slice(0, 5),
      dislikes:          (dislikesMap[p.id]  ?? []).slice(0, 5),
      abilities:         (abilitiesMap[p.id] ?? []).slice(0, 8),
      medicalConditions: medicalMap[p.id]    ?? [],
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
    const myLearnerId = myLearnerIds[0];
    setSending(learner.id);
    try {
      const { error } = await supabase.from('friendships').insert({
        requester_id: myLearnerId,
        addressee_id: learner.id,
        status: 'pending',
        requested_by_guardian_id: guardian.id,
      });
      if (error) throw new Error(error.message);

      const { data: addrProfile } = await supabase
        .from('user_profiles').select('guardian_id').eq('id', learner.id).single();
      if (addrProfile?.guardian_id) {
        await supabase.from('notifications').insert({
          guardian_id: addrProfile.guardian_id, user_id: learner.id,
          type: 'friend_request',
          message: `${guardian.full_name} wants to connect their learner with ${learner.name}.`,
        });
      }

      setLearners(prev => prev.map(l => l.id === learner.id ? { ...l, connectionStatus: 'pending_sent' } : l));
      Alert.alert('Request sent!', `A friend request has been sent to ${learner.name}'s guardian.`);
    } catch (err: any) {
      Alert.alert('Error', err.message ?? 'Something went wrong.');
    }
    setSending(null);
  }

  function openSheet() {
    setDraftAgeGroups([...filterAgeGroups]);
    setDraftLevels([...filterLevels]);
    setDraftLikes([...filterLikes]);
    setDraftDislikes([...filterDislikes]);
    setDraftAbilities([...filterAbilities]);
    setDraftMedical([...filterMedical]);
    setSheetOpen(true);
  }

  function applySheet() {
    setFilterAgeGroups([...draftAgeGroups]);
    setFilterLevels([...draftLevels]);
    setFilterLikes([...draftLikes]);
    setFilterDislikes([...draftDislikes]);
    setFilterAbilities([...draftAbilities]);
    setFilterMedical([...draftMedical]);
    setSheetOpen(false);
  }

  function clearDraft() {
    setDraftAgeGroups([]); setDraftLevels([]);
    setDraftLikes([]);     setDraftDislikes([]); setDraftAbilities([]);
    setDraftMedical([]);
  }

  function removePill(type: string, val: string) {
    if (type === 'age')     setFilterAgeGroups(p => p.filter(x => x !== val));
    if (type === 'level')   setFilterLevels(p => p.filter(x => x !== val));
    if (type === 'like')    setFilterLikes(p => p.filter(x => x !== val));
    if (type === 'dislike') setFilterDislikes(p => p.filter(x => x !== val));
    if (type === 'ability') setFilterAbilities(p => p.filter(x => x !== val));
    if (type === 'medical') setFilterMedical(p => p.filter(x => x !== val));
  }

  const totalActive = filterAgeGroups.length + filterLevels.length + filterLikes.length +
    filterDislikes.length + filterAbilities.length + filterMedical.length;

  const activePills = [
    ...filterAgeGroups.map(g  => ({ key: `age-${g}`,     label: g,          type: 'age',     raw: g })),
    ...filterLevels.map(l     => ({ key: `lvl-${l}`,     label: l,          type: 'level',   raw: l })),
    ...filterLikes.map(l      => ({ key: `like-${l}`,    label: `❤️ ${l}`,  type: 'like',    raw: l })),
    ...filterDislikes.map(l   => ({ key: `dis-${l}`,     label: `🙅 ${l}`,  type: 'dislike', raw: l })),
    ...filterAbilities.map(l  => ({ key: `abi-${l}`,     label: `⭐ ${l}`,  type: 'ability', raw: l })),
    ...filterMedical.map(l    => ({ key: `med-${l}`,     label: `🏥 ${l}`,  type: 'medical', raw: l })),
  ];

  function applyFilters(
    list: LearnerResult[],
    ages: string[], levels: string[], likes: string[], dislikes: string[], abilities: string[], medical: string[],
  ) {
    return list.filter(l => {
      if (searchName && !l.name.toLowerCase().includes(searchName.toLowerCase())) return false;
      if (searchCity && !l.city.toLowerCase().includes(searchCity.toLowerCase()))  return false;
      if (ages.length > 0 && !ages.includes(getAgeGroup(l.age))) return false;
      if (levels.length > 0 && !levels.some(fl => fl.toLowerCase() === l.comprehension_level)) return false;
      if (likes.length > 0 && !l.likes.some(lk => likes.includes(lk))) return false;
      if (dislikes.length > 0 && !l.dislikes.some(d => dislikes.includes(d))) return false;
      if (abilities.length > 0 && !l.abilities.some(a => abilities.includes(a))) return false;
      if (medical.length > 0 && !l.medicalConditions.some(m => medical.includes(m))) return false;
      return true;
    });
  }

  const filtered = useMemo(
    () => applyFilters(learners, filterAgeGroups, filterLevels, filterLikes, filterDislikes, filterAbilities, filterMedical),
    [learners, searchName, searchCity, filterAgeGroups, filterLevels, filterLikes, filterDislikes, filterAbilities, filterMedical],
  );

  const draftPreview = useMemo(
    () => applyFilters(learners, draftAgeGroups, draftLevels, draftLikes, draftDislikes, draftAbilities, draftMedical),
    [learners, searchName, searchCity, draftAgeGroups, draftLevels, draftLikes, draftDislikes, draftAbilities, draftMedical],
  );

  const levelLabels    = COMPREHENSION_LEVELS.map((c: any) => c.label as string);

  return (
    <View style={s.container}>

      {/* ── Search row ─────────────────────────────────────────── */}
      <View style={s.searchRow}>
        <View style={s.searchInp}>
          <Text style={s.searchIcon}>🔍</Text>
          <TextInput
            style={s.searchText}
            value={searchName}
            onChangeText={setSearchName}
            placeholder="Name…"
            placeholderTextColor={COLORS.bloomMuted}
            clearButtonMode="while-editing"
          />
        </View>
        <View style={s.searchInp}>
          <Text style={s.searchIcon}>📍</Text>
          <TextInput
            style={s.searchText}
            value={searchCity}
            onChangeText={setSearchCity}
            placeholder="City…"
            placeholderTextColor={COLORS.bloomMuted}
            clearButtonMode="while-editing"
          />
        </View>
      </View>

      {/* ── Filter bar: pills + button ──────────────────────────── */}
      <View style={s.filterBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.pillsScroll} contentContainerStyle={s.pillsContent}>
          {activePills.map(p => (
            <TouchableOpacity key={p.key} style={s.pill} onPress={() => removePill(p.type, p.raw)} activeOpacity={0.75}>
              <Text style={s.pillTxt}>{p.label}</Text>
              <Text style={s.pillX}>×</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        <TouchableOpacity style={s.filterBtn} onPress={openSheet} activeOpacity={0.8}>
          <Text style={s.filterBtnTxt}>Filters</Text>
          {totalActive > 0 && (
            <View style={s.filterBadge}><Text style={s.filterBadgeTxt}>{totalActive}</Text></View>
          )}
        </TouchableOpacity>
      </View>

      {/* ── Results count ───────────────────────────────────────── */}
      {!loading && (
        <View style={s.resBar}>
          <Text style={s.resCount}>{filtered.length} learner{filtered.length !== 1 ? 's' : ''} found</Text>
        </View>
      )}

      {/* ── Results grid ────────────────────────────────────────── */}
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
                style={s.row}
                onPress={() => navigation.navigate('LearnerPublicProfile', { learnerId: l.id })}
                activeOpacity={0.85}
              >
                {/* Avatar */}
                {l.photo_url ? (
                  <Image source={{ uri: l.photo_url }} style={s.avatar} />
                ) : (
                  <View style={[s.avatar, { backgroundColor: color }]}>
                    <Text style={s.avatarInit}>{l.name[0]?.toUpperCase()}</Text>
                  </View>
                )}

                {/* Info */}
                <View style={s.rowInfo}>
                  <Text style={s.rowName} numberOfLines={1}>{l.name}</Text>
                  <Text style={s.rowMeta} numberOfLines={1}>
                    {l.age} yrs · {l.city}{l.region ? `, ${l.region}` : ''}
                  </Text>
                </View>

                {/* Action */}
                {l.connectionStatus === 'accepted' && (
                  <View style={[s.actionBtn, s.actionBtnFriends]}>
                    <Text style={[s.actionBtnTxt, { color: '#065F46' }]}>✓ Friends</Text>
                  </View>
                )}
                {l.connectionStatus === 'pending_sent' && (
                  <View style={[s.actionBtn, s.actionBtnPending]}>
                    <Text style={[s.actionBtnTxt, { color: COLORS.bloomMuted }]}>Pending</Text>
                  </View>
                )}
                {l.connectionStatus === 'pending_received' && (
                  <TouchableOpacity
                    style={[s.actionBtn, s.actionBtnRespond]}
                    onPress={() => navigation.navigate('LearnerFriendRequests')}
                    activeOpacity={0.8}
                  >
                    <Text style={s.actionBtnTxt}>Respond</Text>
                  </TouchableOpacity>
                )}
                {l.connectionStatus === 'none' && (
                  <TouchableOpacity
                    style={[s.actionBtn, isSending && { opacity: 0.6 }]}
                    onPress={() => sendRequest(l)}
                    disabled={isSending}
                    activeOpacity={0.8}
                  >
                    {isSending
                      ? <ActivityIndicator size="small" color="#fff" />
                      : <Text style={s.actionBtnTxt}>Connect</Text>
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

      {/* ── Filter bottom sheet ─────────────────────────────────── */}
      <Modal visible={sheetOpen} transparent animationType="slide" onRequestClose={() => setSheetOpen(false)}>
        <TouchableOpacity style={s.sheetOverlay} activeOpacity={1} onPress={() => setSheetOpen(false)}>
          <View style={s.sheet} onStartShouldSetResponder={() => true}>
            <View style={s.sheetHandle} />
            <View style={s.sheetHdr}>
              <Text style={s.sheetTitle}>Filter Learners</Text>
              <TouchableOpacity onPress={clearDraft} activeOpacity={0.75}>
                <Text style={s.sheetClear}>Clear all</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={s.sheetBody} showsVerticalScrollIndicator={false}>
              <SheetSection
                id="age" emoji="🎂" title="Age Group"
                options={AGE_GROUPS} selected={draftAgeGroups}
                onToggle={val => setDraftAgeGroups(p => toggle(p, val))}
                openId={openSec} setOpenId={setOpenSec}
              />
              <SheetSection
                id="level" emoji="🧠" title="Comprehension Level"
                options={levelLabels} selected={draftLevels}
                onToggle={val => setDraftLevels(p => toggle(p, val))}
                openId={openSec} setOpenId={setOpenSec}
              />
              <SheetSection
                id="likes" emoji="❤️" title="Likes"
                options={catLikes} selected={draftLikes}
                onToggle={val => setDraftLikes(p => toggle(p, val))}
                openId={openSec} setOpenId={setOpenSec}
              />
              <SheetSection
                id="dislikes" emoji="🙅" title="Dislikes"
                options={catDislikes} selected={draftDislikes}
                onToggle={val => setDraftDislikes(p => toggle(p, val))}
                openId={openSec} setOpenId={setOpenSec}
              />
              <SheetSection
                id="abilities" emoji="⭐" title="What can they do?"
                options={catAbilities} selected={draftAbilities}
                onToggle={val => setDraftAbilities(p => toggle(p, val))}
                openId={openSec} setOpenId={setOpenSec}
              />
              {catMedical.length > 0 && (
                <SheetSection
                  id="medical" emoji="🏥" title="Medical Condition"
                  options={catMedical} selected={draftMedical}
                  onToggle={val => setDraftMedical(p => toggle(p, val))}
                  openId={openSec} setOpenId={setOpenSec}
                />
              )}
            </ScrollView>
            <TouchableOpacity style={s.sheetApply} onPress={applySheet} activeOpacity={0.85}>
              <Text style={s.sheetApplyTxt}>Show {draftPreview.length} Results</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bloomBody },
  center:    { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 60 },

  // Search
  searchRow: { flexDirection: 'row', gap: 8, padding: 14, paddingBottom: 8 },
  searchInp: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: COLORS.bloomCard, borderRadius: 13,
    borderWidth: 1.5, borderColor: COLORS.bloomBorder,
    paddingHorizontal: 10, height: 42,
  },
  searchIcon: { fontSize: 13 },
  searchText: {
    flex: 1, fontSize: 13, fontWeight: '600', color: COLORS.bloomText,
  },

  // Filter bar
  filterBar:    { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingBottom: 6, gap: 8 },
  pillsScroll:  { flex: 1 },
  pillsContent: { gap: 6, flexDirection: 'row' },
  pill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#EFF6FF', borderWidth: 1, borderColor: '#BFDBFE',
    borderRadius: 18, paddingHorizontal: 10, paddingVertical: 5,
  },
  pillTxt: { fontSize: 11, fontWeight: '800', color: '#1D4ED8' },
  pillX:   { fontSize: 11, color: '#93C5FD', fontWeight: '900' },
  filterBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: COLORS.bloomCard, borderWidth: 1.5, borderColor: COLORS.bloomAccent,
    borderRadius: 18, paddingHorizontal: 12, paddingVertical: 7,
  },
  filterBtnTxt:  { fontSize: 12, fontWeight: '800', color: COLORS.bloomAccent },
  filterBadge:   { backgroundColor: COLORS.bloomAccent, borderRadius: 9, paddingHorizontal: 6, paddingVertical: 1 },
  filterBadgeTxt: { fontSize: 10, fontWeight: '900', color: '#fff' },

  // Results count
  resBar:   { paddingHorizontal: 14, paddingBottom: 6 },
  resCount: { fontSize: 12, fontWeight: '700', color: COLORS.bloomMuted },

  // List
  list: { padding: 14, paddingTop: 4, paddingBottom: 40 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: COLORS.bloomCard, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 10,
    borderWidth: 1, borderColor: COLORS.bloomBorder,
    marginBottom: 8,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 4, elevation: 1,
  },
  avatar:     { width: 42, height: 42, borderRadius: 21, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  avatarInit: { fontSize: 18, fontWeight: '800', color: '#fff' },
  rowInfo:    { flex: 1, minWidth: 0 },
  rowName:    { fontSize: 14, fontWeight: '800', color: COLORS.bloomText },
  rowMeta:    { fontSize: 11, color: COLORS.bloomMuted, fontWeight: '500', marginTop: 2 },

  actionBtn: {
    borderRadius: 9, paddingHorizontal: 12, paddingVertical: 7,
    alignItems: 'center', backgroundColor: COLORS.bloomNavy, flexShrink: 0,
  },
  actionBtnTxt:     { color: '#fff', fontWeight: '700', fontSize: 12 },
  actionBtnFriends: { backgroundColor: '#D4F0DE' },
  actionBtnPending: { backgroundColor: COLORS.bloomBorder },
  actionBtnRespond: { backgroundColor: COLORS.bloomAccent },

  // Empty
  empty:      { alignItems: 'center', paddingTop: 80, gap: 12 },
  emptyEmoji: { fontSize: 56 },
  emptyText:  { fontSize: 20, fontWeight: '800', color: COLORS.bloomText },
  emptyHint:  { fontSize: 14, color: COLORS.bloomMuted },

  // Sheet
  sheetOverlay: {
    flex: 1, justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  sheet: {
    height: SCREEN_H * 0.72,
    backgroundColor: COLORS.bloomCard,
    borderTopLeftRadius: 26, borderTopRightRadius: 26,
    paddingBottom: Platform.OS === 'ios' ? 34 : 16,
    overflow: 'hidden',
  },
  sheetHandle: {
    width: 38, height: 4, backgroundColor: COLORS.bloomBorder,
    borderRadius: 2, alignSelf: 'center', marginTop: 10, marginBottom: 2,
  },
  sheetHdr: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 18, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: COLORS.bloomBorder,
  },
  sheetTitle: { fontSize: 15, fontWeight: '900', color: COLORS.bloomText },
  sheetClear: { fontSize: 13, fontWeight: '700', color: COLORS.bloomAccent },
  sheetBody:  { flex: 1 },

  sheetSec:    { borderBottomWidth: 1, borderBottomColor: COLORS.bloomBorder },
  sheetSecHdr: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 18, paddingVertical: 13,
  },
  sheetSecRight:    { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sheetSecTitle:    { fontSize: 13, fontWeight: '800', color: COLORS.bloomText },
  sheetSecBadge:    { backgroundColor: COLORS.bloomAccent, borderRadius: 10, paddingHorizontal: 7, paddingVertical: 1 },
  sheetSecBadgeTxt: { fontSize: 10, fontWeight: '900', color: '#fff' },
  sheetSecArr:      { fontSize: 10, color: COLORS.bloomMuted },

  optRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 18, paddingVertical: 11,
    borderTopWidth: 1, borderTopColor: COLORS.bloomBorder,
  },
  optTxt:       { fontSize: 14, color: COLORS.bloomText, flex: 1 },
  optTxtOn:     { color: COLORS.bloomAccent, fontWeight: '600' },
  optCheck: {
    width: 20, height: 20, borderRadius: 5,
    borderWidth: 1.5, borderColor: COLORS.bloomBorder,
    justifyContent: 'center', alignItems: 'center',
  },
  optCheckOn:   { backgroundColor: COLORS.bloomAccent, borderColor: COLORS.bloomAccent },
  optCheckMark: { color: '#fff', fontSize: 11, fontWeight: '900' },

  sheetApply: {
    marginHorizontal: 18, marginTop: 10,
    backgroundColor: COLORS.bloomNavy, borderRadius: 16,
    paddingVertical: 14, alignItems: 'center',
  },
  sheetApplyTxt: { color: '#fff', fontWeight: '900', fontSize: 15 },
});
