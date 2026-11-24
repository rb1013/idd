import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  View, FlatList, TouchableOpacity, StyleSheet,
  Image, ActivityIndicator, Alert, TextInput,
} from 'react-native';
import AppText from '../../components/AppText';
import RainbowDivider from '../../components/RainbowDivider';
import GuardianFloatingTabBar from '../../components/GuardianFloatingTabBar';
import MoreFiltersLink from '../../components/MoreFiltersLink';
import FilterSheet, { FilterSheetSection } from '../../components/FilterSheet';
import ActiveFilterChips from '../../components/ActiveFilterChips';
import CountyFilterPill from '../../components/CountyFilterPill';
import useNicoHeader from '../../hooks/useNicoHeader';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/AuthContext';
import { calcAge } from '../../constants';
import { GuardianNavParamList } from '../../navigation';
import { useVisibleCount } from '../../hooks/useVisibleCount';
import {
  NICO, TEXT_STYLE, SPACING, RADIUS, SHADOW, FONT_SIZE, FONT_WEIGHT,
  BTN_SIZE, BTN_VARIANT, INPUT, BUTTERFLY_BORDER, BUTTERFLY_TILES, scale,
} from '../../constants/theme';

type Nav = NativeStackNavigationProp<GuardianNavParamList>;

const AVATAR_COLORS = [NICO.teal, NICO.orange, NICO.coral, NICO.pink, NICO.purple, NICO.primary];
const AGE_GROUPS    = ['Under 10', '10–14', '15–18', '19–25', '26–35', '36+'];

// Card fields + guardian name + the data the More Filters need (likes, abilities), in one request.
// Dislikes and comprehension level are shown on the learner's profile page only.
const LEARNER_SELECT =
  'id, name, date_of_birth, photo_url, county, ' +
  'guardians!user_profiles_guardian_id_fkey(full_name), ' +
  'user_likes(categories(name)), user_abilities(categories(name))';

function getAgeGroup(dob: string | null): string | null {
  const age = calcAge(dob);
  if (age === null) return null;
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

function categoryNames(rows: any[] | null | undefined): string[] {
  return (rows ?? []).map((r: any) => r.categories?.name).filter(Boolean);
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface LearnerResult {
  id: string;
  name: string;
  date_of_birth: string | null;
  photo_url: string | null;
  county: string;
  likes:     string[];
  abilities: string[];
  connectionStatus: 'none' | 'pending_sent' | 'pending_received' | 'accepted';
  guardianName: string | null;
}

// ── Avatar ────────────────────────────────────────────────────────────────────

function Avatar({ name, photo, size = 48 }: { name: string; photo: string | null; size?: number }) {
  const color = AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length];
  const r = size / 2;
  if (photo) return <Image source={{ uri: photo }} style={{ width: size, height: size, borderRadius: r }} />;
  return (
    <View style={{ width: size, height: size, borderRadius: r, backgroundColor: color, justifyContent: 'center', alignItems: 'center' }}>
      <AppText style={{ fontSize: size * 0.4, fontWeight: FONT_WEIGHT.extraBold, color: '#fff' }}>{name[0]?.toUpperCase()}</AppText>
    </View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function FindFriendsScreen() {
  const navigation = useNavigation<Nav>();
  const { guardian } = useAuth();

  useNicoHeader(navigation);

  const [myLearnerIds, setMyLearnerIds] = useState<string[]>([]);
  const [loading, setLoading]           = useState(true);
  // Spinner on the first load only; return visits keep the list and refresh quietly.
  const loadedRef = useRef(false);

  const [learners,        setLearners]        = useState<LearnerResult[]>([]);
  const [catLikes,        setCatLikes]        = useState<string[]>([]);
  const [catAbilities,    setCatAbilities]    = useState<string[]>([]);
  const [hiddenIds,       setHiddenIds]       = useState<Set<string>>(new Set());
  const [sending,         setSending]         = useState<string | null>(null);
  const [searchName,      setSearchName]      = useState('');
  const [searchCounty,    setSearchCounty]    = useState('');
  const [filterAgeGroups, setFilterAgeGroups] = useState<string[]>([]);
  const [filterLikes,     setFilterLikes]     = useState<string[]>([]);
  const [filterAbilities, setFilterAbilities] = useState<string[]>([]);
  const [sheetOpen, setSheetOpen] = useState(false);

  useFocusEffect(useCallback(() => {
    if (guardian) load(guardian.id);
  }, [guardian]));

  async function load(guardianId: string) {
    if (!loadedRef.current) setLoading(true);

    // Other families' learners and the filter categories don't need my learner's id — start them now
    const learnersReq = supabase.from('user_profiles').select(LEARNER_SELECT).neq('guardian_id', guardianId).order('name');
    const catsReq     = supabase.from('categories').select('name, type').in('type', ['like', 'ability']).order('name');

    // My learner
    const { data: mine } = await supabase.from('user_profiles').select('id').eq('guardian_id', guardianId);
    const myIds = (mine ?? []).map((r: any) => r.id as string);
    setMyLearnerIds(myIds);

    const none = Promise.resolve({ data: [] as any[] });
    const [
      { data: profiles },
      { data: categories },
      { data: friendships },
      { data: blocked },
      { data: reported },
    ] = await Promise.all([
      learnersReq,
      catsReq,
      // pending + accepted only — a leftover 'rejected' row (older app builds) counts as no request
      myIds.length > 0 ? supabase.from('friendships').select('requester_id, addressee_id, status')
        .in('status', ['pending', 'accepted'])
        .or(myIds.map(id => `requester_id.eq.${id},addressee_id.eq.${id}`).join(',')) : none,
      myIds.length > 0 ? supabase.from('blocked_learners').select('blocked_learner_id').in('learner_id', myIds) : none,
      myIds.length > 0 ? supabase.from('reports').select('reported_learner_id').in('learner_id', myIds) : none,
    ]);

    const cats = (categories ?? []) as { name: string; type: string }[];
    setCatLikes(cats.filter(c => c.type === 'like').map(c => c.name));
    setCatAbilities(cats.filter(c => c.type === 'ability').map(c => c.name));

    setHiddenIds(new Set([
      ...(blocked  ?? []).map((b: any) => b.blocked_learner_id as string),
      ...(reported ?? []).map((r: any) => r.reported_learner_id as string),
    ]));

    function getStatus(otherId: string): LearnerResult['connectionStatus'] {
      const f = (friendships ?? []).find((fr: any) =>
        (myIds.includes(fr.requester_id) && fr.addressee_id === otherId) ||
        (myIds.includes(fr.addressee_id) && fr.requester_id === otherId)
      );
      if (!f) return 'none';
      if (f.status === 'accepted') return 'accepted';
      return myIds.includes(f.requester_id) ? 'pending_sent' : 'pending_received';
    }

    setLearners(((profiles ?? []) as any[]).map(p => ({
      id: p.id, name: p.name, date_of_birth: p.date_of_birth ?? null,
      photo_url: p.photo_url, county: p.county ?? '',
      likes:     categoryNames(p.user_likes).slice(0, 5),
      abilities: categoryNames(p.user_abilities).slice(0, 8),
      connectionStatus: getStatus(p.id),
      guardianName: p.guardians?.full_name ?? null,
    })));

    loadedRef.current = true;
    setLoading(false);
  }

  // ── Actions ────────────────────────────────────────────────────────────────

  async function sendRequest(learner: LearnerResult) {
    if (!guardian || myLearnerIds.length === 0) {
      Alert.alert('No learners', 'You need to add a learner before connecting with others.');
      return;
    }
    setSending(learner.id);
    try {
      const { error } = await supabase.from('friendships').insert({
        requester_id: myLearnerIds[0],
        addressee_id: learner.id,
        status: 'pending',
        requested_by_guardian_id: guardian.id,
      });
      if (error) throw new Error(error.message);

      setLearners(prev => prev.map(l => l.id === learner.id ? { ...l, connectionStatus: 'pending_sent' } : l));
      Alert.alert('Request sent!', `A friend request has been sent to ${learner.name}'s guardian.`);
    } catch (err: any) {
      Alert.alert('Error', err.message ?? 'Something went wrong.');
    }
    setSending(null);
  }

  // ── Filter helpers ─────────────────────────────────────────────────────────

  const totalActive = filterAgeGroups.length + filterLikes.length + filterAbilities.length;

  const activePills = [
    ...filterAgeGroups.map(g => ({ key: `age-${g}`,  label: g,         type: 'age',     raw: g })),
    ...filterLikes.map(l     => ({ key: `lk-${l}`,   label: `❤️ ${l}`, type: 'like',    raw: l })),
    ...filterAbilities.map(l => ({ key: `abi-${l}`,  label: `⭐ ${l}`, type: 'ability', raw: l })),
  ];

  function removePill(type: string, val: string) {
    if (type === 'age')     setFilterAgeGroups(p => p.filter(x => x !== val));
    if (type === 'like')    setFilterLikes(p => p.filter(x => x !== val));
    if (type === 'ability') setFilterAbilities(p => p.filter(x => x !== val));
  }

  function clearAllFilters() {
    setFilterAgeGroups([]); setFilterLikes([]); setFilterAbilities([]);
  }

  function applyFilters(list: LearnerResult[]) {
    return list.filter(l => {
      if (hiddenIds.has(l.id)) return false;
      if (l.connectionStatus === 'accepted' || l.connectionStatus === 'pending_received') return false;
      if (searchName && !l.name.toLowerCase().includes(searchName.toLowerCase())) return false;
      if (searchCounty && !l.county.toLowerCase().includes(searchCounty.toLowerCase()))  return false;
      if (filterAgeGroups.length > 0 && !filterAgeGroups.includes(getAgeGroup(l.date_of_birth) ?? '')) return false;
      if (filterLikes.length > 0 && !l.likes.some(lk => filterLikes.includes(lk))) return false;
      if (filterAbilities.length > 0 && !l.abilities.some(a => filterAbilities.includes(a))) return false;
      return true;
    });
  }

  const filtered = useMemo(() => applyFilters(learners), [learners, hiddenIds, searchName, searchCounty, filterAgeGroups, filterLikes, filterAbilities]);

  const findResetKey = `${searchName}|${searchCounty}|${filterAgeGroups.join(',')}|${filterLikes.join(',')}|${filterAbilities.join(',')}`;
  const { visible, showLoadMore, loadMore, showCapMessage, pageSize } = useVisibleCount(filtered, findResetKey);

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loading) {
    return <View style={s.center}><ActivityIndicator size="large" color={NICO.primary} /></View>;
  }

  return (
    <View style={s.container}>
      <RainbowDivider />

      {/* Search */}
      <View style={s.searchRow}>
        <LinearGradient colors={[...BUTTERFLY_BORDER.colors]} start={BUTTERFLY_BORDER.start} end={BUTTERFLY_BORDER.end} style={s.searchGradient}>
          <View style={s.searchInputRow}>
            <AppText style={s.searchIcon}>🔍</AppText>
            <TextInput style={s.searchInputText} value={searchName} onChangeText={setSearchName}
              placeholder="Name…" placeholderTextColor={NICO.textMuted} clearButtonMode="while-editing" />
          </View>
        </LinearGradient>
        <LinearGradient colors={[...BUTTERFLY_BORDER.colors]} start={BUTTERFLY_BORDER.start} end={BUTTERFLY_BORDER.end} style={s.searchGradient}>
          <CountyFilterPill value={searchCounty} onSelect={setSearchCounty} placeholder="County…" icon="📍" />
        </LinearGradient>
      </View>

      {/* Filter bar */}
      <View style={s.filterBar}>
        <AppText style={s.resultCount}>{filtered.length} learner{filtered.length !== 1 ? 's' : ''} found</AppText>
        <MoreFiltersLink onPress={() => setSheetOpen(true)} isActive={totalActive > 0} />
      </View>

      <ActiveFilterChips
        chips={activePills.map(p => ({ key: p.key, label: p.label, onRemove: () => removePill(p.type, p.raw) }))}
        onClearAll={clearAllFilters}
      />

      <FlatList
        data={visible}
        keyExtractor={l => l.id}
        contentContainerStyle={s.listContent}
        renderItem={({ item: l, index }) => {
          const isSending = sending === l.id;
          const tileBg = BUTTERFLY_TILES[index % BUTTERFLY_TILES.length].bg;
          return (
            <TouchableOpacity
              style={[s.card, { backgroundColor: tileBg }]}
              onPress={() => navigation.navigate('LearnerPublicProfile', { learnerId: l.id })}
              activeOpacity={0.85}
            >
              <View style={s.avatarCol}>
                <Avatar name={l.name} photo={l.photo_url} size={scale(52)} />
                {calcAge(l.date_of_birth) != null && <AppText style={s.avatarAge}>{calcAge(l.date_of_birth)} yrs</AppText>}
              </View>
              <View style={s.cardInfo}>
                <AppText style={s.cardName} numberOfLines={1}>{l.name}</AppText>
                <AppText style={s.cardMeta} numberOfLines={1}>
                  {l.county}
                </AppText>
                {l.guardianName && (
                  <AppText style={s.cardMeta}>Guardian: {l.guardianName}</AppText>
                )}
              </View>
              {l.connectionStatus === 'accepted' && (
                <View style={s.friendBadge}><AppText style={s.friendBadgeTxt}>✓ Friends</AppText></View>
              )}
              {l.connectionStatus === 'pending_sent' && (
                <View style={s.pendingBadge}><AppText style={s.pendingBadgeTxt}>Pending</AppText></View>
              )}
              {l.connectionStatus === 'pending_received' && (
                // The profile page has "Respond to friend request →"
                <TouchableOpacity style={[s.reqBtn, s.respondBtn]} onPress={() => navigation.navigate('LearnerPublicProfile', { learnerId: l.id })} activeOpacity={0.8}>
                  <AppText style={s.respondBtnTxt}>Respond</AppText>
                </TouchableOpacity>
              )}
              {l.connectionStatus === 'none' && (
                <TouchableOpacity style={[s.connectIconBtn, isSending && s.btnDisabled]}
                  onPress={() => sendRequest(l)} disabled={isSending} activeOpacity={0.8}
                  hitSlop={8} accessibilityRole="button" accessibilityLabel={`Connect with ${l.name}`}>
                  {isSending
                    ? <ActivityIndicator size="small" color={NICO.primary} />
                    : <AppText style={s.connectIcon}>🤝</AppText>
                  }
                </TouchableOpacity>
              )}
            </TouchableOpacity>
          );
        }}
        ListFooterComponent={
          showLoadMore ? (
            <TouchableOpacity style={s.loadMoreBtn} onPress={loadMore} activeOpacity={0.75}>
              <AppText style={s.loadMoreText}>Load {pageSize} more</AppText>
            </TouchableOpacity>
          ) : showCapMessage ? (
            <View style={s.capMessage}>
              <AppText style={s.capMessageText}>Use filters to search records</AppText>
            </View>
          ) : null
        }
        ListEmptyComponent={
          <View style={s.center}>
            <AppText style={s.emptyEmoji}>🔍</AppText>
            <AppText style={s.emptyText}>No learners found</AppText>
            <AppText style={s.emptyHint}>Try adjusting your filters</AppText>
          </View>
        }
      />

      {/* Filter sheet */}
      <FilterSheet
        visible={sheetOpen}
        title="Filter Learners"
        onClearAll={clearAllFilters}
        onDone={() => setSheetOpen(false)}
        sections={[
          {
            key: 'age', emoji: '🎂', title: 'Age Group',
            options: AGE_GROUPS.map(g => ({ key: g, label: g })),
            selected: filterAgeGroups,
            onToggle: val => setFilterAgeGroups(p => toggle(p, val)),
          },
          {
            key: 'likes', emoji: '❤️', title: 'Likes',
            options: catLikes.map(l => ({ key: l, label: l })),
            selected: filterLikes,
            onToggle: val => setFilterLikes(p => toggle(p, val)),
          },
          {
            key: 'abilities', emoji: '⭐', title: 'What can they do?',
            options: catAbilities.map(l => ({ key: l, label: l })),
            selected: filterAbilities,
            onToggle: val => setFilterAbilities(p => toggle(p, val)),
          },
        ] satisfies FilterSheetSection[]}
      />

      <GuardianFloatingTabBar />
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container:   { flex: 1, backgroundColor: NICO.screenBg },
  center:      { flex: 1, justifyContent: 'center', alignItems: 'center', gap: SPACING.md, padding: SPACING.xl, backgroundColor: NICO.screenBg },
  listContent: { padding: SPACING.base, paddingBottom: 48 },

  // Empty
  emptyEmoji: { fontSize: scale(56) },
  emptyText:  { fontSize: FONT_SIZE['2xl'], fontWeight: FONT_WEIGHT.extraBold, color: NICO.text },
  emptyHint:  { ...TEXT_STYLE.screenHint, textAlign: 'center' },

  // Card
  card: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.md,
    borderRadius: RADIUS.xl, padding: SPACING.md, marginBottom: SPACING.sm,
    borderWidth: 1, borderColor: 'transparent',
    ...SHADOW.md,
  },
  cardInfo:  { flex: 1, minWidth: 0, gap: 2 },
  cardName:  { fontSize: FONT_SIZE.md, fontWeight: FONT_WEIGHT.extraBold, color: NICO.text },
  cardMeta:  { fontSize: FONT_SIZE.md, color: NICO.text, fontWeight: FONT_WEIGHT.medium },
  avatarCol: { alignItems: 'center', gap: 2 },
  avatarAge: { fontSize: FONT_SIZE.md, color: NICO.text, fontWeight: FONT_WEIGHT.semiBold },

  // Search
  searchRow:    { flexDirection: 'row', gap: SPACING.sm, padding: SPACING.base, paddingBottom: SPACING.sm },
  searchGradient: { flex: 1, padding: BUTTERFLY_BORDER.width, borderRadius: RADIUS.md + BUTTERFLY_BORDER.width },
  searchInputRow: {
    ...INPUT.base, borderWidth: 0,
    flexDirection: 'row', alignItems: 'center', gap: SPACING.xs,
  },
  searchIcon:     { fontSize: FONT_SIZE.sm },
  searchInputText:{ flex: 1, fontSize: FONT_SIZE.md, color: NICO.text, padding: 0 },

  filterBar:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SPACING.base, paddingBottom: SPACING.sm },
  resultCount:  { ...TEXT_STYLE.caption, color: NICO.textMuted },

  // Status / actions
  friendBadge:     { backgroundColor: NICO.successLight, borderRadius: RADIUS.md, paddingHorizontal: SPACING.sm, paddingVertical: SPACING.xs },
  friendBadgeTxt:  { fontSize: FONT_SIZE.sm, fontWeight: FONT_WEIGHT.bold, color: NICO.success },
  pendingBadge:    { backgroundColor: NICO.background, borderRadius: RADIUS.md, paddingHorizontal: SPACING.sm, paddingVertical: SPACING.xs },
  pendingBadgeTxt: { fontSize: FONT_SIZE.sm, fontWeight: FONT_WEIGHT.semiBold, color: NICO.textMuted },
  reqBtn:          { ...BTN_SIZE.sm },
  respondBtn:      { ...BTN_VARIANT.primary },
  respondBtnTxt:   { color: NICO.textOnAccent, fontWeight: FONT_WEIGHT.bold, fontSize: FONT_SIZE.sm },
  // Icon-only "Connect" (🤝), round like the 🚩 / 🚫 icon buttons
  connectIconBtn:  { width: scale(40), height: scale(40), borderRadius: scale(20), backgroundColor: NICO.surface, justifyContent: 'center', alignItems: 'center' },
  connectIcon:     { fontSize: scale(20) },
  btnDisabled:     { opacity: 0.6 },

  loadMoreBtn:    { ...BTN_SIZE.sm, ...BTN_VARIANT.outline, alignSelf: 'center', marginTop: SPACING.base },
  loadMoreText:   { fontSize: FONT_SIZE.lg, fontWeight: FONT_WEIGHT.extraBold, color: NICO.primary },
  capMessage:     { alignItems: 'center', paddingVertical: SPACING.base },
  capMessageText: { ...TEXT_STYLE.hint, fontStyle: 'italic' },
});
