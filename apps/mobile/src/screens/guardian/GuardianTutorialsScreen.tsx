import React, { useCallback, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  Image, ActivityIndicator, Alert, TextInput, Modal, ScrollView,
} from 'react-native';
import AppText from '../../components/AppText';
import { useFocusEffect, useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/AuthContext';
import { COLORS, TUTORIAL_COMPREHENSION } from '../../constants';
import { GuardianNavParamList } from '../../navigation';
import type { Tutorial, TutorialStatus, TutorialSource } from '../../types';

type TutorialWithGuardian = Tutorial & { guardian?: { full_name: string } | null };

const STATUS_COLORS: Record<TutorialStatus, { bg: string; text: string }> = {
  generating: { bg: '#E8ECEF', text: '#5D6D7E' },
  preview:    { bg: '#FEF3CD', text: '#B7791F' },
  pending:    { bg: '#DBEAFE', text: '#1D4ED8' },
  approved:   { bg: COLORS.statusGreenLight, text: COLORS.statusGreenDark },
  rejected:   { bg: COLORS.statusRedLight, text: '#991B1B' },
};

const STATUS_LABELS: Record<TutorialStatus, string> = {
  generating: 'Generating…',
  preview:    'Preview',
  pending:    'Pending Approval',
  approved:   'Approved',
  rejected:   'Rejected',
};

const FORMAT_EMOJI: Record<string, string> = { video: '🎬', slideshow: '🖼' };

type Tab = 'search' | 'my' | 'create';

const MY_TYPE_OPTIONS: { key: TutorialSource; label: string }[] = [
  { key: 'ai_generated', label: '✨ AI Generated' },
  { key: 'youtube',      label: '▶️ YouTube' },
];

const MY_FILTER_OPTIONS: { key: TutorialStatus; label: string }[] = [
  { key: 'generating', label: 'Generating Tutorial' },
  { key: 'preview',    label: 'Preview' },
  { key: 'pending',    label: 'Pending Approval' },
  { key: 'approved',   label: 'Approved' },
  { key: 'rejected',   label: 'Rejected' },
];

export default function GuardianTutorialsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<GuardianNavParamList>>();
  const route = useRoute<RouteProp<GuardianNavParamList, 'Learning'>>();
  const { guardian } = useAuth();

  const [activeTab, setActiveTab] = useState<Tab>(route.params?.initialTab ?? 'search');

  // ── My Tutorials tab ──────────────────────────────────────────────────────
  const [myTutorials, setMyTutorials]   = useState<Tutorial[]>([]);
  const [loadingMy, setLoadingMy]       = useState(true);
  const [myFilters, setMyFilters]       = useState<TutorialStatus[]>([]);
  const [myTypes, setMyTypes]           = useState<TutorialSource[]>([]);
  const [myVisibility, setMyVisibility] = useState<'all' | 'public' | 'private'>('all');
  const [showMyFilterPicker, setShowMyFilterPicker] = useState(false);
  const [showMyTypePicker, setShowMyTypePicker]     = useState(false);
  const [quota, setQuota]               = useState<{ used: number; limit: number } | null>(null);

  // ── Search Tutorials tab ──────────────────────────────────────────────────
  const [approved, setApproved]         = useState<TutorialWithGuardian[]>([]);
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [searchQuery, setSearchQuery]   = useState('');
  const [linkedIds, setLinkedIds]       = useState<Set<string>>(new Set());
  const [learnerUserId, setLearnerUserId] = useState<string | null>(null);
  const [togglingId, setTogglingId]     = useState<string | null>(null);
  const [skillOptions, setSkillOptions] = useState<string[]>([]);
  const [filterSkills, setFilterSkills] = useState<string[]>([]);
  const [filterLevels, setFilterLevels] = useState<string[]>([]);
  const [showSkillPicker, setShowSkillPicker] = useState(false);
  const [showLevelPicker, setShowLevelPicker] = useState(false);

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
    const matchStatus = myFilters.length === 0 || myFilters.includes(t.status as TutorialStatus);
    const matchType   = myTypes.length === 0   || myTypes.includes(t.source as TutorialSource);
    const matchVis    = myVisibility === 'all' || (myVisibility === 'public' ? t.is_public : !t.is_public);
    return matchStatus && matchType && matchVis;
  });
  const filteredSearch = approved.filter(t => {
    if (linkedIds.has(t.id)) return false;
    const q = searchQuery.toLowerCase();
    const matchSearch = !q || t.title?.toLowerCase().includes(q) || t.category?.toLowerCase().includes(q) || (t.display_name ?? '').toLowerCase().includes(q);
    const matchSkill  = filterSkills.length === 0 || filterSkills.includes(t.category);
    const matchLevel  = filterLevels.length === 0 || filterLevels.includes(t.comprehension_level);
    return matchSearch && matchSkill && matchLevel;
  });

  return (
    <View style={styles.container}>
      {/* Tab bar */}
      <View style={styles.tabBar}>
        {(['search', 'my', 'create'] as Tab[]).map(tab => {
          const labels: Record<Tab, string> = { search: 'Search', my: 'My Tutorials', create: 'Create' };
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
        <View style={{ flex: 1 }}>
          <View style={styles.searchRow}>
            <TextInput
              style={styles.searchInput}
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search tutorials…"
              placeholderTextColor={COLORS.bloomMuted}
              clearButtonMode="while-editing"
            />
          </View>

          {/* Skill & Level filters */}
          <View style={styles.filterPanel}>
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
          </View>

          {loadingSearch ? (
            <View style={styles.center}><ActivityIndicator size="large" color={COLORS.bloomAccent} /></View>
          ) : (
            <FlatList
              data={filteredSearch}
              keyExtractor={t => t.id}
              numColumns={2}
              columnWrapperStyle={styles.gridRow}
              contentContainerStyle={styles.gridList}
              renderItem={({ item: t }) => {
                const toggling = togglingId === t.id;
                const isLinked = linkedIds.has(t.id);
                return (
                  <TouchableOpacity
                    style={styles.gridCard}
                    onPress={() => navigation.navigate('TutorialPreview', { tutorialId: t.id })}
                    activeOpacity={0.85}
                  >
                    <View>
                      {t.thumbnail_url
                        ? <Image source={{ uri: t.thumbnail_url }} style={styles.gridThumb} />
                        : <View style={[styles.gridThumb, styles.gridThumbPlaceholder]}>
                            <AppText style={styles.gridThumbEmoji}>{FORMAT_EMOJI[t.format] ?? '📚'}</AppText>
                          </View>
                      }
                    </View>
                    <View style={styles.gridCardBody}>
                      <AppText style={styles.gridCardTitle} numberOfLines={2}>{t.display_name || t.category}</AppText>
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

          {/* Skill picker */}
          <Modal visible={showSkillPicker} transparent animationType="slide" onRequestClose={() => setShowSkillPicker(false)}>
            <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setShowSkillPicker(false)}>
              <View style={styles.sheet} onStartShouldSetResponder={() => true}>
                <View style={styles.sheetHdr}>
                  <AppText style={styles.sheetTitle}>Target Skill</AppText>
                  {filterSkills.length > 0 && (
                    <TouchableOpacity onPress={() => setFilterSkills([])}>
                      <AppText style={styles.sheetClear}>Clear all</AppText>
                    </TouchableOpacity>
                  )}
                </View>
                <ScrollView style={{ maxHeight: 340 }}>
                  {skillOptions.map(s => {
                    const selected = filterSkills.includes(s);
                    return (
                      <TouchableOpacity
                        key={s}
                        style={[styles.sheetOption, selected && styles.sheetOptionActive]}
                        onPress={() => setFilterSkills(prev => selected ? prev.filter(x => x !== s) : [...prev, s])}
                        activeOpacity={0.7}
                      >
                        <AppText style={[styles.sheetOptionText, selected && styles.sheetOptionTextActive]}>{s}</AppText>
                        <View style={[styles.multiCheck, selected && styles.multiCheckActive]}>
                          {selected && <AppText style={styles.multiCheckMark}>✓</AppText>}
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
                <TouchableOpacity style={styles.sheetDone} onPress={() => setShowSkillPicker(false)}>
                  <AppText style={styles.sheetDoneText}>Done</AppText>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          </Modal>

          {/* Level picker */}
          <Modal visible={showLevelPicker} transparent animationType="slide" onRequestClose={() => setShowLevelPicker(false)}>
            <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setShowLevelPicker(false)}>
              <View style={styles.sheet} onStartShouldSetResponder={() => true}>
                <View style={styles.sheetHdr}>
                  <AppText style={styles.sheetTitle}>Comprehension Level</AppText>
                  {filterLevels.length > 0 && (
                    <TouchableOpacity onPress={() => setFilterLevels([])}>
                      <AppText style={styles.sheetClear}>Clear all</AppText>
                    </TouchableOpacity>
                  )}
                </View>
                {(TUTORIAL_COMPREHENSION as string[]).map(l => {
                  const selected = filterLevels.includes(l);
                  return (
                    <TouchableOpacity
                      key={l}
                      style={[styles.sheetOption, selected && styles.sheetOptionActive]}
                      onPress={() => setFilterLevels(prev => selected ? prev.filter(x => x !== l) : [...prev, l])}
                      activeOpacity={0.7}
                    >
                      <AppText style={[styles.sheetOptionText, selected && styles.sheetOptionTextActive, { textTransform: 'capitalize' }]}>{l}</AppText>
                      <View style={[styles.multiCheck, selected && styles.multiCheckActive]}>
                        {selected && <AppText style={styles.multiCheckMark}>✓</AppText>}
                      </View>
                    </TouchableOpacity>
                  );
                })}
                <TouchableOpacity style={styles.sheetDone} onPress={() => setShowLevelPicker(false)}>
                  <AppText style={styles.sheetDoneText}>Done</AppText>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          </Modal>
        </View>
      )}

      {/* ── My Tutorials tab ─────────────────────────────────────────────── */}
      {activeTab === 'my' && (
        <View style={{ flex: 1 }}>
          {/* Status + Visibility filters */}
          <View style={styles.filterPanel}>
            <TouchableOpacity style={styles.filterRow} onPress={() => setShowMyFilterPicker(true)} activeOpacity={0.75}>
              <AppText style={styles.filterLabel}>Status</AppText>
              <AppText style={[styles.filterValue, myFilters.length === 0 && styles.filterPlaceholder]} numberOfLines={1}>
                {myFilters.length === 0 ? 'All Statuses' : myFilters.length === 1 ? MY_FILTER_OPTIONS.find(o => o.key === myFilters[0])?.label : `${myFilters.length} selected`}
              </AppText>
              {myFilters.length > 0
                ? <TouchableOpacity onPress={() => setMyFilters([])} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <AppText style={styles.filterClear}>✕</AppText>
                  </TouchableOpacity>
                : <AppText style={styles.filterChevron}>›</AppText>
              }
            </TouchableOpacity>
            <View style={styles.filterDivider} />
            <TouchableOpacity style={styles.filterRow} onPress={() => setShowMyTypePicker(true)} activeOpacity={0.75}>
              <AppText style={styles.filterLabel}>Type</AppText>
              <AppText style={[styles.filterValue, myTypes.length === 0 && styles.filterPlaceholder]} numberOfLines={1}>
                {myTypes.length === 0 ? 'All Types' : myTypes.length === 1 ? MY_TYPE_OPTIONS.find(o => o.key === myTypes[0])?.label : `${myTypes.length} selected`}
              </AppText>
              {myTypes.length > 0
                ? <TouchableOpacity onPress={() => setMyTypes([])} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <AppText style={styles.filterClear}>✕</AppText>
                  </TouchableOpacity>
                : <AppText style={styles.filterChevron}>›</AppText>
              }
            </TouchableOpacity>
            <View style={styles.filterDivider} />
            <View style={styles.filterRow}>
              <AppText style={styles.filterLabel}>Show</AppText>
              <View style={styles.segmented}>
                {(['all', 'public', 'private'] as const).map(v => (
                  <TouchableOpacity
                    key={v}
                    style={[styles.segment, myVisibility === v && styles.segmentActive]}
                    onPress={() => setMyVisibility(v)}
                    activeOpacity={0.7}
                  >
                    <AppText style={[styles.segmentText, myVisibility === v && styles.segmentTextActive]}>
                      {v === 'all' ? 'All' : v === 'public' ? '🌐 Public' : '🔒 Private'}
                    </AppText>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>

          <Modal visible={showMyFilterPicker} transparent animationType="slide" onRequestClose={() => setShowMyFilterPicker(false)}>
            <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setShowMyFilterPicker(false)}>
              <View style={styles.sheet} onStartShouldSetResponder={() => true}>
                <View style={styles.sheetHdr}>
                  <AppText style={styles.sheetTitle}>Filter by Status</AppText>
                  {myFilters.length > 0 && (
                    <TouchableOpacity onPress={() => setMyFilters([])}>
                      <AppText style={styles.filterClear}>Clear</AppText>
                    </TouchableOpacity>
                  )}
                </View>
                <ScrollView style={{ maxHeight: 340 }}>
                  {MY_FILTER_OPTIONS.map(o => {
                    const selected = myFilters.includes(o.key);
                    return (
                      <TouchableOpacity
                        key={o.key}
                        style={[styles.sheetOption, selected && styles.sheetOptionActive]}
                        onPress={() => setMyFilters(prev => selected ? prev.filter(k => k !== o.key) : [...prev, o.key])}
                        activeOpacity={0.7}
                      >
                        <AppText style={[styles.sheetOptionText, selected && styles.sheetOptionTextActive]}>{o.label}</AppText>
                        <View style={[styles.multiCheck, selected && styles.multiCheckActive]}>
                          {selected && <AppText style={styles.multiCheckMark}>✓</AppText>}
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
                <TouchableOpacity style={styles.sheetDone} onPress={() => setShowMyFilterPicker(false)}>
                  <AppText style={styles.sheetDoneText}>Done</AppText>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          </Modal>

          {/* Type picker */}
          <Modal visible={showMyTypePicker} transparent animationType="slide" onRequestClose={() => setShowMyTypePicker(false)}>
            <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setShowMyTypePicker(false)}>
              <View style={styles.sheet} onStartShouldSetResponder={() => true}>
                <View style={styles.sheetHdr}>
                  <AppText style={styles.sheetTitle}>Filter by Type</AppText>
                  {myTypes.length > 0 && (
                    <TouchableOpacity onPress={() => setMyTypes([])}>
                      <AppText style={styles.filterClear}>Clear</AppText>
                    </TouchableOpacity>
                  )}
                </View>
                {MY_TYPE_OPTIONS.map(o => {
                  const selected = myTypes.includes(o.key);
                  return (
                    <TouchableOpacity
                      key={o.key}
                      style={[styles.sheetOption, selected && styles.sheetOptionActive]}
                      onPress={() => setMyTypes(prev => selected ? prev.filter(k => k !== o.key) : [...prev, o.key])}
                      activeOpacity={0.7}
                    >
                      <AppText style={[styles.sheetOptionText, selected && styles.sheetOptionTextActive]}>{o.label}</AppText>
                      <View style={[styles.multiCheck, selected && styles.multiCheckActive]}>
                        {selected && <AppText style={styles.multiCheckMark}>✓</AppText>}
                      </View>
                    </TouchableOpacity>
                  );
                })}
                <TouchableOpacity style={styles.sheetDone} onPress={() => setShowMyTypePicker(false)}>
                  <AppText style={styles.sheetDoneText}>Done</AppText>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          </Modal>

          {loadingMy ? (
            <View style={styles.center}><ActivityIndicator size="large" color={COLORS.bloomAccent} /></View>
          ) : (
            <FlatList
              ListHeaderComponent={
                filteredMy.length > 0
                  ? <AppText style={styles.listCount}>{filteredMy.length} tutorial{filteredMy.length !== 1 ? 's' : ''}</AppText>
                  : null
              }
              data={filteredMy}
              keyExtractor={t => t.id}
              contentContainerStyle={styles.list}
              renderItem={({ item: t }) => (
                <TouchableOpacity
                  style={styles.card}
                  onPress={() => { if (t.status !== 'generating') navigation.navigate('TutorialPreview', { tutorialId: t.id }); }}
                  activeOpacity={t.status === 'generating' ? 1 : 0.85}
                >
                  <View style={styles.thumb}>
                    {t.thumbnail_url
                      ? <Image source={{ uri: t.thumbnail_url }} style={styles.thumbImage} />
                      : <AppText style={styles.thumbEmoji}>{FORMAT_EMOJI[t.format] ?? '📚'}</AppText>
                    }
                  </View>
                  <View style={styles.cardInfo}>
                    <AppText style={styles.cardTitle} numberOfLines={2}>{t.display_name || t.category}</AppText>
                    <AppText style={styles.cardSub}>{t.category}</AppText>
                    <View style={styles.cardMeta}>
                      <View style={[styles.statusBadge, { backgroundColor: STATUS_COLORS[t.status as TutorialStatus].bg }]}>
                        <AppText style={[styles.statusText, { color: STATUS_COLORS[t.status as TutorialStatus].text }]}>
                          {STATUS_LABELS[t.status as TutorialStatus]}
                        </AppText>
                      </View>
                      {t.link_count > 0 && <AppText style={styles.metaText}>🔗 {t.link_count}</AppText>}
                      {!t.is_public && <AppText style={styles.privateBadge}>🔒</AppText>}
                    </View>
                    {t.status === 'generating' && (
                      <AppText style={styles.generatingHint}>May take 1–2 mins</AppText>
                    )}
                    {t.status === 'approved' && learnerUserId && (
                      <TouchableOpacity
                        style={[styles.linkBtn, linkedIds.has(t.id) && styles.linkBtnLinked]}
                        onPress={() => toggleLink(t)}
                        disabled={togglingId === t.id}
                        activeOpacity={0.75}
                      >
                        <AppText style={[styles.linkBtnText, linkedIds.has(t.id) && styles.linkBtnTextLinked]}>
                          {togglingId === t.id ? '…' : linkedIds.has(t.id) ? '✓ Added to Learner' : '＋ Add to Learner'}
                        </AppText>
                      </TouchableOpacity>
                    )}
                  </View>
                  {t.status !== 'generating' && (
                    <TouchableOpacity style={styles.deleteBtn} onPress={() => deleteTutorial(t)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                      <AppText style={styles.deleteBtnText}>🗑</AppText>
                    </TouchableOpacity>
                  )}
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

      {/* ── Create Tutorial tab ───────────────────────────────────────────── */}
      {activeTab === 'create' && (
        <View style={styles.createPane}>
          {quota && (
            <View style={styles.quotaBar}>
              <View style={styles.quotaHeader}>
                <AppText style={styles.quotaLabel}>Monthly quota</AppText>
                <AppText style={[styles.quotaCount, quota.used >= quota.limit && { color: COLORS.error }]}>
                  {quota.used} / {quota.limit} used
                </AppText>
              </View>
              <View style={styles.quotaTrack}>
                <View style={[styles.quotaFill, {
                  width: `${Math.min((quota.used / quota.limit) * 100, 100)}%` as any,
                  backgroundColor: quota.used >= quota.limit ? COLORS.error : COLORS.bloomAccent,
                }]} />
              </View>
            </View>
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
  container: { flex: 1, backgroundColor: COLORS.bloomBody },
  center:    { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 60 },

  // Tab bar
  tabBar: {
    flexDirection: 'row', backgroundColor: COLORS.bloomCard,
    borderBottomWidth: 1, borderBottomColor: COLORS.bloomBorder,
  },
  tab: {
    flex: 1, paddingVertical: 13, alignItems: 'center',
    borderBottomWidth: 2.5, borderBottomColor: 'transparent',
  },
  tabActive: { borderBottomColor: COLORS.bloomAccent },
  tabText: { fontSize: 13, fontWeight: '600', color: COLORS.bloomMuted },
  tabTextActive: { color: COLORS.bloomAccent, fontWeight: '800' },

  // Search tab
  searchRow: { padding: 14, paddingBottom: 8 },
  searchInput: {
    backgroundColor: COLORS.bloomCard, borderRadius: 14, borderWidth: 1.5, borderColor: COLORS.bloomBorder,
    paddingHorizontal: 16, paddingVertical: 13, fontSize: 15, color: COLORS.bloomText,
  },

  linkBtn: { marginTop: 8, backgroundColor: COLORS.bloomAccent, borderRadius: 10, paddingVertical: 8, alignItems: 'center' },
  linkBtnLinked: { backgroundColor: COLORS.statusGreenLight },
  linkBtnText: { fontSize: 13, fontWeight: '800', color: COLORS.bloomOnAccent },
  linkBtnTextLinked: { color: COLORS.statusGreenDark },

  // Search tab grid
  gridList: { padding: 12, paddingBottom: 32 },
  gridRow:  { gap: 12, marginBottom: 12 },
  gridCard: {
    flex: 1, backgroundColor: COLORS.bloomCard, borderRadius: 18,
    borderWidth: 1.5, borderColor: COLORS.bloomBorder, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },
  gridThumb:            { width: '100%', height: 120 },
  gridThumbPlaceholder: { backgroundColor: COLORS.bloomActiveBg, justifyContent: 'center', alignItems: 'center' },
  gridThumbEmoji:       { fontSize: 44 },
  gridCardBody:         { padding: 12, gap: 4 },
  gridCardTitle:        { fontSize: 15, fontWeight: '800', color: COLORS.bloomText, lineHeight: 20 },
  gridCardSub:          { fontSize: 12, fontWeight: '500', color: COLORS.bloomMuted, marginBottom: 2 },
  gridCardCreator:      { fontSize: 11, color: COLORS.bloomMuted, fontStyle: 'italic' },
  gridAddBtn:           { backgroundColor: COLORS.bloomAccent, borderRadius: 10, paddingVertical: 9, alignItems: 'center', marginTop: 4 },
  gridAddBtnLinked:     { backgroundColor: COLORS.statusGreenLight },
  gridAddBtnText:       { fontSize: 12, fontWeight: '800', color: COLORS.bloomOnAccent },
  gridAddBtnTextLinked: { color: COLORS.statusGreenDark },

  // Quota bar (shared)
  quotaBar: {
    marginHorizontal: 16, marginTop: 14,
    backgroundColor: COLORS.bloomCard, borderRadius: 16, padding: 16, gap: 10,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },
  quotaHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  quotaLabel: { fontSize: 14, fontWeight: '600', color: COLORS.bloomText },
  quotaCount: { fontSize: 14, fontWeight: '800', color: COLORS.bloomAccent },
  quotaTrack: { height: 8, backgroundColor: COLORS.bloomBorder, borderRadius: 4, overflow: 'hidden' },
  quotaFill:  { height: '100%', borderRadius: 4 },


  // Tutorial list
  list: { padding: 16, gap: 14 },
  card: {
    backgroundColor: COLORS.bloomCard, borderRadius: 18,
    flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 10, elevation: 3,
  },
  thumb: {
    width: 80, height: 80, borderRadius: 14, backgroundColor: COLORS.bloomActiveBg,
    justifyContent: 'center', alignItems: 'center', overflow: 'hidden', flexShrink: 0,
  },
  thumbImage: { width: 80, height: 80 },
  thumbEmoji: { fontSize: 36 },
  cardInfo:   { flex: 1, minWidth: 0, gap: 4 },
  cardTitle:  { fontSize: 17, fontWeight: '800', color: COLORS.bloomText, lineHeight: 22 },
  cardSub:    { fontSize: 13, color: COLORS.bloomMuted, fontWeight: '500' },
  cardCreator: { fontSize: 11, color: COLORS.bloomMuted, fontStyle: 'italic', marginTop: 1 },
  cardMeta:   { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4, flexWrap: 'wrap' },
  statusBadge:  { borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4 },
  statusText:   { fontSize: 12, fontWeight: '700' },
  metaText:     { fontSize: 13, color: COLORS.bloomMuted, fontWeight: '500' },
  generatingHint: { fontSize: 11, color: COLORS.bloomMuted, marginTop: 4 },
  privateBadge:   { fontSize: 13 },
  listCount: { fontSize: 13, fontWeight: '600', color: COLORS.bloomMuted, paddingHorizontal: 4, paddingBottom: 8 },
  deleteBtn:    { padding: 6 },
  deleteBtnText:{ fontSize: 22 },

  // Empty state
  empty:      { alignItems: 'center', paddingTop: 80, gap: 12 },
  emptyEmoji: { fontSize: 72 },
  emptyText:  { fontSize: 22, fontWeight: '800', color: COLORS.bloomText },
  emptyHint:  { fontSize: 15, color: COLORS.bloomMuted },

  // Create tab
  createPane: { flex: 1, padding: 0 },
  createCard: {
    marginHorizontal: 16, marginTop: 12,
    backgroundColor: COLORS.bloomCard, borderRadius: 18,
    paddingVertical: 16, paddingHorizontal: 16,
    flexDirection: 'row', alignItems: 'center', gap: 14,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 8, elevation: 3,
  },
  createEmoji:       { fontSize: 34 },
  createCardContent: { flex: 1, gap: 3 },
  createHeading:     { fontSize: 16, fontWeight: '800', color: COLORS.bloomText },
  createBody:        { fontSize: 13, color: COLORS.bloomMuted, lineHeight: 18 },
  createChevron:  { fontSize: 22, color: COLORS.bloomMuted, lineHeight: 28 },
  createBtnText:  { color: COLORS.bloomOnAccent, fontWeight: '800', fontSize: 16 },

  // Label-value filter panel (Search tab)
  filterPanel: {
    marginHorizontal: 14, marginBottom: 8,
    backgroundColor: COLORS.bloomCard, borderRadius: 16,
    borderWidth: 1.5, borderColor: COLORS.bloomBorder, overflow: 'hidden',
  },
  filterRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12, gap: 8 },
  filterLabel: { fontSize: 14, fontWeight: '700', color: COLORS.bloomText, width: 48 },
  filterValue: { flex: 1, fontSize: 14, fontWeight: '600', color: COLORS.bloomText },
  filterPlaceholder: { color: COLORS.bloomMuted, fontWeight: '400' },
  filterClear: { fontSize: 13, color: COLORS.bloomMuted, fontWeight: '700', paddingHorizontal: 4 },
  filterChevron: { fontSize: 20, color: COLORS.bloomMuted, lineHeight: 24 },
  filterDivider: { height: 1, backgroundColor: COLORS.bloomBorder, marginHorizontal: 14 },
  segmented:     { flex: 1, flexDirection: 'row', gap: 6 },
  segment: {
    flex: 1, paddingVertical: 7, borderRadius: 10, alignItems: 'center',
    backgroundColor: COLORS.bloomBody, borderWidth: 1.5, borderColor: COLORS.bloomBorder,
  },
  segmentActive:     { backgroundColor: COLORS.bloomAccent, borderColor: COLORS.bloomAccent },
  segmentText:       { fontSize: 12, fontWeight: '600', color: COLORS.bloomMuted },
  segmentTextActive: { fontSize: 12, fontWeight: '700', color: COLORS.bloomOnAccent },

  // Picker bottom sheet
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: COLORS.bloomCard,
    borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingBottom: 32,
  },
  sheetHdr: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 16,
    borderBottomWidth: 1, borderBottomColor: COLORS.bloomBorder,
  },
  sheetTitle: { fontSize: 16, fontWeight: '800', color: COLORS.bloomText },
  sheetClear: { fontSize: 13, fontWeight: '600', color: COLORS.bloomAccent },
  sheetOption: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 16,
    borderBottomWidth: 1, borderBottomColor: COLORS.bloomBorder,
  },
  sheetOptionActive: { backgroundColor: COLORS.bloomActiveBg },
  sheetOptionText: { fontSize: 15, fontWeight: '600', color: COLORS.bloomText },
  sheetOptionTextActive: { color: COLORS.bloomAccent, fontWeight: '700' },
  sheetDone: { marginHorizontal: 20, marginTop: 16, backgroundColor: COLORS.bloomAccent, borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  sheetDoneText: { color: COLORS.bloomOnAccent, fontWeight: '800', fontSize: 15 },
  multiCheck: {
    width: 22, height: 22, borderRadius: 6,
    borderWidth: 2, borderColor: COLORS.bloomBorder,
    backgroundColor: COLORS.bloomBody, justifyContent: 'center', alignItems: 'center',
  },
  multiCheckActive: { backgroundColor: COLORS.bloomAccent, borderColor: COLORS.bloomAccent },
  multiCheckMark: { color: COLORS.bloomOnAccent, fontSize: 12, fontWeight: '800' },
});
