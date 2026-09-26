import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, FlatList, TouchableOpacity, StyleSheet,
  Image, ActivityIndicator, Alert, TextInput, Modal,
} from 'react-native';
import AppText from '../../components/AppText';
import RainbowDivider from '../../components/RainbowDivider';
import GuardianTabBar from '../../components/GuardianTabBar';
import MoreFiltersLink from '../../components/MoreFiltersLink';
import FilterSheet, { FilterSheetSection } from '../../components/FilterSheet';
import useNicoHeader from '../../hooks/useNicoHeader';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/AuthContext';
import { TUTORIAL_COMPREHENSION, calcAge } from '../../constants';
import { GuardianNavParamList } from '../../navigation';
import type { Tutorial } from '../../types';
import { useVisibleCount } from '../../hooks/useVisibleCount';
import {
  NICO, TEXT_STYLE, SPACING, RADIUS, SHADOW, FONT_SIZE, FONT_WEIGHT,
  BTN_SIZE, BTN_VARIANT, INPUT, BUTTERFLY_BORDER, BUTTERFLY_TILES,
  CARD_BTN_ALIGN, GRID_COLS, GRID_CARD_W, scale,
} from '../../constants/theme';

type RouteType = RouteProp<GuardianNavParamList, 'TutorialLibrary'>;
type TutorialWithGuardian = Tutorial & { guardian?: { id: string; full_name: string } | null };

const FORMAT_EMOJI: Record<string, string> = { video: '🎬', slideshow: '🖼' };
const AVATAR_COLORS = [NICO.teal, NICO.orange, NICO.coral, NICO.pink, NICO.purple, NICO.primary];

interface LinkedUser {
  id: string;
  name: string;
  photo_url: string | null;
}

interface GuardianProfile {
  id: string; name: string; photoUrl: string | null;
  city: string; state: string; situationTags: string[];
  learners: { name: string; date_of_birth: string | null; gender: string | null }[];
}

export default function TutorialLibraryScreen() {
  useRoute<RouteType>();
  const { guardian } = useAuth();
  const navigation = useNavigation<NativeStackNavigationProp<GuardianNavParamList>>();

  useNicoHeader(navigation);

  const [activeTab, setActiveTab] = useState<'learner' | 'find'>('learner');
  const activeTabRef = useRef<'learner' | 'find'>('learner');
  const firstTabChange = useRef(true);

  const [tutorials, setTutorials] = useState<TutorialWithGuardian[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterSkills, setFilterSkills] = useState<string[]>([]);
  const [filterLevels, setFilterLevels] = useState<string[]>([]);
  const [skillOptions, setSkillOptions] = useState<string[]>([]);
  const [showMoreFilters, setShowMoreFilters] = useState(false);

  // Users belonging to this guardian
  const [users, setUsers] = useState<LinkedUser[]>([]);

  // Linked tutorials for the guardian's learner
  const [linkedTutorialIds, setLinkedTutorialIds] = useState<Set<string>>(new Set());
  const [linkedLoaded, setLinkedLoaded] = useState(false);
  const [togglingLinkId, setTogglingLinkId] = useState<string | null>(null);

  // Guardian profile sheet — opened by tapping a tutorial creator's name
  const [guardianSheet, setGuardianSheet] = useState<GuardianProfile | null>(null);
  const [loadingGuardianSheet, setLoadingGuardianSheet] = useState(false);

  async function openGuardianSheet(guardianId: string) {
    setGuardianSheet(null);
    setLoadingGuardianSheet(true);
    const { data } = await supabase
      .from('guardians')
      .select('id, full_name, photo_url, city, state, situation_tags, user_profiles(name, date_of_birth, gender)')
      .eq('id', guardianId)
      .single();
    if (data) {
      setGuardianSheet({
        id: data.id, name: data.full_name ?? '',
        photoUrl: data.photo_url ?? null,
        city: data.city ?? '', state: data.state ?? '',
        situationTags: data.situation_tags ?? [],
        learners: (data.user_profiles ?? []).map((l: any) => ({
          name: l.name, date_of_birth: l.date_of_birth ?? null, gender: l.gender ?? null,
        })),
      });
    }
    setLoadingGuardianSheet(false);
  }

  function closeGuardianSheet() {
    setGuardianSheet(null);
    setLoadingGuardianSheet(false);
  }

  useEffect(() => {
    navigation.setOptions({ title: 'Tutorials' });
  }, []);

  // Keep ref in sync with state so loadTutorials always sees current tab
  useEffect(() => {
    activeTabRef.current = activeTab;
    if (firstTabChange.current) { firstTabChange.current = false; return; }
    setSearch('');
    setFilterSkills([]);
    setFilterLevels([]);
    loadTutorials();
  }, [activeTab]);

  useFocusEffect(
    useCallback(() => {
      loadTutorials();
      loadSkills();
      if (guardian) loadGuardianUsers(guardian.id);
    }, [guardian]),
  );

  async function loadSkills() {
    const { data } = await supabase.from('tutorial_skills').select('label').order('label');
    setSkillOptions((data ?? []).map((r: any) => r.label));
  }

  async function loadTutorials() {
    setLoading(true);
    const tab = activeTabRef.current;
    let query = supabase
      .from('tutorials')
      .select('*, guardian:guardians!created_by_guardian_id(id, full_name)')
      .eq('status', 'approved')
      .order('created_at', { ascending: false });
    // Find tab: only public tutorials. Learner tab: include private (guardian's own)
    if (tab !== 'learner') query = query.eq('is_public', true);
    const { data } = await query;
    setTutorials((data as TutorialWithGuardian[]) || []);
    setLoading(false);
  }

  async function loadGuardianUsers(guardianId: string) {
    const { data } = await supabase
      .from('user_profiles')
      .select('id, name, photo_url')
      .eq('guardian_id', guardianId);
    const u = (data as LinkedUser[]) || [];
    setUsers(u);
    if (u.length > 0) {
      loadLinkedTutorials(u[0].id);
    }
  }

  async function loadLinkedTutorials(userId: string) {
    const { data } = await supabase
      .from('user_tutorials')
      .select('tutorial_id')
      .eq('user_id', userId);
    setLinkedTutorialIds(new Set((data ?? []).map((r: any) => r.tutorial_id)));
    setLinkedLoaded(true);
  }

  // ── Assign flow (direct 1:1) ───────────────────────────────────────────────

  async function toggleLink(tutorial: Tutorial) {
    if (users.length === 0) { Alert.alert('No learner', 'No learner profile found.'); return; }
    const userId = users[0].id;
    const isLinked = linkedTutorialIds.has(tutorial.id);
    setTogglingLinkId(tutorial.id);
    if (isLinked) {
      await supabase.from('user_tutorials').delete().eq('user_id', userId).eq('tutorial_id', tutorial.id);
      setLinkedTutorialIds(prev => { const next = new Set(prev); next.delete(tutorial.id); return next; });
    } else {
      await supabase.from('user_tutorials').upsert(
        [{ user_id: userId, tutorial_id: tutorial.id, added_by_guardian_id: guardian?.id ?? null }],
        { onConflict: 'user_id,tutorial_id' },
      );
      setLinkedTutorialIds(prev => new Set([...prev, tutorial.id]));
    }
    setTogglingLinkId(null);
  }

  // ── Rendering ──────────────────────────────────────────────────────────────

  const filtered = tutorials.filter(t => {
    if (activeTab === 'learner' && !linkedTutorialIds.has(t.id)) return false;
    const q = search.toLowerCase();
    const matchSearch = !q || t.title.toLowerCase().includes(q) || (t.topic ?? '').toLowerCase().includes(q) || t.category.toLowerCase().includes(q);
    const matchSkill = filterSkills.length === 0 || filterSkills.includes(t.category);
    const matchLevel = filterLevels.length === 0 || filterLevels.includes(t.comprehension_level);
    return matchSearch && matchSkill && matchLevel;
  });

  const totalActiveFilters = filterSkills.length + filterLevels.length;
  const resetKey = `${activeTab}|${search}|${filterSkills.join(',')}|${filterLevels.join(',')}`;
  const { visible: visibleTutorials, showLoadMore, loadMore, showCapMessage, pageSize } = useVisibleCount(filtered, resetKey);

  return (
    <View style={s.container}>
      <RainbowDivider />

      {/* Tab bar — Find Tutorials tab hidden for now, can be re-enabled later */}
      {/* <View style={s.tabBar}>
        {(['learner', 'find'] as const).map(tab => (
          <TouchableOpacity
            key={tab}
            style={[s.tab, activeTab === tab && s.tabActive]}
            onPress={() => setActiveTab(tab)}
            activeOpacity={0.75}
          >
            <AppText style={[s.tabText, activeTab === tab && s.tabTextActive]}>
              {tab === 'learner' ? "Learner's Tutorials" : 'Find Tutorials'}
            </AppText>
          </TouchableOpacity>
        ))}
      </View> */}

      {/* Info banner */}
      <View style={s.infoBanner}>
        <AppText style={s.infoIcon}>💡</AppText>
        <AppText style={s.infoText}>
          To link tutorials to your learner, go to <AppText style={s.infoLink} onPress={() => navigation.navigate('Learning', {} as any)}>Tutorials</AppText> on your dashboard, then use <AppText style={s.infoHighlight}>Search</AppText> or <AppText style={s.infoHighlight}>My Tutorials</AppText> to add them.
        </AppText>
      </View>

      {/* Search bar — Find tab only */}
      {activeTab === 'find' && (
        <View style={s.searchRow}>
          <LinearGradient colors={[...BUTTERFLY_BORDER.colors]} start={BUTTERFLY_BORDER.start} end={BUTTERFLY_BORDER.end} style={s.searchGradient}>
            <TextInput
              style={s.searchInput}
              value={search}
              onChangeText={setSearch}
              placeholder="Search tutorials…"
              placeholderTextColor={NICO.textMuted}
              clearButtonMode="while-editing"
            />
          </LinearGradient>
        </View>
      )}

      {/* Filter bar — Find tab only */}
      {activeTab === 'find' && (
        <View style={s.filterBar}>
          <MoreFiltersLink onPress={() => setShowMoreFilters(true)} isActive={totalActiveFilters > 0} />
        </View>
      )}

      {loading ? (
        <View style={s.center}><ActivityIndicator size="large" color={NICO.primary} /></View>
      ) : (
        <FlatList
          data={visibleTutorials}
          keyExtractor={t => t.id}
          numColumns={GRID_COLS}
          key={String(GRID_COLS)}
          columnWrapperStyle={s.gridRow}
          contentContainerStyle={s.gridList}
          ListFooterComponent={
            showLoadMore ? (
              <TouchableOpacity style={s.loadMoreBtn} onPress={loadMore} activeOpacity={0.7}>
                <AppText style={s.loadMoreText}>Load {pageSize} more</AppText>
              </TouchableOpacity>
            ) : showCapMessage ? (
              <View style={s.capMessage}>
                <AppText style={s.capMessageText}>Use filters to search records</AppText>
              </View>
            ) : null
          }
          renderItem={({ item: t, index }) => {
            const isLinked = linkedTutorialIds.has(t.id);
            const toggling = togglingLinkId === t.id;
            const tileBg = BUTTERFLY_TILES[index % BUTTERFLY_TILES.length].bg;
            const isRemove = activeTab === 'learner';
            return (
              <TouchableOpacity
                style={[s.gridCard, { backgroundColor: tileBg, borderColor: 'transparent' }]}
                onPress={() => navigation.navigate('TutorialPreview', { tutorialId: t.id })}
                activeOpacity={0.85}
              >
                {/* Thumbnail */}
                <View style={s.thumbWrap}>
                  {t.thumbnail_url
                    ? <Image source={{ uri: t.thumbnail_url }} style={s.gridThumb} />
                    : (
                      <View style={[s.gridThumb, s.gridThumbPlaceholder]}>
                        <AppText style={s.gridThumbEmoji}>{FORMAT_EMOJI[t.format] ?? '📚'}</AppText>
                      </View>
                    )
                  }
                  {isRemove && (
                    <TouchableOpacity
                      style={s.gridDeleteBtn}
                      onPress={() => toggleLink(t)}
                      disabled={toggling}
                      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                    >
                      <AppText style={s.gridDeleteIcon}>✕</AppText>
                    </TouchableOpacity>
                  )}
                </View>

                <View style={s.gridCardBody}>
                  <AppText style={s.gridCardTitle} numberOfLines={2}>{t.display_name || t.category}</AppText>
                  <AppText style={s.gridCardSub}>{t.category}</AppText>
                  {t.guardian?.full_name && (
                    <TouchableOpacity
                      onPress={() => openGuardianSheet(t.guardian!.id)}
                      hitSlop={{ top: 4, bottom: 4, left: 0, right: 8 }}
                    >
                      <AppText style={s.gridCardCreator} numberOfLines={1}>by {t.guardian.full_name}</AppText>
                    </TouchableOpacity>
                  )}
                  {!isRemove && (
                    <TouchableOpacity
                      style={[s.gridAddBtn, isLinked && s.gridAddBtnLinked]}
                      onPress={() => toggleLink(t)}
                      disabled={toggling}
                      activeOpacity={0.75}
                    >
                      <AppText style={[s.gridAddBtnText, isLinked && s.gridAddBtnTextLinked]}>
                        {toggling ? '…' : isLinked ? '✓ Added' : '＋ Add to Learner'}
                      </AppText>
                    </TouchableOpacity>
                  )}
                </View>
              </TouchableOpacity>
            );
          }}
          ListEmptyComponent={
            <View style={s.empty}>
              <AppText style={s.emptyEmoji}>{activeTab === 'learner' ? '📚' : '🔍'}</AppText>
              <AppText style={s.emptyText}>{activeTab === 'learner' ? 'No linked tutorials' : 'No tutorials found'}</AppText>
              {activeTab === 'find' && (
                <AppText style={s.emptyHint}>Try adjusting your search or filters</AppText>
              )}
            </View>
          }
        />
      )}

      {/* More filters — Find tab only */}
      <FilterSheet
        visible={showMoreFilters}
        sections={[
          {
            key: 'skill', emoji: '🎯', title: 'Skill',
            options: skillOptions.map(sk => ({ key: sk, label: sk })),
            selected: filterSkills,
            onToggle: sk => setFilterSkills(prev => prev.includes(sk) ? prev.filter(x => x !== sk) : [...prev, sk]),
          },
          {
            key: 'level', emoji: '📊', title: 'Comprehension Level',
            options: (TUTORIAL_COMPREHENSION as string[]).map(l => ({ key: l, label: l, capitalize: true })),
            selected: filterLevels,
            onToggle: l => setFilterLevels(prev => prev.includes(l) ? prev.filter(x => x !== l) : [...prev, l]),
          },
        ] satisfies FilterSheetSection[]}
        onClearAll={() => { setFilterSkills([]); setFilterLevels([]); }}
        onDone={() => setShowMoreFilters(false)}
      />

      {/* Guardian profile sheet — opened by tapping a tutorial creator's name */}
      <Modal
        visible={!!guardianSheet || loadingGuardianSheet}
        transparent
        animationType="slide"
        onRequestClose={closeGuardianSheet}
      >
        <TouchableOpacity style={s.sheetBackdrop} activeOpacity={1} onPress={closeGuardianSheet}>
          <View style={s.sheet} onStartShouldSetResponder={() => true}>
            <View style={s.sheetPill} />
            {loadingGuardianSheet && !guardianSheet ? (
              <ActivityIndicator size="large" color={NICO.primary} style={{ marginVertical: 32 }} />
            ) : guardianSheet ? (
              <>
                <View style={s.sheetHeader}>
                  {guardianSheet.photoUrl ? (
                    <Image source={{ uri: guardianSheet.photoUrl }} style={s.sheetPhoto} />
                  ) : (
                    <View style={[s.sheetAvatar, { backgroundColor: AVATAR_COLORS[guardianSheet.name.charCodeAt(0) % AVATAR_COLORS.length] }]}>
                      <AppText style={s.sheetAvatarText}>{guardianSheet.name[0]?.toUpperCase()}</AppText>
                    </View>
                  )}
                  <View style={s.sheetInfo}>
                    <AppText style={s.sheetName}>{guardianSheet.name}</AppText>
                    {!!(guardianSheet.city || guardianSheet.state) && (
                      <AppText style={s.sheetCity}>
                        📍 {[guardianSheet.city, guardianSheet.state].filter(Boolean).join(', ')}
                      </AppText>
                    )}
                  </View>
                </View>
                {guardianSheet.situationTags.length > 0 && (
                  <View style={s.sheetSection}>
                    <AppText style={s.sheetSectionTitle}>Situation</AppText>
                    <View style={s.sheetTags}>
                      {guardianSheet.situationTags.map(t => (
                        <View key={t} style={s.sheetTag}>
                          <AppText style={s.sheetTagText}>{t}</AppText>
                        </View>
                      ))}
                    </View>
                  </View>
                )}
                {guardianSheet.learners.length > 0 && (
                  <View style={s.sheetSection}>
                    <AppText style={s.sheetSectionTitle}>Learner</AppText>
                    {guardianSheet.learners.map((l, i) => (
                      <View key={i} style={s.learnerRow}>
                        <AppText style={s.learnerName}>{l.name}</AppText>
                        <AppText style={s.learnerMeta}>
                          {[
                            l.date_of_birth ? `${calcAge(l.date_of_birth) ?? '—'} yrs` : null,
                            l.gender,
                          ].filter(Boolean).join('  ·  ')}
                        </AppText>
                      </View>
                    ))}
                  </View>
                )}
              </>
            ) : null}
          </View>
        </TouchableOpacity>
      </Modal>

      <GuardianTabBar />
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: NICO.screenBg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 60 },

  tabBar: { flexDirection: 'row', backgroundColor: NICO.surface, borderBottomWidth: 1, borderBottomColor: NICO.border },
  tab: { flex: 1, paddingVertical: SPACING.md, alignItems: 'center', borderBottomWidth: 2.5, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: NICO.primary },
  tabText: { ...TEXT_STYLE.tabLabel },
  tabTextActive: { ...TEXT_STYLE.tabLabel, color: NICO.primary, fontWeight: FONT_WEIGHT.extraBold },

  infoBanner: {
    flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.sm,
    margin: SPACING.base, marginBottom: SPACING.sm, padding: SPACING.md,
    backgroundColor: BUTTERFLY_TILES[2].bg, borderRadius: RADIUS.md,
    borderLeftWidth: 4, borderLeftColor: BUTTERFLY_TILES[2].accent,
  },
  infoIcon:      { fontSize: FONT_SIZE.lg, flexShrink: 0 },
  infoText:      { ...TEXT_STYLE.screenHint, flex: 1, lineHeight: 22 },
  infoHighlight: { fontWeight: FONT_WEIGHT.extraBold, color: NICO.primary },
  infoLink:      { fontWeight: FONT_WEIGHT.extraBold, color: NICO.primary, textDecorationLine: 'underline' },

  searchRow: { padding: SPACING.base, paddingBottom: SPACING.sm },
  searchGradient: { padding: BUTTERFLY_BORDER.width, borderRadius: RADIUS.md + BUTTERFLY_BORDER.width },
  searchInput: { ...INPUT.base, borderWidth: 0 },

  filterBar: { paddingHorizontal: SPACING.base, paddingBottom: SPACING.sm, alignItems: 'flex-end' },

  gridList: { padding: SPACING.md, paddingBottom: SPACING['2xl'] },
  gridRow:  { gap: SPACING.md, marginBottom: SPACING.md, justifyContent: 'flex-start' },
  gridCard: {
    width: GRID_CARD_W, borderRadius: RADIUS.xl,
    borderWidth: 1, borderColor: 'transparent', overflow: 'hidden',
    ...SHADOW.md,
  },
  thumbWrap:            { position: 'relative', overflow: 'hidden' },
  gridThumb:            { width: '100%', height: scale(120) },
  gridThumbPlaceholder: { backgroundColor: NICO.background, justifyContent: 'center', alignItems: 'center' },
  gridThumbEmoji:       { fontSize: scale(44) },

  gridDeleteBtn: {
    position: 'absolute', top: SPACING.xs, right: SPACING.xs,
    backgroundColor: 'white',
    borderWidth: 1.5, borderColor: NICO.error,
    borderRadius: RADIUS.full,
    width: scale(28), height: scale(28), justifyContent: 'center', alignItems: 'center',
    ...SHADOW.sm,
  },
  gridDeleteIcon: { fontSize: FONT_SIZE.md, color: NICO.error, fontWeight: FONT_WEIGHT.bold },

  gridCardBody:    { padding: SPACING.md, gap: SPACING.xs },
  gridCardTitle:   { ...TEXT_STYLE.bodyMedium, color: '#1E3A8A', lineHeight: 20, textDecorationLine: 'underline' },
  gridCardSub:     { fontSize: FONT_SIZE.sm, fontWeight: FONT_WEIGHT.bold, color: NICO.text, marginBottom: SPACING.xs },
  gridCardCreator: { ...TEXT_STYLE.labelSmall, fontStyle: 'italic', color: NICO.primary, textDecorationLine: 'underline' },

  gridAddBtn:           { ...BTN_SIZE.sm, ...BTN_VARIANT.primary, alignSelf: CARD_BTN_ALIGN, marginTop: SPACING.xs },
  gridAddBtnLinked:     { backgroundColor: NICO.successLight, ...SHADOW.none },
  gridAddBtnText:       { ...TEXT_STYLE.buttonSmall },
  gridAddBtnTextLinked: { ...TEXT_STYLE.buttonSmall, color: NICO.success },

  loadMoreBtn:    { ...BTN_SIZE.sm, ...BTN_VARIANT.outline, alignSelf: 'center', marginTop: SPACING.base },
  loadMoreText:   { fontSize: FONT_SIZE.lg, fontWeight: FONT_WEIGHT.extraBold, color: NICO.primary },
  capMessage:     { alignItems: 'center', paddingVertical: SPACING.base },
  capMessageText: { ...TEXT_STYLE.hint, fontStyle: 'italic' },

  empty: { alignItems: 'center', paddingTop: 60, gap: SPACING.sm },
  emptyEmoji: { fontSize: scale(48) },
  emptyText: { fontSize: FONT_SIZE.xl, fontWeight: FONT_WEIGHT.bold, color: NICO.text },
  emptyHint: { fontSize: FONT_SIZE.sm, color: NICO.textMuted },

  // Guardian profile sheet
  sheetBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: NICO.screenBg,
    borderTopLeftRadius: RADIUS['3xl'], borderTopRightRadius: RADIUS['3xl'],
    padding: SPACING.lg, paddingBottom: scale(36), maxHeight: '80%',
  },
  sheetPill:    { width: 40, height: 4, borderRadius: 2, backgroundColor: NICO.border, alignSelf: 'center', marginBottom: SPACING.lg },
  sheetHeader:  { flexDirection: 'row', gap: SPACING.base, alignItems: 'center', marginBottom: SPACING.base },
  sheetPhoto:   { width: 64, height: 64, borderRadius: 32 },
  sheetAvatar:  { width: 64, height: 64, borderRadius: 32, justifyContent: 'center', alignItems: 'center' },
  sheetAvatarText: { fontSize: scale(26), fontWeight: FONT_WEIGHT.extraBold, color: '#fff' },
  sheetInfo:    { flex: 1, gap: SPACING.xs },
  sheetName:    { fontSize: FONT_SIZE['2xl'], fontWeight: FONT_WEIGHT.black, color: NICO.text },
  sheetCity:    { fontSize: FONT_SIZE.sm, color: NICO.textMuted },
  sheetSection: { marginTop: SPACING.base, gap: SPACING.sm },
  sheetSectionTitle: { fontSize: FONT_SIZE.xs, fontWeight: FONT_WEIGHT.bold, color: NICO.textMuted, textTransform: 'uppercase', letterSpacing: 0.8 },
  sheetTags:    { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.xs },
  sheetTag:     { backgroundColor: NICO.primaryLight, borderRadius: RADIUS.full, paddingHorizontal: SPACING.sm, paddingVertical: 4 },
  sheetTagText: { fontSize: FONT_SIZE.sm, color: NICO.primary, fontWeight: FONT_WEIGHT.semiBold },
  learnerRow:   { backgroundColor: NICO.background, borderRadius: RADIUS.lg, padding: SPACING.md, gap: 3, borderWidth: 1, borderColor: NICO.border },
  learnerName:  { fontSize: FONT_SIZE.md, fontWeight: FONT_WEIGHT.extraBold, color: NICO.text },
  learnerMeta:  { fontSize: FONT_SIZE.xs, color: NICO.textMuted },
});
