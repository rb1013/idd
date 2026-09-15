import React, { useCallback, useEffect, useState } from 'react';
import {
  View, FlatList, TouchableOpacity, StyleSheet,
  TextInput, Modal, KeyboardAvoidingView, Platform,
  ActivityIndicator, Alert,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import AppText from '../../components/AppText';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/AuthContext';
import { COLORS } from '../../constants';
import { GuardianNavParamList } from '../../navigation';

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
  guardianName: string;
  replyCount: number;
  categoryLabel?: string;
}

interface Category { id: string; label: string; }

export default function DiscussionsScreen() {
  const navigation = useNavigation<Nav>();
  const { guardian } = useAuth();

  const [posts, setPosts]             = useState<Post[]>([]);
  const [loading, setLoading]         = useState(true);
  const [showCreate, setShowCreate]   = useState(false);
  const [newTitle, setNewTitle]       = useState('');
  const [newBody, setNewBody]         = useState('');
  const [submitting, setSubmitting]   = useState(false);
  const [categories, setCategories]   = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);

  // Filters
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
  const [showMoreFilters, setShowMoreFilters] = useState(false);

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
      .select('id, title, body, created_at, category_id, guardians(full_name), discussion_replies(id), discussion_category_options(label)')
      .order('created_at', { ascending: false });

    setPosts(
      (data ?? []).map((p: any) => ({
        id: p.id,
        title: p.title,
        body: p.body,
        createdAt: p.created_at,
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
      setNewTitle('');
      setNewBody('');
      setSelectedCategory(null);
      setShowCreate(false);
      load();
    }
    setSubmitting(false);
  }

  if (loading) {
    return <View style={s.center}><ActivityIndicator size="large" color={COLORS.bloomAccent} /></View>;
  }

  const filteredPosts = posts.filter(p => {
    if (filterTitle && !p.title.toLowerCase().includes(filterTitle.toLowerCase())) return false;
    if (filterGuardian && !p.guardianName.toLowerCase().includes(filterGuardian.toLowerCase())) return false;
    if (filterCategory && p.categoryLabel !== filterCategory.label) return false;
    if (filterDateFrom) {
      const from = new Date(filterDateFrom); from.setHours(0, 0, 0, 0);
      if (new Date(p.createdAt) < from) return false;
    }
    if (filterDateTo) {
      const to = new Date(filterDateTo); to.setHours(23, 59, 59, 999);
      if (new Date(p.createdAt) > to) return false;
    }
    return true;
  });

  const fmtDate = (d: Date) => d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  const moreFiltersActive = !!(filterGuardian || filterDateFrom || filterDateTo);
  const anyFilterActive = !!(filterTitle || filterCategory || filterGuardian || filterDateFrom || filterDateTo);
  const displayedPosts = anyFilterActive ? filteredPosts : filteredPosts.slice(0, 10);

  const filterHeader = (
    <View style={s.filterOuter}>
      {/* Primary filters: Title + Category */}
      <View style={s.filterPanel}>
        <TextInput
          style={s.filterInput}
          placeholder="Search by title…"
          placeholderTextColor={COLORS.bloomMuted}
          value={filterTitle}
          onChangeText={setFilterTitle}
        />

        {categories.length > 0 && (
          <>
            <View style={s.filterDivider} />
            <TouchableOpacity style={s.filterCatBtn} onPress={() => setShowFilterCatPicker(o => !o)} activeOpacity={0.7}>
              <AppText style={s.filterLabel}>Category</AppText>
              <AppText style={[s.filterValue, !!filterCategory && s.filterValueActive]} numberOfLines={1}>
                {filterCategory?.label ?? 'All'}
              </AppText>
              {filterCategory
                ? <TouchableOpacity onPress={() => { setFilterCategory(null); setShowFilterCatPicker(false); }} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <AppText style={s.filterClear}>✕</AppText>
                  </TouchableOpacity>
                : <AppText style={s.filterArrow}>{showFilterCatPicker ? '▴' : '▾'}</AppText>
              }
            </TouchableOpacity>
            {showFilterCatPicker && (
              <View>
                <View style={s.filterDivider} />
                {categories.map((cat, i) => (
                  <TouchableOpacity
                    key={cat.id}
                    style={[s.filterCatOption, i < categories.length - 1 && s.filterDividerItem, filterCategory?.id === cat.id && s.filterCatOptionSelected]}
                    onPress={() => { setFilterCategory(cat); setShowFilterCatPicker(false); }}
                  >
                    <AppText style={[s.filterValue, filterCategory?.id === cat.id && s.filterValueActive]}>{cat.label}</AppText>
                    {filterCategory?.id === cat.id && <AppText style={s.dropdownCheck}>✓</AppText>}
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </>
        )}
      </View>

      {/* More Filters toggle */}
      <TouchableOpacity
        style={s.moreFiltersBtn}
        onPress={() => setShowMoreFilters(o => !o)}
        activeOpacity={0.7}
      >
        <AppText style={s.moreFiltersBtnText}>
          {showMoreFilters ? 'Less Filters' : 'More Filters'}
        </AppText>
        {moreFiltersActive && !showMoreFilters && (
          <View style={s.moreFiltersBadge} />
        )}
        <AppText style={s.moreFiltersChevron}>{showMoreFilters ? '▴' : '▾'}</AppText>
      </TouchableOpacity>

      {/* Expanded: Guardian + Date range */}
      {showMoreFilters && (
        <View style={s.filterPanel}>
          <TextInput
            style={s.filterInput}
            placeholder="Search by guardian name…"
            placeholderTextColor={COLORS.bloomMuted}
            value={filterGuardian}
            onChangeText={setFilterGuardian}
          />

          <View style={s.filterDivider} />

          <TouchableOpacity
            style={s.filterRow}
            onPress={() => { setTempDateFrom(filterDateFrom ?? new Date()); setShowDateFromPicker(true); }}
            activeOpacity={0.7}
          >
            <AppText style={s.filterLabel}>From</AppText>
            <AppText style={[s.filterValue, filterDateFrom && s.filterValueActive]}>
              {filterDateFrom ? fmtDate(filterDateFrom) : 'Any date'}
            </AppText>
            {filterDateFrom
              ? <TouchableOpacity onPress={() => setFilterDateFrom(null)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <AppText style={s.filterClear}>✕</AppText>
                </TouchableOpacity>
              : <AppText style={s.filterArrow}>›</AppText>
            }
          </TouchableOpacity>

          <View style={s.filterDivider} />

          <TouchableOpacity
            style={s.filterRow}
            onPress={() => { setTempDateTo(filterDateTo ?? new Date()); setShowDateToPicker(true); }}
            activeOpacity={0.7}
          >
            <AppText style={s.filterLabel}>To</AppText>
            <AppText style={[s.filterValue, filterDateTo && s.filterValueActive]}>
              {filterDateTo ? fmtDate(filterDateTo) : 'Any date'}
            </AppText>
            {filterDateTo
              ? <TouchableOpacity onPress={() => setFilterDateTo(null)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <AppText style={s.filterClear}>✕</AppText>
                </TouchableOpacity>
              : <AppText style={s.filterArrow}>›</AppText>
            }
          </TouchableOpacity>
        </View>
      )}
    </View>
  );

  return (
    <View style={s.container}>
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
              <AppText style={s.metaText}>
                {p.replyCount} {p.replyCount === 1 ? 'reply' : 'replies'}
              </AppText>
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={s.empty}>
            <AppText style={s.emptyEmoji}>💬</AppText>
            <AppText style={s.emptyText}>{posts.length === 0 ? 'No discussions yet' : 'No results'}</AppText>
            <AppText style={s.emptyHint}>{posts.length === 0 ? 'Start the first conversation' : anyFilterActive ? 'Try adjusting your filters' : ''}</AppText>
          </View>
        }
      />

      <TouchableOpacity style={s.fab} onPress={() => setShowCreate(true)} activeOpacity={0.85}>
        <AppText style={s.fabText}>+ New Discussion</AppText>
      </TouchableOpacity>

      {/* Date From picker */}
      <Modal visible={showDateFromPicker} transparent animationType="slide" onRequestClose={() => setShowDateFromPicker(false)}>
        <TouchableOpacity style={s.nudgeBackdrop} activeOpacity={1} onPress={() => setShowDateFromPicker(false)}>
          <View style={s.nudgeSheet} onStartShouldSetResponder={() => true}>
            <View style={s.filterPickerHdr}>
              <TouchableOpacity onPress={() => setShowDateFromPicker(false)}>
                <AppText style={s.filterPickerCancel}>Cancel</AppText>
              </TouchableOpacity>
              <AppText style={s.filterPickerTitle}>From Date</AppText>
              <TouchableOpacity onPress={() => { setFilterDateFrom(tempDateFrom); setShowDateFromPicker(false); }}>
                <AppText style={s.filterPickerDone}>Done</AppText>
              </TouchableOpacity>
            </View>
            <DateTimePicker value={tempDateFrom} mode="date" display="spinner" onChange={(_, d) => { if (d) setTempDateFrom(d); }} style={{ height: 220 }} />
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Date To picker */}
      <Modal visible={showDateToPicker} transparent animationType="slide" onRequestClose={() => setShowDateToPicker(false)}>
        <TouchableOpacity style={s.nudgeBackdrop} activeOpacity={1} onPress={() => setShowDateToPicker(false)}>
          <View style={s.nudgeSheet} onStartShouldSetResponder={() => true}>
            <View style={s.filterPickerHdr}>
              <TouchableOpacity onPress={() => setShowDateToPicker(false)}>
                <AppText style={s.filterPickerCancel}>Cancel</AppText>
              </TouchableOpacity>
              <AppText style={s.filterPickerTitle}>To Date</AppText>
              <TouchableOpacity onPress={() => { setFilterDateTo(tempDateTo); setShowDateToPicker(false); }}>
                <AppText style={s.filterPickerDone}>Done</AppText>
              </TouchableOpacity>
            </View>
            <DateTimePicker value={tempDateTo} mode="date" display="spinner" onChange={(_, d) => { if (d) setTempDateTo(d); }} style={{ height: 220 }} />
          </View>
        </TouchableOpacity>
      </Modal>

      <Modal
        visible={showCreate}
        animationType="slide"
        transparent
        onRequestClose={closeCreateSheet}
      >
        <KeyboardAvoidingView
          style={s.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <TouchableOpacity
            style={s.modalBackdrop}
            activeOpacity={1}
            onPress={closeCreateSheet}
          />
          <View style={s.modalSheet}>
            <View style={s.modalHandle} />
            <View style={s.modalTitleRow}>
              <AppText style={s.modalTitle}>Start a Discussion</AppText>
              <TouchableOpacity onPress={closeCreateSheet} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <AppText style={s.modalClose}>✕</AppText>
              </TouchableOpacity>
            </View>

            <AppText style={s.fieldLabel}>Topic</AppText>
            <TextInput
              style={s.fieldInput}
              value={newTitle}
              onChangeText={setNewTitle}
              placeholder="What's on your mind?"
              placeholderTextColor={COLORS.bloomMuted}
              maxLength={120}
            />

            {categories.length > 0 && (
              <>
                <AppText style={s.fieldLabel}>Category</AppText>
                <TouchableOpacity style={s.pickerBtn} onPress={() => setShowCategoryPicker(o => !o)} activeOpacity={0.7}>
                  <AppText style={[s.pickerBtnText, !selectedCategory && { color: COLORS.bloomMuted }]}>
                    {selectedCategory?.label ?? 'Select a category…'}
                  </AppText>
                  <AppText style={s.pickerChevron}>{showCategoryPicker ? '▴' : '▾'}</AppText>
                </TouchableOpacity>
                {showCategoryPicker && (
                  <View style={s.dropdownList}>
                    {selectedCategory && (
                      <TouchableOpacity style={s.dropdownItem} onPress={() => { setSelectedCategory(null); setShowCategoryPicker(false); }}>
                        <AppText style={s.dropdownClearText}>Clear</AppText>
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

            <AppText style={s.fieldLabel}>Details</AppText>
            <TextInput
              style={[s.fieldInput, s.fieldTextArea]}
              value={newBody}
              onChangeText={setNewBody}
              placeholder="Share more context…"
              placeholderTextColor={COLORS.bloomMuted}
              multiline
              numberOfLines={4}
            />

            <TouchableOpacity
              style={[s.submitBtn, (!newTitle.trim() || !newBody.trim() || submitting) && { opacity: 0.5 }]}
              onPress={submitPost}
              disabled={!newTitle.trim() || !newBody.trim() || submitting}
            >
              {submitting
                ? <ActivityIndicator color="#fff" />
                : <AppText style={s.submitBtnText}>Post Discussion</AppText>
              }
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bloomBody },
  center:    { flex: 1, justifyContent: 'center', alignItems: 'center' },
  list:      { padding: 16, paddingBottom: 100, gap: 10 },

  card: {
    backgroundColor: COLORS.bloomCard, borderRadius: 18, padding: 16, gap: 6,
    borderWidth: 1, borderColor: COLORS.bloomBorder,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },
  postTitle: { fontSize: 16, fontWeight: '800', color: COLORS.bloomText },
  postBody:  { fontSize: 13, color: '#4A5568', lineHeight: 18 },
  postMeta:  { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  metaText:  { fontSize: 12, color: '#5A6470' },
  metaDot:   { fontSize: 12, color: COLORS.bloomBorder },

  fab: {
    position: 'absolute', bottom: 28, right: 20, left: 20,
    backgroundColor: COLORS.bloomAccent, borderRadius: 16,
    paddingVertical: 16, alignItems: 'center',
    shadowColor: COLORS.bloomAccent, shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4, shadowRadius: 12, elevation: 8,
  },
  fabText: { color: COLORS.bloomOnAccent, fontWeight: '800', fontSize: 15 },

  empty:      { alignItems: 'center', paddingTop: 80, gap: 12 },
  emptyEmoji: { fontSize: 56 },
  emptyText:  { fontSize: 20, fontWeight: '800', color: COLORS.bloomText },
  emptyHint:  { fontSize: 14, color: COLORS.bloomMuted },

  modalOverlay:  { flex: 1, justifyContent: 'flex-end' },
  modalBackdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.45)' },
  modalSheet: {
    backgroundColor: COLORS.bloomCard,
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    padding: 24, paddingBottom: 40, gap: 12,
  },
  filterOuter: { paddingHorizontal: 14, paddingTop: 12, paddingBottom: 6, gap: 8 },
  filterPanel: {
    backgroundColor: COLORS.bloomCard, borderRadius: 16,
    borderWidth: 1, borderColor: COLORS.bloomBorder,
    overflow: 'hidden',
  },
  filterInput: {
    paddingHorizontal: 16, paddingVertical: 13,
    fontSize: 14, color: COLORS.bloomText,
  },
  filterDivider:    { height: 1, backgroundColor: COLORS.bloomBorder, marginLeft: 16 },
  filterCatBtn: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 13,
  },
  filterRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 13,
  },
  filterLabel:      { fontSize: 13, fontWeight: '700', color: COLORS.bloomText, width: 72 },
  filterValue:      { flex: 1, fontSize: 13, color: COLORS.bloomMuted },
  filterValueActive:{ color: COLORS.bloomNavy, fontWeight: '600' },
  filterArrow:      { fontSize: 14, color: COLORS.bloomMuted },
  filterClear:      { fontSize: 13, color: COLORS.bloomNavy, fontWeight: '700' },
  filterCatOption:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 13 },
  filterDividerItem:{ borderBottomWidth: 1, borderBottomColor: COLORS.bloomBorder },
  filterCatOptionSelected: { backgroundColor: COLORS.bloomAccent + '10' },

  moreFiltersBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 6,
  },
  moreFiltersBtnText: { fontSize: 13, fontWeight: '600', color: COLORS.bloomNavy },
  moreFiltersChevron: { fontSize: 11, color: COLORS.bloomNavy },
  moreFiltersBadge: {
    width: 7, height: 7, borderRadius: 4,
    backgroundColor: COLORS.bloomAccent, marginTop: -2,
  },

  nudgeBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  nudgeSheet: {
    backgroundColor: COLORS.bloomCard,
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    paddingBottom: 36,
  },
  filterPickerHdr: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 16,
    borderBottomWidth: 1, borderBottomColor: COLORS.bloomBorder,
  },
  filterPickerTitle:  { fontSize: 16, fontWeight: '800', color: COLORS.bloomText },
  filterPickerCancel: { fontSize: 15, color: COLORS.bloomMuted, width: 60 },
  filterPickerDone:   { fontSize: 15, fontWeight: '700', color: COLORS.bloomNavy, width: 60, textAlign: 'right' },

  modalHandle: {
    width: 44, height: 4, backgroundColor: COLORS.bloomBorder,
    borderRadius: 2, alignSelf: 'center', marginBottom: 8,
  },
  modalTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  modalTitle:    { fontSize: 20, fontWeight: '900', color: COLORS.bloomText },
  modalClose:    { fontSize: 18, color: COLORS.bloomMuted, fontWeight: '600' },

  fieldLabel: { fontSize: 12, fontWeight: '700', color: COLORS.bloomMuted, letterSpacing: 0.5, marginBottom: -4 },
  fieldInput: {
    backgroundColor: COLORS.bloomBody, borderRadius: 14, borderWidth: 1.5,
    borderColor: COLORS.bloomBorder, padding: 14,
    fontSize: 15, color: COLORS.bloomText,
  },
  fieldTextArea: { minHeight: 100, textAlignVertical: 'top' },

  submitBtn: {
    backgroundColor: COLORS.bloomAccent, borderRadius: 14,
    paddingVertical: 16, alignItems: 'center', marginTop: 4,
  },
  submitBtnText: { color: COLORS.bloomOnAccent, fontWeight: '800', fontSize: 15 },

  pickerBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: COLORS.bloomBody, borderRadius: 14, borderWidth: 1.5,
    borderColor: COLORS.bloomBorder, padding: 14,
  },
  pickerBtnText: { fontSize: 15, color: COLORS.bloomText, flex: 1 },
  pickerChevron: { fontSize: 13, color: COLORS.bloomMuted },

  dropdownList: {
    borderWidth: 1.5, borderColor: COLORS.bloomBorder, borderRadius: 14,
    backgroundColor: COLORS.bloomCard, overflow: 'hidden', marginTop: -8,
  },
  dropdownItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 13 },
  dropdownItemBorder: { borderBottomWidth: 1, borderBottomColor: COLORS.bloomBorder },
  dropdownItemSelected: { backgroundColor: COLORS.bloomAccent + '12' },
  dropdownItemText:     { fontSize: 15, color: COLORS.bloomText },
  dropdownItemTextSelected: { fontWeight: '700', color: COLORS.bloomAccent },
  dropdownCheck:  { fontSize: 15, color: COLORS.bloomAccent, fontWeight: '700' },
  dropdownClearText: { fontSize: 14, color: '#E53E3E', fontWeight: '600' },

  categoryBadge: {
    alignSelf: 'flex-start',
    backgroundColor: COLORS.bloomAccent + '18', borderRadius: 10,
    paddingHorizontal: 8, paddingVertical: 3, marginBottom: 2,
  },
  categoryBadgeText: { fontSize: 11, fontWeight: '700', color: COLORS.bloomAccent },
});
