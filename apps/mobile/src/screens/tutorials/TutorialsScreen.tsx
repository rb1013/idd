import React, { useCallback, useState } from 'react';
import {
  View, ScrollView, TouchableOpacity, StyleSheet,
  Image, ActivityIndicator, Dimensions, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AppText from '../../components/AppText';
import RainbowDivider from '../../components/RainbowDivider';
import ContentContainer from '../../components/ContentContainer';
import useNicoHeader from '../../hooks/useNicoHeader';
import { speakLearner } from '../../lib/speech';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/AuthContext';
import { useVisibleCount } from '../../hooks/useVisibleCount';
import { UserStackParamList } from '../../navigation';
import type { Tutorial } from '../../types';
import {
  NICO, TEXT_STYLE, SPACING, RADIUS, SHADOW, FONT_SIZE, FONT_WEIGHT,
  BTN_SIZE, BTN_VARIANT, BUTTERFLY_TILES, MAX_CONTENT_WIDTH, IS_TABLET, scale,
} from '../../constants/theme';

const { width } = Dimensions.get('window');
const CONTENT_W = IS_TABLET && MAX_CONTENT_WIDTH ? MAX_CONTENT_WIDTH : width;
const TILE_W = (CONTENT_W - 40 - 12) / 2; // 20px padding each side, 12px gap

const FORMAT_EMOJI: Record<string, string> = { video: '🎬', slideshow: '🖼' };

const CATEGORY_META: Record<string, { emoji: string; color: string }> = {
  'Math':      { emoji: '🔢', color: NICO.primary },
  'Reading':   { emoji: '📖', color: NICO.teal },
  'Science':   { emoji: '🔬', color: NICO.teal },
  'Life Skills': { emoji: '🏠', color: NICO.orange },
  'Social':    { emoji: '🤝', color: NICO.purple },
  'Health':    { emoji: '🍎', color: NICO.error },
  'Art':       { emoji: '🎨', color: NICO.orange },
  'Music':     { emoji: '🎵', color: NICO.purple },
  'Sport':     { emoji: '⚽', color: NICO.green },
  'Cooking':   { emoji: '🍳', color: NICO.coral },
  'Safety':    { emoji: '⛑️', color: NICO.error },
};
const CAT_COLORS = [NICO.primary, NICO.teal, NICO.orange, NICO.purple, NICO.error, NICO.green, NICO.coral];
function categoryColor(name: string): string {
  return CATEGORY_META[name]?.color ?? CAT_COLORS[Math.abs([...name].reduce((h, c) => c.charCodeAt(0) + ((h << 5) - h), 0)) % CAT_COLORS.length];
}
function categoryEmoji(name: string): string { return CATEGORY_META[name]?.emoji ?? '📚'; }

const NO_TUTORIALS_MSG = "No tutorials yet! Ask your Guardian to add learning videos for you!";

function NoTutorialsState() {
  return (
    <View style={s.emptyContainer}>
      <AppText style={s.emptyEmoji}>📚</AppText>
      <AppText style={s.emptyText}>No tutorials yet!</AppText>
      <AppText style={s.emptyHint}>Ask your Guardian to add learning videos for you</AppText>
      <TouchableOpacity
        style={s.emptySpeakBtn}
        onPress={() => speakLearner(NO_TUTORIALS_MSG)}
        activeOpacity={0.75}
      >
        <AppText style={s.emptySpeakBtnText}>🔊</AppText>
      </TouchableOpacity>
    </View>
  );
}

export default function TutorialsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<UserStackParamList>>();
  const { activeUser } = useAuth();
  const [tutorials, setTutorials] = useState<Tutorial[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [categories, setCategories] = useState<string[]>([]);
  const [categoryOpen, setCategoryOpen] = useState(false);

  useNicoHeader(navigation);

  useFocusEffect(
    useCallback(() => {
      if (activeUser) fetchTutorials(activeUser.id);
    }, [activeUser]),
  );

  async function fetchTutorials(userId: string) {
    const { data: links } = await supabase
      .from('user_tutorials')
      .select('tutorial_id')
      .eq('user_id', userId);

    if (!links || links.length === 0) {
      setTutorials([]);
      setCategories(['All']);
      setLoading(false);
      return;
    }

    const tutorialIds = links.map((l: any) => l.tutorial_id);

    const { data: tuts } = await supabase
      .from('tutorials')
      .select('*')
      .in('id', tutorialIds)
      .eq('status', 'approved')
      .order('created_at', { ascending: false });

    const items = (tuts ?? []) as Tutorial[];
    setTutorials(items);
    const cats = [...new Set(items.map(t => t.category))];
    setCategories(['All', ...cats]);
    setLoading(false);
  }

  const { visible: visibleTutorials, showLoadMore, loadMore, showCapMessage, pageSize } = useVisibleCount(tutorials, selectedCategory ?? undefined);

  if (loading) return <View style={s.center}><ActivityIndicator size="large" color={NICO.primary} /></View>;

  return (
    <View style={s.container}>
      <RainbowDivider />
      {/* Category dropdown — commented out, re-enable when needed
      <View style={s.filterBar}>
        <TouchableOpacity style={s.filterBtn} onPress={() => setCategoryOpen(true)} activeOpacity={0.75}>
          <AppText style={s.filterBtnText}>{activeLabel}</AppText>
          <AppText style={s.filterBtnArrow}>▾</AppText>
        </TouchableOpacity>
      </View>
      <Modal visible={categoryOpen} transparent animationType="slide" onRequestClose={() => setCategoryOpen(false)}>
        <TouchableOpacity style={s.sheetOverlay} activeOpacity={1} onPress={() => setCategoryOpen(false)}>
          <SafeAreaView style={s.sheet}>
            <View style={s.sheetHeader}>
              <AppText style={s.sheetTitle}>Filter by Category</AppText>
              <TouchableOpacity onPress={() => setCategoryOpen(false)}>
                <AppText style={s.sheetDone}>Done</AppText>
              </TouchableOpacity>
            </View>
            <ScrollView>
              {categories.filter(cat => cat !== 'All').map(cat => {
                const isActive = selectedCategory === cat;
                const color = categoryColor(cat);
                return (
                  <TouchableOpacity key={cat} style={[s.sheetOption, isActive && { backgroundColor: color + '18' }]}
                    onPress={() => { setSelectedCategory(cat); setCategoryOpen(false); }}>
                    <AppText style={s.sheetOptionEmoji}>{categoryEmoji(cat)}</AppText>
                    <AppText style={[s.sheetOptionText, isActive && { color, fontWeight: '800' }]}>{cat}</AppText>
                    {isActive && <AppText style={[s.sheetCheck, { color }]}>✓</AppText>}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </SafeAreaView>
        </TouchableOpacity>
      </Modal>
      */}

      {tutorials.length === 0 ? (
        <NoTutorialsState />
      ) : (
        <ScrollView contentContainerStyle={s.list}>
          <ContentContainer>
          {/* All tutorials — no favourites/regular split, everything treated the same */}
          {tutorials.length > 0 && (
            <View style={s.section}>
            <View style={s.tileGrid}>
              {visibleTutorials.map((item, idx) => {
                const tile = BUTTERFLY_TILES[idx % BUTTERFLY_TILES.length];
                return (
                  <TouchableOpacity
                    key={item.id}
                    style={[s.tile, { backgroundColor: tile.bg, borderColor: tile.accent }]}
                    onPress={() => navigation.navigate(
                      item.format === 'video' ? 'VideoPlayer' : 'SlideshowPlayer',
                      { tutorialId: item.id },
                    )}
                    activeOpacity={0.85}
                  >
                    {item.thumbnail_url
                      ? <Image source={{ uri: item.thumbnail_url }} style={s.tileThumb} resizeMode="cover" />
                      : (
                        <View style={[s.tileThumb, { backgroundColor: tile.accent + '40', justifyContent: 'center', alignItems: 'center' }]}>
                          <AppText style={{ fontSize: scale(36) }}>{FORMAT_EMOJI[item.format] ?? '📚'}</AppText>
                        </View>
                      )
                    }
                    <View style={s.tileBody}>
                      <AppText style={s.tileTitleText} numberOfLines={2}>{item.display_name || item.category}</AppText>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
            {showLoadMore && (
              <TouchableOpacity style={s.loadMoreBtn} onPress={loadMore} activeOpacity={0.7}>
                <AppText style={s.loadMoreText}>Load {pageSize} more</AppText>
              </TouchableOpacity>
            )}
            {showCapMessage && (
              <View style={s.capMessage}>
                <AppText style={s.capMessageText}>Use filters to search records</AppText>
              </View>
            )}
            </View>
          )}
          </ContentContainer>
        </ScrollView>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: NICO.screenBg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  filterBar: {
    paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md,
    alignItems: 'flex-end',
  },
  filterBtn: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.xs,
    backgroundColor: NICO.surface,
    borderWidth: 1.5, borderColor: NICO.border,
    borderRadius: RADIUS.full, paddingHorizontal: SPACING.base, paddingVertical: SPACING.sm,
  },
  filterBtnText: { fontSize: FONT_SIZE.sm, fontWeight: FONT_WEIGHT.bold, color: NICO.text },
  filterBtnArrow: { fontSize: FONT_SIZE.xs, color: NICO.textMuted },
  sheetOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: {
    backgroundColor: NICO.surface,
    borderTopLeftRadius: RADIUS['2xl'], borderTopRightRadius: RADIUS['2xl'],
    maxHeight: '65%',
    paddingBottom: Platform.OS === 'android' ? SPACING.base : 0,
  },
  sheetHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: SPACING.lg, paddingVertical: SPACING.base,
    borderBottomWidth: 1, borderBottomColor: NICO.border,
  },
  sheetTitle: { fontSize: FONT_SIZE.md, fontWeight: FONT_WEIGHT.extraBold, color: NICO.text },
  sheetDone: { fontSize: FONT_SIZE.md, color: NICO.primary, fontWeight: FONT_WEIGHT.bold },
  sheetOption: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.md,
    paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md,
    borderBottomWidth: 1, borderBottomColor: NICO.border,
  },
  sheetOptionEmoji: { fontSize: FONT_SIZE.xl },
  sheetOptionText: { flex: 1, fontSize: FONT_SIZE.md, color: NICO.text, fontWeight: FONT_WEIGHT.semiBold },
  sheetCheck: { fontSize: FONT_SIZE.lg, fontWeight: FONT_WEIGHT.extraBold },
  list: { padding: SPACING.lg, paddingBottom: 48, gap: SPACING.xl },

  section: { gap: SPACING.md },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  sectionEmoji: { fontSize: scale(26) },
  sectionTitle: { fontSize: FONT_SIZE['2xl'], fontWeight: FONT_WEIGHT.black, color: NICO.text },

  tileGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-start', gap: SPACING.md },
  tile: {
    width: TILE_W, borderRadius: RADIUS.xl, overflow: 'hidden', borderWidth: 1,
    ...SHADOW.sm,
  },
  tileThumb: { width: '100%', aspectRatio: 1 },
  tileBody: { padding: SPACING.sm, gap: SPACING.xs },
  tileTitleText: { fontSize: FONT_SIZE.sm, fontWeight: FONT_WEIGHT.semiBold, color: NICO.text, lineHeight: 20 },

  loadMoreBtn:    { ...BTN_SIZE.sm, ...BTN_VARIANT.outline, alignSelf: 'center', marginTop: SPACING.base },
  loadMoreText:   { fontSize: FONT_SIZE.lg, fontWeight: FONT_WEIGHT.extraBold, color: NICO.primary },
  capMessage:     { alignItems: 'center', paddingVertical: SPACING.base },
  capMessageText: { ...TEXT_STYLE.hint, fontStyle: 'italic' },

  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80, gap: SPACING.md, backgroundColor: NICO.screenBg },
  emptyEmoji: { fontSize: scale(72) },
  emptyText: { fontSize: FONT_SIZE['2xl'], fontWeight: FONT_WEIGHT.black, color: NICO.text },
  emptyHint: { ...TEXT_STYLE.screenHint, textAlign: 'center', paddingHorizontal: SPACING.xl },
  emptySpeakBtn: {
    marginTop: SPACING.sm, paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md,
    borderRadius: RADIUS['2xl'], backgroundColor: BUTTERFLY_TILES[2].bg,
    borderWidth: 1.5, borderColor: BUTTERFLY_TILES[2].accent,
  },
  emptySpeakBtnText: { fontSize: FONT_SIZE.lg },
});
