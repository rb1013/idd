import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, ScrollView, TouchableOpacity, StyleSheet,
  Image, ActivityIndicator, Modal, Dimensions, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AppText from '../../components/AppText';
import RainbowDivider from '../../components/RainbowDivider';
import ContentContainer from '../../components/ContentContainer';
import useNicoHeader from '../../hooks/useNicoHeader';
import * as Speech from 'expo-speech';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { VideoView, useVideoPlayer } from 'expo-video';
import YoutubePlayer from '../../components/YoutubePlayer';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/AuthContext';
import { useVisibleCount } from '../../hooks/useVisibleCount';
import type { Tutorial, TutorialFrame } from '../../types';
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

interface TutorialWithFrames extends Tutorial {
  frames: TutorialFrame[];
}

const NO_TUTORIALS_MSG = "No tutorials yet! Ask your Guardian to add learning videos for you!";

function NoTutorialsState() {
  return (
    <View style={s.emptyContainer}>
      <AppText style={s.emptyEmoji}>📚</AppText>
      <AppText style={s.emptyText}>No tutorials yet!</AppText>
      <AppText style={s.emptyHint}>Ask your Guardian to add learning videos for you</AppText>
      <TouchableOpacity
        style={s.emptySpeakBtn}
        onPress={() => Speech.speak(NO_TUTORIALS_MSG, { rate: 0.65, pitch: 1.0 })}
        activeOpacity={0.75}
      >
        <AppText style={s.emptySpeakBtnText}>🔊</AppText>
      </TouchableOpacity>
    </View>
  );
}

export default function TutorialsScreen() {
  const navigation = useNavigation();
  const { activeUser } = useAuth();
  const [tutorials, setTutorials] = useState<TutorialWithFrames[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [categories, setCategories] = useState<string[]>([]);
  const [playing, setPlaying] = useState<TutorialWithFrames | null>(null);
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
      .select('*, tutorial_frames(*)')
      .in('id', tutorialIds)
      .eq('status', 'approved')
      .order('created_at', { ascending: false });

    const items: TutorialWithFrames[] = (tuts ?? []).map((t: any) => ({
      ...t,
      frames: [...(t.tutorial_frames ?? [])].sort((a: TutorialFrame, b: TutorialFrame) => a.order_index - b.order_index),
    }));

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
                    onPress={() => setPlaying(item)}
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

      {playing && (
        playing.format === 'video'
          ? <VideoModal tutorial={playing} onClose={() => setPlaying(null)} />
          : <PlaybackModal tutorial={playing} onClose={() => setPlaying(null)} />
      )}
    </View>
  );
}

function VideoModal({ tutorial, onClose }: { tutorial: TutorialWithFrames; onClose: () => void }) {
  if (tutorial.source === 'youtube') {
    return <YoutubeVideoModal tutorial={tutorial} onClose={onClose} />;
  }
  return <NativeVideoModal tutorial={tutorial} onClose={onClose} />;
}

function YoutubeVideoModal({ tutorial, onClose }: { tutorial: TutorialWithFrames; onClose: () => void }) {
  const videoId = tutorial.video_url?.match(/embed\/([a-zA-Z0-9_-]{11})/)?.[1] ?? null;
  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <View style={s.modalContainer}>
        <TouchableOpacity style={s.closeBtn} onPress={onClose}>
          <AppText style={s.closeBtnText}>✕ Close</AppText>
        </TouchableOpacity>
        {videoId && (
          <>
            <YoutubePlayer videoId={videoId} height={Math.round(width * 9 / 16)} />
            <View style={s.videoInfo}>
              <AppText style={s.videoTitle}>{tutorial.title}</AppText>
              <AppText style={s.videoDesc}>{tutorial.description}</AppText>
            </View>
          </>
        )}
      </View>
    </Modal>
  );
}

function NativeVideoModal({ tutorial, onClose }: { tutorial: TutorialWithFrames; onClose: () => void }) {
  const player = useVideoPlayer(tutorial.video_url ?? null, p => { if (tutorial.video_url) p.play(); });

  useEffect(() => {
    if (tutorial.video_url) {
      player.replace({ uri: tutorial.video_url });
      player.play();
    }
  }, [tutorial.video_url]);

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <View style={s.modalContainer}>
        <TouchableOpacity style={s.closeBtn} onPress={onClose}>
          <AppText style={s.closeBtnText}>✕ Close</AppText>
        </TouchableOpacity>
        {tutorial.video_url && (
          <>
            <VideoView player={player} style={s.video} nativeControls contentFit="contain" />
            <View style={s.videoInfo}>
              <AppText style={s.videoTitle}>{tutorial.title}</AppText>
              <AppText style={s.videoDesc}>{tutorial.description}</AppText>
            </View>
          </>
        )}
      </View>
    </Modal>
  );
}

// ── Primary playback: auto-plays through frames, Play/Pause is the only control ──
function PlaybackModal({ tutorial, onClose }: { tutorial: TutorialWithFrames; onClose: () => void }) {
  const frames = tutorial.frames;
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [finished, setFinished] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [viewingSlides, setViewingSlides] = useState(false);

  const playingRef = useRef(false);
  const wasPlayingRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const currentFrame = frames[index];
  const isLast = index === frames.length - 1;

  // Stored audio — prefer over device TTS when available
  const player = useAudioPlayer(currentFrame?.audio_url ? { uri: currentFrame.audio_url } : null);
  const playerStatus = useAudioPlayerStatus(player);

  useEffect(() => { playingRef.current = playing; }, [playing]);

  function advance() {
    if (isLast) { setPlaying(false); setFinished(true); }
    else setIndex(i => i + 1);
  }

  // Drive playback of the current frame — auto-starts immediately, and again on resume from pause
  useEffect(() => {
    if (!playing) return;
    Speech.stop();
    setSpeaking(false);
    if (timerRef.current) clearTimeout(timerRef.current);

    if (currentFrame?.audio_url) {
      player.seekTo(0);
      player.play();
    } else if (currentFrame?.tts_text) {
      setSpeaking(true);
      Speech.speak(currentFrame.tts_text, {
        rate: 0.65, pitch: 1.0,
        onDone: () => { setSpeaking(false); if (playingRef.current) advance(); },
        onStopped: () => setSpeaking(false),
      });
    } else {
      timerRef.current = setTimeout(() => { if (playingRef.current) advance(); }, 3000);
    }
  }, [index, playing]);

  // Detect stored audio finishing → advance
  useEffect(() => {
    const wasPlaying = wasPlayingRef.current;
    wasPlayingRef.current = playerStatus.playing;
    const audioFinished = wasPlaying && !playerStatus.playing
      && playerStatus.duration > 0
      && playerStatus.currentTime >= playerStatus.duration - 0.5;
    if (audioFinished && playingRef.current) advance();
  }, [playerStatus.playing]);

  function stopAll() { Speech.stop(); player.pause(); if (timerRef.current) clearTimeout(timerRef.current); }

  function togglePlay() {
    if (finished) { setFinished(false); setIndex(0); setPlaying(true); return; }
    if (playing) stopAll();
    setPlaying(p => !p);
  }

  function handleClose() { stopAll(); onClose(); }

  return (
    <Modal visible animationType="slide" onRequestClose={handleClose}>
      {viewingSlides ? (
        <ManualSlideshowContent tutorial={tutorial} onClose={handleClose} />
      ) : (
        <SafeAreaView style={s.playContainer}>
          <View style={s.playImageWrap}>
            {currentFrame?.image_url
              ? <Image source={{ uri: currentFrame.image_url }} style={s.playImage} resizeMode="contain" />
              : (
                <View style={[s.playImage, s.playImagePlaceholder]}>
                  <AppText style={{ fontSize: scale(64) }}>📖</AppText>
                </View>
              )
            }
            <View style={s.playTitleBar}>
              <AppText style={s.playTitle} numberOfLines={1}>{tutorial.display_name || tutorial.category}</AppText>
              <TouchableOpacity onPress={handleClose} style={s.playClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <AppText style={s.playCloseText}>✕</AppText>
              </TouchableOpacity>
            </View>
          </View>

          <View style={s.playText}>
            {currentFrame?.caption && <AppText style={s.slideshowCaption}>{currentFrame.caption}</AppText>}
            {currentFrame?.tts_text && <AppText style={s.slideshowNarration}>{currentFrame.tts_text}</AppText>}
            {speaking && <AppText style={s.speakingIndicator}>📢 Reading aloud…</AppText>}
            {finished && <AppText style={s.finishedText}>🎉 All done!</AppText>}
          </View>

          <TouchableOpacity style={s.playBtn} onPress={togglePlay} activeOpacity={0.85}>
            <AppText style={s.playBtnText}>
              {finished ? '🔁  Watch Again' : playing ? '⏸  Pause' : '▶  Play'}
            </AppText>
          </TouchableOpacity>

          <TouchableOpacity
            style={s.slidesLink}
            onPress={() => { stopAll(); setViewingSlides(true); }}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <AppText style={s.slidesLinkText}>📚  View as slides</AppText>
          </TouchableOpacity>
        </SafeAreaView>
      )}
    </Modal>
  );
}

// ── Manual slideshow content: read at your own pace, Previous/Next only, no auto-advance ──
// Rendered inline inside PlaybackModal's single Modal (not its own Modal) so switching
// modes doesn't dismiss+re-present a native modal, which caused a flash of the screen behind it.
function ManualSlideshowContent({ tutorial, onClose }: { tutorial: TutorialWithFrames; onClose: () => void }) {
  const frames = tutorial.frames;
  const [index, setIndex] = useState(0);
  const [speaking, setSpeaking] = useState(false);

  const currentFrame = frames[index];
  const isLast = index === frames.length - 1;

  const player = useAudioPlayer(currentFrame?.audio_url ? { uri: currentFrame.audio_url } : null);

  function stopAll() { Speech.stop(); player.pause(); }

  // Narrate the current frame — only when the learner taps the speaker icon, never automatically
  function speakCurrentFrame() {
    stopAll();
    setSpeaking(false);
    if (currentFrame?.audio_url) {
      player.seekTo(0);
      player.play();
    } else if (currentFrame?.tts_text) {
      setSpeaking(true);
      Speech.speak(currentFrame.tts_text, {
        rate: 0.65, pitch: 1.0,
        onDone: () => setSpeaking(false),
        onStopped: () => setSpeaking(false),
      });
    }
  }

  function goNext() { stopAll(); setIndex(i => Math.min(frames.length - 1, i + 1)); }
  function goPrev() { stopAll(); setIndex(i => Math.max(0, i - 1)); }
  function handleClose() { stopAll(); onClose(); }

  return (
    <SafeAreaView style={s.slideshowContainer}>
      {/* Header */}
      <View style={s.slideshowHeader}>
        <AppText style={s.slideshowCounter}>{index + 1} / {frames.length}</AppText>
        <TouchableOpacity onPress={handleClose} style={s.slideshowClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <AppText style={s.slideshowCloseText}>✕</AppText>
        </TouchableOpacity>
      </View>
      <AppText style={s.slideshowTitle} numberOfLines={1}>{tutorial.display_name || tutorial.category}</AppText>

      {/* Frame image */}
      <View style={s.slideshowImageWrap}>
        {currentFrame?.image_url
          ? <Image source={{ uri: currentFrame.image_url }} style={s.slideshowImage} resizeMode="contain" />
          : (
            <View style={[s.slideshowImage, s.slideshowImagePlaceholder]}>
              <AppText style={{ fontSize: scale(64) }}>📖</AppText>
            </View>
          )
        }
      </View>

      {/* Text */}
      <View style={s.slideshowText}>
        {currentFrame?.caption && <AppText style={s.slideshowCaption}>{currentFrame.caption}</AppText>}
        {currentFrame?.tts_text && <AppText style={s.slideshowNarration}>{currentFrame.tts_text}</AppText>}
        {speaking && <AppText style={s.speakingIndicator}>📢 Reading aloud…</AppText>}
      </View>

      {/* Navigation */}
      <View style={s.slideshowNav}>
        <TouchableOpacity
          style={[s.navBtn, index === 0 && s.navBtnHidden]}
          onPress={goPrev}
          disabled={index === 0}
        >
          <AppText style={s.navBtnText}>← Previous</AppText>
        </TouchableOpacity>

        <View style={s.dotsCol}>
          <View style={s.dots}>
            {frames.map((_, i) => (
              <View key={i} style={[s.dot, i === index && s.dotActive]} />
            ))}
          </View>
          <TouchableOpacity
            style={s.frameSpeakBtn}
            onPress={speakCurrentFrame}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <AppText style={s.frameSpeakIcon}>🔊</AppText>
          </TouchableOpacity>
        </View>

        {!isLast ? (
          <TouchableOpacity style={s.navBtn} onPress={goNext}>
            <AppText style={s.navBtnText}>Next →</AppText>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={[s.navBtn, s.navBtnDone]} onPress={handleClose}>
            <AppText style={[s.navBtnText, { color: '#fff' }]}>Done ✓</AppText>
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
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

  // Video modal
  modalContainer: { flex: 1, backgroundColor: NICO.screenBg },
  closeBtn: { padding: SPACING.base, paddingTop: 50 },
  closeBtnText: { color: NICO.text, fontSize: FONT_SIZE.md, fontWeight: FONT_WEIGHT.bold },
  video: { width, height: width * 0.5625 },
  videoInfo: { padding: SPACING.xl },
  videoTitle: { fontSize: FONT_SIZE.xl, fontWeight: FONT_WEIGHT.bold, color: NICO.text, marginBottom: SPACING.sm },
  videoDesc: { fontSize: FONT_SIZE.md, color: NICO.textMuted, lineHeight: 22 },

  // Primary playback screen (auto-play, Play/Pause only)
  playContainer: { flex: 1, backgroundColor: NICO.screenBg },
  playImageWrap: { flex: 1, margin: SPACING.lg, borderRadius: RADIUS.xl, overflow: 'hidden' },
  playImage: { width: '100%', height: '100%' },
  playImagePlaceholder: { justifyContent: 'center', alignItems: 'center' },
  // Title bar overlays the top of the image directly — no separate header row, so no gap
  playTitleBar: {
    position: 'absolute', top: 0, left: 0, right: 0,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  playTitle: { flex: 1, fontSize: FONT_SIZE.xl, fontWeight: FONT_WEIGHT.black, color: '#fff', marginRight: SPACING.sm },
  playClose: { padding: SPACING.xs },
  playCloseText: { fontSize: FONT_SIZE['2xl'], fontWeight: FONT_WEIGHT.black, color: '#fff' },
  playText: { paddingHorizontal: SPACING.xl, paddingTop: SPACING.lg, gap: SPACING.sm },
  finishedText: { fontSize: FONT_SIZE.xl, fontWeight: FONT_WEIGHT.extraBold, color: NICO.success, marginTop: SPACING.xs },
  playBtn: { marginTop: SPACING.lg, ...BTN_SIZE.lg, ...BTN_VARIANT.primary },
  playBtnText: { ...TEXT_STYLE.buttonPrimary },
  slidesLink: {
    alignSelf: 'center', marginTop: SPACING.md, marginBottom: SPACING.lg,
    backgroundColor: NICO.background, borderRadius: RADIUS.full,
    paddingVertical: SPACING.sm, paddingHorizontal: SPACING.lg,
  },
  slidesLinkText: { fontSize: FONT_SIZE.sm, color: NICO.text, fontWeight: FONT_WEIGHT.bold },

  // Slideshow modal
  slideshowContainer: { flex: 1, backgroundColor: NICO.screenBg },
  slideshowHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: SPACING.lg, paddingTop: SPACING.sm, paddingBottom: SPACING.xs },
  slideshowCounter: { fontSize: FONT_SIZE.sm, fontWeight: FONT_WEIGHT.semiBold, color: NICO.textMuted },
  slideshowClose: { padding: SPACING.xs },
  slideshowCloseText: { fontSize: FONT_SIZE['3xl'], fontWeight: FONT_WEIGHT.black, color: NICO.text },
  slideshowTitle: { fontSize: FONT_SIZE.lg, fontWeight: FONT_WEIGHT.extraBold, color: NICO.text, paddingHorizontal: SPACING.lg, marginBottom: SPACING.md },
  slideshowImageWrap: { marginHorizontal: SPACING.lg, borderRadius: RADIUS.xl, overflow: 'hidden', aspectRatio: 1, backgroundColor: NICO.background },
  slideshowImage: { width: '100%', height: '100%' },
  slideshowImagePlaceholder: { backgroundColor: NICO.background, justifyContent: 'center', alignItems: 'center' },
  frameSpeakBtn: {
    width: scale(34), height: scale(34), borderRadius: scale(17),
    backgroundColor: NICO.background,
    justifyContent: 'center', alignItems: 'center',
  },
  frameSpeakIcon: { fontSize: scale(14.7) },
  slideshowText: { paddingHorizontal: SPACING.lg, paddingTop: SPACING.base, gap: SPACING.sm },
  slideshowCaption: { fontSize: FONT_SIZE['3xl'], fontWeight: FONT_WEIGHT.black, color: NICO.text },
  slideshowNarration: { fontSize: FONT_SIZE.xl, fontWeight: FONT_WEIGHT.bold, color: NICO.text, lineHeight: 28 },
  speakingIndicator: { fontSize: FONT_SIZE.sm, color: NICO.primary, marginTop: SPACING.xs },
  slideshowNav: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg, paddingBottom: SPACING.xl, paddingTop: SPACING.sm,
  },
  navBtn: { backgroundColor: NICO.background, borderRadius: RADIUS.lg, paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md },
  navBtnHidden: { opacity: 0 },
  navBtnDone: { backgroundColor: NICO.primary },
  navBtnText: { fontWeight: FONT_WEIGHT.bold, color: NICO.text, fontSize: FONT_SIZE.sm },
  dotsCol: { alignItems: 'center', gap: SPACING.md },
  dots: { flexDirection: 'row', gap: SPACING.xs },
  dot: { width: scale(8), height: scale(8), borderRadius: scale(4), backgroundColor: NICO.border },
  dotActive: { backgroundColor: NICO.primary, width: scale(20) },
});
