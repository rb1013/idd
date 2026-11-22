import React, { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import {
  View, FlatList, TouchableOpacity, StyleSheet,
  TextInput, Modal, KeyboardAvoidingView, Platform,
  ActivityIndicator, Alert, ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import AppText from '../../components/AppText';
import RainbowDivider from '../../components/RainbowDivider';
import GuardianFloatingTabBar from '../../components/GuardianFloatingTabBar';
import GuardianPeekSheet, { GuardianPeekInfo } from '../../components/GuardianPeekSheet';
import FilterSheet, { FilterSheetSection } from '../../components/FilterSheet';
import useNicoHeader from '../../hooks/useNicoHeader';
import MoreFiltersLink from '../../components/MoreFiltersLink';
import ActiveFilterChips from '../../components/ActiveFilterChips';
import ReportFlag from '../../components/ReportFlag';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { supabase } from '../../lib/supabase';
import { containsProfanity, isBlockedWordsError, showKindWordsAlert } from '../../lib/contentFilter';
import { useAuth } from '../../lib/AuthContext';
import { GuardianNavParamList } from '../../navigation';
import { useVisibleCount } from '../../hooks/useVisibleCount';
import { DISCUSSION_TOPIC_MAX, DISCUSSION_DETAILS_MAX } from '../../constants';
import {
  NICO, TEXT_STYLE, SPACING, RADIUS, SHADOW, FONT_SIZE, FONT_WEIGHT,
  BTN_SIZE, BTN_VARIANT, INPUT, BUTTERFLY_BORDER, BUTTERFLY_TILES, scale,
} from '../../constants/theme';

type Nav = NativeStackNavigationProp<GuardianNavParamList>;

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

interface Post {
  id: string;
  title: string;
  body: string;
  createdAt: string;
  guardianId: string;
  guardianName: string;
  replyCount: number;
  categoryId?: string;
  categoryLabel?: string;
}

interface Category { id: string; label: string; }

type DiscussionTab = 'all' | 'mine';

interface DiscussionFilters {
  title: string;
  guardian: string;
  range: DateRange;
  category: Category | null;
}

// Fixed recent-date ranges (no custom dates). Older posts are found via title / category / guardian filters.
type DateRange = 'any' | '7d' | '14d' | '30d';

const DATE_RANGE_OPTIONS: { key: DateRange; label: string; days: number | null }[] = [
  { key: 'any', label: 'Any time',     days: null },
  { key: '7d',  label: 'Last 7 days',  days: 7 },
  { key: '14d', label: 'Last 14 days', days: 14 },
  { key: '30d', label: 'Last 30 days', days: 30 },
];

/** Local midnight at the start of the range: "Last 7 days" = today + the previous 6 days. */
function rangeStart(range: DateRange): Date | null {
  const days = DATE_RANGE_OPTIONS.find(o => o.key === range)?.days;
  if (!days) return null;
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - (days - 1));
  return d;
}

const EMPTY_FILTERS: DiscussionFilters = { title: '', guardian: '', range: 'any', category: null };

function filtersKey(f: DiscussionFilters): string {
  return `${f.title}|${f.category?.id ?? ''}|${f.guardian}|${f.range}`;
}

export default function DiscussionsScreen() {
  const navigation = useNavigation<Nav>();
  const { guardian } = useAuth();
  useNicoHeader(navigation);

  const [posts, setPosts]           = useState<Post[]>([]);
  const [loading, setLoading]       = useState(true);
  const [tab, setTab]               = useState<DiscussionTab>('mine');
  const [showCreate, setShowCreate] = useState(false);

  useLayoutEffect(() => {
    const addBtn = (
      <TouchableOpacity
        onPress={() => setShowCreate(true)}
        activeOpacity={0.6}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        style={{ marginRight: SPACING.xs }}
      >
        <AppText style={{ fontSize: scale(24) }}>➕</AppText>
      </TouchableOpacity>
    );
    navigation.setOptions({
      headerRight: () => addBtn,
      // iOS 26 wraps custom headerRight elements in a native "Liquid Glass" pill by default —
      // hidesSharedBackground turns that off so only our own element renders.
      unstable_headerRightItems: () => [
        { type: 'custom', element: addBtn, hidesSharedBackground: true },
      ],
    });
  }, [navigation]);
  const [newTitle, setNewTitle]     = useState('');
  const [newBody, setNewBody]       = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory]   = useState<Category | null>(null);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);

  // Each tab keeps its own filters, so a filter set on one tab never applies (hidden) on the other
  const [filtersByTab, setFiltersByTab] = useState<Record<DiscussionTab, DiscussionFilters>>({ all: EMPTY_FILTERS, mine: EMPTY_FILTERS });
  const {
    title: filterTitle, guardian: filterGuardian, range: filterRange, category: filterCategory,
  } = filtersByTab[tab];
  const updateFilters     = (patch: Partial<DiscussionFilters>) => setFiltersByTab(prev => ({ ...prev, [tab]: { ...prev[tab], ...patch } }));
  const setFilterTitle    = (title: string) => updateFilters({ title });
  const setFilterGuardian = (guardian: string) => updateFilters({ guardian });
  const setFilterRange    = (range: DateRange) => updateFilters({ range });
  const setFilterCategory = (category: Category | null) => updateFilters({ category });

  const [showRangePicker, setShowRangePicker] = useState(false);
  const [showFilterCatPicker, setShowFilterCatPicker] = useState(false);
  const [sheetOpen, setSheetOpen]           = useState(false);

  const [guardianSheet, setGuardianSheet]               = useState<GuardianPeekInfo | null>(null);
  const [loadingGuardianSheet, setLoadingGuardianSheet] = useState(false);

  async function openGuardianSheet(guardianId: string) {
    setGuardianSheet(null);
    setLoadingGuardianSheet(true);
    const { data } = await supabase
      .from('guardians')
      .select('id, full_name, photo_url, county, situation_tags')
      .eq('id', guardianId)
      .single();
    if (data) {
      setGuardianSheet({
        id: data.id,
        name: data.full_name ?? '',
        photoUrl: data.photo_url ?? null,
        county: data.county ?? '',
        situationTags: data.situation_tags ?? [],
      });
    }
    setLoadingGuardianSheet(false);
  }

  function closeGuardianSheet() {
    setGuardianSheet(null);
    setLoadingGuardianSheet(false);
  }

  useEffect(() => {
    supabase.from('discussion_category_options').select('id, label').order('label')
      .then(({ data }) => setCategories(data ?? []));
  }, []);

  useFocusEffect(useCallback(() => { load(); }, []));

  function closeCreateSheet() {
    setShowCreate(false);
    setNewTitle('');
    setNewBody('');
    setSelectedCategory(null);
    setShowCategoryPicker(false);
    setEditingPostId(null);
  }

  function openEditSheet(post: Post) {
    setEditingPostId(post.id);
    setNewTitle(post.title);
    setNewBody(post.body);
    setSelectedCategory(post.categoryId ? (categories.find(c => c.id === post.categoryId) ?? null) : null);
    setShowCreate(true);
  }

  function deletePost(post: Post) {
    const replyWarning = post.replyCount > 0
      ? ` This will also delete ${post.replyCount} ${post.replyCount === 1 ? 'reply' : 'replies'}.`
      : '';
    Alert.alert(
      'Delete discussion',
      `Are you sure you want to delete this discussion? This cannot be undone.${replyWarning}`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete', style: 'destructive', onPress: async () => {
            const { error } = await supabase.from('discussion_posts').delete().eq('id', post.id);
            if (error) Alert.alert('Error', error.message);
            else load();
          },
        },
      ]
    );
  }

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from('discussion_posts')
      .select('id, title, body, created_at, guardian_id, category_id, guardians(full_name), discussion_replies(id), discussion_category_options(label)')
      .order('created_at', { ascending: false });

    setPosts(
      (data ?? []).map((p: any) => ({
        id: p.id, title: p.title, body: p.body, createdAt: p.created_at,
        guardianId: p.guardian_id,
        guardianName: p.guardians?.full_name ?? 'Unknown',
        replyCount: (p.discussion_replies ?? []).length,
        categoryId: p.category_id ?? undefined,
        categoryLabel: p.discussion_category_options?.label ?? undefined,
      }))
    );
    setLoading(false);
  }

  async function submitPost() {
    if (!newTitle.trim() || !newBody.trim() || !guardian) return;
    // Layer 1: in-app profanity check on topic + details (server re-checks blocked_words)
    if (containsProfanity(newTitle, newBody)) { showKindWordsAlert('post'); return; }
    setSubmitting(true);
    const { error } = editingPostId
      ? await supabase.from('discussion_posts').update({
          title: newTitle.trim(),
          body: newBody.trim(),
          category_id: selectedCategory?.id ?? null,
        }).eq('id', editingPostId)
      : await supabase.from('discussion_posts').insert({
          guardian_id: guardian.id,
          title: newTitle.trim(),
          body: newBody.trim(),
          category_id: selectedCategory?.id ?? null,
        });
    if (isBlockedWordsError(error)) {
      showKindWordsAlert('post');   // Layer 2: rejected by the database trigger (blocked_words)
    } else if (error) {
      Alert.alert('Error', error.message);
    } else {
      closeCreateSheet();
      load();
    }
    setSubmitting(false);
  }

  const applyFilters = (list: Post[], f: DiscussionFilters) => {
    if (f.title.trim())    list = list.filter(p => p.title.toLowerCase().includes(f.title.trim().toLowerCase()));
    if (f.guardian.trim()) list = list.filter(p => p.guardianName.toLowerCase().includes(f.guardian.trim().toLowerCase()));
    if (f.category)        list = list.filter(p => p.categoryLabel === f.category!.label);
    const from = rangeStart(f.range);
    if (from) list = list.filter(p => new Date(p.createdAt) >= from);
    return list;
  };

  const allFiltered  = applyFilters([...posts], filtersByTab.all);
  const mineFiltered = applyFilters(posts.filter(p => p.guardianId === guardian?.id), filtersByTab.mine);

  // More Filters (category + guardian name) only exists on the All tab
  const hasMoreFilters = tab === 'all' && !!(filterGuardian || filterCategory);

  const { visible: visibleAll,  showLoadMore: showLoadMoreAll,  loadMore: loadMoreAll,  showCapMessage: showCapAll,  pageSize: pageSizeAll  } = useVisibleCount(allFiltered,  filtersKey(filtersByTab.all));
  const { visible: visibleMine, showLoadMore: showLoadMoreMine, loadMore: loadMoreMine, showCapMessage: showCapMine, pageSize: pageSizeMine } = useVisibleCount(mineFiltered, filtersKey(filtersByTab.mine));

  const displayedPosts = tab === 'mine' ? visibleMine : visibleAll;
  const showMore       = tab === 'mine' ? showLoadMoreMine : showLoadMoreAll;
  const doPaginate     = tab === 'mine' ? loadMoreMine     : loadMoreAll;
  const ps             = tab === 'mine' ? pageSizeMine     : pageSizeAll;
  const showCap        = tab === 'mine' ? showCapMine      : showCapAll;


  const filterHeader = (
    <View style={s.filterOuter}>
      <LinearGradient colors={[...BUTTERFLY_BORDER.colors]} start={BUTTERFLY_BORDER.start} end={BUTTERFLY_BORDER.end} style={s.searchGradient}>
        <TextInput
          style={s.searchInput}
          placeholder="Search by title…"
          placeholderTextColor={NICO.textMuted}
          value={filterTitle}
          onChangeText={setFilterTitle}
          clearButtonMode="while-editing"
        />
      </LinearGradient>

      {/* Date range dropdown — fixed recent ranges, same style as the category dropdown */}
      <View>
        <LinearGradient colors={[...BUTTERFLY_BORDER.colors]} start={BUTTERFLY_BORDER.start} end={BUTTERFLY_BORDER.end} style={s.fieldGradient}>
          <TouchableOpacity
            style={s.catPickerBtn}
            onPress={() => { setShowRangePicker(o => !o); setShowFilterCatPicker(false); }}
            activeOpacity={0.7}
          >
            <AppText style={[s.catPickerTxt, filterRange === 'any' && { color: NICO.textMuted }]}>
              {DATE_RANGE_OPTIONS.find(o => o.key === filterRange)?.label}
            </AppText>
            {filterRange !== 'any'
              ? <TouchableOpacity onPress={() => { setFilterRange('any'); setShowRangePicker(false); }} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <AppText style={s.dateClear}>✕</AppText>
                </TouchableOpacity>
              : <AppText style={s.pickerChevron}>{showRangePicker ? '▴' : '▾'}</AppText>
            }
          </TouchableOpacity>
        </LinearGradient>
        {showRangePicker && (
          <View style={s.dropdownList}>
            {DATE_RANGE_OPTIONS.map((opt, i) => (
              <TouchableOpacity
                key={opt.key}
                style={[s.dropdownItem, i < DATE_RANGE_OPTIONS.length - 1 && s.dropdownItemBorder, filterRange === opt.key && s.dropdownItemSelected]}
                onPress={() => { setFilterRange(opt.key); setShowRangePicker(false); }}
              >
                <AppText style={[s.dropdownItemText, filterRange === opt.key && s.dropdownItemTextSelected]}>{opt.label}</AppText>
                {filterRange === opt.key && <AppText style={s.dropdownCheck}>✓</AppText>}
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      {/* Category dropdown — My Discussions tab only */}
      {tab === 'mine' && categories.length > 0 && (
        <View>
          <LinearGradient colors={[...BUTTERFLY_BORDER.colors]} start={BUTTERFLY_BORDER.start} end={BUTTERFLY_BORDER.end} style={s.fieldGradient}>
            <TouchableOpacity style={s.catPickerBtn} onPress={() => { setShowFilterCatPicker(o => !o); setShowRangePicker(false); }} activeOpacity={0.7}>
              <AppText style={[s.catPickerTxt, !filterCategory && { color: NICO.textMuted }]}>
                {filterCategory?.label ?? 'All categories'}
              </AppText>
              {filterCategory
                ? <TouchableOpacity onPress={() => { setFilterCategory(null); setShowFilterCatPicker(false); }} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <AppText style={s.dateClear}>✕</AppText>
                  </TouchableOpacity>
                : <AppText style={s.pickerChevron}>{showFilterCatPicker ? '▴' : '▾'}</AppText>
              }
            </TouchableOpacity>
          </LinearGradient>
          {showFilterCatPicker && (
            <View style={s.dropdownList}>
              {categories.map((cat, i) => (
                <TouchableOpacity
                  key={cat.id}
                  style={[s.dropdownItem, i < categories.length - 1 && s.dropdownItemBorder, filterCategory?.id === cat.id && s.dropdownItemSelected]}
                  onPress={() => { setFilterCategory(filterCategory?.id === cat.id ? null : cat); setShowFilterCatPicker(false); }}
                >
                  <AppText style={[s.dropdownItemText, filterCategory?.id === cat.id && s.dropdownItemTextSelected]}>{cat.label}</AppText>
                  {filterCategory?.id === cat.id && <AppText style={s.dropdownCheck}>✓</AppText>}
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      )}

      <View style={s.filterBar}>
        <AppText style={s.resultCount}>
          {(tab === 'mine' ? mineFiltered : allFiltered).length} result{(tab === 'mine' ? mineFiltered : allFiltered).length !== 1 ? 's' : ''}
        </AppText>
        {tab === 'all' && (
          <MoreFiltersLink onPress={() => setSheetOpen(true)} isActive={hasMoreFilters} />
        )}
      </View>

      {/* Chips for filters hidden in the More Filters sheet (All tab only; My tab shows category inline) */}
      {tab === 'all' && (
        <ActiveFilterChips
          chips={[
            ...(filterCategory ? [{ key: 'category', label: `🏷️ ${filterCategory.label}`, onRemove: () => setFilterCategory(null) }] : []),
            ...(filterGuardian.trim() ? [{ key: 'guardian', label: `👤 ${filterGuardian.trim()}`, onRemove: () => setFilterGuardian('') }] : []),
          ]}
          onClearAll={() => updateFilters({ category: null, guardian: '' })}
          contentStyle={{ paddingHorizontal: 0, paddingBottom: 0 }}
        />
      )}
    </View>
  );

  return (
    <View style={s.container}>
      <RainbowDivider />

      {/* Tab bar */}
      <View style={s.tabBar}>
        {(['mine', 'all'] as const).map(t => (
          <TouchableOpacity key={t} style={[s.tab, tab === t && s.tabActive]} onPress={() => setTab(t)} activeOpacity={0.8}>
            <AppText style={[s.tabTxt, tab === t && s.tabTxtActive]}>
              {t === 'all' ? 'All Discussions' : 'My Discussions'}
            </AppText>
          </TouchableOpacity>
        ))}
      </View>

      <View style={s.tabPane}>
      {loading ? (
        <View style={s.center}><ActivityIndicator size="large" color={NICO.primary} /></View>
      ) : (
        <FlatList
          data={displayedPosts}
          keyExtractor={p => p.id}
          contentContainerStyle={s.list}
          ListHeaderComponent={filterHeader}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item: p, index }) => (
            <TouchableOpacity
              style={[s.card, { backgroundColor: BUTTERFLY_TILES[index % BUTTERFLY_TILES.length].bg, borderColor: 'transparent' }]}
              onPress={() => navigation.navigate('DiscussionDetail', { postId: p.id })}
              activeOpacity={0.82}
            >
              {(p.categoryLabel || tab === 'mine' || p.guardianId !== guardian?.id) && (
                <View style={s.cardTopRow}>
                  {p.categoryLabel ? (
                    <View style={s.categoryBadge}>
                      <AppText style={s.categoryBadgeText}>{p.categoryLabel}</AppText>
                    </View>
                  ) : <View />}
                  {/* 🚩 on other guardians' posts only (owners see ✏️ / 🗑️ on My Discussions) */}
                  {tab !== 'mine' && p.guardianId !== guardian?.id && (
                    <ReportFlag target={{ area: 'discussion_post', postId: p.id }} />
                  )}
                  {tab === 'mine' && (
                    <View style={s.cardActions}>
                      <TouchableOpacity
                        style={s.cardActionBtn}
                        onPress={(e) => { e.stopPropagation(); openEditSheet(p); }}
                        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                      >
                        <AppText style={s.cardActionIcon}>✏️</AppText>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[s.cardActionBtn, s.cardActionBtnDanger]}
                        onPress={(e) => { e.stopPropagation(); deletePost(p); }}
                        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                      >
                        <AppText style={s.cardActionIcon}>🗑️</AppText>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              )}
              <AppText style={s.postTitle}>{p.title}</AppText>
              <AppText style={s.postBody} numberOfLines={2}>{p.body}</AppText>
              <View style={s.postMeta}>
                <TouchableOpacity onPress={(e) => { e.stopPropagation(); openGuardianSheet(p.guardianId); }} hitSlop={{ top: 6, bottom: 6, left: 0, right: 6 }}>
                  <AppText style={s.guardianLink}>{p.guardianName}</AppText>
                </TouchableOpacity>
                <AppText style={s.metaDot}>·</AppText>
                <AppText style={s.metaText}>{timeAgo(p.createdAt)}</AppText>
                <AppText style={s.metaDot}>·</AppText>
                <AppText style={s.metaText}>{p.replyCount} {p.replyCount === 1 ? 'reply' : 'replies'}</AppText>
              </View>
            </TouchableOpacity>
          )}
          ListFooterComponent={
            showMore ? (
              <TouchableOpacity style={s.loadMoreBtn} onPress={doPaginate} activeOpacity={0.7}>
                <AppText style={s.loadMoreText}>Load {ps} more</AppText>
              </TouchableOpacity>
            ) : showCap ? (
              <View style={s.capMessage}>
                <AppText style={s.capMessageText}>Use filters to search records</AppText>
              </View>
            ) : null
          }
          ListEmptyComponent={
            <View style={s.empty}>
              <AppText style={s.emptyText}>
                {tab === 'mine'
                  ? (posts.filter(p => p.guardianId === guardian?.id).length === 0 ? "No discussions started" : 'No results')
                  : (posts.length === 0 ? 'No discussions yet' : 'No results')}
              </AppText>
              <AppText style={s.emptyHint}>
                {tab === 'mine' && posts.filter(p => p.guardianId === guardian?.id).length === 0
                  ? 'Be the first to start a conversation'
                  : 'Try adjusting your filters'}
              </AppText>
            </View>
          }
        />
      )}
      </View>


      {/* More Filters sheet */}
      <FilterSheet
        visible={sheetOpen}
        title="More Filters"
        sections={[
          ...(categories.length > 0 && tab === 'all' ? [{
            key: 'category', emoji: '🏷️', title: 'Category', type: 'single' as const,
            options: categories.map(c => ({ key: c.id, label: c.label })),
            selected: filterCategory ? [filterCategory.id] : [],
            onToggle: (v: string) => setFilterCategory(filterCategory?.id === v ? null : (categories.find(c => c.id === v) ?? null)),
          }] : []),
        ] satisfies FilterSheetSection[]}
        extraContent={tab === 'all' ? (
          <View style={s.extraFilters}>
            <AppText style={s.extraLabel}>Guardian Name</AppText>
            <TextInput
              style={s.plainInput}
              placeholder="Search by guardian name…"
              placeholderTextColor={NICO.textMuted}
              value={filterGuardian}
              onChangeText={setFilterGuardian}
              clearButtonMode="while-editing"
            />
          </View>
        ) : undefined}
        hasExtraActive={!!filterGuardian}
        onClearAll={() => updateFilters({ category: null, guardian: '' })}
        onDone={() => setSheetOpen(false)}
      />

      {/* Create discussion modal */}
      <Modal visible={showCreate} animationType="slide" transparent onRequestClose={closeCreateSheet}>
        <KeyboardAvoidingView style={s.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <TouchableOpacity style={s.modalBackdrop} activeOpacity={1} onPress={closeCreateSheet} />
          <View style={s.modalSheet}>
            <View style={s.modalHandle} />
            <View style={s.modalTitleRow}>
              <AppText style={s.modalTitle}>{editingPostId ? 'Edit Discussion' : 'Start a Discussion'}</AppText>
              <TouchableOpacity onPress={closeCreateSheet} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <AppText style={s.modalClose}>✕</AppText>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <View style={s.formGap}>
                <AppText style={s.fieldLabel}>Topic <AppText style={s.required}>*</AppText></AppText>
                <LinearGradient colors={[...BUTTERFLY_BORDER.colors]} start={BUTTERFLY_BORDER.start} end={BUTTERFLY_BORDER.end} style={s.fieldGradient}>
                  <TextInput
                    style={s.fieldInput}
                    value={newTitle}
                    onChangeText={setNewTitle}
                    placeholder="What's on your mind?"
                    placeholderTextColor={NICO.textMuted}
                    maxLength={DISCUSSION_TOPIC_MAX}
                  />
                </LinearGradient>
                <AppText style={s.charCount}>{newTitle.length}/{DISCUSSION_TOPIC_MAX}</AppText>

                {categories.length > 0 && (
                  <>
                    <AppText style={s.fieldLabel}>Category <AppText style={s.required}>*</AppText></AppText>
                    <LinearGradient colors={[...BUTTERFLY_BORDER.colors]} start={BUTTERFLY_BORDER.start} end={BUTTERFLY_BORDER.end} style={s.fieldGradient}>
                      <TouchableOpacity style={s.pickerBtn} onPress={() => setShowCategoryPicker(o => !o)} activeOpacity={0.7}>
                        <AppText style={[s.pickerBtnText, !selectedCategory && { color: NICO.textMuted }]}>
                          {selectedCategory?.label ?? 'Select a category…'}
                        </AppText>
                        <AppText style={s.pickerChevron}>{showCategoryPicker ? '▴' : '▾'}</AppText>
                      </TouchableOpacity>
                    </LinearGradient>
                    {showCategoryPicker && (
                      <View style={s.dropdownList}>
                        {selectedCategory && (
                          <TouchableOpacity style={s.dropdownItem} onPress={() => { setSelectedCategory(null); setShowCategoryPicker(false); }}>
                            <AppText style={[s.dropdownItemText, { color: NICO.error }]}>Clear</AppText>
                          </TouchableOpacity>
                        )}
                        {categories.map((cat, i) => (
                          <TouchableOpacity
                            key={cat.id}
                            style={[s.dropdownItem, (i < categories.length - 1 || !!selectedCategory) && s.dropdownItemBorder, selectedCategory?.id === cat.id && s.dropdownItemSelected]}
                            onPress={() => { setSelectedCategory(cat); setShowCategoryPicker(false); }}
                          >
                            <AppText style={[s.dropdownItemText, selectedCategory?.id === cat.id && s.dropdownItemTextSelected]}>{cat.label}</AppText>
                            {selectedCategory?.id === cat.id && <AppText style={s.dropdownCheck}>✓</AppText>}
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}
                  </>
                )}

                <AppText style={s.fieldLabel}>Details <AppText style={s.required}>*</AppText></AppText>
                <LinearGradient colors={[...BUTTERFLY_BORDER.colors]} start={BUTTERFLY_BORDER.start} end={BUTTERFLY_BORDER.end} style={s.fieldGradient}>
                  <TextInput
                    style={[s.fieldInput, s.fieldTextArea]}
                    value={newBody}
                    onChangeText={setNewBody}
                    placeholder="Share more context…"
                    placeholderTextColor={NICO.textMuted}
                    multiline
                    numberOfLines={4}
                    maxLength={DISCUSSION_DETAILS_MAX}
                  />
                </LinearGradient>
                <AppText style={s.charCount}>{newBody.length}/{DISCUSSION_DETAILS_MAX}</AppText>

                <TouchableOpacity
                  style={[{ ...BTN_SIZE.lg, ...BTN_VARIANT.primary }, (!newTitle.trim() || !newBody.trim() || (categories.length > 0 && !selectedCategory) || submitting) && { opacity: 0.5 }]}
                  onPress={submitPost}
                  disabled={!newTitle.trim() || !newBody.trim() || (categories.length > 0 && !selectedCategory) || submitting}
                  activeOpacity={0.85}
                >
                  {submitting
                    ? <ActivityIndicator color={NICO.textOnAccent} />
                    : <AppText style={s.submitBtnText}>{editingPostId ? 'Save Changes' : 'Post Discussion'}</AppText>
                  }
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
      <GuardianPeekSheet
        visible={!!guardianSheet || loadingGuardianSheet}
        guardian={guardianSheet}
        loading={loadingGuardianSheet}
        onClose={closeGuardianSheet}
        onBlocked={() => load()}   // their posts disappear (hidden by the database)
      />
      <GuardianFloatingTabBar />
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: NICO.screenBg },
  tabPane:   { flex: 1, backgroundColor: NICO.screenBg },
  center:    { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 40 },
  list:      { padding: SPACING.base, paddingBottom: 48, gap: SPACING.sm },

  // Tab bar
  tabBar: {
    flexDirection: 'row', backgroundColor: NICO.surface,
    borderBottomWidth: 1, borderBottomColor: NICO.border,
  },
  tab: {
    flex: 1, alignItems: 'center', paddingVertical: SPACING.md,
    borderBottomWidth: 2.5, borderBottomColor: 'transparent',
  },
  tabActive:    { borderBottomColor: NICO.primary },
  tabTxt:       { ...TEXT_STYLE.tabLabel },
  tabTxtActive: { ...TEXT_STYLE.tabLabel, color: NICO.primary, fontWeight: FONT_WEIGHT.extraBold },

  // Filter header
  filterOuter: { paddingBottom: SPACING.sm, gap: SPACING.sm },
  searchGradient: {
    padding: BUTTERFLY_BORDER.width,
    borderRadius: RADIUS.md + BUTTERFLY_BORDER.width,
  },
  searchInput: { ...INPUT.base, borderWidth: 0 },
  plainInput:  { ...INPUT.base },

  filterBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  resultCount:      { ...TEXT_STYLE.caption, color: NICO.textMuted },
  moreBtnGradient:  { padding: BUTTERFLY_BORDER.width, borderRadius: RADIUS.full },
  moreBtn:          { flexDirection: 'row', alignItems: 'center', borderRadius: RADIUS.full, paddingHorizontal: SPACING.base, paddingVertical: SPACING.xs, backgroundColor: NICO.screenBg },
  moreBtnActive:    { backgroundColor: NICO.primaryLight },
  moreBtnText:      { fontSize: FONT_SIZE.md, fontWeight: FONT_WEIGHT.medium, color: NICO.textMuted },
  moreBtnTextActive:{ fontSize: FONT_SIZE.md, fontWeight: FONT_WEIGHT.semiBold, color: NICO.primary },


  // Post cards
  card: {
    backgroundColor: 'white', borderRadius: RADIUS.xl, padding: SPACING.base, gap: SPACING.xs,
    borderWidth: 1, borderColor: NICO.border,
    ...SHADOW.md,
  },
  postTitle: { ...TEXT_STYLE.cardTitle },
  postBody:  { fontSize: FONT_SIZE.lg, color: NICO.text, fontWeight: FONT_WEIGHT.semiBold, lineHeight: 22 },
  postMeta:  { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs, marginTop: SPACING.xs },
  metaText:  { ...TEXT_STYLE.caption },
  metaDot:   { fontSize: FONT_SIZE.sm, color: NICO.border },
  guardianLink: { fontSize: FONT_SIZE.sm, color: '#2563EB', fontWeight: FONT_WEIGHT.bold, textDecorationLine: 'underline' },

  cardTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 },
  categoryBadge: {
    alignSelf: 'flex-start', backgroundColor: NICO.primaryLight,
    borderRadius: RADIUS.sm, paddingHorizontal: SPACING.sm, paddingVertical: 2,
  },
  categoryBadgeText: { fontSize: FONT_SIZE.xs, fontWeight: FONT_WEIGHT.bold, color: NICO.primary },

  cardActions: { flexDirection: 'row', gap: SPACING.xs },
  cardActionBtn: {
    width: scale(28), height: scale(28), borderRadius: scale(14),
    backgroundColor: NICO.primaryLight, justifyContent: 'center', alignItems: 'center',
  },
  cardActionBtnDanger: { backgroundColor: NICO.errorLight },
  cardActionIcon: { fontSize: scale(14) },

  // FAB

  empty:     { alignItems: 'center', paddingTop: 60, gap: SPACING.md },
  emptyText: { ...TEXT_STYLE.cardTitle },
  emptyHint: { ...TEXT_STYLE.screenHint, textAlign: 'center', paddingHorizontal: SPACING['2xl'] },

  loadMoreBtn:    { ...BTN_SIZE.sm, ...BTN_VARIANT.outline, alignSelf: 'center', marginTop: SPACING.sm },
  loadMoreText:   { fontSize: FONT_SIZE.lg, fontWeight: FONT_WEIGHT.extraBold, color: NICO.primary },
  capMessage:     { alignItems: 'center', paddingVertical: SPACING.base },
  capMessageText: { ...TEXT_STYLE.hint, fontStyle: 'italic' },

  // Inline category dropdown (My Discussions tab)
  catPickerBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', ...INPUT.base, borderWidth: 0 },
  catPickerTxt: { flex: 1, fontSize: FONT_SIZE.lg, color: NICO.text },

  // FilterSheet extra content
  extraFilters: { paddingHorizontal: SPACING.lg, paddingTop: SPACING.sm, paddingBottom: SPACING.base, gap: SPACING.xs },
  extraLabel:   { ...TEXT_STYLE.labelSmall, textTransform: 'uppercase', letterSpacing: 0.7 },
  dateClear:        { fontSize: FONT_SIZE.sm, color: NICO.primary, fontWeight: FONT_WEIGHT.bold },

  // Create discussion modal
  modalOverlay:  { flex: 1, justifyContent: 'flex-end' },
  modalBackdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.45)' },
  modalSheet: {
    backgroundColor: NICO.screenBg,
    borderTopLeftRadius: RADIUS.xl, borderTopRightRadius: RADIUS.xl,
    padding: SPACING.lg, paddingBottom: scale(40), maxHeight: '90%',
  },
  modalHandle: {
    width: 44, height: 4, backgroundColor: NICO.border,
    borderRadius: 2, alignSelf: 'center', marginBottom: SPACING.md,
  },
  modalTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: SPACING.sm },
  modalTitle:    { ...TEXT_STYLE.screenTitle },
  modalClose:    { fontSize: FONT_SIZE.xl, color: NICO.textMuted, fontWeight: FONT_WEIGHT.semiBold },

  formGap: { gap: SPACING.sm, paddingBottom: SPACING.lg },

  fieldLabel:   { fontSize: FONT_SIZE.md, fontWeight: FONT_WEIGHT.bold, color: NICO.text },
  required:     { fontSize: FONT_SIZE['2xl'], fontWeight: FONT_WEIGHT.black, color: NICO.error },
  fieldGradient: {
    padding: BUTTERFLY_BORDER.width,
    borderRadius: RADIUS.md + BUTTERFLY_BORDER.width,
  },
  fieldInput:    { ...INPUT.base, borderWidth: 0 },
  fieldTextArea: { minHeight: scale(100), textAlignVertical: 'top' },
  charCount:     { fontSize: FONT_SIZE.sm, color: NICO.text, fontWeight: FONT_WEIGHT.medium, alignSelf: 'flex-end', marginTop: -SPACING.xs },
  submitBtnText: { ...TEXT_STYLE.buttonPrimary },

  pickerBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    ...INPUT.base, borderWidth: 0,
  },
  pickerBtnText: { fontSize: FONT_SIZE.lg, color: NICO.text, flex: 1 },
  pickerChevron: { fontSize: FONT_SIZE.md, color: NICO.textMuted },

  dropdownList: {
    borderWidth: 1, borderColor: NICO.border, borderRadius: RADIUS.md,
    backgroundColor: NICO.surface, overflow: 'hidden', marginTop: -SPACING.xs,
  },
  dropdownItem:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SPACING.base, paddingVertical: SPACING.md },
  dropdownItemBorder:   { borderBottomWidth: 1, borderBottomColor: NICO.border },
  dropdownItemSelected: { backgroundColor: NICO.primaryLight },
  dropdownItemText:     { fontSize: FONT_SIZE.lg, color: NICO.text },
  dropdownItemTextSelected: { fontWeight: FONT_WEIGHT.bold, color: NICO.primary },
  dropdownCheck:        { fontSize: FONT_SIZE.lg, color: NICO.primary, fontWeight: FONT_WEIGHT.bold },
});
