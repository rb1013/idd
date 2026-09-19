import React, { useCallback, useState } from 'react';
import {
  View, FlatList, TouchableOpacity, StyleSheet,
  Image, ActivityIndicator, Alert, TextInput, ScrollView,
} from 'react-native';
import AppText from '../../components/AppText';
import FilterSheet, { FilterSheetSection } from '../../components/FilterSheet';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/AuthContext';
import { TUTORIAL_COMPREHENSION } from '../../constants';
import { GuardianNavParamList } from '../../navigation';
import type { Tutorial, TutorialStatus, TutorialSource } from '../../types';
import { useVisibleCount } from '../../hooks/useVisibleCount';
import useNicoHeader from '../../hooks/useNicoHeader';
import RainbowDivider from '../../components/RainbowDivider';
import {
  NICO, TEXT_STYLE, SPACING, RADIUS, SHADOW, FONT_SIZE, FONT_WEIGHT,
  BTN_SIZE, BTN_VARIANT, INPUT, BUTTERFLY_BORDER, CARD_BTN_ALIGN, scale, IS_TABLET,
} from '../../constants/theme';

type TutorialWithGuardian = Tutorial & { guardian?: { full_name: string } | null };

const STATUS_COLORS: Record<TutorialStatus, { bg: string; text: string }> = {
  generating: { bg: NICO.background,   text: NICO.textMuted  },
  preview:    { bg: NICO.warningLight,  text: NICO.warning    },
  pending:    { bg: NICO.primaryLight,  text: NICO.primary    },
  approved:   { bg: NICO.successLight,  text: NICO.success    },
  rejected:   { bg: NICO.errorLight,    text: NICO.error      },
};

const STATUS_LABELS: Record<TutorialStatus, string> = {
  generating: 'Generating…',
  preview:    'Preview',
  pending:    'Pending Approval',
  approved:   'Approved',
  rejected:   'Rejected',
};

const STATUS_RIBBON_LABELS: Record<TutorialStatus, string> = {
  generating: 'Generating',
  preview:    'Preview',
  pending:    'Pending',
  approved:   'Approved',
  rejected:   'Rejected',
};

const GRID_CARD = {
  // Diagonal ribbon (top-left of thumbnail) — scaled so text fits on tablet
  ribbonTop:     scale(16),
  ribbonLeft:    scale(-38),
  ribbonWidth:   scale(120),
  ribbonPadding: scale(5),
  // Delete button (top-right of thumbnail)
  deleteBg:     'white',
  deleteBorder: NICO.error,
  deleteColor:  NICO.error,
  deleteIcon:   '✕',
  deleteSize:   scale(28),
  // Card title truncation
  titleMaxChars:   60,   // enforced at creation; full name stored in DB
  titlePhoneChars: 17,   // phone cards are narrow — truncate to keep 1 line
};

/** Returns the card title: full text on tablet, truncated on phone. */
function cardTitle(name: string): string {
  if (IS_TABLET) return name;
  return name.length > GRID_CARD.titlePhoneChars
    ? name.slice(0, GRID_CARD.titlePhoneChars) + '…'
    : name;
}

const FORMAT_EMOJI: Record<string, string> = { video: '🎬', slideshow: '🖼' };

type Tab = 'search' | 'my' | 'pending' | 'create';

const MY_TYPE_OPTIONS: { key: TutorialSource; label: string }[] = [
  { key: 'ai_generated', label: '✨ AI Generated' },
  { key: 'youtube',      label: '▶️ YouTube' },
];

const MY_FILTER_OPTIONS: { key: TutorialStatus; label: string }[] = [
  { key: 'approved', label: 'Approved' },
  { key: 'rejected', label: 'Rejected' },
];

const PENDING_STATUS_OPTIONS: { key: TutorialStatus; label: string }[] = [
  { key: 'generating', label: 'Generating…' },
  { key: 'preview',    label: 'Preview' },
  { key: 'pending',    label: 'Pending Approval' },
];

const MY_STATUSES: TutorialStatus[]      = ['approved', 'rejected'];
const PENDING_STATUSES: TutorialStatus[] = ['generating', 'preview', 'pending'];

export default function GuardianTutorialsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<GuardianNavParamList>>();
  const route = useRoute<RouteProp<GuardianNavParamList, 'Learning'>>();
  const { guardian } = useAuth();

  const [activeTab, setActiveTab] = useState<Tab>(route.params?.initialTab ?? 'search');

  useNicoHeader(navigation);

  // ── My Tutorials tab ──────────────────────────────────────────────────────
  const [myTutorials, setMyTutorials]   = useState<Tutorial[]>([]);
  const [loadingMy, setLoadingMy]       = useState(true);
  const [myFilters, setMyFilters]       = useState<TutorialStatus[]>([]);
  const [myTypes, setMyTypes]           = useState<TutorialSource[]>([]);
  const [myVisibility, setMyVisibility] = useState<'all' | 'public' | 'private'>('all');
  const [mySearchQuery, setMySearchQuery]         = useState('');
  const [myFilterSkills, setMyFilterSkills]       = useState<string[]>([]);
  const [myFilterLevels, setMyFilterLevels]       = useState<string[]>([]);
  const [showMyMoreFilters, setShowMyMoreFilters] = useState(false);
  const [quota, setQuota]               = useState<{ used: number; limit: number } | null>(null);

  // ── Pending tab ───────────────────────────────────────────────────────────
  const [pendingSearch, setPendingSearch]             = useState('');
  const [pendingStatusFilter, setPendingStatusFilter] = useState<TutorialStatus[]>([]);
  const [pendingFilterSkills, setPendingFilterSkills] = useState<string[]>([]);
  const [pendingFilterLevels, setPendingFilterLevels] = useState<string[]>([]);
  const [showPendingMoreFilters, setShowPendingMoreFilters] = useState(false);

  // ── Search Tutorials tab ──────────────────────────────────────────────────
  const [approved, setApproved]           = useState<TutorialWithGuardian[]>([]);
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [searchQuery, setSearchQuery]     = useState('');
  const [linkedIds, setLinkedIds]         = useState<Set<string>>(new Set());
  const [learnerUserId, setLearnerUserId] = useState<string | null>(null);
  const [togglingId, setTogglingId]       = useState<string | null>(null);
  const [skillOptions, setSkillOptions]   = useState<string[]>([]);
  const [filterSkills, setFilterSkills]   = useState<string[]>([]);
  const [filterLevels, setFilterLevels]   = useState<string[]>([]);
  const [showSearchMoreFilters, setShowSearchMoreFilters] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (guardian) {
        loadMy(guardian.id);
        loadLearner(guardian.id);
        loadApproved();
        loadSkills();
      }
    }, [guardian]),
  );

  async function loadSkills() {
    const { data } = await supabase.from('tutorial_skills').select('label').order('label');
    setSkillOptions((data ?? []).map((r: any) => r.label));
  }

  async function loadMy(guardianId: string) {
    setLoadingMy(true);
    const [{ data: tuts }, { data: quotaRow }, { data: settings }] = await Promise.all([
      supabase.from('tutorials').select('*').eq('created_by_guardian_id', guardianId).order('created_at', { ascending: false }),
      supabase.from('guardian_tutorial_quota').select('count').eq('guardian_id', guardianId).eq('month', new Date().toISOString().slice(0, 7)).single(),
      supabase.from('app_settings').select('tutorial_quota_limit').single(),
    ]);
    setMyTutorials((tuts as Tutorial[]) || []);
    const limit = settings?.tutorial_quota_limit ?? 10;
    setQuota({ used: quotaRow?.count ?? 0, limit });
    setLoadingMy(false);
  }

  async function loadLearner(guardianId: string) {
    const { data } = await supabase.from('user_profiles').select('id').eq('guardian_id', guardianId).maybeSingle();
    if (data?.id) {
      setLearnerUserId(data.id);
      const { data: linked } = await supabase.from('user_tutorials').select('tutorial_id').eq('user_id', data.id);
      setLinkedIds(new Set((linked ?? []).map((r: any) => r.tutorial_id)));
    }
  }

  async function loadApproved() {
    setLoadingSearch(true);
    const { data } = await supabase.from('tutorials').select('*, guardian:guardians!created_by_guardian_id(full_name)').eq('status', 'approved').eq('is_public', true).order('created_at', { ascending: false });
    setApproved((data as TutorialWithGuardian[]) || []);
    setLoadingSearch(false);
  }

  function switchTab(tab: Tab) {
    setActiveTab(tab);
  }

  async function deleteTutorial(t: Tutorial) {
    const msg = t.link_count > 0
      ? `This tutorial is linked to ${t.link_count} user profile${t.link_count > 1 ? 's' : ''}. Deleting it will remove it from their learning page. Continue?`
      : 'Delete this tutorial? This cannot be undone.';
    Alert.alert('Delete Tutorial', msg, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
          await supabase.from('tutorials').delete().eq('id', t.id);
          setMyTutorials(prev => prev.filter(x => x.id !== t.id));
        },
      },
    ]);
  }

  async function toggleLink(tutorial: Tutorial) {
    if (!learnerUserId) { Alert.alert('No learner', 'No learner profile found.'); return; }
    const isLinked = linkedIds.has(tutorial.id);
    setTogglingId(tutorial.id);
    if (isLinked) {
      await supabase.from('user_tutorials').delete().eq('user_id', learnerUserId).eq('tutorial_id', tutorial.id);
      setLinkedIds(prev => { const n = new Set(prev); n.delete(tutorial.id); return n; });
    } else {
      await supabase.from('user_tutorials').upsert(
        [{ user_id: learnerUserId, tutorial_id: tutorial.id, added_by_guardian_id: guardian?.id ?? null }],
        { onConflict: 'user_id,tutorial_id' },
      );
      setLinkedIds(prev => new Set([...prev, tutorial.id]));
    }
    setTogglingId(null);
  }

  const filteredMy = myTutorials.filter(t => {
    if (!MY_STATUSES.includes(t.status as TutorialStatus)) return false;
    const matchStatus = myFilters.length === 0 || myFilters.includes(t.status as TutorialStatus);
    const matchType   = myTypes.length === 0   || myTypes.includes(t.source as TutorialSource);
    const matchVis    = myVisibility === 'all' || (myVisibility === 'public' ? t.is_public : !t.is_public);
    const q = mySearchQuery.toLowerCase();
    const matchSearch = !q || (t.display_name ?? '').toLowerCase().includes(q) || (t.category ?? '').toLowerCase().includes(q);
    const matchSkill  = myFilterSkills.length === 0 || myFilterSkills.includes(t.category);
    const matchLevel  = myFilterLevels.length === 0 || myFilterLevels.includes(t.comprehension_level);
    return matchStatus && matchType && matchVis && matchSearch && matchSkill && matchLevel;
  });
  const filteredPending = myTutorials.filter(t => {
    if (!PENDING_STATUSES.includes(t.status as TutorialStatus)) return false;
    const matchStatus = pendingStatusFilter.length === 0 || pendingStatusFilter.includes(t.status as TutorialStatus);
    const q = pendingSearch.toLowerCase();
    const matchName  = !q || (t.display_name ?? '').toLowerCase().includes(q) || (t.category ?? '').toLowerCase().includes(q);
    const matchSkill = pendingFilterSkills.length === 0 || pendingFilterSkills.includes(t.category);
    const matchLevel = pendingFilterLevels.length === 0 || pendingFilterLevels.includes(t.comprehension_level);
    return matchStatus && matchName && matchSkill && matchLevel;
  });
  const filteredSearch = approved.filter(t => {
    if (linkedIds.has(t.id)) return false;
    const q = searchQuery.toLowerCase();
    const matchSearch = !q || t.title?.toLowerCase().includes(q) || t.category?.toLowerCase().includes(q) || (t.display_name ?? '').toLowerCase().includes(q);
    const matchSkill  = filterSkills.length === 0 || filterSkills.includes(t.category);
    const matchLevel  = filterLevels.length === 0 || filterLevels.includes(t.comprehension_level);
    return matchSearch && matchSkill && matchLevel;
  });

  const resetKeySearch = `${searchQuery}|${filterSkills.join(',')}|${filterLevels.join(',')}`;
  const { visible: visibleSearch, showLoadMore: showLoadMoreSearch, loadMore: loadMoreSearch, showCapMessage: showCapSearch, pageSize: pageSizeSearch } = useVisibleCount(filteredSearch, resetKeySearch);

  const resetKeyMy = `${mySearchQuery}|${myFilters.join(',')}|${myTypes.join(',')}|${myVisibility}|${myFilterSkills.join(',')}|${myFilterLevels.join(',')}`;
  const { visible: visibleMy, showLoadMore: showLoadMoreMy, loadMore: loadMoreMy, showCapMessage: showCapMy, pageSize: pageSizeMy } = useVisibleCount(filteredMy, resetKeyMy);

  const resetKeyPending = `${pendingSearch}|${pendingStatusFilter.join(',')}|${pendingFilterSkills.join(',')}|${pendingFilterLevels.join(',')}`;
  const { visible: visiblePending, showLoadMore: showLoadMorePending, loadMore: loadMorePending, pageSize: pageSizePending } = useVisibleCount(filteredPending, resetKeyPending);

  return (
    <View style={styles.container}>
      <RainbowDivider />
      {/* Tab bar */}
      <View style={styles.tabBar}>
        {(['search', 'my', 'pending', 'create'] as Tab[]).map(tab => {
          const labels: Record<Tab, string> = { search: 'Search', my: 'My Tutorials', pending: 'Pending', create: 'Create' };
          const active = activeTab === tab;
          return (
            <TouchableOpacity
              key={tab}
              style={[styles.tab, active && styles.tabActive]}
              onPress={() => switchTab(tab)}
              activeOpacity={0.75}
            >
              <AppText style={[styles.tabText, active && styles.tabTextActive]}>{labels[tab]}</AppText>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* ── Search Tutorials tab ─────────────────────────────────────────── */}
      {activeTab === 'search' && (
        <View style={styles.tabPane}>
          <View style={styles.searchRow}>
            <LinearGradient colors={[...BUTTERFLY_BORDER.colors]} start={BUTTERFLY_BORDER.start} end={BUTTERFLY_BORDER.end} style={styles.searchGradient}>
              <TextInput
                style={styles.searchInput}
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Search by name…"
                placeholderTextColor={NICO.textMuted}
                clearButtonMode="while-editing"
              />
            </LinearGradient>
          </View>

          {/* Filter bar: More Filters */}
          {(() => {
            const hasSearchMore = filterSkills.length + filterLevels.length > 0;
            return (
              <>
                <View style={styles.filterBar}>
                  <LinearGradient colors={[...BUTTERFLY_BORDER.colors]} start={BUTTERFLY_BORDER.start} end={BUTTERFLY_BORDER.end} style={styles.moreBtnGradient}>
                    <TouchableOpacity style={[styles.moreBtn, hasSearchMore && styles.moreBtnActive]} onPress={() => setShowSearchMoreFilters(true)} activeOpacity={0.75}>
                      <AppText style={[styles.moreBtnText, hasSearchMore && styles.moreBtnTextActive]}>More Filters</AppText>
                    </TouchableOpacity>
                  </LinearGradient>
                </View>
                {hasSearchMore && (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsRow} contentContainerStyle={styles.chipsContent}>
                    {filterSkills.map(s => (
                      <TouchableOpacity key={`skill-${s}`} style={styles.chip} onPress={() => setFilterSkills(p => p.filter(x => x !== s))} activeOpacity={0.75}>
                        <AppText style={styles.chipText}>{s}</AppText>
                        <AppText style={styles.chipX}>×</AppText>
                      </TouchableOpacity>
                    ))}
                    {filterLevels.map(l => (
                      <TouchableOpacity key={`level-${l}`} style={styles.chip} onPress={() => setFilterLevels(p => p.filter(x => x !== l))} activeOpacity={0.75}>
                        <AppText style={styles.chipText}>{l}</AppText>
                        <AppText style={styles.chipX}>×</AppText>
                      </TouchableOpacity>
                    ))}
                    <TouchableOpacity style={styles.clearAllChip} onPress={() => { setFilterSkills([]); setFilterLevels([]); }} activeOpacity={0.75}>
                      <AppText style={styles.clearAllChipText}>Clear all</AppText>
                    </TouchableOpacity>
                  </ScrollView>
                )}
              </>
            );
          })()}

          {loadingSearch ? (
            <View style={styles.center}><ActivityIndicator size="large" color={NICO.primary} /></View>
          ) : (
            <FlatList
              data={visibleSearch}
              keyExtractor={t => t.id}
              numColumns={2}
              columnWrapperStyle={styles.gridRow}
              contentContainerStyle={styles.gridList}
              ListFooterComponent={
                showLoadMoreSearch ? (
                  <TouchableOpacity style={styles.loadMoreBtn} onPress={loadMoreSearch} activeOpacity={0.7}>
                    <AppText style={styles.loadMoreText}>Load {pageSizeSearch} more</AppText>
                  </TouchableOpacity>
                ) : showCapSearch ? (
                  <View style={styles.capMessage}>
                    <AppText style={styles.capMessageText}>Use filters to search records</AppText>
                  </View>
                ) : null
              }
              renderItem={({ item: t }) => {
                const toggling = togglingId === t.id;
                const isLinked = linkedIds.has(t.id);
                return (
                  <TouchableOpacity
                    style={styles.gridCard}
                    onPress={() => navigation.navigate('TutorialPreview', { tutorialId: t.id })}
                    activeOpacity={0.85}
                  >
                    <View style={styles.thumbWrap}>
                      {t.thumbnail_url
                        ? <Image source={{ uri: t.thumbnail_url }} style={styles.gridThumb} />
                        : <View style={[styles.gridThumb, styles.gridThumbPlaceholder]}>
                            <AppText style={styles.gridThumbEmoji}>{FORMAT_EMOJI[t.format] ?? '📚'}</AppText>
                          </View>
                      }
                    </View>
                    <View style={styles.gridCardBody}>
                      <AppText style={styles.gridCardTitle} numberOfLines={IS_TABLET ? 2 : 1}>{cardTitle(t.display_name || t.category)}</AppText>
                      <AppText style={styles.gridCardSub}>{t.category}</AppText>
                      {(t as TutorialWithGuardian).guardian?.full_name && (
                        <AppText style={styles.gridCardCreator} numberOfLines={1}>by {(t as TutorialWithGuardian).guardian!.full_name}</AppText>
                      )}
                      <TouchableOpacity
                        style={[styles.gridAddBtn, isLinked && styles.gridAddBtnLinked]}
                        onPress={() => toggleLink(t)}
                        disabled={toggling}
                        activeOpacity={0.75}
                      >
                        <AppText style={[styles.gridAddBtnText, isLinked && styles.gridAddBtnTextLinked]}>
                          {toggling ? '…' : isLinked ? '✓ Added' : '＋ Add to Learner'}
                        </AppText>
                      </TouchableOpacity>
                    </View>
                  </TouchableOpacity>
                );
              }}
              ListEmptyComponent={
                <View style={styles.empty}>
                  <AppText style={styles.emptyEmoji}>🔍</AppText>
                  <AppText style={styles.emptyText}>No tutorials found</AppText>
                  <AppText style={styles.emptyHint}>Try a different search or filter</AppText>
                </View>
              }
            />
          )}

          <FilterSheet
            visible={showSearchMoreFilters}
            sections={[
              {
                key: 'skill', title: 'Skill',
                options: skillOptions.map(s => ({ key: s, label: s })),
                selected: filterSkills,
                onToggle: s => setFilterSkills(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]),
              },
              {
                key: 'level', title: 'Comprehension Level',
                options: (TUTORIAL_COMPREHENSION as string[]).map(l => ({ key: l, label: l, capitalize: true })),
                selected: filterLevels,
                onToggle: l => setFilterLevels(prev => prev.includes(l) ? prev.filter(x => x !== l) : [...prev, l]),
              },
            ] satisfies FilterSheetSection[]}
            onClearAll={() => { setFilterSkills([]); setFilterLevels([]); }}
            onDone={() => setShowSearchMoreFilters(false)}
          />
        </View>
      )}

      {/* ── My Tutorials tab ─────────────────────────────────────────────── */}
      {activeTab === 'my' && (
        <View style={styles.tabPane}>
          <View style={styles.searchRow}>
            <LinearGradient colors={[...BUTTERFLY_BORDER.colors]} start={BUTTERFLY_BORDER.start} end={BUTTERFLY_BORDER.end} style={styles.searchGradient}>
              <TextInput
                style={styles.searchInput}
                value={mySearchQuery}
                onChangeText={setMySearchQuery}
                placeholder="Search by name…"
                placeholderTextColor={NICO.textMuted}
                clearButtonMode="while-editing"
              />
            </LinearGradient>
          </View>

          {/* Filter bar: More Filters */}
          {(() => {
            const hasMyMore = myFilterSkills.length + myFilterLevels.length + myFilters.length + myTypes.length + (myVisibility !== 'all' ? 1 : 0) > 0;
            return (
              <>
                <View style={styles.filterBar}>
                  <LinearGradient colors={[...BUTTERFLY_BORDER.colors]} start={BUTTERFLY_BORDER.start} end={BUTTERFLY_BORDER.end} style={styles.moreBtnGradient}>
                    <TouchableOpacity style={[styles.moreBtn, hasMyMore && styles.moreBtnActive]} onPress={() => setShowMyMoreFilters(true)} activeOpacity={0.75}>
                      <AppText style={[styles.moreBtnText, hasMyMore && styles.moreBtnTextActive]}>More Filters</AppText>
                    </TouchableOpacity>
                  </LinearGradient>
                </View>
                {hasMyMore && (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsRow} contentContainerStyle={styles.chipsContent}>
                    {myFilterSkills.map(s => (
                      <TouchableOpacity key={`skill-${s}`} style={styles.chip} onPress={() => setMyFilterSkills(p => p.filter(x => x !== s))} activeOpacity={0.75}>
                        <AppText style={styles.chipText}>{s}</AppText>
                        <AppText style={styles.chipX}>×</AppText>
                      </TouchableOpacity>
                    ))}
                    {myFilterLevels.map(l => (
                      <TouchableOpacity key={`level-${l}`} style={styles.chip} onPress={() => setMyFilterLevels(p => p.filter(x => x !== l))} activeOpacity={0.75}>
                        <AppText style={styles.chipText}>{l}</AppText>
                        <AppText style={styles.chipX}>×</AppText>
                      </TouchableOpacity>
                    ))}
                    {myFilters.map(s => (
                      <TouchableOpacity key={`status-${s}`} style={styles.chip} onPress={() => setMyFilters(p => p.filter(x => x !== s))} activeOpacity={0.75}>
                        <AppText style={styles.chipText}>{MY_FILTER_OPTIONS.find(o => o.key === s)?.label ?? s}</AppText>
                        <AppText style={styles.chipX}>×</AppText>
                      </TouchableOpacity>
                    ))}
                    {myTypes.map(t => (
                      <TouchableOpacity key={`type-${t}`} style={styles.chip} onPress={() => setMyTypes(p => p.filter(x => x !== t))} activeOpacity={0.75}>
                        <AppText style={styles.chipText}>{MY_TYPE_OPTIONS.find(o => o.key === t)?.label ?? t}</AppText>
                        <AppText style={styles.chipX}>×</AppText>
                      </TouchableOpacity>
                    ))}
                    {myVisibility !== 'all' && (
                      <TouchableOpacity style={styles.chip} onPress={() => setMyVisibility('all')} activeOpacity={0.75}>
                        <AppText style={styles.chipText}>{myVisibility === 'public' ? '🌐 Public' : '🔒 Private'}</AppText>
                        <AppText style={styles.chipX}>×</AppText>
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity style={styles.clearAllChip} onPress={() => { setMyFilterSkills([]); setMyFilterLevels([]); setMyFilters([]); setMyTypes([]); setMyVisibility('all'); }} activeOpacity={0.75}>
                      <AppText style={styles.clearAllChipText}>Clear all</AppText>
                    </TouchableOpacity>
                  </ScrollView>
                )}
              </>
            );
          })()}

          <FilterSheet
            visible={showMyMoreFilters}
            sections={[
              {
                key: 'skill', title: 'Skill',
                options: skillOptions.map(s => ({ key: s, label: s })),
                selected: myFilterSkills,
                onToggle: s => setMyFilterSkills(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]),
              },
              {
                key: 'level', title: 'Comprehension Level',
                options: (TUTORIAL_COMPREHENSION as string[]).map(l => ({ key: l, label: l, capitalize: true })),
                selected: myFilterLevels,
                onToggle: l => setMyFilterLevels(prev => prev.includes(l) ? prev.filter(x => x !== l) : [...prev, l]),
              },
              {
                key: 'status', title: 'Status',
                options: MY_FILTER_OPTIONS.map(o => ({ key: o.key, label: o.label })),
                selected: myFilters,
                onToggle: k => setMyFilters(prev => prev.includes(k as TutorialStatus) ? prev.filter(x => x !== k) : [...prev, k as TutorialStatus]),
              },
              {
                key: 'type', title: 'Type',
                options: MY_TYPE_OPTIONS.map(o => ({ key: o.key, label: o.label })),
                selected: myTypes,
                onToggle: k => setMyTypes(prev => prev.includes(k as TutorialSource) ? prev.filter(x => x !== k) : [...prev, k as TutorialSource]),
              },
              {
                key: 'visibility', title: 'Visibility', type: 'single',
                options: [
                  { key: 'all', label: 'All' },
                  { key: 'public', label: '🌐 Public' },
                  { key: 'private', label: '🔒 Private' },
                ],
                selected: [myVisibility],
                onToggle: v => setMyVisibility(v as 'all' | 'public' | 'private'),
              },
            ] satisfies FilterSheetSection[]}
            onClearAll={() => { setMyFilterSkills([]); setMyFilterLevels([]); setMyFilters([]); setMyTypes([]); setMyVisibility('all'); }}
            onDone={() => setShowMyMoreFilters(false)}
          />

          {loadingMy ? (
            <View style={styles.center}><ActivityIndicator size="large" color={NICO.primary} /></View>
          ) : (
            <FlatList
              data={visibleMy}
              keyExtractor={t => t.id}
              numColumns={2}
              columnWrapperStyle={styles.gridRow}
              contentContainerStyle={styles.gridList}
              ListHeaderComponent={
                filteredMy.length > 0
                  ? <AppText style={styles.listCount}>{filteredMy.length} tutorial{filteredMy.length !== 1 ? 's' : ''}</AppText>
                  : null
              }
              ListFooterComponent={
                showLoadMoreMy ? (
                  <TouchableOpacity style={styles.loadMoreBtn} onPress={loadMoreMy} activeOpacity={0.7}>
                    <AppText style={styles.loadMoreText}>Load {pageSizeMy} more</AppText>
                  </TouchableOpacity>
                ) : showCapMy ? (
                  <View style={styles.capMessage}><AppText style={styles.capMessageText}>Use filters to search records</AppText></View>
                ) : null
              }
              renderItem={({ item: t }) => (
                <TouchableOpacity
                  style={styles.gridCard}
                  onPress={() => { if (t.status !== 'generating') navigation.navigate('TutorialPreview', { tutorialId: t.id }); }}
                  activeOpacity={t.status === 'generating' ? 1 : 0.85}
                >
                  <View style={styles.thumbWrap}>
                    {t.thumbnail_url
                      ? <Image source={{ uri: t.thumbnail_url }} style={styles.gridThumb} />
                      : <View style={[styles.gridThumb, styles.gridThumbPlaceholder]}>
                          <AppText style={styles.gridThumbEmoji}>{FORMAT_EMOJI[t.format] ?? '📚'}</AppText>
                        </View>
                    }
                    <View style={[styles.statusRibbon, { backgroundColor: STATUS_COLORS[t.status as TutorialStatus].bg }]}>
                      <AppText style={[styles.statusRibbonText, { color: STATUS_COLORS[t.status as TutorialStatus].text }]}>
                        {STATUS_RIBBON_LABELS[t.status as TutorialStatus]}
                      </AppText>
                    </View>
                    {t.status !== 'generating' && (
                      <TouchableOpacity style={styles.gridDeleteBtn} onPress={() => deleteTutorial(t)} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                        <AppText style={styles.gridDeleteIcon}>{GRID_CARD.deleteIcon}</AppText>
                      </TouchableOpacity>
                    )}
                  </View>
                  <View style={styles.gridCardBody}>
                    <AppText style={styles.gridCardTitle} numberOfLines={IS_TABLET ? 2 : 1}>{cardTitle(t.display_name || t.category)}</AppText>
                    <AppText style={styles.gridCardSub}>{t.category}</AppText>
                    {t.status === 'generating' && <AppText style={styles.generatingHint}>May take 1–2 mins</AppText>}
                    {t.status === 'approved' && learnerUserId && (
                      <TouchableOpacity
                        style={[styles.gridAddBtn, linkedIds.has(t.id) && styles.gridAddBtnLinked]}
                        onPress={() => toggleLink(t)}
                        disabled={togglingId === t.id}
                        activeOpacity={0.75}
                      >
                        <AppText style={[styles.gridAddBtnText, linkedIds.has(t.id) && styles.gridAddBtnTextLinked]}>
                          {togglingId === t.id ? '…' : linkedIds.has(t.id) ? '✓ Added' : '＋ Add to Learner'}
                        </AppText>
                      </TouchableOpacity>
                    )}
                  </View>
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <View style={styles.empty}>
                  <AppText style={styles.emptyEmoji}>📚</AppText>
                  <AppText style={styles.emptyText}>No tutorials yet</AppText>
                  <AppText style={styles.emptyHint}>Create a tutorial to get started</AppText>
                </View>
              }
            />
          )}
        </View>
      )}

      {/* ── Pending tab ──────────────────────────────────────────────────── */}
      {activeTab === 'pending' && (
        <View style={styles.tabPane}>
          <View style={styles.searchRow}>
            <LinearGradient colors={[...BUTTERFLY_BORDER.colors]} start={BUTTERFLY_BORDER.start} end={BUTTERFLY_BORDER.end} style={styles.searchGradient}>
              <TextInput
                style={styles.searchInput}
                value={pendingSearch}
                onChangeText={setPendingSearch}
                placeholder="Search by name…"
                placeholderTextColor={NICO.textMuted}
                clearButtonMode="while-editing"
              />
            </LinearGradient>
          </View>

          {/* Filter bar: More Filters */}
          {(() => {
            const hasPendingMore = pendingFilterSkills.length + pendingFilterLevels.length + pendingStatusFilter.length > 0;
            return (
              <>
                <View style={styles.filterBar}>
                  <LinearGradient colors={[...BUTTERFLY_BORDER.colors]} start={BUTTERFLY_BORDER.start} end={BUTTERFLY_BORDER.end} style={styles.moreBtnGradient}>
                    <TouchableOpacity style={[styles.moreBtn, hasPendingMore && styles.moreBtnActive]} onPress={() => setShowPendingMoreFilters(true)} activeOpacity={0.75}>
                      <AppText style={[styles.moreBtnText, hasPendingMore && styles.moreBtnTextActive]}>More Filters</AppText>
                    </TouchableOpacity>
                  </LinearGradient>
                </View>
                {hasPendingMore && (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsRow} contentContainerStyle={styles.chipsContent}>
                    {pendingFilterSkills.map(s => (
                      <TouchableOpacity key={`skill-${s}`} style={styles.chip} onPress={() => setPendingFilterSkills(p => p.filter(x => x !== s))} activeOpacity={0.75}>
                        <AppText style={styles.chipText}>{s}</AppText>
                        <AppText style={styles.chipX}>×</AppText>
                      </TouchableOpacity>
                    ))}
                    {pendingFilterLevels.map(l => (
                      <TouchableOpacity key={`level-${l}`} style={styles.chip} onPress={() => setPendingFilterLevels(p => p.filter(x => x !== l))} activeOpacity={0.75}>
                        <AppText style={styles.chipText}>{l}</AppText>
                        <AppText style={styles.chipX}>×</AppText>
                      </TouchableOpacity>
                    ))}
                    {pendingStatusFilter.map(s => (
                      <TouchableOpacity key={`status-${s}`} style={styles.chip} onPress={() => setPendingStatusFilter(p => p.filter(x => x !== s))} activeOpacity={0.75}>
                        <AppText style={styles.chipText}>{PENDING_STATUS_OPTIONS.find(o => o.key === s)?.label ?? s}</AppText>
                        <AppText style={styles.chipX}>×</AppText>
                      </TouchableOpacity>
                    ))}
                    <TouchableOpacity style={styles.clearAllChip} onPress={() => { setPendingFilterSkills([]); setPendingFilterLevels([]); setPendingStatusFilter([]); }} activeOpacity={0.75}>
                      <AppText style={styles.clearAllChipText}>Clear all</AppText>
                    </TouchableOpacity>
                  </ScrollView>
                )}
              </>
            );
          })()}

          <FilterSheet
            visible={showPendingMoreFilters}
            sections={[
              {
                key: 'skill', title: 'Skill',
                options: skillOptions.map(s => ({ key: s, label: s })),
                selected: pendingFilterSkills,
                onToggle: s => setPendingFilterSkills(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]),
              },
              {
                key: 'level', title: 'Comprehension Level',
                options: (TUTORIAL_COMPREHENSION as string[]).map(l => ({ key: l, label: l, capitalize: true })),
                selected: pendingFilterLevels,
                onToggle: l => setPendingFilterLevels(prev => prev.includes(l) ? prev.filter(x => x !== l) : [...prev, l]),
              },
              {
                key: 'status', title: 'Status',
                options: PENDING_STATUS_OPTIONS.map(o => ({ key: o.key, label: o.label })),
                selected: pendingStatusFilter,
                onToggle: k => setPendingStatusFilter(prev => prev.includes(k as TutorialStatus) ? prev.filter(x => x !== k) : [...prev, k as TutorialStatus]),
              },
            ] satisfies FilterSheetSection[]}
            onClearAll={() => { setPendingFilterSkills([]); setPendingFilterLevels([]); setPendingStatusFilter([]); }}
            onDone={() => setShowPendingMoreFilters(false)}
          />

          {loadingMy ? (
            <View style={styles.center}><ActivityIndicator size="large" color={NICO.primary} /></View>
          ) : (
            <FlatList
              data={visiblePending}
              keyExtractor={t => t.id}
              numColumns={2}
              columnWrapperStyle={styles.gridRow}
              contentContainerStyle={styles.gridList}
              ListHeaderComponent={
                filteredPending.length > 0
                  ? <AppText style={styles.listCount}>{filteredPending.length} tutorial{filteredPending.length !== 1 ? 's' : ''}</AppText>
                  : null
              }
              ListFooterComponent={
                showLoadMorePending ? (
                  <TouchableOpacity style={styles.loadMoreBtn} onPress={loadMorePending} activeOpacity={0.7}>
                    <AppText style={styles.loadMoreText}>Load {pageSizePending} more</AppText>
                  </TouchableOpacity>
                ) : null
              }
              renderItem={({ item: t }) => (
                <TouchableOpacity
                  style={styles.gridCard}
                  onPress={() => { if (t.status !== 'generating') navigation.navigate('TutorialPreview', { tutorialId: t.id }); }}
                  activeOpacity={t.status === 'generating' ? 1 : 0.85}
                >
                  <View style={styles.thumbWrap}>
                    {t.thumbnail_url
                      ? <Image source={{ uri: t.thumbnail_url }} style={styles.gridThumb} />
                      : <View style={[styles.gridThumb, styles.gridThumbPlaceholder]}>
                          <AppText style={styles.gridThumbEmoji}>{FORMAT_EMOJI[t.format] ?? '📚'}</AppText>
                        </View>
                    }
                    <View style={[styles.statusRibbon, { backgroundColor: STATUS_COLORS[t.status as TutorialStatus].bg }]}>
                      <AppText style={[styles.statusRibbonText, { color: STATUS_COLORS[t.status as TutorialStatus].text }]}>
                        {STATUS_RIBBON_LABELS[t.status as TutorialStatus]}
                      </AppText>
                    </View>
                    {t.status !== 'generating' && (
                      <TouchableOpacity style={styles.gridDeleteBtn} onPress={() => deleteTutorial(t)} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                        <AppText style={styles.gridDeleteIcon}>{GRID_CARD.deleteIcon}</AppText>
                      </TouchableOpacity>
                    )}
                  </View>
                  <View style={styles.gridCardBody}>
                    <AppText style={styles.gridCardTitle} numberOfLines={IS_TABLET ? 2 : 1}>{cardTitle(t.display_name || t.category)}</AppText>
                    <AppText style={styles.gridCardSub}>{t.category}</AppText>
                    {t.status === 'generating' && <AppText style={styles.generatingHint}>May take 1–2 mins</AppText>}
                  </View>
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <View style={styles.empty}>
                  <AppText style={styles.emptyEmoji}>⏳</AppText>
                  <AppText style={styles.emptyText}>No pending tutorials</AppText>
                  <AppText style={styles.emptyHint}>Tutorials in progress will appear here</AppText>
                </View>
              }
            />
          )}
        </View>
      )}

      {/* ── Create Tutorial tab ───────────────────────────────────────────── */}
      {activeTab === 'create' && (
        <View style={styles.tabPane}>
          {quota && (
            <LinearGradient
              colors={[...BUTTERFLY_BORDER.colors]}
              start={BUTTERFLY_BORDER.start}
              end={BUTTERFLY_BORDER.end}
              style={styles.quotaGradient}
            >
              <View style={styles.quotaBar}>
                <View style={styles.quotaHeader}>
                  <AppText style={styles.quotaLabel}>Monthly quota</AppText>
                  <AppText style={[styles.quotaCount, quota.used >= quota.limit && { color: NICO.error }]}>
                    {quota.used} / {quota.limit} used
                  </AppText>
                </View>
                <View style={styles.quotaTrack}>
                  <View style={[styles.quotaFill, {
                    width: `${Math.min((quota.used / quota.limit) * 100, 100)}%` as any,
                    backgroundColor: quota.used >= quota.limit ? NICO.error : NICO.primary,
                  }]} />
                </View>
              </View>
            </LinearGradient>
          )}

          <TouchableOpacity
            style={[styles.createCard, quota?.used !== undefined && quota.used >= quota.limit && { opacity: 0.6 }]}
            onPress={() => {
              if (quota && quota.used >= quota.limit) { Alert.alert('Quota reached', `You have used all ${quota.limit} tutorials for this month.`); return; }
              navigation.navigate('CreateTutorial');
            }}
            activeOpacity={0.85}
          >
            <AppText style={styles.createEmoji}>✨</AppText>
            <View style={styles.createCardContent}>
              <AppText style={styles.createHeading}>AI-Generated Tutorial</AppText>
              <AppText style={styles.createBody}>AI creates a personalised slideshow for your learner.</AppText>
            </View>
            <AppText style={styles.createChevron}>›</AppText>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.createCard}
            onPress={() => navigation.navigate('LinkYoutube')}
            activeOpacity={0.85}
          >
            <AppText style={styles.createEmoji}>▶️</AppText>
            <View style={styles.createCardContent}>
              <AppText style={styles.createHeading}>Link YouTube Video</AppText>
              <AppText style={styles.createBody}>Embed a YouTube video — plays inside the app. ⚠️ May show ads.</AppText>
            </View>
            <AppText style={styles.createChevron}>›</AppText>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: NICO.screenBg },
  center:    { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 60 },

  // Tab bar
  tabBar: {
    flexDirection: 'row', backgroundColor: NICO.surface,
    borderBottomWidth: 1, borderBottomColor: NICO.border,
  },
  tab: {
    flex: 1, paddingVertical: SPACING.md, alignItems: 'center',
    borderBottomWidth: 2.5, borderBottomColor: 'transparent',
  },
  tabActive:     { borderBottomColor: NICO.primary },
  tabText:       { ...TEXT_STYLE.tabLabel },
  tabTextActive: { ...TEXT_STYLE.tabLabel, color: NICO.primary, fontWeight: FONT_WEIGHT.extraBold },

  // Search / name input row
  searchRow:    { padding: SPACING.base, paddingBottom: SPACING.sm },
  searchGradient: {
    padding: BUTTERFLY_BORDER.width,
    borderRadius: RADIUS.md + BUTTERFLY_BORDER.width,
  },
  searchInput: {
    ...INPUT.base,
    borderWidth: 0,   // gradient wrapper provides the visual border
  },

  // Link button (My Tutorials tab)
  linkBtn:           { ...BTN_SIZE.sm, ...BTN_VARIANT.primary, marginTop: SPACING.sm, alignSelf: CARD_BTN_ALIGN },
  linkBtnLinked:     { backgroundColor: NICO.successLight, ...SHADOW.none },
  linkBtnText:       { ...TEXT_STYLE.buttonSmall },
  linkBtnTextLinked: { ...TEXT_STYLE.buttonSmall, color: NICO.success },

  // Search tab grid
  gridList: { padding: SPACING.md, paddingBottom: SPACING['2xl'] },
  gridRow:  { gap: SPACING.md, marginBottom: SPACING.md },
  gridCard: {
    flex: 1, backgroundColor: 'white', borderRadius: RADIUS.xl,
    borderWidth: 1, borderColor: NICO.border, overflow: 'hidden',
    ...SHADOW.md,
  },
  thumbWrap:            { position: 'relative', overflow: 'hidden' },
  gridThumb:            { width: '100%', height: 120 },
  gridThumbPlaceholder: { backgroundColor: NICO.background, justifyContent: 'center', alignItems: 'center' },
  gridThumbEmoji:       { fontSize: 44 },
  statusRibbon: {
    position: 'absolute',
    top: GRID_CARD.ribbonTop, left: GRID_CARD.ribbonLeft, width: GRID_CARD.ribbonWidth,
    paddingVertical: GRID_CARD.ribbonPadding, alignItems: 'center',
    transform: [{ rotate: '-45deg' }],
  },
  statusRibbonText: { fontSize: FONT_SIZE.xs, fontWeight: FONT_WEIGHT.bold },
  gridCardBody:         { padding: SPACING.md, gap: SPACING.xs },
  gridCardTitle:        { ...TEXT_STYLE.bodyMedium, lineHeight: 20 },
  gridCardSub:          { ...TEXT_STYLE.caption, marginBottom: SPACING.xs },
  gridCardCreator:      { ...TEXT_STYLE.labelSmall, fontStyle: 'italic' },
  gridDeleteBtn: {
    position: 'absolute', top: SPACING.xs, right: SPACING.xs,
    backgroundColor: GRID_CARD.deleteBg,
    borderWidth: 1.5, borderColor: GRID_CARD.deleteBorder,
    borderRadius: RADIUS.full,
    width: GRID_CARD.deleteSize, height: GRID_CARD.deleteSize, justifyContent: 'center', alignItems: 'center',
    ...SHADOW.sm,
  },
  gridDeleteIcon: { fontSize: FONT_SIZE.md, color: GRID_CARD.deleteColor, fontWeight: FONT_WEIGHT.bold },
  gridAddBtn:           { ...BTN_SIZE.sm, ...BTN_VARIANT.primary, alignSelf: CARD_BTN_ALIGN, marginTop: SPACING.xs },
  gridAddBtnLinked:     { backgroundColor: NICO.successLight, ...SHADOW.none },
  gridAddBtnText:       { ...TEXT_STYLE.buttonSmall },
  gridAddBtnTextLinked: { ...TEXT_STYLE.buttonSmall, color: NICO.success },

  // Quota bar (Create tab)
  quotaGradient: {
    marginHorizontal: SPACING.base, marginTop: SPACING.base, marginBottom: SPACING.xs,
    borderRadius: RADIUS.lg + BUTTERFLY_BORDER.width,
    padding: BUTTERFLY_BORDER.width,
    ...SHADOW.sm,
  },
  quotaBar: {
    backgroundColor: NICO.surface, borderRadius: RADIUS.lg,
    padding: SPACING.base, gap: SPACING.sm,
  },
  quotaHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  quotaLabel:  { ...TEXT_STYLE.bodyMedium },
  quotaCount:  { ...TEXT_STYLE.bodyMedium, color: NICO.primary },
  quotaTrack:  { height: 6, backgroundColor: NICO.border, borderRadius: RADIUS.full, overflow: 'hidden' },
  quotaFill:   { height: '100%', borderRadius: RADIUS.full },

  // Tutorial list (My + Pending tabs)
  list: { padding: SPACING.base, gap: SPACING.md },
  card: {
    backgroundColor: NICO.surface, borderRadius: RADIUS.xl,
    borderWidth: 1, borderColor: NICO.border,
    flexDirection: 'row', alignItems: 'center', gap: SPACING.md, padding: SPACING.md,
    ...SHADOW.md,
  },
  thumb: {
    width: 80, height: 80, borderRadius: RADIUS.lg, backgroundColor: NICO.background,
    justifyContent: 'center', alignItems: 'center', overflow: 'hidden', flexShrink: 0,
  },
  thumbImage:     { width: 80, height: 80 },
  thumbEmoji:     { fontSize: 36 },
  cardInfo:       { flex: 1, minWidth: 0, gap: SPACING.xs },
  cardTitle:      { ...TEXT_STYLE.bodyMedium, fontSize: FONT_SIZE.xl, lineHeight: 22 },
  cardSub:        { ...TEXT_STYLE.hint },
  cardCreator:    { ...TEXT_STYLE.labelSmall, fontStyle: 'italic', marginTop: 2 },
  cardMeta:       { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginTop: SPACING.xs, flexWrap: 'wrap' },
  statusBadge:    { borderRadius: RADIUS.full, paddingHorizontal: SPACING.md, paddingVertical: SPACING.xs },
  statusText:     { fontSize: FONT_SIZE.xs, fontWeight: FONT_WEIGHT.bold },
  metaText:       { ...TEXT_STYLE.hint },
  generatingHint: { ...TEXT_STYLE.caption, marginTop: SPACING.xs },
  privateBadge:   { fontSize: FONT_SIZE.md },
  listCount:      { ...TEXT_STYLE.hint, paddingHorizontal: SPACING.xs, paddingBottom: SPACING.sm },
  deleteBtn:      { padding: SPACING.sm },
  deleteBtnText:  { fontSize: FONT_SIZE['4xl'] },

  // Load more / cap
  loadMoreBtn: { ...BTN_SIZE.sm, ...BTN_VARIANT.outline, alignSelf: 'center', marginTop: SPACING.base },
  loadMoreText: { fontSize: FONT_SIZE.lg, fontWeight: FONT_WEIGHT.extraBold, color: NICO.primary },
  capMessage:     { alignItems: 'center', paddingVertical: SPACING.base },
  capMessageText: { ...TEXT_STYLE.hint, fontStyle: 'italic' },

  // Empty state
  empty:      { alignItems: 'center', paddingTop: 80, gap: SPACING.md },
  emptyEmoji: { fontSize: 72 },
  emptyText:  { ...TEXT_STYLE.cardTitle },
  emptyHint:  { ...TEXT_STYLE.hint },

  // Create tab
  tabPane: { flex: 1, backgroundColor: NICO.background },
  createCard: {
    marginHorizontal: SPACING.base, marginTop: SPACING.md,
    backgroundColor: 'white', borderRadius: RADIUS.xl,
    borderWidth: 1, borderColor: NICO.border,
    paddingVertical: SPACING.base, paddingHorizontal: SPACING.base,
    flexDirection: 'row', alignItems: 'center', gap: SPACING.md,
    ...SHADOW.md,
  },
  createEmoji:       { fontSize: 34 },
  createCardContent: { flex: 1, gap: SPACING.xs },
  createHeading:     { ...TEXT_STYLE.bodyMedium, fontSize: FONT_SIZE.xl },
  createBody:        { ...TEXT_STYLE.hint, lineHeight: 18 },
  createChevron:     { fontSize: FONT_SIZE['4xl'], color: NICO.textMuted, lineHeight: 28 },
  createBtnText:     { ...TEXT_STYLE.buttonPrimary },

  // Label-value filter panel
  filterPanel: {
    marginHorizontal: SPACING.base, marginBottom: SPACING.sm,
    backgroundColor: NICO.surface, borderRadius: RADIUS.lg,
    borderWidth: 1, borderColor: NICO.border, overflow: 'hidden',
  },
  filterRow:         { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.base, paddingVertical: SPACING.md, gap: SPACING.sm },
  filterLabel:       { ...TEXT_STYLE.bodyMedium, width: 52 },
  filterValue:       { flex: 1, ...TEXT_STYLE.body },
  filterPlaceholder: { color: NICO.textMuted, fontWeight: FONT_WEIGHT.regular },
  filterClear:       { ...TEXT_STYLE.caption, color: NICO.textMuted, fontWeight: FONT_WEIGHT.bold, paddingHorizontal: SPACING.xs },
  filterChevron:     { fontSize: FONT_SIZE['2xl'], color: NICO.textMuted, lineHeight: 26 },
  filterDivider:     { height: 1, backgroundColor: NICO.border, marginHorizontal: SPACING.base },
  segmented:         { flex: 1, flexDirection: 'row', gap: SPACING.xs },
  segment: {
    flex: 1, paddingVertical: SPACING.sm, borderRadius: RADIUS.md, alignItems: 'center',
    backgroundColor: NICO.screenBg, borderWidth: 1, borderColor: NICO.border,
  },
  segmentActive:     { backgroundColor: NICO.primary, borderColor: NICO.primary },
  segmentText:       { ...TEXT_STYLE.caption },
  segmentTextActive: { ...TEXT_STYLE.caption, color: NICO.textOnAccent, fontWeight: FONT_WEIGHT.bold },

  // Picker bottom sheet
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.40)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: NICO.surface,
    borderTopLeftRadius: RADIUS['3xl'], borderTopRightRadius: RADIUS['3xl'],
    paddingBottom: SPACING['2xl'],
  },
  sheetHdr: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg, paddingVertical: SPACING.base,
    borderBottomWidth: 1, borderBottomColor: NICO.border,
  },
  sheetTitle:            { ...TEXT_STYLE.modalTitle },
  sheetClear:            { ...TEXT_STYLE.linkSmall },
  sheetOption: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg, paddingVertical: SPACING.base,
    borderBottomWidth: 1, borderBottomColor: NICO.border,
  },
  sheetOptionActive:     { backgroundColor: NICO.primaryLight },
  sheetOptionText:       { ...TEXT_STYLE.body },
  sheetOptionTextActive: { ...TEXT_STYLE.body, color: NICO.primary, fontWeight: FONT_WEIGHT.bold },
  sheetDone: {
    marginHorizontal: SPACING.lg, marginTop: SPACING.base,
    ...BTN_SIZE.lg, ...BTN_VARIANT.primary,
  },
  sheetDoneText:  { ...TEXT_STYLE.buttonPrimary },
  multiCheck: {
    width: 22, height: 22, borderRadius: RADIUS.xs,
    borderWidth: 2, borderColor: NICO.border,
    backgroundColor: NICO.screenBg, justifyContent: 'center', alignItems: 'center',
  },
  multiCheckActive: { backgroundColor: NICO.primary, borderColor: NICO.primary },
  multiCheckMark:   { color: NICO.textOnAccent, fontSize: FONT_SIZE.xs, fontWeight: FONT_WEIGHT.extraBold },

  // Filter bar (inline chip + More Filters button)
  filterBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end',
    paddingHorizontal: SPACING.base, paddingVertical: SPACING.sm,
  },
  moreBtnGradient: {
    padding: BUTTERFLY_BORDER.width,
    borderRadius: RADIUS.full,
  },
  moreBtn: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.base, paddingVertical: SPACING.xs,
    backgroundColor: NICO.screenBg,
  },
  moreBtnActive: { backgroundColor: NICO.primaryLight },
  moreBtnText: { fontSize: FONT_SIZE.md, fontWeight: FONT_WEIGHT.medium, color: NICO.textMuted },
  moreBtnTextActive: { fontSize: FONT_SIZE.md, fontWeight: FONT_WEIGHT.semiBold, color: NICO.primary },

  // Active-filter chips strip
  chipsRow: { maxHeight: 40 },
  chipsContent: { paddingHorizontal: SPACING.base, gap: SPACING.xs, alignItems: 'center' },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: NICO.primaryLight, borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.sm, paddingVertical: 4,
  },
  chipText: { ...TEXT_STYLE.caption, color: NICO.primary, textTransform: 'capitalize' },
  chipX:    { fontSize: FONT_SIZE.xs, color: NICO.primary, fontWeight: FONT_WEIGHT.bold },
  clearAllChip: {
    paddingHorizontal: SPACING.sm, paddingVertical: 4,
    borderRadius: RADIUS.full, borderWidth: 1, borderColor: NICO.border,
  },
  clearAllChipText: { ...TEXT_STYLE.caption, color: NICO.textMuted },

  // Sheet section header
  sheetSectionHdr: {
    ...TEXT_STYLE.caption, color: NICO.textMuted, fontWeight: FONT_WEIGHT.bold,
    textTransform: 'uppercase', letterSpacing: 0.8,
    paddingHorizontal: SPACING.lg, paddingTop: SPACING.base, paddingBottom: SPACING.xs,
    backgroundColor: NICO.background,
  },
});
