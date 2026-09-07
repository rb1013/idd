import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Image, ActivityIndicator, Modal, Dimensions, SafeAreaView, Platform,
} from 'react-native';
import * as Speech from 'expo-speech';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { VideoView, useVideoPlayer } from 'expo-video';
import YoutubePlayer from '../../components/YoutubePlayer';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/AuthContext';
import { COLORS, USER_HEADER, USER_TILE_CYCLE } from '../../constants';
import type { Tutorial, TutorialFrame } from '../../types';

const { width } = Dimensions.get('window');
const TILE_W = (width - 40 - 12) / 2; // 20px padding each side, 12px gap

const FORMAT_EMOJI: Record<string, string> = { video: '🎬', slideshow: '🖼' };

const CATEGORY_META: Record<string, { emoji: string; color: string }> = {
  'Math':      { emoji: '🔢', color: COLORS.primary },
  'Reading':   { emoji: '📖', color: COLORS.secondary },
  'Science':   { emoji: '🔬', color: '#1ABC9C' },
  'Life Skills': { emoji: '🏠', color: '#F5A623' },
  'Social':    { emoji: '🤝', color: '#9B59B6' },
  'Health':    { emoji: '🍎', color: COLORS.error },
  'Art':       { emoji: '🎨', color: '#E67E22' },
  'Music':     { emoji: '🎵', color: '#8E44AD' },
  'Sport':     { emoji: '⚽', color: '#27AE60' },
  'Cooking':   { emoji: '🍳', color: '#D35400' },
  'Safety':    { emoji: '⛑️', color: '#C0392B' },
};
const CAT_COLORS = [COLORS.primary, COLORS.secondary, '#F5A623', '#9B59B6', COLORS.error, '#1ABC9C', '#E67E22'];
function categoryColor(name: string): string {
  return CATEGORY_META[name]?.color ?? CAT_COLORS[Math.abs([...name].reduce((h, c) => c.charCodeAt(0) + ((h << 5) - h), 0)) % CAT_COLORS.length];
}
function categoryEmoji(name: string): string { return CATEGORY_META[name]?.emoji ?? '📚'; }

interface TutorialWithFrames extends Tutorial {
  frames: TutorialFrame[];
  is_featured?: boolean;
}

const NO_TUTORIALS_MSG = "No tutorials yet! Ask your Guardian to add learning videos for you!";

function NoTutorialsState() {
  const spokenRef = useRef(false);
  useFocusEffect(useCallback(() => {
    if (!spokenRef.current) {
      spokenRef.current = true;
      const t = setTimeout(() => Speech.speak(NO_TUTORIALS_MSG, { rate: 0.8, pitch: 1.1 }), 600);
      return () => { clearTimeout(t); Speech.stop(); };
    }
    return () => { Speech.stop(); };
  }, []));

  return (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyEmoji}>📚</Text>
      <Text style={styles.emptyText}>No tutorials yet!</Text>
      <Text style={styles.emptyHint}>Ask your Guardian to add learning videos for you</Text>
      <TouchableOpacity
        style={styles.emptySpeakBtn}
        onPress={() => Speech.speak(NO_TUTORIALS_MSG, { rate: 0.8, pitch: 1.1 })}
        activeOpacity={0.75}
      >
        <Text style={styles.emptySpeakBtnText}>🔊  Hear this again</Text>
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

  useLayoutEffect(() => {
    navigation.setOptions({
      headerStyle:      { backgroundColor: USER_HEADER.backgroundColor },
      headerTintColor:  USER_HEADER.tintColor,
      headerTitleStyle: { color: USER_HEADER.tintColor, fontWeight: '900' as const, fontSize: 18 },
    });
  }, [navigation]);

  useFocusEffect(
    useCallback(() => {
      if (activeUser) fetchTutorials(activeUser.id);
    }, [activeUser]),
  );

  async function fetchTutorials(userId: string) {
    const { data: links } = await supabase
      .from('user_tutorials')
      .select('tutorial_id, is_featured')
      .eq('user_id', userId);

    if (!links || links.length === 0) {
      setTutorials([]);
      setCategories(['All']);
      setLoading(false);
      return;
    }

    const featuredIds = new Set(links.filter((l: any) => l.is_featured).map((l: any) => l.tutorial_id));
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
      is_featured: featuredIds.has(t.id),
    }));

    setTutorials(items);
    const cats = [...new Set(items.map(t => t.category))];
    setCategories(['All', ...cats]);
    setLoading(false);
  }

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color={COLORS.primary} /></View>;

  const featuredItems = tutorials.filter(t => t.is_featured);
  const regularItems = tutorials.filter(t => !t.is_featured);


  return (
    <View style={styles.container}>
      {/* Category dropdown — commented out, re-enable when needed
      <View style={styles.filterBar}>
        <TouchableOpacity style={styles.filterBtn} onPress={() => setCategoryOpen(true)} activeOpacity={0.75}>
          <Text style={styles.filterBtnText}>{activeLabel}</Text>
          <Text style={styles.filterBtnArrow}>▾</Text>
        </TouchableOpacity>
      </View>
      <Modal visible={categoryOpen} transparent animationType="slide" onRequestClose={() => setCategoryOpen(false)}>
        <TouchableOpacity style={styles.sheetOverlay} activeOpacity={1} onPress={() => setCategoryOpen(false)}>
          <SafeAreaView style={styles.sheet}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Filter by Category</Text>
              <TouchableOpacity onPress={() => setCategoryOpen(false)}>
                <Text style={styles.sheetDone}>Done</Text>
              </TouchableOpacity>
            </View>
            <ScrollView>
              {categories.filter(cat => cat !== 'All').map(cat => {
                const isActive = selectedCategory === cat;
                const color = categoryColor(cat);
                return (
                  <TouchableOpacity key={cat} style={[styles.sheetOption, isActive && { backgroundColor: color + '18' }]}
                    onPress={() => { setSelectedCategory(cat); setCategoryOpen(false); }}>
                    <Text style={styles.sheetOptionEmoji}>{categoryEmoji(cat)}</Text>
                    <Text style={[styles.sheetOptionText, isActive && { color, fontWeight: '800' }]}>{cat}</Text>
                    {isActive && <Text style={[styles.sheetCheck, { color }]}>✓</Text>}
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
        <ScrollView contentContainerStyle={styles.list}>
          {/* ⭐ Featured / Favourites section */}
          {featuredItems.length > 0 && !selectedCategory && (
            <View style={styles.featuredSection}>
              <View style={styles.featuredHeader}>
                <Text style={styles.featuredHeaderEmoji}>⭐</Text>
                <View>
                  <Text style={styles.featuredHeaderTitle}>Your Favourites</Text>
                  <Text style={styles.featuredHeaderSub}>Chosen for you by your Guardian</Text>
                </View>
              </View>
              {featuredItems.map(item => (
                <TouchableOpacity
                  key={item.id}
                  style={styles.featuredCard}
                  onPress={() => setPlaying(item)}
                  activeOpacity={0.88}
                >
                  {/* Image */}
                  <View style={styles.featuredImgWrap}>
                    {item.thumbnail_url
                      ? <Image source={{ uri: item.thumbnail_url }} style={styles.featuredImg} resizeMode="cover" />
                      : (
                        <View style={[styles.featuredImg, styles.featuredImgPlaceholder]}>
                          <Text style={{ fontSize: 56 }}>{FORMAT_EMOJI[item.format] ?? '📚'}</Text>
                        </View>
                      )
                    }
                    <View style={styles.featuredBadge}>
                      <Text style={styles.featuredBadgeText}>⭐ Favourite</Text>
                    </View>
                  </View>
                  {/* Text */}
                  <View style={styles.featuredBody}>
                    <Text style={styles.featuredTitle} numberOfLines={2}>{item.display_name || item.category}</Text>
                    <Text style={styles.featuredMeta}>{categoryEmoji(item.category)} {item.category}</Text>
                    <View style={styles.featuredPlayBtn}>
                      <Text style={styles.featuredPlayBtnText}>▶  Start Learning</Text>
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* All tutorials flat grid */}
          {regularItems.length > 0 && (
            <View style={styles.tileGrid}>
              {regularItems.map((item, idx) => {
                const tile = USER_TILE_CYCLE[idx % USER_TILE_CYCLE.length];
                return (
                  <TouchableOpacity
                    key={item.id}
                    style={[styles.tile, { backgroundColor: tile.backgroundColor, borderColor: tile.borderColor }]}
                    onPress={() => setPlaying(item)}
                    activeOpacity={0.85}
                  >
                    {item.thumbnail_url
                      ? <Image source={{ uri: item.thumbnail_url }} style={styles.tileThumb} resizeMode="cover" />
                      : (
                        <View style={[styles.tileThumb, { backgroundColor: tile.borderColor + '40', justifyContent: 'center', alignItems: 'center' }]}>
                          <Text style={{ fontSize: 36 }}>{FORMAT_EMOJI[item.format] ?? '📚'}</Text>
                        </View>
                      )
                    }
                    <View style={styles.tileBody}>
                      <Text style={styles.tileTitleText} numberOfLines={2}>{item.display_name || item.category}</Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </ScrollView>
      )}

      {playing && (
        playing.format === 'video'
          ? <VideoModal tutorial={playing} onClose={() => setPlaying(null)} />
          : <SlideshowModal tutorial={playing} onClose={() => setPlaying(null)} />
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
      <View style={styles.modalContainer}>
        <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
          <Text style={styles.closeBtnText}>✕ Close</Text>
        </TouchableOpacity>
        {videoId && (
          <>
            <YoutubePlayer videoId={videoId} height={Math.round(width * 9 / 16)} />
            <View style={styles.videoInfo}>
              <Text style={styles.videoTitle}>{tutorial.title}</Text>
              <Text style={styles.videoDesc}>{tutorial.description}</Text>
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
      <View style={styles.modalContainer}>
        <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
          <Text style={styles.closeBtnText}>✕ Close</Text>
        </TouchableOpacity>
        {tutorial.video_url && (
          <>
            <VideoView player={player} style={styles.video} nativeControls contentFit="contain" />
            <View style={styles.videoInfo}>
              <Text style={styles.videoTitle}>{tutorial.title}</Text>
              <Text style={styles.videoDesc}>{tutorial.description}</Text>
            </View>
          </>
        )}
      </View>
    </Modal>
  );
}

function SlideshowModal({ tutorial, onClose }: { tutorial: TutorialWithFrames; onClose: () => void }) {
  const frames = tutorial.frames;
  const [started, setStarted] = useState(false);
  const [index, setIndex] = useState(0);
  const [autoPlay, setAutoPlay] = useState(false);
  const [speaking, setSpeaking] = useState(false);

  const autoPlayRef = useRef(false);
  const wasPlayingRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const currentFrame = frames[index];
  const isLast = index === frames.length - 1;

  // Stored audio — prefer over device TTS when available
  const player = useAudioPlayer(currentFrame?.audio_url ? { uri: currentFrame.audio_url } : null);
  const playerStatus = useAudioPlayerStatus(player);

  useEffect(() => { autoPlayRef.current = autoPlay; }, [autoPlay]);

  // On frame change: play stored audio OR device TTS — only after user taps Start
  useEffect(() => {
    if (!started) return;
    Speech.stop();
    setSpeaking(false);
    if (timerRef.current) clearTimeout(timerRef.current);

    if (currentFrame?.audio_url) {
      player.seekTo(0);
      player.play();
    } else if (currentFrame?.tts_text) {
      setSpeaking(true);
      Speech.speak(currentFrame.tts_text, {
        rate: 0.8, pitch: 1.0,
        onDone: () => {
          setSpeaking(false);
          if (autoPlayRef.current && !isLast) setIndex(i => i + 1);
          else if (autoPlayRef.current && isLast) setAutoPlay(false);
        },
        onStopped: () => setSpeaking(false),
      });
    } else if (autoPlayRef.current) {
      timerRef.current = setTimeout(() => {
        if (!isLast) setIndex(i => i + 1); else setAutoPlay(false);
      }, 3000);
    }
  }, [index, started]);

  // Detect stored audio finishing → auto-advance
  useEffect(() => {
    const wasPlaying = wasPlayingRef.current;
    wasPlayingRef.current = playerStatus.playing;
    const finished = wasPlaying && !playerStatus.playing
      && playerStatus.duration > 0
      && playerStatus.currentTime >= playerStatus.duration - 0.5;
    if (finished && autoPlayRef.current) {
      if (!isLast) setIndex(i => i + 1); else setAutoPlay(false);
    }
  }, [playerStatus.playing]);

  function stopAll() { Speech.stop(); player.pause(); if (timerRef.current) clearTimeout(timerRef.current); }

  function goNext() { stopAll(); setIndex(i => Math.min(frames.length - 1, i + 1)); }
  function goPrev() { stopAll(); setAutoPlay(false); setIndex(i => Math.max(0, i - 1)); }
  function handleClose() { stopAll(); setAutoPlay(false); setStarted(false); setIndex(0); onClose(); }

  // ── Start screen ──────────────────────────────────────────────────────────
  if (!started) {
    const firstImage = frames[0]?.image_url ?? tutorial.thumbnail_url;
    return (
      <Modal visible animationType="slide" onRequestClose={handleClose}>
        <SafeAreaView style={styles.startContainer}>
          <TouchableOpacity onPress={handleClose} style={styles.startClose}>
            <Text style={styles.startCloseText}>✕</Text>
          </TouchableOpacity>

          {firstImage
            ? <Image source={{ uri: firstImage }} style={styles.startImage} resizeMode="cover" />
            : (
              <View style={[styles.startImage, styles.startImagePlaceholder]}>
                <Text style={{ fontSize: 80 }}>📖</Text>
              </View>
            )
          }

          <View style={styles.startInfo}>
            <Text style={styles.startTitle}>{tutorial.display_name || tutorial.category}</Text>
            <Text style={styles.startMeta}>{frames.length} slides · {tutorial.category}</Text>
          </View>

          <TouchableOpacity
            style={styles.startBtn}
            onPress={() => { setStarted(true); setAutoPlay(true); }}
            activeOpacity={0.85}
          >
            <Text style={styles.startBtnText}>▶  Start</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.startManualBtn}
            onPress={() => setStarted(true)}
            activeOpacity={0.85}
          >
            <Text style={styles.startManualBtnText}>Browse manually</Text>
          </TouchableOpacity>
        </SafeAreaView>
      </Modal>
    );
  }

  return (
    <Modal visible animationType="slide" onRequestClose={handleClose}>
      <SafeAreaView style={styles.slideshowContainer}>
        {/* Header */}
        <View style={styles.slideshowHeader}>
          <Text style={styles.slideshowCounter}>{index + 1} / {frames.length}</Text>
          <TouchableOpacity onPress={handleClose} style={styles.slideshowClose}>
            <Text style={styles.slideshowCloseText}>✕</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.slideshowTitle} numberOfLines={1}>{tutorial.display_name || tutorial.category}</Text>

        {/* Frame image */}
        <View style={styles.slideshowImageWrap}>
          {currentFrame?.image_url
            ? <Image source={{ uri: currentFrame.image_url }} style={styles.slideshowImage} resizeMode="contain" />
            : (
              <View style={[styles.slideshowImage, styles.slideshowImagePlaceholder]}>
                <Text style={{ fontSize: 64 }}>📖</Text>
              </View>
            )
          }
        </View>

        {/* Text */}
        <View style={styles.slideshowText}>
          {currentFrame?.caption && <Text style={styles.slideshowCaption}>{currentFrame.caption}</Text>}
          {currentFrame?.tts_text && <Text style={styles.slideshowNarration}>{currentFrame.tts_text}</Text>}
          {speaking && <Text style={styles.speakingIndicator}>📢 Reading aloud…</Text>}
        </View>

        {/* Auto-play toggle */}
        <TouchableOpacity
          style={[styles.autoPlayBtn, autoPlay && styles.autoPlayBtnActive]}
          onPress={() => {
            if (!autoPlay) { setIndex(0); setAutoPlay(true); }
            else setAutoPlay(false);
          }}
        >
          <Text style={[styles.autoPlayBtnText, autoPlay && { color: '#fff' }]}>
            {autoPlay ? '⏸  Pause Auto Play' : '▶  Auto Play'}
          </Text>
        </TouchableOpacity>

        {/* Navigation */}
        <View style={styles.slideshowNav}>
          <TouchableOpacity
            style={[styles.navBtn, index === 0 && styles.navBtnHidden]}
            onPress={goPrev}
            disabled={index === 0}
          >
            <Text style={styles.navBtnText}>← Previous</Text>
          </TouchableOpacity>

          <View style={styles.dots}>
            {frames.map((_, i) => (
              <View key={i} style={[styles.dot, i === index && styles.dotActive]} />
            ))}
          </View>

          {!isLast ? (
            <TouchableOpacity style={styles.navBtn} onPress={goNext}>
              <Text style={styles.navBtnText}>Next →</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={[styles.navBtn, styles.navBtnDone]} onPress={handleClose}>
              <Text style={[styles.navBtnText, { color: '#fff' }]}>Done ✓</Text>
            </TouchableOpacity>
          )}
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: USER_HEADER.pageBackground },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  filterBar: {
    paddingHorizontal: 20, paddingVertical: 12,
    alignItems: 'flex-end',
  },
  filterBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: COLORS.surface,
    borderWidth: 1.5, borderColor: COLORS.border,
    borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8,
  },
  filterBtnText: { fontSize: 14, fontWeight: '700', color: COLORS.text },
  filterBtnArrow: { fontSize: 12, color: COLORS.textLight },
  sheetOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    maxHeight: '65%',
    paddingBottom: Platform.OS === 'android' ? 16 : 0,
  },
  sheetHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 16,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  sheetTitle: { fontSize: 17, fontWeight: '800', color: COLORS.text },
  sheetDone: { fontSize: 16, color: COLORS.primary, fontWeight: '700' },
  sheetOption: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 20, paddingVertical: 15,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  sheetOptionEmoji: { fontSize: 20 },
  sheetOptionText: { flex: 1, fontSize: 16, color: COLORS.text, fontWeight: '600' },
  sheetCheck: { fontSize: 18, fontWeight: '800' },
  list: { padding: 20, paddingBottom: 48, gap: 28 },

  // Featured / Favourites section
  featuredSection: { gap: 14 },
  featuredHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 2 },
  featuredHeaderEmoji: { fontSize: 32 },
  featuredHeaderTitle: { fontSize: 22, fontWeight: '900', color: COLORS.text },
  featuredHeaderSub: { fontSize: 13, color: COLORS.textLight, fontWeight: '500', marginTop: 1 },
  featuredCard: {
    borderRadius: 24, overflow: 'hidden',
    backgroundColor: '#FFFBEB',
    borderWidth: 2.5, borderColor: COLORS.statusAmber,
    shadowColor: COLORS.statusAmber, shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.28, shadowRadius: 16, elevation: 7,
  },
  featuredImgWrap: { position: 'relative' },
  featuredImg: { width: '100%', aspectRatio: 1 },
  featuredImgPlaceholder: { backgroundColor: COLORS.statusAmberLight, justifyContent: 'center', alignItems: 'center' },
  featuredBadge: {
    position: 'absolute', top: 14, left: 14,
    backgroundColor: COLORS.statusAmber, borderRadius: 20,
    paddingHorizontal: 12, paddingVertical: 5,
    shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 6, elevation: 3,
  },
  featuredBadgeText: { fontSize: 13, fontWeight: '800', color: '#fff' },
  featuredBody: { padding: 18, gap: 6 },
  featuredTitle: { fontSize: 22, fontWeight: '700', color: '#1A1A2E', lineHeight: 28 },
  featuredMeta: { fontSize: 14, color: COLORS.statusAmberDark, fontWeight: '600' },
  featuredPlayBtn: {
    marginTop: 10, backgroundColor: COLORS.statusDeepPurple, borderRadius: 16,
    paddingVertical: 14, alignItems: 'center',
    shadowColor: COLORS.statusDeepPurple, shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45, shadowRadius: 14, elevation: 6,
  },
  featuredPlayBtnText: { color: '#fff', fontWeight: '900', fontSize: 17, letterSpacing: 0.3 },

  section: { gap: 14 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  sectionEmoji: { fontSize: 26 },
  sectionTitle: { fontSize: 22, fontWeight: '900', color: COLORS.text },

  tileGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  tile: {
    width: TILE_W, borderRadius: 20, overflow: 'hidden', borderWidth: 2,
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.07, shadowRadius: 10, elevation: 3,
  },
  tileThumb: { width: '100%', aspectRatio: 1 },
  tileBody: { padding: 10, gap: 4 },
  tileTitleText: { fontSize: 14, fontWeight: '600', color: COLORS.text, lineHeight: 20 },
  tileFormat: { fontSize: 12, fontWeight: '600', textTransform: 'capitalize' as const },

  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80, gap: 12, backgroundColor: USER_HEADER.pageBackground },
  emptyEmoji: { fontSize: 72 },
  emptyText: { fontSize: 24, fontWeight: '900', color: COLORS.text },
  emptyHint: { fontSize: 16, color: COLORS.textLight, textAlign: 'center', paddingHorizontal: 32 },
  emptySpeakBtn: {
    marginTop: 8, paddingHorizontal: 24, paddingVertical: 12,
    borderRadius: 20, backgroundColor: '#FDEADB',
    borderWidth: 1.5, borderColor: '#D4A888',
  },
  emptySpeakBtnText: { fontSize: 15, fontWeight: '700', color: USER_HEADER.backgroundColor },

  // Video modal (unchanged)
  modalContainer: { flex: 1, backgroundColor: '#000' },
  closeBtn: { padding: 16, paddingTop: 50 },
  closeBtnText: { color: '#fff', fontSize: 16 },
  video: { width, height: width * 0.5625 },
  videoInfo: { padding: 24 },
  videoTitle: { fontSize: 20, fontWeight: '700', color: '#fff', marginBottom: 8 },
  videoDesc: { fontSize: 15, color: '#aaa', lineHeight: 22 },

  // Start screen
  startContainer: { flex: 1, backgroundColor: '#0F0F1A', alignItems: 'center' },
  startClose: { alignSelf: 'flex-end', padding: 20, paddingTop: 16 },
  startCloseText: { fontSize: 22, color: 'rgba(255,255,255,0.6)' },
  startImage: { width: '100%', flex: 1, maxHeight: 340 },
  startImagePlaceholder: { backgroundColor: '#1E1E3A', justifyContent: 'center', alignItems: 'center' },
  startInfo: { paddingHorizontal: 28, paddingTop: 24, alignSelf: 'stretch', gap: 6 },
  startTitle: { fontSize: 24, fontWeight: '900', color: '#fff', lineHeight: 32 },
  startMeta: { fontSize: 14, color: 'rgba(255,255,255,0.5)', fontWeight: '500' },
  startBtn: {
    marginTop: 32, marginHorizontal: 28, alignSelf: 'stretch',
    borderRadius: 20, paddingVertical: 18, alignItems: 'center',
    backgroundColor: COLORS.statusDeepPurple,
    shadowColor: COLORS.statusDeepPurple, shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.55, shadowRadius: 20, elevation: 10,
  },
  startBtnText: { color: '#fff', fontWeight: '900', fontSize: 20, letterSpacing: 0.5 },
  startManualBtn: { marginTop: 14, marginBottom: 24, paddingVertical: 10 },
  startManualBtnText: { color: 'rgba(255,255,255,0.45)', fontSize: 14, fontWeight: '600' },

  // Slideshow modal — dark theme
  slideshowContainer: { flex: 1, backgroundColor: '#0F0F1A' },
  slideshowHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 12, paddingBottom: 4 },
  slideshowCounter: { fontSize: 14, fontWeight: '600', color: 'rgba(255,255,255,0.45)' },
  slideshowClose: { padding: 4 },
  slideshowCloseText: { fontSize: 22, color: 'rgba(255,255,255,0.45)' },
  slideshowTitle: { fontSize: 18, fontWeight: '800', color: '#fff', paddingHorizontal: 20, marginBottom: 12 },
  slideshowImageWrap: { marginHorizontal: 20, borderRadius: 20, overflow: 'hidden', aspectRatio: 1, backgroundColor: '#000' },
  slideshowImage: { width: '100%', height: '100%' },
  slideshowImagePlaceholder: { backgroundColor: '#1E1E3A', justifyContent: 'center', alignItems: 'center' },
  slideshowText: { flex: 1, paddingHorizontal: 20, paddingTop: 16, gap: 8 },
  slideshowCaption: { fontSize: 26, fontWeight: '900', color: '#fff' },
  slideshowNarration: { fontSize: 17, color: 'rgba(255,255,255,0.65)', lineHeight: 26 },
  speakingIndicator: { fontSize: 13, color: '#A78BFA', marginTop: 4 },
  autoPlayBtn: {
    marginHorizontal: 20, marginBottom: 8, borderRadius: 14,
    paddingVertical: 12, alignItems: 'center',
    backgroundColor: 'rgba(124,58,237,0.2)', borderWidth: 1.5, borderColor: COLORS.statusDeepPurple,
  },
  autoPlayBtnActive: { backgroundColor: COLORS.statusDeepPurple },
  autoPlayBtnText: { fontWeight: '700', fontSize: 15, color: '#A78BFA' },
  slideshowNav: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingBottom: 24, paddingTop: 12,
  },
  navBtn: { backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 14, paddingHorizontal: 20, paddingVertical: 12 },
  navBtnHidden: { opacity: 0 },
  navBtnDone: { backgroundColor: COLORS.statusDeepPurple },
  navBtnText: { fontWeight: '700', color: '#fff', fontSize: 15 },
  dots: { flexDirection: 'row', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.2)' },
  dotActive: { backgroundColor: COLORS.statusDeepPurple, width: 20 },
});
