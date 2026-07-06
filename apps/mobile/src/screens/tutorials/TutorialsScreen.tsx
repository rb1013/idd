import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  Image, ActivityIndicator, Modal, Dimensions, SafeAreaView,
} from 'react-native';
import * as Speech from 'expo-speech';
import { useFocusEffect } from '@react-navigation/native';
import { VideoView, useVideoPlayer } from 'expo-video';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/AuthContext';
import { COLORS } from '../../constants';
import type { Tutorial, TutorialFrame } from '../../types';

const { width } = Dimensions.get('window');

const FORMAT_EMOJI: Record<string, string> = { video: '🎬', slideshow: '🖼', cards: '🃏' };

interface TutorialWithFrames extends Tutorial {
  frames: TutorialFrame[];
}

export default function TutorialsScreen() {
  const { activeUser } = useAuth();
  const [tutorials, setTutorials] = useState<TutorialWithFrames[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [categories, setCategories] = useState<string[]>([]);
  const [playing, setPlaying] = useState<TutorialWithFrames | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (activeUser) fetchTutorials(activeUser.id);
    }, [activeUser]),
  );

  async function fetchTutorials(userId: string) {
    // Fetch tutorials linked to this specific user via user_tutorials
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

  const filtered = selectedCategory && selectedCategory !== 'All'
    ? tutorials.filter(t => t.category === selectedCategory)
    : tutorials;

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color={COLORS.primary} /></View>;

  return (
    <View style={styles.container}>
      {/* Category filter */}
      <FlatList
        horizontal
        data={categories}
        keyExtractor={c => c}
        style={styles.categoryBar}
        contentContainerStyle={styles.categoryBarContent}
        showsHorizontalScrollIndicator={false}
        renderItem={({ item }) => {
          const active = (!selectedCategory && item === 'All') || selectedCategory === item;
          return (
            <TouchableOpacity
              style={[styles.categoryChip, active && styles.categoryChipActive]}
              onPress={() => setSelectedCategory(item === 'All' ? null : item)}
            >
              <Text style={[styles.categoryChipText, active && styles.categoryChipTextActive]}>{item}</Text>
            </TouchableOpacity>
          );
        }}
      />

      <FlatList
        data={filtered}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.list}
        numColumns={2}
        columnWrapperStyle={styles.row}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.card} onPress={() => setPlaying(item)} activeOpacity={0.85}>
            {item.thumbnail_url
              ? <Image source={{ uri: item.thumbnail_url }} style={styles.thumbnail} />
              : (
                <View style={[styles.thumbnail, styles.thumbnailPlaceholder]}>
                  <Text style={styles.formatEmoji}>{FORMAT_EMOJI[item.format] ?? '📚'}</Text>
                </View>
              )
            }
            <View style={styles.cardBody}>
              <Text style={styles.cardTitle} numberOfLines={2}>{item.title}</Text>
              <View style={styles.cardMeta}>
                <Text style={styles.cardCategory}>{item.category}</Text>
                {item.duration_seconds && <Text style={styles.cardDuration}>{item.duration_seconds}s</Text>}
              </View>
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyEmoji}>📚</Text>
            <Text style={styles.emptyText}>No tutorials yet</Text>
            <Text style={styles.emptyHint}>Ask your carer to add learning videos for you</Text>
          </View>
        }
      />

      {playing && (
        playing.format === 'video'
          ? <VideoModal tutorial={playing} onClose={() => setPlaying(null)} />
          : <SlideshowModal tutorial={playing} onClose={() => setPlaying(null)} />
      )}
    </View>
  );
}

function VideoModal({ tutorial, onClose }: { tutorial: TutorialWithFrames; onClose: () => void }) {
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
  const [index, setIndex] = useState(0);
  const [speaking, setSpeaking] = useState(false);

  const currentFrame = frames[index];

  useEffect(() => {
    speakFrame(currentFrame);
  }, [index]);

  function speakFrame(frame: TutorialFrame | undefined) {
    if (!frame?.tts_text) return;
    setSpeaking(true);
    Speech.speak(frame.tts_text, {
      rate: 0.8,
      pitch: 1.0,
      onDone: () => setSpeaking(false),
      onStopped: () => setSpeaking(false),
    });
  }

  function goNext() {
    Speech.stop();
    setIndex(i => Math.min(frames.length - 1, i + 1));
  }

  function goPrev() {
    Speech.stop();
    setIndex(i => Math.max(0, i - 1));
  }

  return (
    <Modal visible animationType="slide" onRequestClose={() => { Speech.stop(); onClose(); }}>
      <SafeAreaView style={styles.slideshowContainer}>
        {/* Header */}
        <View style={styles.slideshowHeader}>
          <Text style={styles.slideshowCounter}>{index + 1} / {frames.length}</Text>
          <TouchableOpacity onPress={() => { Speech.stop(); onClose(); }} style={styles.slideshowClose}>
            <Text style={styles.slideshowCloseText}>✕</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.slideshowTitle} numberOfLines={1}>{tutorial.title}</Text>

        {/* Frame image */}
        <View style={styles.slideshowImageWrap}>
          {currentFrame?.image_url
            ? <Image source={{ uri: currentFrame.image_url }} style={styles.slideshowImage} resizeMode="cover" />
            : (
              <View style={[styles.slideshowImage, styles.slideshowImagePlaceholder]}>
                <Text style={{ fontSize: 64 }}>📖</Text>
              </View>
            )
          }
        </View>

        {/* Text */}
        <View style={styles.slideshowText}>
          {currentFrame?.caption && (
            <Text style={styles.slideshowCaption}>{currentFrame.caption}</Text>
          )}
          {currentFrame?.tts_text && (
            <Text style={styles.slideshowNarration}>{currentFrame.tts_text}</Text>
          )}
          {speaking && <Text style={styles.speakingIndicator}>📢 Reading aloud…</Text>}
        </View>

        {/* Navigation */}
        <View style={styles.slideshowNav}>
          <TouchableOpacity
            style={[styles.navBtn, index === 0 && styles.navBtnHidden]}
            onPress={goPrev}
            disabled={index === 0}
          >
            <Text style={styles.navBtnText}>← Previous</Text>
          </TouchableOpacity>

          {/* Dot indicators */}
          <View style={styles.dots}>
            {frames.map((_, i) => (
              <View key={i} style={[styles.dot, i === index && styles.dotActive]} />
            ))}
          </View>

          {index < frames.length - 1 ? (
            <TouchableOpacity style={styles.navBtn} onPress={goNext}>
              <Text style={styles.navBtnText}>Next →</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={[styles.navBtn, styles.navBtnDone]} onPress={() => { Speech.stop(); onClose(); }}>
              <Text style={[styles.navBtnText, { color: '#fff' }]}>Done ✓</Text>
            </TouchableOpacity>
          )}
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  categoryBar: { maxHeight: 56 },
  categoryBarContent: { paddingHorizontal: 16, paddingVertical: 10, gap: 8 },
  categoryChip: {
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20,
    backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border,
  },
  categoryChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  categoryChipText: { fontSize: 13, color: COLORS.textLight },
  categoryChipTextActive: { color: '#fff', fontWeight: '600' },
  list: { padding: 12, paddingBottom: 32 },
  row: { gap: 12 },
  card: {
    flex: 1, backgroundColor: COLORS.surface, borderRadius: 16,
    borderWidth: 1, borderColor: COLORS.border, overflow: 'hidden', marginBottom: 12,
  },
  thumbnail: { width: '100%', height: 110 },
  thumbnailPlaceholder: { backgroundColor: COLORS.primaryLight, justifyContent: 'center', alignItems: 'center' },
  formatEmoji: { fontSize: 36 },
  cardBody: { padding: 10 },
  cardTitle: { fontSize: 14, fontWeight: '600', color: COLORS.text, marginBottom: 4 },
  cardMeta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardCategory: { fontSize: 12, color: COLORS.secondary },
  cardDuration: { fontSize: 11, color: COLORS.textLight },

  emptyContainer: { alignItems: 'center', paddingTop: 60, gap: 10 },
  emptyEmoji: { fontSize: 56 },
  emptyText: { fontSize: 20, fontWeight: '700', color: COLORS.text },
  emptyHint: { fontSize: 14, color: COLORS.textLight, textAlign: 'center', paddingHorizontal: 32 },

  // Video modal (unchanged)
  modalContainer: { flex: 1, backgroundColor: '#000' },
  closeBtn: { padding: 16, paddingTop: 50 },
  closeBtnText: { color: '#fff', fontSize: 16 },
  video: { width, height: width * 0.5625 },
  videoInfo: { padding: 24 },
  videoTitle: { fontSize: 20, fontWeight: '700', color: '#fff', marginBottom: 8 },
  videoDesc: { fontSize: 15, color: '#aaa', lineHeight: 22 },

  // Slideshow modal
  slideshowContainer: { flex: 1, backgroundColor: COLORS.background },
  slideshowHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 12, paddingBottom: 4 },
  slideshowCounter: { fontSize: 14, fontWeight: '600', color: COLORS.textLight },
  slideshowClose: { padding: 4 },
  slideshowCloseText: { fontSize: 22, color: COLORS.textLight },
  slideshowTitle: { fontSize: 18, fontWeight: '800', color: COLORS.text, paddingHorizontal: 20, marginBottom: 12 },
  slideshowImageWrap: { marginHorizontal: 20, borderRadius: 20, overflow: 'hidden', aspectRatio: 16 / 9 },
  slideshowImage: { width: '100%', height: '100%' },
  slideshowImagePlaceholder: { backgroundColor: COLORS.primaryLight, justifyContent: 'center', alignItems: 'center' },
  slideshowText: { flex: 1, paddingHorizontal: 20, paddingTop: 16, gap: 8 },
  slideshowCaption: { fontSize: 26, fontWeight: '900', color: COLORS.text },
  slideshowNarration: { fontSize: 17, color: COLORS.textLight, lineHeight: 26 },
  speakingIndicator: { fontSize: 13, color: COLORS.primary, marginTop: 4 },
  slideshowNav: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingBottom: 24, paddingTop: 12,
  },
  navBtn: { backgroundColor: COLORS.primaryLight, borderRadius: 14, paddingHorizontal: 20, paddingVertical: 12 },
  navBtnHidden: { opacity: 0 },
  navBtnDone: { backgroundColor: COLORS.primary },
  navBtnText: { fontWeight: '700', color: COLORS.primary, fontSize: 15 },
  dots: { flexDirection: 'row', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.border },
  dotActive: { backgroundColor: COLORS.primary, width: 20 },
});
