import React, { useCallback, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  Image, ActivityIndicator, Alert, TextInput, Modal, ScrollView,
} from 'react-native';
import { useFocusEffect, useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/AuthContext';
import { COLORS, TUTORIAL_COMPREHENSION } from '../../constants';
import { GuardianNavParamList } from '../../navigation';
import type { Tutorial, TutorialStatus } from '../../types';

type TutorialWithGuardian = Tutorial & { guardian?: { full_name: string } | null };

const STATUS_COLORS: Record<TutorialStatus, { bg: string; text: string }> = {
  generating: { bg: '#E8ECEF', text: '#5D6D7E' },
  preview:    { bg: '#FEF3CD', text: '#B7791F' },
  pending:    { bg: '#DBEAFE', text: '#1D4ED8' },
  approved:   { bg: '#D1FAE5', text: '#065F46' },
  rejected:   { bg: '#FEE2E2', text: '#991B1B' },
};

const STATUS_LABELS: Record<TutorialStatus, string> = {
  generating: 'Generating…',
  preview:    'Review Needed',
  pending:    'Pending Review',
  approved:   'Approved',
  rejected:   'Rejected',
};

const FORMAT_EMOJI: Record<string, string> = { video: '🎬', slideshow: '🖼' };

type Tab = 'search' | 'my' | 'create';

type MyFilter = 'all' | TutorialStatus;
const MY_FILTERS: { key: MyFilter; label: string }[] = [
  { key: 'all',      label: 'All' },
  { key: 'preview',  label: 'Review Needed' },
  { key: 'pending',  label: 'Pending' },
  { key: 'approved', label: 'Approved' },
  { key: 'rejected', label: 'Rejected' },
];

export default function GuardianTutorialsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<GuardianNavParamList>>();
  const route = useRoute<RouteProp<GuardianNavParamList, 'Learning'>>();
  const { guardian } = useAuth();

  const [activeTab, setActiveTab] = useState<Tab>(route.params?.initialTab ?? 'search');

  // ── My Tutorials tab ──────────────────────────────────────────────────────
  const [myTutorials, setMyTutorials]   = useState<Tutorial[]>([]);
  const [loadingMy, setLoadingMy]       = useState(true);
  const [myFilter, setMyFilter]         = useState<MyFilter>('all');
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
    const { data } = await supabase.from('tutorials').select('*, guardian:guardians!created_by_guardian_id(full_name)').eq('status', 'approved').order('created_at', { ascending: false });
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

  const filteredMy = myFilter === 'all' ? myTutorials : myTutorials.filter(t => t.status === myFilter);
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
              <Text style={[styles.tabText, active && styles.tabTextActive]}>{labels[tab]}</Text>
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
              <Text style={styles.filterLabel}>Skill</Text>
              <Text style={[styles.filterValue, filterSkills.length === 0 && styles.filterPlaceholder]} numberOfLines={1}>
                {filterSkills.length === 0 ? 'All Skills' : filterSkills.length === 1 ? filterSkills[0] : `${filterSkills.length} selected`}
              </Text>
              {filterSkills.length > 0
                ? <TouchableOpacity onPress={() => setFilterSkills([])} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Text style={styles.filterClear}>✕</Text>
                  </TouchableOpacity>
                : <Text style={styles.filterChevron}>›</Text>
              }
            </TouchableOpacity>
            <View style={styles.filterDivider} />
            <TouchableOpacity style={styles.filterRow} onPress={() => setShowLevelPicker(true)} activeOpacity={0.75}>
              <Text style={styles.filterLabel}>Level</Text>
              <Text style={[styles.filterValue, filterLevels.length === 0 && styles.filterPlaceholder, { textTransform: 'capitalize' }]} numberOfLines={1}>
                {filterLevels.length === 0 ? 'All Levels' : filterLevels.length === 1 ? filterLevels[0] : `${filterLevels.length} selected`}
              </Text>
              {filterLevels.length > 0
                ? <TouchableOpacity onPress={() => setFilterLevels([])} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Text style={styles.filterClear}>✕</Text>
                  </TouchableOpacity>
                : <Text style={styles.filterChevron}>›</Text>
              }
            </TouchableOpacity>
          </View>

          {loadingSearch ? (
            <View style={styles.center}><ActivityIndicator size="large" color={COLORS.bloomAccent} /></View>
          ) : (
            <FlatList
              data={filteredSearch}
              keyExtractor={t => t.id}
              contentContainerStyle={styles.list}
              renderItem={({ item: t }) => {
                const toggling = togglingId === t.id;
                return (
                  <TouchableOpacity
                    style={styles.card}
                    onPress={() => navigation.navigate('TutorialPreview', { tutorialId: t.id })}
                    activeOpacity={0.85}
                  >
                    <View style={styles.thumb}>
                      {t.thumbnail_url
                        ? <Image source={{ uri: t.thumbnail_url }} style={styles.thumbImage} />
                        : <Text style={styles.thumbEmoji}>{FORMAT_EMOJI[t.format] ?? '📚'}</Text>
                      }
                    </View>
                    <View style={styles.cardInfo}>
                      <Text style={styles.cardTitle} numberOfLines={2}>{t.display_name || t.category}</Text>
                      <Text style={styles.cardSub}>{t.category}</Text>
                      {(t as TutorialWithGuardian).guardian?.full_name && (
                        <Text style={styles.cardCreator} numberOfLines={1}>by {(t as TutorialWithGuardian).guardian!.full_name}</Text>
                      )}
                      <TouchableOpacity
                        style={styles.linkBtn}
                        onPress={() => toggleLink(t)}
                        disabled={toggling}
                        activeOpacity={0.75}
                      >
                        <Text style={styles.linkBtnText}>
                          {toggling ? '…' : '＋ Add to Learner'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </TouchableOpacity>
                );
              }}
              ListEmptyComponent={
                <View style={styles.empty}>
                  <Text style={styles.emptyEmoji}>🔍</Text>
                  <Text style={styles.emptyText}>No tutorials found</Text>
                  <Text style={styles.emptyHint}>Try a different search or filter</Text>
                </View>
              }
            />
          )}

          {/* Skill picker */}
          <Modal visible={showSkillPicker} transparent animationType="slide" onRequestClose={() => setShowSkillPicker(false)}>
            <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setShowSkillPicker(false)}>
              <View style={styles.sheet} onStartShouldSetResponder={() => true}>
                <View style={styles.sheetHdr}>
                  <Text style={styles.sheetTitle}>Target Skill</Text>
                  {filterSkills.length > 0 && (
                    <TouchableOpacity onPress={() => setFilterSkills([])}>
                      <Text style={styles.sheetClear}>Clear all</Text>
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
                        <Text style={[styles.sheetOptionText, selected && styles.sheetOptionTextActive]}>{s}</Text>
                        <View style={[styles.multiCheck, selected && styles.multiCheckActive]}>
                          {selected && <Text style={styles.multiCheckMark}>✓</Text>}
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
                <TouchableOpacity style={styles.sheetDone} onPress={() => setShowSkillPicker(false)}>
                  <Text style={styles.sheetDoneText}>Done</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          </Modal>

          {/* Level picker */}
          <Modal visible={showLevelPicker} transparent animationType="slide" onRequestClose={() => setShowLevelPicker(false)}>
            <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setShowLevelPicker(false)}>
              <View style={styles.sheet} onStartShouldSetResponder={() => true}>
                <View style={styles.sheetHdr}>
                  <Text style={styles.sheetTitle}>Comprehension Level</Text>
                  {filterLevels.length > 0 && (
                    <TouchableOpacity onPress={() => setFilterLevels([])}>
                      <Text style={styles.sheetClear}>Clear all</Text>
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
                      <Text style={[styles.sheetOptionText, selected && styles.sheetOptionTextActive, { textTransform: 'capitalize' }]}>{l}</Text>
                      <View style={[styles.multiCheck, selected && styles.multiCheckActive]}>
                        {selected && <Text style={styles.multiCheckMark}>✓</Text>}
                      </View>
                    </TouchableOpacity>
                  );
                })}
                <TouchableOpacity style={styles.sheetDone} onPress={() => setShowLevelPicker(false)}>
                  <Text style={styles.sheetDoneText}>Done</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          </Modal>
        </View>
      )}

      {/* ── My Tutorials tab ─────────────────────────────────────────────── */}
      {activeTab === 'my' && (
        <View style={{ flex: 1 }}>
          <FlatList
            horizontal
            data={MY_FILTERS}
            keyExtractor={f => f.key}
            style={styles.filterBar}
            contentContainerStyle={styles.filterBarContent}
            showsHorizontalScrollIndicator={false}
            renderItem={({ item }) => {
              const active = myFilter === item.key;
              return (
                <TouchableOpacity
                  style={[styles.filterChip, active && styles.filterChipActive]}
                  onPress={() => setMyFilter(item.key)}
                >
                  <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>{item.label}</Text>
                </TouchableOpacity>
              );
            }}
          />

          {loadingMy ? (
            <View style={styles.center}><ActivityIndicator size="large" color={COLORS.bloomAccent} /></View>
          ) : (
            <FlatList
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
                      : <Text style={styles.thumbEmoji}>{FORMAT_EMOJI[t.format] ?? '📚'}</Text>
                    }
                  </View>
                  <View style={styles.cardInfo}>
                    <Text style={styles.cardTitle} numberOfLines={2}>{t.display_name || t.category}</Text>
                    <Text style={styles.cardSub}>{t.category}</Text>
                    <View style={styles.cardMeta}>
                      <View style={[styles.statusBadge, { backgroundColor: STATUS_COLORS[t.status as TutorialStatus].bg }]}>
                        <Text style={[styles.statusText, { color: STATUS_COLORS[t.status as TutorialStatus].text }]}>
                          {STATUS_LABELS[t.status as TutorialStatus]}
                        </Text>
                      </View>
                      {t.link_count > 0 && <Text style={styles.metaText}>🔗 {t.link_count}</Text>}
                    </View>
                    {t.status === 'generating' && (
                      <Text style={styles.generatingHint}>May take 1–2 mins</Text>
                    )}
                  </View>
                  {t.status !== 'generating' && (
                    <TouchableOpacity style={styles.deleteBtn} onPress={() => deleteTutorial(t)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                      <Text style={styles.deleteBtnText}>🗑</Text>
                    </TouchableOpacity>
                  )}
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <View style={styles.empty}>
                  <Text style={styles.emptyEmoji}>📚</Text>
                  <Text style={styles.emptyText}>No tutorials yet</Text>
                  <Text style={styles.emptyHint}>Create a tutorial to get started</Text>
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
                <Text style={styles.quotaLabel}>Monthly quota</Text>
                <Text style={[styles.quotaCount, quota.used >= quota.limit && { color: COLORS.error }]}>
                  {quota.used} / {quota.limit} used
                </Text>
              </View>
              <View style={styles.quotaTrack}>
                <View style={[styles.quotaFill, {
                  width: `${Math.min((quota.used / quota.limit) * 100, 100)}%` as any,
                  backgroundColor: quota.used >= quota.limit ? COLORS.error : COLORS.bloomAccent,
                }]} />
              </View>
            </View>
          )}

          <View style={styles.createCard}>
            <Text style={styles.createEmoji}>✨</Text>
            <Text style={styles.createHeading}>AI-Generated Tutorials</Text>
            <Text style={styles.createBody}>
              Describe what you'd like your learner to learn. Our AI will generate a personalised slideshow tutorial tailored to their needs.
            </Text>
            <TouchableOpacity
              style={[styles.createBtn, quota?.used !== undefined && quota.used >= quota.limit && styles.createBtnDisabled]}
              onPress={() => {
                if (quota && quota.used >= quota.limit) { Alert.alert('Quota reached', `You have used all ${quota.limit} tutorials for this month.`); return; }
                navigation.navigate('CreateTutorial');
              }}
              activeOpacity={0.85}
            >
              <Text style={styles.createBtnText}>✨  Create Tutorial</Text>
            </TouchableOpacity>
          </View>
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

  linkBtn: { marginTop: 8, backgroundColor: '#DAEAFF', borderRadius: 10, paddingVertical: 8, alignItems: 'center' },
  linkBtnLinked: { backgroundColor: '#D1FAE5' },
  linkBtnText: { fontSize: 13, fontWeight: '800', color: COLORS.bloomAccent },
  linkBtnTextLinked: { color: '#065F46' },

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

  // Filter chips (My tab)
  filterBar:        { maxHeight: 52, marginTop: 10 },
  filterBarContent: { paddingHorizontal: 16, gap: 8, alignItems: 'center' },
  filterChip: {
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20,
    backgroundColor: COLORS.bloomCard, borderWidth: 1.5, borderColor: COLORS.bloomBorder,
  },
  filterChipActive:     { backgroundColor: COLORS.bloomNavy, borderColor: COLORS.bloomNavy },
  filterChipText:       { fontSize: 13, fontWeight: '600', color: COLORS.bloomMuted },
  filterChipTextActive: { color: '#fff', fontWeight: '700' },

  // Tutorial list
  list: { padding: 16, gap: 14 },
  card: {
    backgroundColor: COLORS.bloomCard, borderRadius: 18,
    flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 10, elevation: 3,
  },
  thumb: {
    width: 80, height: 80, borderRadius: 14, backgroundColor: '#DAEAFF',
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
    margin: 16, marginTop: 14,
    backgroundColor: COLORS.bloomCard, borderRadius: 20,
    padding: 24, alignItems: 'center', gap: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 10, elevation: 3,
  },
  createEmoji:   { fontSize: 52 },
  createHeading: { fontSize: 20, fontWeight: '800', color: COLORS.bloomText, textAlign: 'center' },
  createBody:    { fontSize: 14, color: COLORS.bloomMuted, textAlign: 'center', lineHeight: 21 },
  createBtn: {
    marginTop: 8, backgroundColor: COLORS.bloomNavy, borderRadius: 16,
    paddingVertical: 15, paddingHorizontal: 32, alignItems: 'center',
    shadowColor: COLORS.bloomNavy, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 8, elevation: 5,
  },
  createBtnDisabled: { opacity: 0.45 },
  createBtnText: { color: '#fff', fontWeight: '800', fontSize: 16 },

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
  sheetOptionActive: { backgroundColor: '#DAEAFF' },
  sheetOptionText: { fontSize: 15, fontWeight: '600', color: COLORS.bloomText },
  sheetOptionTextActive: { color: COLORS.bloomAccent, fontWeight: '700' },
  sheetDone: { marginHorizontal: 20, marginTop: 16, backgroundColor: COLORS.bloomNavy, borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  sheetDoneText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  multiCheck: {
    width: 22, height: 22, borderRadius: 6,
    borderWidth: 2, borderColor: COLORS.bloomBorder,
    backgroundColor: COLORS.bloomBody, justifyContent: 'center', alignItems: 'center',
  },
  multiCheckActive: { backgroundColor: COLORS.bloomAccent, borderColor: COLORS.bloomAccent },
  multiCheckMark: { color: '#fff', fontSize: 12, fontWeight: '800' },
});
