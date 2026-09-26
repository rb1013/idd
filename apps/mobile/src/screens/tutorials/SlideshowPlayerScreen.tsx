import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Image, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import AppText from '../../components/AppText';
import useNicoHeader from '../../hooks/useNicoHeader';
import * as Speech from 'expo-speech';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { RouteProp, useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { supabase } from '../../lib/supabase';
import { UserStackParamList } from '../../navigation';
import type { TutorialWithFrames, TutorialFrame } from '../../types';
import {
  NICO, TEXT_STYLE, SPACING, RADIUS, SHADOW, FONT_SIZE, FONT_WEIGHT,
  BTN_SIZE, BTN_VARIANT, scale,
} from '../../constants/theme';

type Route = RouteProp<UserStackParamList, 'SlideshowPlayer'>;
type Nav   = NativeStackNavigationProp<UserStackParamList>;

export default function SlideshowPlayerScreen() {
  const route = useRoute<Route>();
  const navigation = useNavigation<Nav>();
  const { tutorialId } = route.params;

  useNicoHeader(navigation);

  const [tutorial, setTutorial] = useState<TutorialWithFrames | null>(null);
  const [loading, setLoading] = useState(true);
  const [viewingSlides, setViewingSlides] = useState(false);

  useEffect(() => {
    supabase.from('tutorials').select('*, tutorial_frames(*)').eq('id', tutorialId).single()
      .then(({ data }) => {
        if (data) {
          const t = data as any;
          setTutorial({
            ...t,
            frames: [...(t.tutorial_frames ?? [])].sort((a: TutorialFrame, b: TutorialFrame) => a.order_index - b.order_index),
          });
        }
        setLoading(false);
      });
  }, [tutorialId]);

  // Stop any narration in progress the moment the learner navigates away
  useFocusEffect(useCallback(() => {
    return () => { Speech.stop(); };
  }, []));

  if (loading) {
    return <View style={s.center}><ActivityIndicator size="large" color={NICO.primary} /></View>;
  }
  if (!tutorial) {
    return <View style={s.center}><AppText style={s.errorText}>Tutorial not found</AppText></View>;
  }

  return viewingSlides
    ? <ManualSlideshow tutorial={tutorial} onBack={() => setViewingSlides(false)} />
    : <AutoPlayback tutorial={tutorial} onViewSlides={() => setViewingSlides(true)} />;
}

// ── Auto-play mode: Play/Pause is the only control ──────────────────────────
function AutoPlayback({ tutorial, onViewSlides }: { tutorial: TutorialWithFrames; onViewSlides: () => void }) {
  const frames = tutorial.frames;
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [finished, setFinished] = useState(false);
  const [speaking, setSpeaking] = useState(false);

  const playingRef = useRef(false);
  const wasPlayingRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const currentFrame = frames[index];
  const isLast = index === frames.length - 1;

  const player = useAudioPlayer(currentFrame?.audio_url ? { uri: currentFrame.audio_url } : null);
  const playerStatus = useAudioPlayerStatus(player);

  useEffect(() => { playingRef.current = playing; }, [playing]);

  function advance() {
    if (isLast) { setPlaying(false); setFinished(true); }
    else setIndex(i => i + 1);
  }

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

  return (
    <View style={s.playContainer}>
      <AppText style={s.playTitle} numberOfLines={2}>{tutorial.display_name || tutorial.category}</AppText>

      <View style={s.playImageWrap}>
        {currentFrame?.image_url
          ? <Image source={{ uri: currentFrame.image_url }} style={s.playImage} resizeMode="contain" />
          : (
            <View style={[s.playImage, s.imagePlaceholder]}>
              <AppText style={{ fontSize: scale(64) }}>📖</AppText>
            </View>
          )
        }
      </View>

      <View style={s.playText}>
        {currentFrame?.caption && <AppText style={s.caption}>{currentFrame.caption}</AppText>}
        {currentFrame?.tts_text && <AppText style={s.narration}>{currentFrame.tts_text}</AppText>}
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
        onPress={() => { stopAll(); onViewSlides(); }}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <AppText style={s.slidesLinkText}>📚  View as slides</AppText>
      </TouchableOpacity>
    </View>
  );
}

// ── Manual mode: Previous/Next only, no auto-advance ────────────────────────
function ManualSlideshow({ tutorial, onBack }: { tutorial: TutorialWithFrames; onBack: () => void }) {
  const frames = tutorial.frames;
  const [index, setIndex] = useState(0);
  const [speaking, setSpeaking] = useState(false);

  const currentFrame = frames[index];
  const isLast = index === frames.length - 1;

  const player = useAudioPlayer(currentFrame?.audio_url ? { uri: currentFrame.audio_url } : null);

  function stopAll() { Speech.stop(); player.pause(); }

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
  function handleBack() { stopAll(); onBack(); }

  return (
    <View style={s.slideshowContainer}>
      <View style={s.slideshowTopRow}>
        <TouchableOpacity onPress={handleBack} style={s.backLink} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <AppText style={s.backLinkText}>▶  Back to Play</AppText>
        </TouchableOpacity>
        <AppText style={s.slideshowCounter}>{index + 1} / {frames.length}</AppText>
      </View>

      <View style={s.slideshowImageWrap}>
        {currentFrame?.image_url
          ? <Image source={{ uri: currentFrame.image_url }} style={s.slideshowImage} resizeMode="contain" />
          : (
            <View style={[s.slideshowImage, s.imagePlaceholder]}>
              <AppText style={{ fontSize: scale(64) }}>📖</AppText>
            </View>
          )
        }
      </View>

      <View style={s.slideshowText}>
        {currentFrame?.caption && <AppText style={s.caption}>{currentFrame.caption}</AppText>}
        {currentFrame?.tts_text && <AppText style={s.narration}>{currentFrame.tts_text}</AppText>}
        {speaking && <AppText style={s.speakingIndicator}>📢 Reading aloud…</AppText>}
      </View>

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
          <TouchableOpacity style={[s.navBtn, s.navBtnDone]} onPress={handleBack}>
            <AppText style={[s.navBtnText, { color: '#fff' }]}>Done ✓</AppText>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: NICO.screenBg },
  errorText: { fontSize: FONT_SIZE.md, color: NICO.textMuted },

  imagePlaceholder: { backgroundColor: NICO.background, justifyContent: 'center', alignItems: 'center' },

  // Auto-play mode
  playContainer: { flex: 1, backgroundColor: NICO.screenBg },
  playTitle: {
    fontSize: FONT_SIZE['3xl'], fontWeight: FONT_WEIGHT.black, color: NICO.text,
    paddingHorizontal: SPACING.lg, paddingTop: SPACING.md,
  },
  playImageWrap: { aspectRatio: 1, marginHorizontal: SPACING.lg, marginTop: SPACING.sm, marginBottom: SPACING.sm, borderRadius: RADIUS.xl, overflow: 'hidden' },
  playImage: { width: '100%', height: '100%' },
  playText: { paddingHorizontal: SPACING.xl, paddingTop: SPACING.lg, gap: SPACING.sm },
  finishedText: { fontSize: FONT_SIZE.xl, fontWeight: FONT_WEIGHT.extraBold, color: NICO.success, marginTop: SPACING.xs },
  playBtn: { marginTop: SPACING.lg, marginHorizontal: SPACING.xl, ...BTN_SIZE.lg, ...BTN_VARIANT.primary },
  playBtnText: { ...TEXT_STYLE.buttonPrimary },
  slidesLink: {
    alignSelf: 'center', marginTop: SPACING.md, marginBottom: SPACING.lg,
    backgroundColor: NICO.background, borderRadius: RADIUS.full,
    paddingVertical: SPACING.sm, paddingHorizontal: SPACING.lg,
  },
  slidesLinkText: { fontSize: FONT_SIZE.sm, color: NICO.text, fontWeight: FONT_WEIGHT.bold },

  caption: { fontSize: FONT_SIZE['3xl'], fontWeight: FONT_WEIGHT.black, color: NICO.text },
  narration: { fontSize: FONT_SIZE.xl, fontWeight: FONT_WEIGHT.bold, color: NICO.text, lineHeight: 28 },
  speakingIndicator: { fontSize: FONT_SIZE.sm, color: NICO.primary, marginTop: SPACING.xs },

  // Manual mode
  slideshowContainer: { flex: 1, backgroundColor: NICO.screenBg },
  slideshowTopRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: SPACING.lg, paddingTop: SPACING.md, paddingBottom: SPACING.xs,
  },
  backLink: { padding: SPACING.xs },
  backLinkText: { fontSize: FONT_SIZE.lg, fontWeight: FONT_WEIGHT.extraBold, color: NICO.primary },
  slideshowCounter: { fontSize: FONT_SIZE.lg, fontWeight: FONT_WEIGHT.extraBold, color: NICO.textMuted },
  slideshowImageWrap: { marginHorizontal: SPACING.lg, marginTop: SPACING.md, borderRadius: RADIUS.xl, overflow: 'hidden', aspectRatio: 1, backgroundColor: NICO.background },
  slideshowImage: { width: '100%', height: '100%' },
  slideshowText: { paddingHorizontal: SPACING.lg, paddingTop: SPACING.base, gap: SPACING.sm },
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
  frameSpeakBtn: {
    width: scale(34), height: scale(34), borderRadius: scale(17),
    backgroundColor: NICO.orange,
    justifyContent: 'center', alignItems: 'center',
  },
  frameSpeakIcon: { fontSize: scale(14.7) },
});
