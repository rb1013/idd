import React, { useCallback, useEffect, useState } from 'react';
import {
  View, FlatList, TouchableOpacity, StyleSheet,
  TextInput, Modal, KeyboardAvoidingView, Platform,
  ActivityIndicator, Alert, ScrollView,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { LinearGradient } from 'expo-linear-gradient';
import AppText from '../../components/AppText';
import RainbowDivider from '../../components/RainbowDivider';
import FilterSheet, { FilterSheetSection } from '../../components/FilterSheet';
import useNicoHeader from '../../hooks/useNicoHeader';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/AuthContext';
import { GuardianNavParamList } from '../../navigation';
import { useVisibleCount } from '../../hooks/useVisibleCount';
import {
  NICO, TEXT_STYLE, SPACING, RADIUS, SHADOW, FONT_SIZE, FONT_WEIGHT,
  BTN_SIZE, BTN_VARIANT, INPUT, BUTTERFLY_BORDER, scale,
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
  return new Date(dateStr).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

interface Post {
  id: string;
  title: string;
  body: string;
  createdAt: string;
  guardianId: string;
  guardianName: string;
  replyCount: number;
  categoryLabel?: string;
}

interface Category { id: string; label: string; }

export default function DiscussionsScreen() {
  const navigation = useNavigation<Nav>();
  const { guardian } = useAuth();
  useNicoHeader(navigation);

  const [posts, setPosts]           = useState<Post[]>([]);
  const [loading, setLoading]       = useState(true);
  const [tab, setTab]               = useState<'all' | 'mine'>('all');
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle]     = useState('');
  const [newBody, setNewBody]       = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory]   = useState<Category | null>(null);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);

  const [filterTitle, setFilterTitle]       = useState('');
  const [filterGuardian, setFilterGuardian] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState<Date | null>(null);
  const [filterDateTo, setFilterDateTo]     = useState<Date | null>(null);
  const [tempDateFrom, setTempDateFrom]     = useState(new Date());
  const [tempDateTo, setTempDateTo]         = useState(new Date());
  const [showDateFromPicker, setShowDateFromPicker] = useState(false);
  const [showDateToPicker, setShowDateToPicker]     = useState(false);
  const [filterCategory, setFilterCategory] = useState<Category | null>(null);
  const [showFilterCatPicker, setShowFilterCatPicker] = useState(false);
  const [sheetOpen, setSheetOpen]           = useState(false);

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
        categoryLabel: p.discussion_category_options?.label ?? undefined,
      }))
    );
    setLoading(false);
  }

  async function submitPost() {
    if (!newTitle.trim() || !newBody.trim() || !guardian) return;
    setSubmitting(true);
    const { error } = await supabase.from('discussion_posts').insert({
      guardian_id: guardian.id,
      title: newTitle.trim(),
      body: newBody.trim(),
      category_id: selectedCategory?.id ?? null,
    });
    if (error) {
      Alert.alert('Error', error.message);
    } else {
      setNewTitle(''); setNewBody(''); setSelectedCategory(null); setShowCreate(false);
      load();
    }
    setSubmitting(false);
  }

  const applyFilters = (list: Post[]) => {
    if (filterTitle.trim())    list = list.filter(p => p.title.toLowerCase().includes(filterTitle.trim().toLowerCase()));
    if (filterGuardian.trim()) list = list.filter(p => p.guardianName.toLowerCase().includes(filterGuardian.trim().toLowerCase()));
    if (filterCategory)        list = list.filter(p => p.categoryLabel === filterCategory.label);
    if (filterDateFrom) {
      const from = new Date(filterDateFrom); from.setHours(0, 0, 0, 0);
      list = list.filter(p => new Date(p.createdAt) >= from);
    }
    if (filterDateTo) {
      const to = new Date(filterDateTo); to.setHours(23, 59, 59, 999);
      list = list.filter(p => new Date(p.createdAt) <= to);
    }
    return list;
  };

  const allFiltered  = applyFilters([...posts]);
  const mineFiltered = applyFilters(posts.filter(p => p.guardianId === guardian?.id));

  const fmtDate = (d: Date) => d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  const hasMoreFilters = tab === 'mine' ? !!filterGuardian : !!(filterGuardian || filterCategory);

  const filterResetKey = `${filterTitle}|${filterCategory?.id ?? ''}|${filterGuardian}|${filterDateFrom?.toISOString() ?? ''}|${filterDateTo?.toISOString() ?? ''}`;
  const { visible: visibleAll,  showLoadMore: showLoadMoreAll,  loadMore: loadMoreAll,  showCapMessage: showCapAll,  pageSize: pageSizeAll  } = useVisibleCount(allFiltered,  filterResetKey);
  const { visible: visibleMine, showLoadMore: showLoadMoreMine, loadMore: loadMoreMine, showCapMessage: showCapMine, pageSize: pageSizeMine } = useVisibleCount(mineFiltered, filterResetKey);

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

      {/* Date range inline — rainbow bordered */}
      <View style={s.dateRow}>
        <LinearGradient colors={[...BUTTERFLY_BORDER.colors]} start={BUTTERFLY_BORDER.start} end={BUTTERFLY_BORDER.end} style={s.dateBtnGradient}>
          <TouchableOpacity
            style={[s.dateBtn, filterDateFrom && s.dateBtnActive]}
            onPress={() => { setTempDateFrom(filterDateFrom ?? new Date()); setShowDateFromPicker(true); }}
            activeOpacity={0.75}
          >
            <AppText style={[s.dateBtnTxt, filterDateFrom && s.dateBtnTxtActive]}>
              {filterDateFrom ? fmtDate(filterDateFrom) : 'From'}
            </AppText>
            {filterDateFrom && (
              <TouchableOpacity onPress={() => setFilterDateFrom(null)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <AppText style={s.dateClear}>✕</AppText>
              </TouchableOpacity>
            )}
          </TouchableOpacity>
        </LinearGradient>
        <AppText style={s.dateSep}>–</AppText>
        <LinearGradient colors={[...BUTTERFLY_BORDER.colors]} start={BUTTERFLY_BORDER.start} end={BUTTERFLY_BORDER.end} style={s.dateBtnGradient}>
          <TouchableOpacity
            style={[s.dateBtn, filterDateTo && s.dateBtnActive]}
            onPress={() => { setTempDateTo(filterDateTo ?? new Date()); setShowDateToPicker(true); }}
            activeOpacity={0.75}
          >
            <AppText style={[s.dateBtnTxt, filterDateTo && s.dateBtnTxtActive]}>
              {filterDateTo ? fmtDate(filterDateTo) : 'To'}
            </AppText>
            {filterDateTo && (
              <TouchableOpacity onPress={() => setFilterDateTo(null)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <AppText style={s.dateClear}>✕</AppText>
              </TouchableOpacity>
            )}
          </TouchableOpacity>
        </LinearGradient>
      </View>

      {/* Category dropdown — My Discussions tab only */}
      {tab === 'mine' && categories.length > 0 && (
        <View>
          <LinearGradient colors={[...BUTTERFLY_BORDER.colors]} start={BUTTERFLY_BORDER.start} end={BUTTERFLY_BORDER.end} style={s.fieldGradient}>
            <TouchableOpacity style={s.catPickerBtn} onPress={() => setShowFilterCatPicker(o => !o)} activeOpacity={0.7}>
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
          <LinearGradient colors={[...BUTTERFLY_BORDER.colors]} start={BUTTERFLY_BORDER.start} end={BUTTERFLY_BORDER.end} style={s.moreBtnGradient}>
            <TouchableOpacity style={[s.moreBtn, hasMoreFilters && s.moreBtnActive]} onPress={() => setSheetOpen(true)} activeOpacity={0.75}>
              <AppText style={[s.moreBtnText, hasMoreFilters && s.moreBtnTextActive]}>More Filters</AppText>
            </TouchableOpacity>
          </LinearGradient>
        )}
      </View>
    </View>
  );

  return (
    <View style={s.container}>
      <RainbowDivider />

      {/* Tab bar */}
      <View style={s.tabBar}>
        {(['all', 'mine'] as const).map(t => (
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
          renderItem={({ item: p }) => (
            <TouchableOpacity
              style={s.card}
              onPress={() => navigation.navigate('DiscussionDetail', { postId: p.id })}
              activeOpacity={0.82}
            >
              {p.categoryLabel && (
                <View style={s.categoryBadge}>
                  <AppText style={s.categoryBadgeText}>{p.categoryLabel}</AppText>
                </View>
              )}
              <AppText style={s.postTitle}>{p.title}</AppText>
              <AppText style={s.postBody} numberOfLines={2}>{p.body}</AppText>
              <View style={s.postMeta}>
                <AppText style={s.metaText}>{p.guardianName}</AppText>
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

      <TouchableOpacity style={s.fab} onPress={() => setShowCreate(true)} activeOpacity={0.85}>
        <AppText style={s.fabText}>New Discussion</AppText>
      </TouchableOpacity>

      {/* More Filters sheet */}
      <FilterSheet
        visible={sheetOpen}
        title="More Filters"
        sections={[
          ...(categories.length > 0 && tab === 'all' ? [{
            key: 'category', emoji: '🏷️', title: 'Category',
            options: categories.map(c => ({ key: c.id, label: c.label })),
            selected: filterCategory ? [filterCategory.id] : [],
            onToggle: (v: string) => setFilterCategory(prev => prev?.id === v ? null : (categories.find(c => c.id === v) ?? null)),
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
        onClearAll={() => { setFilterCategory(null); setFilterGuardian(''); }}
        onDone={() => setSheetOpen(false)}
      />

      {/* Date pickers */}
      <Modal visible={showDateFromPicker} transparent animationType="slide" onRequestClose={() => setShowDateFromPicker(false)}>
        <TouchableOpacity style={s.pickerBackdrop} activeOpacity={1} onPress={() => setShowDateFromPicker(false)}>
          <View style={s.pickerSheet} onStartShouldSetResponder={() => true}>
            <View style={s.pickerHdr}>
              <TouchableOpacity onPress={() => setShowDateFromPicker(false)}>
                <AppText style={s.pickerCancel}>Cancel</AppText>
              </TouchableOpacity>
              <AppText style={s.pickerTitle}>From Date</AppText>
              <TouchableOpacity onPress={() => { setFilterDateFrom(tempDateFrom); setShowDateFromPicker(false); }}>
                <AppText style={s.pickerDone}>Done</AppText>
              </TouchableOpacity>
            </View>
            <DateTimePicker value={tempDateFrom} mode="date" display="spinner" onChange={(_, d) => { if (d) setTempDateFrom(d); }} style={{ height: 220 }} />
          </View>
        </TouchableOpacity>
      </Modal>

      <Modal visible={showDateToPicker} transparent animationType="slide" onRequestClose={() => setShowDateToPicker(false)}>
        <TouchableOpacity style={s.pickerBackdrop} activeOpacity={1} onPress={() => setShowDateToPicker(false)}>
          <View style={s.pickerSheet} onStartShouldSetResponder={() => true}>
            <View style={s.pickerHdr}>
              <TouchableOpacity onPress={() => setShowDateToPicker(false)}>
                <AppText style={s.pickerCancel}>Cancel</AppText>
              </TouchableOpacity>
              <AppText style={s.pickerTitle}>To Date</AppText>
              <TouchableOpacity onPress={() => { setFilterDateTo(tempDateTo); setShowDateToPicker(false); }}>
                <AppText style={s.pickerDone}>Done</AppText>
              </TouchableOpacity>
            </View>
            <DateTimePicker value={tempDateTo} mode="date" display="spinner" onChange={(_, d) => { if (d) setTempDateTo(d); }} style={{ height: 220 }} />
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Create discussion modal */}
      <Modal visible={showCreate} animationType="slide" transparent onRequestClose={closeCreateSheet}>
        <KeyboardAvoidingView style={s.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <TouchableOpacity style={s.modalBackdrop} activeOpacity={1} onPress={closeCreateSheet} />
          <View style={s.modalSheet}>
            <View style={s.modalHandle} />
            <View style={s.modalTitleRow}>
              <AppText style={s.modalTitle}>Start a Discussion</AppText>
              <TouchableOpacity onPress={closeCreateSheet} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <AppText style={s.modalClose}>✕</AppText>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <View style={s.formGap}>
                <AppText style={s.fieldLabel}>Topic <AppText style={{ color: NICO.error }}>*</AppText></AppText>
                <LinearGradient colors={[...BUTTERFLY_BORDER.colors]} start={BUTTERFLY_BORDER.start} end={BUTTERFLY_BORDER.end} style={s.fieldGradient}>
                  <TextInput
                    style={s.fieldInput}
                    value={newTitle}
                    onChangeText={setNewTitle}
                    placeholder="What's on your mind?"
                    placeholderTextColor={NICO.textMuted}
                    maxLength={80}
                  />
                </LinearGradient>

                {categories.length > 0 && (
                  <>
                    <AppText style={s.fieldLabel}>Category <AppText style={{ color: NICO.error }}>*</AppText></AppText>
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

                <AppText style={s.fieldLabel}>Details <AppText style={{ color: NICO.error }}>*</AppText></AppText>
                <LinearGradient colors={[...BUTTERFLY_BORDER.colors]} start={BUTTERFLY_BORDER.start} end={BUTTERFLY_BORDER.end} style={s.fieldGradient}>
                  <TextInput
                    style={[s.fieldInput, s.fieldTextArea]}
                    value={newBody}
                    onChangeText={setNewBody}
                    placeholder="Share more context…"
                    placeholderTextColor={NICO.textMuted}
                    multiline
                    numberOfLines={4}
                    maxLength={600}
                  />
                </LinearGradient>

                <TouchableOpacity
                  style={[{ ...BTN_SIZE.lg, ...BTN_VARIANT.primary }, (!newTitle.trim() || !newBody.trim() || (categories.length > 0 && !selectedCategory) || submitting) && { opacity: 0.5 }]}
                  onPress={submitPost}
                  disabled={!newTitle.trim() || !newBody.trim() || (categories.length > 0 && !selectedCategory) || submitting}
                  activeOpacity={0.85}
                >
                  {submitting
                    ? <ActivityIndicator color={NICO.textOnAccent} />
                    : <AppText style={s.submitBtnText}>Post Discussion</AppText>
                  }
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: NICO.screenBg },
  tabPane:   { flex: 1, backgroundColor: NICO.background },
  center:    { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 40 },
  list:      { padding: SPACING.base, paddingBottom: 100, gap: SPACING.sm },

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
  postBody:  { fontSize: FONT_SIZE.md, color: NICO.textSecondary, lineHeight: 20 },
  postMeta:  { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs, marginTop: SPACING.xs },
  metaText:  { ...TEXT_STYLE.caption },
  metaDot:   { fontSize: FONT_SIZE.sm, color: NICO.border },

  categoryBadge: {
    alignSelf: 'flex-start', backgroundColor: NICO.primaryLight,
    borderRadius: RADIUS.sm, paddingHorizontal: SPACING.sm, paddingVertical: 2, marginBottom: 2,
  },
  categoryBadgeText: { fontSize: FONT_SIZE.xs, fontWeight: FONT_WEIGHT.bold, color: NICO.primary },

  // FAB
  fab: {
    position: 'absolute', bottom: 28,
    ...BTN_SIZE.lg, ...BTN_VARIANT.primary,
    ...SHADOW.md,
  },
  fabText: { ...TEXT_STYLE.buttonPrimary },

  empty:     { alignItems: 'center', paddingTop: 60, gap: SPACING.md },
  emptyText: { ...TEXT_STYLE.cardTitle },
  emptyHint: { ...TEXT_STYLE.hint, textAlign: 'center', paddingHorizontal: SPACING['2xl'] },

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
  dateRow:        { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  dateBtnGradient:{ flex: 1, padding: BUTTERFLY_BORDER.width, borderRadius: RADIUS.lg + BUTTERFLY_BORDER.width },
  dateBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderRadius: RADIUS.lg, borderWidth: 0,
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm,
    backgroundColor: NICO.surface,
  },
  dateBtnActive:    { backgroundColor: NICO.primaryLight },
  dateBtnTxt:       { fontSize: FONT_SIZE.md, color: NICO.textMuted },
  dateBtnTxtActive: { fontSize: FONT_SIZE.md, color: NICO.primary, fontWeight: FONT_WEIGHT.semiBold },
  dateSep:          { fontSize: FONT_SIZE.md, color: NICO.textMuted },
  dateClear:        { fontSize: FONT_SIZE.sm, color: NICO.primary, fontWeight: FONT_WEIGHT.bold },

  // Date picker sheet
  pickerBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  pickerSheet: {
    backgroundColor: NICO.surface, borderTopLeftRadius: RADIUS.xl, borderTopRightRadius: RADIUS.xl,
    paddingBottom: 36,
  },
  pickerHdr: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg, paddingVertical: SPACING.base,
    borderBottomWidth: 1, borderBottomColor: NICO.border,
  },
  pickerTitle:  { ...TEXT_STYLE.cardTitle },
  pickerCancel: { fontSize: FONT_SIZE.lg, color: NICO.textMuted, width: 60 },
  pickerDone:   { fontSize: FONT_SIZE.lg, fontWeight: FONT_WEIGHT.bold, color: NICO.primary, width: 60, textAlign: 'right' },

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

  fieldLabel:   { fontSize: FONT_SIZE.md, fontWeight: FONT_WEIGHT.bold, color: NICO.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },
  fieldGradient: {
    padding: BUTTERFLY_BORDER.width,
    borderRadius: RADIUS.md + BUTTERFLY_BORDER.width,
  },
  fieldInput:    { ...INPUT.base, borderWidth: 0 },
  fieldTextArea: { minHeight: scale(100), textAlignVertical: 'top' },
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
