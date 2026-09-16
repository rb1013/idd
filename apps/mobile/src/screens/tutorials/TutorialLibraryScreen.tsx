import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  Image, ActivityIndicator, Alert, TextInput, Modal, ScrollView,
} from 'react-native';
import AppText from '../../components/AppText';
import { useFocusEffect, useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/AuthContext';
import { COLORS, TUTORIAL_COMPREHENSION } from '../../constants';
import { GuardianNavParamList } from '../../navigation';
import type { Tutorial } from '../../types';
import { useVisibleCount } from '../../hooks/useVisibleCount';

type RouteType = RouteProp<GuardianNavParamList, 'TutorialLibrary'>;
type TutorialWithGuardian = Tutorial & { guardian?: { full_name: string } | null };

const FORMAT_EMOJI: Record<string, string> = { video: '🎬', slideshow: '🖼' };

interface LinkedUser {
  id: string;
  name: string;
  photo_url: string | null;
}

export default function TutorialLibraryScreen() {
  const { params } = useRoute<RouteType>();
  const { guardian } = useAuth();
  const navigation = useNavigation<NativeStackNavigationProp<GuardianNavParamList>>();

  const [activeTab, setActiveTab] = useState<'learner' | 'find'>('learner');
  const activeTabRef = useRef<'learner' | 'find'>('learner');
  const firstTabChange = useRef(true);

  const [tutorials, setTutorials] = useState<TutorialWithGuardian[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterSkills, setFilterSkills] = useState<string[]>([]);
  const [filterLevels, setFilterLevels] = useState<string[]>([]);
  const [skillOptions, setSkillOptions] = useState<string[]>([]);
  const [showSkillPicker, setShowSkillPicker] = useState(false);
  const [showLevelPicker, setShowLevelPicker] = useState(false);

  // Users belonging to this guardian
  const [users, setUsers] = useState<LinkedUser[]>([]);

  // Linked tutorials for the guardian's learner
  const [linkedTutorialIds, setLinkedTutorialIds] = useState<Set<string>>(new Set());
  const [linkedLoaded, setLinkedLoaded] = useState(false);
  const [togglingLinkId, setTogglingLinkId] = useState<string | null>(null);

  // Featured / favourite flow: userId -> Set of featured tutorialIds
  const [featuredMap, setFeaturedMap] = useState<Record<string, Set<string>>>({});
  const [featuringTutorial, setFeaturingTutorial] = useState<Tutorial | null>(null);
  const [featureAssignedUsers, setFeatureAssignedUsers] = useState<LinkedUser[]>([]);
  const [togglingFeature, setTogglingFeature] = useState(false);

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
      .select('*, guardian:guardians!created_by_guardian_id(full_name)')
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
      loadFeaturedMap(u.map(x => x.id));
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

  async function loadFeaturedMap(userIds: string[]) {
    const { data } = await supabase
      .from('user_tutorials')
      .select('user_id, tutorial_id')
      .in('user_id', userIds)
      .eq('is_featured', true);
    const map: Record<string, Set<string>> = {};
    for (const { user_id, tutorial_id } of (data ?? []) as { user_id: string; tutorial_id: string }[]) {
      if (!map[user_id]) map[user_id] = new Set();
      map[user_id].add(tutorial_id);
    }
    setFeaturedMap(map);
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
      setFeaturedMap(prev => {
        const next = { ...prev };
        if (next[userId]) { next[userId] = new Set(next[userId]); next[userId].delete(tutorial.id); }
        return next;
      });
    } else {
      await supabase.from('user_tutorials').upsert(
        [{ user_id: userId, tutorial_id: tutorial.id, added_by_guardian_id: guardian?.id ?? null }],
        { onConflict: 'user_id,tutorial_id' },
      );
      setLinkedTutorialIds(prev => new Set([...prev, tutorial.id]));
    }
    setTogglingLinkId(null);
  }

  // ── Feature / favourite flow ───────────────────────────────────────────────

  async function openFeatureModal(tutorial: Tutorial) {
    const { data } = await supabase
      .from('user_tutorials')
      .select('user_id')
      .eq('tutorial_id', tutorial.id)
      .in('user_id', users.map(u => u.id));
    const assignedIds = new Set((data ?? []).map((r: any) => r.user_id));
    const assigned = users.filter(u => assignedIds.has(u.id));
    if (assigned.length === 0) {
      Alert.alert('Not assigned', 'Add this tutorial to a user first before marking it as a favourite.');
      return;
    }
    if (assigned.length === 1) {
      await toggleFeatured(tutorial, assigned[0].id);
      return;
    }
    setFeatureAssignedUsers(assigned);
    setFeaturingTutorial(tutorial);
  }

  async function toggleFeatured(tutorial: Tutorial, userId: string) {
    const currentSet = featuredMap[userId] ?? new Set<string>();
    const isCurrentlyFeatured = currentSet.has(tutorial.id);
    if (!isCurrentlyFeatured && currentSet.size >= 3) {
      Alert.alert('Limit reached', `You can only feature up to 3 tutorials per user. Remove a favourite first.`);
      return;
    }
    setTogglingFeature(true);
    const newVal = !isCurrentlyFeatured;
    await supabase.from('user_tutorials')
      .update({ is_featured: newVal })
      .eq('user_id', userId)
      .eq('tutorial_id', tutorial.id);
    setFeaturedMap(prev => {
      const next = { ...prev };
      const s = new Set<string>(prev[userId] ?? []);
      if (newVal) s.add(tutorial.id); else s.delete(tutorial.id);
      next[userId] = s;
      return next;
    });
    setTogglingFeature(false);
    setFeaturingTutorial(null);
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

  const resetKey = `${activeTab}|${search}|${filterSkills.join(',')}|${filterLevels.join(',')}`;
  const { visible: visibleTutorials, showLoadMore, loadMore, showCapMessage, pageSize } = useVisibleCount(filtered, resetKey);

  return (
    <View style={styles.container}>
      {/* Tab bar — Find Tutorials tab hidden for now, can be re-enabled later */}
      {/* <View style={styles.tabBar}>
        {(['learner', 'find'] as const).map(tab => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && styles.tabActive]}
            onPress={() => setActiveTab(tab)}
            activeOpacity={0.75}
          >
            <AppText style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
              {tab === 'learner' ? "Learner's Tutorials" : 'Find Tutorials'}
            </AppText>
          </TouchableOpacity>
        ))}
      </View> */}

      {/* Info banner */}
      <View style={styles.infoBanner}>
        <AppText style={styles.infoIcon}>💡</AppText>
        <AppText style={styles.infoText}>
          To link tutorials to your learner, go to <AppText style={styles.infoLink} onPress={() => navigation.navigate('Learning', {} as any)}>Tutorials</AppText> on your dashboard, then use <AppText style={styles.infoHighlight}>Search</AppText> or <AppText style={styles.infoHighlight}>My Tutorials</AppText> to add them.
        </AppText>
      </View>

      {/* Search bar — Find tab only */}
      {activeTab === 'find' && (
        <View style={styles.searchRow}>
          <TextInput
            style={styles.searchInput}
            value={search}
            onChangeText={setSearch}
            placeholder="Search tutorials…"
            placeholderTextColor={COLORS.bloomMuted}
            clearButtonMode="while-editing"
          />
        </View>
      )}

      {/* Filter panel — Find tab only */}
      {activeTab === 'find' && <View style={styles.filterPanel}>
          <TouchableOpacity style={styles.filterRow} onPress={() => setShowSkillPicker(true)} activeOpacity={0.75}>
            <AppText style={styles.filterLabel}>Skill</AppText>
            <AppText style={[styles.filterValue, filterSkills.length === 0 && styles.filterPlaceholder]} numberOfLines={1}>
              {filterSkills.length === 0 ? 'All Skills' : filterSkills.length === 1 ? filterSkills[0] : `${filterSkills.length} selected`}
            </AppText>
            {filterSkills.length > 0
              ? <TouchableOpacity onPress={() => setFilterSkills([])} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <AppText style={styles.filterClear}>✕</AppText>
                </TouchableOpacity>
              : <AppText style={styles.filterChevron}>›</AppText>
            }
          </TouchableOpacity>
          <View style={styles.filterDivider} />
          <TouchableOpacity style={styles.filterRow} onPress={() => setShowLevelPicker(true)} activeOpacity={0.75}>
            <AppText style={styles.filterLabel}>Level</AppText>
            <AppText style={[styles.filterValue, filterLevels.length === 0 && styles.filterPlaceholder, { textTransform: 'capitalize' }]} numberOfLines={1}>
              {filterLevels.length === 0 ? 'All Levels' : filterLevels.length === 1 ? filterLevels[0] : `${filterLevels.length} selected`}
            </AppText>
            {filterLevels.length > 0
              ? <TouchableOpacity onPress={() => setFilterLevels([])} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <AppText style={styles.filterClear}>✕</AppText>
                </TouchableOpacity>
              : <AppText style={styles.filterChevron}>›</AppText>
            }
          </TouchableOpacity>
        </View>}

      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color={COLORS.bloomAccent} /></View>
      ) : (
        <FlatList
          data={visibleTutorials}
          keyExtractor={t => t.id}
          contentContainerStyle={styles.list}
          numColumns={2}
          columnWrapperStyle={styles.row}
          ListFooterComponent={
            showLoadMore ? (
              <TouchableOpacity style={styles.loadMoreBtn} onPress={loadMore} activeOpacity={0.7}>
                <AppText style={styles.loadMoreText}>Load {pageSize} more</AppText>
              </TouchableOpacity>
            ) : showCapMessage ? (
              <View style={styles.capMessage}>
                <AppText style={styles.capMessageText}>Use filters to search records</AppText>
              </View>
            ) : null
          }
          renderItem={({ item: t }) => {
            const isFeaturedForAny = Object.values(featuredMap).some(s => s.has(t.id));
            const isLinked = linkedTutorialIds.has(t.id);
            const toggling = togglingLinkId === t.id;
            return (
              <TouchableOpacity
                style={[styles.card, isFeaturedForAny && styles.cardFeatured]}
                onPress={() => navigation.navigate('TutorialPreview', { tutorialId: t.id })}
                activeOpacity={0.85}
              >
                {/* Thumbnail */}
                <View>
                  {t.thumbnail_url
                    ? <Image source={{ uri: t.thumbnail_url }} style={styles.thumb} />
                    : (
                      <View style={[styles.thumb, styles.thumbPlaceholder]}>
                        <AppText style={styles.thumbEmoji}>{FORMAT_EMOJI[t.format] ?? '📚'}</AppText>
                      </View>
                    )
                  }
                  {/* Star button overlay */}
                  <TouchableOpacity
                    style={[styles.starBtn, isFeaturedForAny && styles.starBtnActive]}
                    onPress={() => openFeatureModal(t)}
                    hitSlop={{ top: 6, right: 6, bottom: 6, left: 6 }}
                  >
                    <AppText style={styles.starBtnText}>{isFeaturedForAny ? '⭐' : '☆'}</AppText>
                  </TouchableOpacity>
                </View>

                <View style={styles.cardBody}>
                  <AppText style={styles.cardTitle} numberOfLines={2}>{t.display_name || t.category}</AppText>
                  <AppText style={styles.cardMeta}>{t.category}</AppText>
                  {t.guardian?.full_name && (
                    <AppText style={styles.cardCreator} numberOfLines={1}>by {t.guardian.full_name}</AppText>
                  )}
                  <TouchableOpacity
                    style={[styles.addBtn, isLinked && styles.addBtnLinked]}
                    onPress={() => toggleLink(t)}
                    disabled={toggling}
                    activeOpacity={0.75}
                  >
                    <AppText style={[styles.addBtnText, isLinked && styles.addBtnTextLinked]}>
                      {toggling ? '…' : activeTab === 'learner' ? '✕ Remove' : isLinked ? '✓ Added' : '＋ Add to Learner'}
                    </AppText>
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            );
          }}
          ListEmptyComponent={
            <View style={styles.empty}>
              <AppText style={styles.emptyEmoji}>{activeTab === 'learner' ? '📚' : '🔍'}</AppText>
              <AppText style={styles.emptyText}>{activeTab === 'learner' ? 'No linked tutorials' : 'No tutorials found'}</AppText>
              {activeTab === 'learner' ? (
                null
                /* <AppText style={styles.emptyHint}>
                  Switch to{' '}
                  <AppText style={styles.emptyLink} onPress={() => setActiveTab('find')}>Find Tutorials</AppText>
                  {' '}to add some
                </AppText> */
              ) : (
                <AppText style={styles.emptyHint}>Try adjusting your search or filters</AppText>
              )}
            </View>
          }
        />
      )}

      {/* Skill picker */}
      <Modal visible={showSkillPicker} transparent animationType="slide" onRequestClose={() => setShowSkillPicker(false)}>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setShowSkillPicker(false)}>
          <View style={styles.pickerCard} onStartShouldSetResponder={() => true}>
            <View style={styles.pickerHeader}>
              <AppText style={styles.pickerTitle}>Target Skill</AppText>
              {filterSkills.length > 0 && (
                <TouchableOpacity onPress={() => setFilterSkills([])}>
                  <AppText style={styles.pickerClearAll}>Clear all</AppText>
                </TouchableOpacity>
              )}
            </View>
            <ScrollView style={{ maxHeight: 340 }}>
              {skillOptions.map(s => {
                const selected = filterSkills.includes(s);
                return (
                  <TouchableOpacity
                    key={s}
                    style={[styles.pickerOption, selected && styles.pickerOptionActive]}
                    onPress={() => setFilterSkills(prev => selected ? prev.filter(x => x !== s) : [...prev, s])}
                    activeOpacity={0.7}
                  >
                    <AppText style={[styles.pickerOptionText, selected && styles.pickerOptionTextActive]}>{s}</AppText>
                    <View style={[styles.multiCheck, selected && styles.multiCheckActive]}>
                      {selected && <AppText style={styles.multiCheckMark}>✓</AppText>}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            <TouchableOpacity style={styles.confirmBtn} onPress={() => setShowSkillPicker(false)}>
              <AppText style={styles.confirmBtnText}>Done</AppText>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Level picker */}
      <Modal visible={showLevelPicker} transparent animationType="slide" onRequestClose={() => setShowLevelPicker(false)}>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setShowLevelPicker(false)}>
          <View style={styles.pickerCard} onStartShouldSetResponder={() => true}>
            <View style={styles.pickerHeader}>
              <AppText style={styles.pickerTitle}>Comprehension Level</AppText>
              {filterLevels.length > 0 && (
                <TouchableOpacity onPress={() => setFilterLevels([])}>
                  <AppText style={styles.pickerClearAll}>Clear all</AppText>
                </TouchableOpacity>
              )}
            </View>
            {(TUTORIAL_COMPREHENSION as string[]).map(l => {
              const selected = filterLevels.includes(l);
              return (
                <TouchableOpacity
                  key={l}
                  style={[styles.pickerOption, selected && styles.pickerOptionActive]}
                  onPress={() => setFilterLevels(prev => selected ? prev.filter(x => x !== l) : [...prev, l])}
                  activeOpacity={0.7}
                >
                  <AppText style={[styles.pickerOptionText, selected && styles.pickerOptionTextActive, { textTransform: 'capitalize' }]}>{l}</AppText>
                  <View style={[styles.multiCheck, selected && styles.multiCheckActive]}>
                    {selected && <AppText style={styles.multiCheckMark}>✓</AppText>}
                  </View>
                </TouchableOpacity>
              );
            })}
            <TouchableOpacity style={styles.confirmBtn} onPress={() => setShowLevelPicker(false)}>
              <AppText style={styles.confirmBtnText}>Done</AppText>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Feature-for-user modal (multi-user case only) */}
      <Modal visible={!!featuringTutorial} animationType="slide" transparent onRequestClose={() => setFeaturingTutorial(null)}>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setFeaturingTutorial(null)}>
          <TouchableOpacity style={styles.pickerCard} activeOpacity={1} onPress={() => {}}>
            <AppText style={styles.pickerTitle}>⭐ Mark as Favourite</AppText>
            <AppText style={styles.pickerSub}>Select which user(s) should see this at the top</AppText>

            {featureAssignedUsers.map(user => {
              const isFeatured = (featuredMap[user.id] ?? new Set()).has(featuringTutorial?.id ?? '');
              const count = (featuredMap[user.id] ?? new Set()).size;
              return (
                <TouchableOpacity
                  key={user.id}
                  style={[styles.userRow, isFeatured && styles.userRowFeatured]}
                  onPress={() => featuringTutorial && toggleFeatured(featuringTutorial, user.id)}
                  disabled={togglingFeature || (!isFeatured && count >= 3)}
                  activeOpacity={0.7}
                >
                  {user.photo_url
                    ? <Image source={{ uri: user.photo_url }} style={styles.userAvatar} />
                    : (
                      <View style={[styles.userAvatar, styles.userAvatarPlaceholder]}>
                        <AppText style={styles.userAvatarText}>{user.name[0]}</AppText>
                      </View>
                    )
                  }
                  <View style={{ flex: 1 }}>
                    <AppText style={styles.userName}>{user.name}</AppText>
                    {!isFeatured && count >= 3 && (
                      <AppText style={styles.featureLimitNote}>3/3 favourites used</AppText>
                    )}
                  </View>
                  <AppText style={styles.featureStar}>{isFeatured ? '⭐' : '☆'}</AppText>
                </TouchableOpacity>
              );
            })}

            <TouchableOpacity style={styles.cancelBtn} onPress={() => setFeaturingTutorial(null)}>
              <AppText style={styles.cancelBtnText}>Done</AppText>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bloomBody },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 60 },

  tabBar: { flexDirection: 'row', backgroundColor: COLORS.bloomCard, borderBottomWidth: 1.5, borderBottomColor: COLORS.bloomBorder },
  tab: { flex: 1, paddingVertical: 13, alignItems: 'center', borderBottomWidth: 2.5, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: COLORS.bloomAccent },
  tabText: { fontSize: 14, fontWeight: '600', color: COLORS.bloomMuted },
  tabTextActive: { color: COLORS.bloomAccent, fontWeight: '700' },

  infoBanner: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    margin: 14, marginBottom: 8, padding: 14,
    backgroundColor: COLORS.bloomActiveBg, borderRadius: 14,
    borderWidth: 1.5, borderColor: COLORS.bloomSageMid,
  },
  infoIcon:      { fontSize: 18, flexShrink: 0 },
  infoText:      { flex: 1, fontSize: 13, color: COLORS.bloomText, lineHeight: 20 },
  infoHighlight: { fontWeight: '700', color: COLORS.bloomAccent },
  infoLink:      { fontWeight: '700', color: '#1D6FE8', textDecorationLine: 'underline' },

  searchRow: { padding: 14, paddingBottom: 8 },
  searchInput: {
    backgroundColor: COLORS.bloomCard, borderRadius: 14, borderWidth: 1.5, borderColor: COLORS.bloomBorder,
    paddingHorizontal: 16, paddingVertical: 13, fontSize: 15, fontWeight: '500', color: COLORS.bloomText,
  },

  // Label-value filter panel
  filterPanel: {
    marginHorizontal: 14, marginBottom: 10,
    backgroundColor: COLORS.bloomCard, borderRadius: 16,
    borderWidth: 1.5, borderColor: COLORS.bloomBorder,
    overflow: 'hidden',
  },
  filterRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 13, gap: 8 },
  filterLabel: { fontSize: 14, fontWeight: '700', color: COLORS.bloomText, width: 48 },
  filterValue: { flex: 1, fontSize: 14, fontWeight: '600', color: COLORS.bloomText },
  filterPlaceholder: { color: COLORS.bloomMuted, fontWeight: '400' },
  filterClear: { fontSize: 13, color: COLORS.bloomMuted, fontWeight: '700', paddingHorizontal: 4 },
  filterChevron: { fontSize: 20, color: COLORS.bloomMuted, lineHeight: 24 },
  filterDivider: { height: 1, backgroundColor: COLORS.bloomBorder, marginHorizontal: 14 },

  // Picker options inside modals
  pickerOption: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 16,
    borderBottomWidth: 1, borderBottomColor: COLORS.bloomBorder,
  },
  pickerOptionActive: { backgroundColor: COLORS.bloomActiveBg },
  pickerOptionText: { fontSize: 15, fontWeight: '600', color: COLORS.bloomText },
  pickerOptionTextActive: { color: COLORS.bloomAccent, fontWeight: '700' },
  pickerCheck: { fontSize: 16, color: COLORS.bloomAccent, fontWeight: '800' },
  pickerHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  pickerClearAll: { fontSize: 13, fontWeight: '600', color: COLORS.bloomAccent },
  multiCheck: {
    width: 22, height: 22, borderRadius: 6,
    borderWidth: 2, borderColor: COLORS.bloomBorder,
    backgroundColor: COLORS.bloomBody,
    justifyContent: 'center', alignItems: 'center',
  },
  multiCheckActive: { backgroundColor: COLORS.bloomAccent, borderColor: COLORS.bloomAccent },
  multiCheckMark: { color: COLORS.bloomOnAccent, fontSize: 12, fontWeight: '800' },

  list: { padding: 12, paddingBottom: 32 },
  row: { gap: 12, marginBottom: 12 },

  card: {
    flex: 1, backgroundColor: COLORS.bloomCard, borderRadius: 18,
    borderWidth: 1.5, borderColor: COLORS.bloomBorder, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },
  cardFeatured: {
    borderColor: COLORS.statusAmber, borderWidth: 2,
    shadowColor: COLORS.statusAmber, shadowOpacity: 0.25, shadowRadius: 10, elevation: 5,
  },
  thumb: { width: '100%', height: 120 },
  thumbPlaceholder: { backgroundColor: COLORS.bloomActiveBg, justifyContent: 'center', alignItems: 'center' },
  thumbEmoji: { fontSize: 44 },

  starBtn: {
    position: 'absolute', top: 8, right: 8,
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center', alignItems: 'center',
  },
  starBtnActive: { backgroundColor: 'rgba(245,158,11,0.85)' },
  starBtnText: { fontSize: 15 },

  cardBody: { padding: 12, gap: 4 },
  cardTitle: { fontSize: 15, fontWeight: '800', color: COLORS.bloomText, lineHeight: 20 },
  cardMeta: { fontSize: 12, fontWeight: '500', color: COLORS.secondary, marginBottom: 2 },
  cardCreator: { fontSize: 11, color: COLORS.bloomMuted, fontStyle: 'italic' },
  cardMetas: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginBottom: 6 },
  cardMetaChip: {
    fontSize: 11, fontWeight: '600', color: COLORS.bloomMuted,
    backgroundColor: COLORS.bloomBorder, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3,
    textTransform: 'capitalize',
  },
  addBtn: { backgroundColor: COLORS.bloomAccent, borderRadius: 10, paddingVertical: 9, alignItems: 'center', marginTop: 2 },
  addBtnLinked: { backgroundColor: COLORS.bloomAccent },
  addBtnText: { fontSize: 13, fontWeight: '800', color: COLORS.bloomOnAccent },
  addBtnTextLinked: { color: COLORS.bloomOnAccent },

  loadMoreBtn: {
    alignItems: 'center', paddingVertical: 14, marginTop: 4,
    borderWidth: 1.5, borderColor: COLORS.bloomBorder,
    borderRadius: 14, backgroundColor: COLORS.bloomCard,
  },
  loadMoreText:    { fontSize: 14, fontWeight: '700', color: COLORS.bloomNavy },
  capMessage:      { alignItems: 'center', paddingVertical: 16 },
  capMessageText:  { fontSize: 13, color: COLORS.bloomMuted, fontStyle: 'italic' },

  empty: { alignItems: 'center', paddingTop: 60, gap: 8 },
  emptyEmoji: { fontSize: 48 },
  emptyText: { fontSize: 18, fontWeight: '700', color: COLORS.bloomText },
  emptyHint: { fontSize: 13, color: COLORS.bloomMuted },
  emptyLink: { fontSize: 13, color: COLORS.bloomAccent, fontWeight: '700', textDecorationLine: 'underline' },

  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  pickerCard: {
    backgroundColor: COLORS.bloomCard, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, paddingBottom: 40, gap: 12,
  },
  pickerTitle: { fontSize: 22, fontWeight: '800', color: COLORS.bloomText },
  pickerSub: { fontSize: 14, color: COLORS.bloomMuted, marginBottom: 4 },

  userRow: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: COLORS.bloomBody, borderRadius: 16, padding: 16,
    borderWidth: 2, borderColor: 'transparent',
  },
  userRowFeatured: { borderColor: COLORS.statusAmber, backgroundColor: '#FFFBEB' },
  userAvatar: { width: 50, height: 50, borderRadius: 25 },
  userAvatarPlaceholder: { backgroundColor: COLORS.bloomActiveBg, justifyContent: 'center', alignItems: 'center' },
  userAvatarText: { fontSize: 20, fontWeight: '800', color: COLORS.bloomAccent },
  userName: { fontSize: 17, fontWeight: '700', color: COLORS.bloomText },
  featureLimitNote: { fontSize: 11, color: COLORS.bloomMuted, marginTop: 2 },
  featureStar: { fontSize: 22 },

  confirmBtn: { marginTop: 4, paddingVertical: 15, alignItems: 'center', backgroundColor: COLORS.bloomAccent, borderRadius: 16 },
  confirmBtnText: { fontWeight: '800', fontSize: 15, color: COLORS.bloomOnAccent },
  cancelBtn: { paddingVertical: 13, alignItems: 'center', backgroundColor: COLORS.bloomBorder, borderRadius: 16 },
  cancelBtnText: { fontWeight: '700', fontSize: 15, color: COLORS.bloomText },
});
