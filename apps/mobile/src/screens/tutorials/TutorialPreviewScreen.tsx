import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, Image, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, Alert, ActivityIndicator, Modal, Dimensions, Animated,
} from 'react-native';
import AppText from '../../components/AppText';
import RainbowDivider from '../../components/RainbowDivider';
import useNicoHeader from '../../hooks/useNicoHeader';
import { useFocusEffect, useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/AuthContext';
import { GuardianNavParamList } from '../../navigation';
import type { TutorialWithFrames, TutorialFrame, TutorialStatus } from '../../types';
import YoutubePlayer from '../../components/YoutubePlayer';
import {
  NICO, TEXT_STYLE, SPACING, RADIUS, SHADOW, FONT_SIZE, FONT_WEIGHT,
  BTN_SIZE, BTN_VARIANT, scale,
} from '../../constants/theme';

const { width } = Dimensions.get('window');

type NavProp = NativeStackNavigationProp<GuardianNavParamList, 'TutorialPreview'>;
type RouteType = RouteProp<GuardianNavParamList, 'TutorialPreview'>;

const STATUS_COLORS: Record<TutorialStatus, { bg: string; text: string }> = {
  generating: { bg: NICO.background, text: NICO.textMuted },
  preview:    { bg: NICO.warningLight, text: NICO.warning },
  pending:    { bg: NICO.primaryLight, text: NICO.primary },
  approved:   { bg: NICO.successLight, text: NICO.success },
  rejected:   { bg: NICO.errorLight,  text: NICO.error },
};
const STATUS_LABELS: Record<TutorialStatus, string> = {
  generating: 'Generating…',
  preview:    'Preview',
  pending:    'Pending Approval',
  approved:   'Approved',
  rejected:   'Rejected by Admin',
};

export default function TutorialPreviewScreen() {
  const navigation = useNavigation<NavProp>();
  const route = useRoute<RouteType>();
  const { tutorialId } = route.params;
  const { guardian } = useAuth();

  const [tutorial, setTutorial] = useState<TutorialWithFrames | null>(null);
  const [loading, setLoading] = useState(true);
  const [frameIndex, setFrameIndex] = useState(0);
  const [viewTab, setViewTab] = useState<'video' | 'slides'>('video');
  const [viewTabsWidth, setViewTabsWidth] = useState(0);
  const viewTabUnderlineX = useRef(new Animated.Value(0)).current;

  useNicoHeader(navigation);

  // Audio — hooks must be called unconditionally so compute URL from state directly
  const currentAudioUrl = tutorial?.frames?.[frameIndex]?.audio_url ?? null;
  const player = useAudioPlayer(currentAudioUrl ? { uri: currentAudioUrl } : null);
  const playerStatus = useAudioPlayerStatus(player);

  const [autoPlay, setAutoPlay] = useState(false);
  const autoPlayRef = useRef(false);
  const wasPlayingRef = useRef(false);
  const autoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { autoPlayRef.current = autoPlay; }, [autoPlay]);

  // In Play All mode, start audio automatically when the frame changes
  useEffect(() => {
    if (!autoPlay || !currentAudioUrl) return;
    player.seekTo(0);
    player.play();
  }, [autoPlay, frameIndex]); // eslint-disable-line react-hooks/exhaustive-deps

  // Detect audio finishing → auto-advance
  useEffect(() => {
    const wasPlaying = wasPlayingRef.current;
    wasPlayingRef.current = playerStatus.playing;
    const finished = wasPlaying && !playerStatus.playing
      && playerStatus.duration > 0
      && playerStatus.currentTime >= playerStatus.duration - 0.5;
    if (finished && autoPlayRef.current) {
      const frames = tutorial?.frames ?? [];
      if (frameIndex < frames.length - 1) setFrameIndex(i => i + 1);
      else setAutoPlay(false);
    }
  }, [playerStatus.playing]);

  // For frames without audio, use a 4s timer when auto-play is on
  useEffect(() => {
    if (!autoPlay || currentAudioUrl) return;
    if (autoTimerRef.current) clearTimeout(autoTimerRef.current);
    const frames = tutorial?.frames ?? [];
    if (frameIndex >= frames.length - 1) { setAutoPlay(false); return; }
    autoTimerRef.current = setTimeout(() => setFrameIndex(i => i + 1), 4000);
    return () => { if (autoTimerRef.current) clearTimeout(autoTimerRef.current); };
  }, [autoPlay, frameIndex, currentAudioUrl]);
  const [editingFrame, setEditingFrame] = useState<TutorialFrame | null>(null);
  const [editCaption, setEditCaption] = useState('');
  const [editTts, setEditTts] = useState('');
  const [editImagePrompt, setEditImagePrompt] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [regeneratingImage, setRegeneratingImage] = useState(false);
  const [regeneratingTutorial, setRegeneratingTutorial] = useState(false);
  const [savingCaption, setSavingCaption] = useState(false);
  const [savingNarration, setSavingNarration] = useState(false);
  const [editingCaption, setEditingCaption] = useState(false);
  const [editingNarration, setEditingNarration] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useFocusEffect(
    useCallback(() => {
      load();
      return () => { if (pollRef.current) clearInterval(pollRef.current); };
    }, [tutorialId]),
  );

  async function load() {
    const { data, error } = await supabase
      .from('tutorials')
      .select('*, tutorial_frames(*)')
      .eq('id', tutorialId)
      .order('order_index', { referencedTable: 'tutorial_frames', ascending: true })
      .single();

    if (error || !data) { setLoading(false); return; }

    const t = data as TutorialWithFrames;
    t.frames = (t as any).tutorial_frames ?? [];
    setTutorial(t);
    setLoading(false);

    // Poll while generating
    if (t.status === 'generating') {
      pollRef.current = setInterval(async () => {
        const { data: fresh } = await supabase
          .from('tutorials')
          .select('*, tutorial_frames(*)')
          .eq('id', tutorialId)
          .order('order_index', { referencedTable: 'tutorial_frames', ascending: true })
          .single();
        if (fresh && fresh.status !== 'generating') {
          const updated = fresh as TutorialWithFrames;
          updated.frames = (updated as any).tutorial_frames ?? [];
          setTutorial(updated);
          if (pollRef.current) clearInterval(pollRef.current);
        }
      }, 4000);
    }
  }

  async function saveCaptionEdit() {
    if (!editingFrame) return;
    setSavingCaption(true);
    try {
      await supabase.from('tutorial_frames').update({ caption: editCaption }).eq('id', editingFrame.id);
      const updated = { ...editingFrame, caption: editCaption };
      setEditingFrame(updated);
      setTutorial(prev => prev ? { ...prev, frames: prev.frames.map(f => f.id === updated.id ? updated : f) } : prev);
      setEditingCaption(false);
    } catch (err: unknown) {
      Alert.alert('Save failed', err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setSavingCaption(false);
    }
  }

  async function saveNarrationEdit() {
    if (!editingFrame) return;
    setSavingNarration(true);
    try {
      const { data, error } = await supabase.functions.invoke('regenerate-frame', {
        body: { frame_id: editingFrame.id, tts_text: editTts },
      });
      if (error || data?.error) {
        let detail = data?.error ?? error?.message ?? 'Something went wrong';
        try {
          const body = await (error as any)?.context?.json?.();
          if (body?.error) detail = body.error;
        } catch {}
        throw new Error(detail);
      }
      const updatedFrame = data.frame as TutorialFrame;
      // Preserve potentially cache-busted image_url — narration save never changes the image
      if (editingFrame.image_url) updatedFrame.image_url = editingFrame.image_url;
      setEditingFrame(updatedFrame);
      setTutorial(prev => prev ? { ...prev, frames: prev.frames.map(f => f.id === updatedFrame.id ? updatedFrame : f) } : prev);
      setEditingNarration(false);
    } catch (err: unknown) {
      Alert.alert('Save failed', err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setSavingNarration(false);
    }
  }

  function regenerateFrameImage() {
    Alert.alert(
      'Regenerate Image',
      'This will replace the current image for this slide. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Regenerate', onPress: doRegenerateFrameImage },
      ],
    );
  }

  async function doRegenerateFrameImage() {
    if (!editingFrame) return;
    const guardianDescription = editImagePrompt.trim()
      || (editCaption
        ? `${tutorial?.topic ?? ''} — ${editCaption}: ${editTts}`
        : `${tutorial?.topic ?? ''}: ${editTts}`);
    const visualStyle = tutorial?.visual_style ?? '2D Animation';
    const imageStyle = tutorial?.image_style ?? 'Simple & Bold';
    const imagePrompt = `${guardianDescription}. Style: ${visualStyle}, ${imageStyle}. Use soft, muted, low-saturation colours — avoid neon or harshly bright colours, since intense colour can be overstimulating for IDD users.`;
    setRegeneratingImage(true);
    try {
      const { data, error } = await supabase.functions.invoke('regenerate-frame', {
        body: { frame_id: editingFrame.id, image_prompt: imagePrompt },
      });
      if (error || data?.error) {
        let detail = data?.error ?? error?.message ?? 'Something went wrong';
        try {
          const body = await (error as any)?.context?.json?.();
          if (body?.error) detail = body.error;
        } catch {}
        throw new Error(detail);
      }
      const updatedFrame = data.frame as TutorialFrame;
      // Bust the image cache — storage path is unchanged so React Native would serve the old image
      if (updatedFrame.image_url) {
        updatedFrame.image_url = `${updatedFrame.image_url.split('?')[0]}?t=${Date.now()}`;
      }
      setTutorial(prev => {
        if (!prev) return prev;
        return { ...prev, frames: prev.frames.map(f => f.id === updatedFrame.id ? updatedFrame : f) };
      });
      setEditingFrame(updatedFrame);
    } catch (err: unknown) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to regenerate image');
    }
    setRegeneratingImage(false);
  }

  async function submitForReview() {
    setSubmitting(true);
    await supabase.from('tutorials').update({ status: 'pending', updated_at: new Date().toISOString() }).eq('id', tutorialId);
    setTutorial(prev => prev ? { ...prev, status: 'pending' } : prev);
    setSubmitting(false);
    Alert.alert('Submitted!', 'Your tutorial has been submitted for admin review. You\'ll be notified once it\'s approved.');
  }

  async function withdrawFromReview() {
    Alert.alert('Withdraw Tutorial', 'This will pull your tutorial from the admin queue and let you re-edit it.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Withdraw', onPress: async () => {
          await supabase.from('tutorials').update({ status: 'preview', updated_at: new Date().toISOString() }).eq('id', tutorialId);
          setTutorial(prev => prev ? { ...prev, status: 'preview' } : prev);
        },
      },
    ]);
  }

  async function deleteTutorial() {
    Alert.alert('Delete Tutorial', 'This will permanently delete this tutorial. This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          await supabase.from('tutorials').delete().eq('id', tutorialId);
          navigation.navigate('Learning', { initialTab: 'my' });
        },
      },
    ]);
  }

  function regenerateTutorial() {
    Alert.alert(
      'Re-generate Tutorial',
      'This will discard the current frames and generate the tutorial again using the same settings. This uses one of your monthly tutorial slots.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Re-generate', onPress: doRegenerateTutorial },
      ],
    );
  }

  async function doRegenerateTutorial() {
    setRegeneratingTutorial(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const { data, error } = await supabase.functions.invoke('regenerate-tutorial', {
        body: { tutorial_id: tutorialId },
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      if (error || data?.error) {
        let detail = data?.error ?? error?.message ?? 'Something went wrong';
        try {
          const body = await (error as any)?.context?.json?.();
          if (body?.error) detail = body.error;
        } catch {}
        throw new Error(detail);
      }
      setTutorial(prev => prev ? { ...prev, status: 'generating', frames: [] } : prev);
      setFrameIndex(0);
      load();
    } catch (err: unknown) {
      Alert.alert('Could not regenerate', err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setRegeneratingTutorial(false);
    }
  }

  function switchTab(tab: 'video' | 'slides') {
    setAutoPlay(false);
    player.pause();
    setViewTab(tab);
    Animated.timing(viewTabUnderlineX, {
      toValue: tab === 'video' ? 0 : 1,
      duration: 180,
      useNativeDriver: true,
    }).start();
  }

  if (loading) {
    return <View style={s.center}><ActivityIndicator size="large" color={NICO.primary} /></View>;
  }

  if (!tutorial) {
    return (
      <View style={s.center}>
        <AppText style={s.errorText}>Tutorial not found</AppText>
      </View>
    );
  }

  if (tutorial.status === 'generating') {
    return (
      <View style={s.center}>
        <ActivityIndicator size="large" color={NICO.primary} />
        <AppText style={s.generatingText}>AI is creating your tutorial…</AppText>
        <AppText style={s.generatingHint}>This usually takes 1-2 mins</AppText>
        <AppText style={s.generatingWarning}>Please do not press back button or do not re-load the page</AppText>
      </View>
    );
  }

  const frames = tutorial.frames ?? [];
  const currentFrame = frames[frameIndex];
  const isCreator = guardian?.id === tutorial.created_by_guardian_id;
  // The generation pipeline auto-rejects a tutorial on any failure (e.g. a Claude API
  // error), writing into the same status/admin_notes fields a human admin rejection
  // uses. This prefix is how the pipeline marks that — no human admin ever types it —
  // so it's a safe way to tell "system failure" apart from "a person reviewed and said no".
  const isTechnicalError = tutorial.status === 'rejected' && !!tutorial.admin_notes?.startsWith('Generation failed:');

  return (
    <View style={s.container}>
      <RainbowDivider />
      <ScrollView contentContainerStyle={s.content}>
        {/* Status banner — creator only, not shown when approved or preview */}
        {isCreator && tutorial.status !== 'approved' && tutorial.status !== 'preview' && (
          <View style={s.statusRow}>
            <View style={[s.statusDot, { backgroundColor: STATUS_COLORS[tutorial.status as TutorialStatus].text }]} />
            <AppText style={[s.statusText, { color: STATUS_COLORS[tutorial.status as TutorialStatus].text }]}>
              {isTechnicalError ? 'Technical Error' : STATUS_LABELS[tutorial.status as TutorialStatus]}
            </AppText>
          </View>
        )}

        {/* Technical failure — creator only: hide the raw error, point them to support */}
        {isCreator && isTechnicalError && (
          <View style={s.adminNotesCard}>
            <AppText style={s.adminNotesText}>
              ⚠️  Something went wrong generating this tutorial. Please contact <AppText style={s.adminNotesEmail}>nicosupport@gmail.com</AppText> for help.
            </AppText>
          </View>
        )}

        {/* Rejected admin notes — creator only, real admin rejections only */}
        {isCreator && tutorial.status === 'rejected' && !isTechnicalError && tutorial.admin_notes && (
          <View style={s.adminNotesCard}>
            <AppText style={s.adminNotesLabel}>Admin Notes</AppText>
            <AppText style={s.adminNotesText}>{tutorial.admin_notes}</AppText>
          </View>
        )}

        {/* Tutorial title */}
        <AppText style={s.title}>{tutorial.display_name || tutorial.category}</AppText>

        {/* YouTube player */}
        {tutorial.source === 'youtube' && tutorial.video_url && (() => {
          const match = tutorial.video_url.match(/embed\/([a-zA-Z0-9_-]{11})/);
          const videoId = match?.[1];
          if (!videoId) return null;
          return (
            <View style={{ marginBottom: 20 }}>
              <YoutubePlayer
                videoId={videoId}
                height={Math.round((width - 32) * 9 / 16)}
              />
            </View>
          );
        })()}

        {/* Video / Slides tabs (slideshow only) */}
        {tutorial.source !== 'youtube' && frames.length > 0 && (
          <View style={s.viewTabs} onLayout={e => setViewTabsWidth(e.nativeEvent.layout.width)}>
            <TouchableOpacity style={s.viewTab} onPress={() => switchTab('video')} activeOpacity={0.75}>
              <AppText style={[s.viewTabText, viewTab === 'video' && s.viewTabTextActive]}>🎬 Video</AppText>
            </TouchableOpacity>
            <TouchableOpacity style={s.viewTab} onPress={() => switchTab('slides')} activeOpacity={0.75}>
              <AppText style={[s.viewTabText, viewTab === 'slides' && s.viewTabTextActive]}>📑 Slides</AppText>
            </TouchableOpacity>
            {viewTabsWidth > 0 && (
              <Animated.View
                style={[
                  s.viewTabUnderline,
                  {
                    width: viewTabsWidth / 2,
                    transform: [{
                      translateX: viewTabUnderlineX.interpolate({ inputRange: [0, 1], outputRange: [0, viewTabsWidth / 2] }),
                    }],
                  },
                ]}
              />
            )}
          </View>
        )}

        {/* Frame viewer (slideshow only) */}
        {tutorial.source !== 'youtube' && frames.length > 0 && (
          <View style={s.frameContainer}>
            {/* Top row: mode control (left) + small regenerate button (right) */}
            <View style={s.frameActions}>
              {viewTab === 'video' ? (
                <TouchableOpacity
                  style={[s.autoPlayBtn, autoPlay && s.autoPlayBtnActive]}
                  onPress={() => {
                    if (!autoPlay) { setFrameIndex(0); setAutoPlay(true); }
                    else setAutoPlay(false);
                  }}
                  disabled={frames.length <= 1}
                >
                  <AppText style={s.autoPlayBtnText}>
                    {autoPlay ? '⏸  Stop' : '▶  Play'}
                  </AppText>
                </TouchableOpacity>
              ) : (
                <AppText style={s.frameCounter}>Frame {frameIndex + 1} of {frames.length}</AppText>
              )}
              <View style={{ flex: 1 }} />
              {isCreator && tutorial.source === 'ai_generated' && ['preview', 'rejected'].includes(tutorial.status) && !isTechnicalError && (
                <TouchableOpacity
                  style={[s.regenSmallBtn, regeneratingTutorial && s.regenSmallBtnDisabled]}
                  onPress={regenerateTutorial}
                  disabled={regeneratingTutorial}
                  activeOpacity={0.8}
                >
                  {regeneratingTutorial
                    ? <ActivityIndicator size="small" color={NICO.text} />
                    : <AppText style={s.regenSmallBtnText}>🔄  Re-generate {viewTab === 'video' ? 'Video' : 'Slides'}</AppText>
                  }
                </TouchableOpacity>
              )}
            </View>

            {/* Frame image */}
            <View style={s.frameImage}>
              {currentFrame?.image_url
                ? <Image source={{ uri: currentFrame.image_url }} style={s.image} resizeMode="contain" />
                : (
                  <View style={s.imagePlaceholder}>
                    <AppText style={s.imagePlaceholderEmoji}>🖼</AppText>
                    <AppText style={s.imagePlaceholderText}>No image</AppText>
                  </View>
                )
              }
            </View>

            {/* Replay + Edit — Slides tab only */}
            {viewTab === 'slides' && (
              <View style={s.frameSlideActions}>
                {currentFrame?.audio_url && (
                  <TouchableOpacity
                    style={s.audioBtn}
                    onPress={() => {
                      if (playerStatus.playing) { player.pause(); }
                      else { player.pause(); player.seekTo(0); player.play(); }
                    }}
                  >
                    <AppText style={s.audioBtnIcon}>
                      {playerStatus.playing ? '⏸' : '🔊'}
                    </AppText>
                  </TouchableOpacity>
                )}
                {isCreator && ['preview', 'rejected'].includes(tutorial.status) && (
                  <TouchableOpacity
                    style={s.editBtn}
                    onPress={() => {
                      if (currentFrame) {
                        setEditCaption(currentFrame.caption ?? '');
                        setEditTts(currentFrame.tts_text ?? '');
                        setEditImagePrompt('');
                        setEditingCaption(false);
                        setEditingNarration(false);
                        setEditingFrame(currentFrame);
                      }
                    }}
                  >
                    <AppText style={s.editBtnText}>✏️  Edit slide</AppText>
                  </TouchableOpacity>
                )}
              </View>
            )}

            {/* Caption + narration */}
            <View style={s.frameText}>
              {currentFrame?.caption && (
                <AppText style={s.caption}>{currentFrame.caption}</AppText>
              )}
              {currentFrame?.tts_text && (
                <AppText style={s.narration}>{currentFrame.tts_text}</AppText>
              )}
            </View>

            {/* Frame navigation — Slides tab only */}
            {viewTab === 'slides' && (
              <View style={s.frameNav}>
                <TouchableOpacity
                  style={[s.navBtn, frameIndex === 0 && s.navBtnDisabled]}
                  onPress={() => setFrameIndex(i => Math.max(0, i - 1))}
                  disabled={frameIndex === 0}
                >
                  <AppText style={s.navBtnText}>← Prev</AppText>
                </TouchableOpacity>
                <View style={s.frameDots}>
                  {frames.map((_, i) => (
                    <TouchableOpacity key={i} onPress={() => setFrameIndex(i)}>
                      <View style={[s.dot, i === frameIndex && s.dotActive]} />
                    </TouchableOpacity>
                  ))}
                </View>
                <TouchableOpacity
                  style={[s.navBtn, frameIndex === frames.length - 1 && s.navBtnDisabled]}
                  onPress={() => setFrameIndex(i => Math.min(frames.length - 1, i + 1))}
                  disabled={frameIndex === frames.length - 1}
                >
                  <AppText style={s.navBtnText}>Next →</AppText>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

        {/* Action buttons — creator only */}
        {isCreator && <View style={s.actions}>
          {tutorial.status === 'preview' && (
            <TouchableOpacity
              style={[s.actionBtn, s.actionBtnPrimary, submitting && s.actionBtnDisabled]}
              onPress={submitForReview}
              disabled={submitting}
            >
              {submitting ? <ActivityIndicator color={NICO.textOnAccent} /> : <AppText style={s.actionBtnTextPrimary}>Submit for Review</AppText>}
            </TouchableOpacity>
          )}
          {tutorial.status === 'pending' && (
            <TouchableOpacity style={[s.actionBtn, s.actionBtnWarning]} onPress={withdrawFromReview}>
              <AppText style={s.actionBtnTextPrimary}>Withdraw from Review</AppText>
            </TouchableOpacity>
          )}
          {tutorial.status === 'rejected' && !isTechnicalError && (
            <TouchableOpacity
              style={[s.actionBtn, s.actionBtnPrimary, submitting && s.actionBtnDisabled]}
              onPress={submitForReview}
              disabled={submitting}
            >
              {submitting ? <ActivityIndicator color={NICO.textOnAccent} /> : <AppText style={s.actionBtnTextPrimary}>Resubmit for Review</AppText>}
            </TouchableOpacity>
          )}
          {tutorial.status === 'approved' && tutorial.is_public && (
            <View style={s.approvedBanner}>
              <AppText style={s.approvedText}>✅ This tutorial is live in the shared library</AppText>
            </View>
          )}
          <TouchableOpacity style={[s.actionBtn, s.actionBtnDelete]} onPress={deleteTutorial}>
            <AppText style={s.actionBtnTextDelete}>{tutorial.source === 'youtube' ? 'Delete Video' : 'Delete Tutorial'}</AppText>
          </TouchableOpacity>
        </View>}

      </ScrollView>

      {/* Frame editor modal */}
      <Modal visible={!!editingFrame} animationType="slide" onRequestClose={() => setEditingFrame(null)}>
        <View style={s.editorContainer}>
          <View style={s.editorHeader}>
            <AppText style={s.editorTitle}>Edit Frame {(editingFrame ? frames.indexOf(editingFrame) : 0) + 1}</AppText>
            <TouchableOpacity onPress={() => setEditingFrame(null)} style={s.editorClose}>
              <AppText style={s.editorCloseText}>✕</AppText>
            </TouchableOpacity>
          </View>

          <ScrollView style={s.editorContent} keyboardShouldPersistTaps="handled">

            {/* ── Caption ── */}
            <View style={s.editorSection}>
              <View style={s.editorFieldRow}>
                <AppText style={s.editorFieldLabel}>Caption</AppText>
                {!editingCaption && (
                  <TouchableOpacity onPress={() => setEditingCaption(true)} style={s.editorPencilBtn}>
                    <AppText style={s.editorPencilText}>✏️</AppText>
                  </TouchableOpacity>
                )}
              </View>
              {editingCaption ? (
                <View style={s.editorInlineRow}>
                  <TextInput
                    style={[s.editorInput, { flex: 1 }]}
                    value={editCaption}
                    onChangeText={t => setEditCaption(t.slice(0, 50))}
                    placeholder="e.g. Tap the ball"
                    placeholderTextColor={NICO.textMuted}
                    maxLength={50}
                    autoFocus
                  />
                  <TouchableOpacity
                    style={[s.editorInlineConfirm, savingCaption && { opacity: 0.5 }]}
                    onPress={saveCaptionEdit}
                    disabled={savingCaption}
                  >
                    {savingCaption
                      ? <ActivityIndicator size="small" color={NICO.textOnAccent} />
                      : <AppText style={s.editorInlineConfirmText}>✓</AppText>
                    }
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={s.editorInlineDismiss}
                    onPress={() => { setEditCaption(editingFrame?.caption ?? ''); setEditingCaption(false); }}
                  >
                    <AppText style={s.editorInlineDismissText}>✕</AppText>
                  </TouchableOpacity>
                </View>
              ) : (
                <AppText style={s.editorFieldValue}>{editCaption || '—'}</AppText>
              )}
            </View>

            <View style={s.editorDivider} />

            {/* ── Narration ── */}
            <View style={s.editorSection}>
              <View style={s.editorFieldRow}>
                <AppText style={s.editorFieldLabel}>Narration text</AppText>
                {!editingNarration && (
                  <TouchableOpacity onPress={() => setEditingNarration(true)} style={s.editorPencilBtn}>
                    <AppText style={s.editorPencilText}>✏️</AppText>
                  </TouchableOpacity>
                )}
              </View>
              {editingNarration ? (
                <>
                  <TextInput
                    style={[s.editorInput, { height: 90 }]}
                    value={editTts}
                    onChangeText={t => setEditTts(t.slice(0, 150))}
                    placeholder="e.g. Use the inside of your foot to tap the ball forward."
                    placeholderTextColor={NICO.textMuted}
                    multiline
                    textAlignVertical="top"
                    maxLength={150}
                    autoFocus
                  />
                  <View style={s.editorInlineRowEnd}>
                    <TouchableOpacity
                      style={s.editorInlineDismiss}
                      onPress={() => { setEditTts(editingFrame?.tts_text ?? ''); setEditingNarration(false); }}
                    >
                      <AppText style={s.editorInlineDismissText}>Cancel</AppText>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[s.editorInlineConfirm, savingNarration && { opacity: 0.5 }]}
                      onPress={saveNarrationEdit}
                      disabled={savingNarration}
                    >
                      {savingNarration
                        ? <ActivityIndicator size="small" color={NICO.textOnAccent} />
                        : <AppText style={s.editorInlineConfirmText}>Save &amp; regenerate audio</AppText>
                      }
                    </TouchableOpacity>
                  </View>
                </>
              ) : (
                <AppText style={s.editorFieldValue}>{editTts || '—'}</AppText>
              )}
            </View>

            <View style={s.editorDivider} />

            {/* ── Image regeneration ── */}
            <View style={s.editorImageSection}>
              {editingFrame?.image_url && (
                <Image source={{ uri: editingFrame.image_url }} style={s.editorImage} resizeMode="cover" />
              )}
              <AppText style={s.editorFieldLabel}>What should the image show?</AppText>
              <TextInput
                style={[s.editorInput, { height: 80, marginBottom: 10 }]}
                value={editImagePrompt}
                onChangeText={t => setEditImagePrompt(t.slice(0, 150))}
                placeholder="e.g. A child kicking a soccer ball on a green field"
                placeholderTextColor={NICO.textMuted}
                multiline
                textAlignVertical="top"
                maxLength={150}
              />
              <TouchableOpacity
                style={[s.regenBtn, regeneratingImage && s.regenBtnDisabled]}
                onPress={regenerateFrameImage}
                disabled={regeneratingImage}
              >
                {regeneratingImage
                  ? <ActivityIndicator color={NICO.primary} size="small" />
                  : <AppText style={s.regenBtnText}>🔄  Regenerate image</AppText>
                }
              </TouchableOpacity>
            </View>

          </ScrollView>

          <View style={s.editorActions}>
            <TouchableOpacity style={s.editorDoneBtn} onPress={() => setEditingFrame(null)}>
              <AppText style={s.editorDoneBtnText}>Done</AppText>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: NICO.screenBg },
  content:   { padding: SPACING.base, paddingBottom: 48 },
  center:    { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12, padding: 32 },
  errorText:     { ...TEXT_STYLE.body, color: NICO.textMuted },
  generatingText:{ fontSize: FONT_SIZE.lg, fontWeight: FONT_WEIGHT.extraBold, color: NICO.text, textAlign: 'center' },
  generatingHint:{ fontSize: FONT_SIZE.md, color: NICO.textMuted, textAlign: 'center' },
  generatingWarning:{ fontSize: FONT_SIZE.lg, fontWeight: FONT_WEIGHT.extraBold, color: NICO.error, textAlign: 'center', marginTop: SPACING.md },

  statusRow:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: SPACING.xs, marginBottom: 14 },
  statusDot:  { width: 8, height: 8, borderRadius: RADIUS.full },
  statusText: { fontWeight: FONT_WEIGHT.bold, fontSize: FONT_SIZE.sm, letterSpacing: 0.2 },

  adminNotesCard:  { backgroundColor: NICO.errorLight, borderRadius: RADIUS.md, borderWidth: 1.5, borderColor: NICO.error, padding: 14, marginBottom: 12 },
  adminNotesLabel: { fontSize: FONT_SIZE.xs, fontWeight: FONT_WEIGHT.bold, color: NICO.error, marginBottom: 4 },
  adminNotesText:  { fontSize: FONT_SIZE.md, color: NICO.text, lineHeight: 20 },
  adminNotesEmail: { fontWeight: FONT_WEIGHT.extraBold, color: NICO.error },

  title: { fontSize: FONT_SIZE['4xl'], fontWeight: FONT_WEIGHT.extraBold, color: NICO.text, marginBottom: 10 },

  viewTabs:          { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: NICO.border, marginBottom: SPACING.base, position: 'relative' },
  viewTab:           { flex: 1, alignItems: 'center', paddingVertical: SPACING.sm },
  viewTabText:       { fontSize: FONT_SIZE.md, fontWeight: FONT_WEIGHT.semiBold, color: NICO.textMuted },
  viewTabTextActive: { color: NICO.text, fontWeight: FONT_WEIGHT.bold },
  viewTabUnderline:  { position: 'absolute', bottom: -1, left: 0, height: 3, borderRadius: RADIUS.full, backgroundColor: NICO.primary },

  frameContainer:    { backgroundColor: NICO.surface, borderRadius: RADIUS.xl, overflow: 'hidden', marginBottom: 20, ...SHADOW.sm },
  frameActions:      { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: SPACING.sm, padding: 14, paddingBottom: SPACING.sm },
  frameSlideActions: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm, paddingHorizontal: 14, paddingTop: 10, paddingBottom: 4 },
  frameCounter:      { fontSize: FONT_SIZE.lg, fontWeight: FONT_WEIGHT.bold, color: NICO.text },

  autoPlayBtn:       { backgroundColor: NICO.background, borderRadius: RADIUS.full, paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm },
  autoPlayBtnActive: { backgroundColor: NICO.border },
  autoPlayBtnText:   { fontSize: FONT_SIZE.sm, fontWeight: FONT_WEIGHT.bold, color: NICO.text },
  regenSmallBtn:     { paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, borderRadius: RADIUS.full, backgroundColor: NICO.background, justifyContent: 'center', alignItems: 'center' },
  regenSmallBtnDisabled: { opacity: 0.5 },
  regenSmallBtnText: { fontSize: FONT_SIZE.sm, fontWeight: FONT_WEIGHT.bold, color: NICO.text },

  audioBtn:     { width: scale(40), height: scale(40), borderRadius: RADIUS.full, backgroundColor: NICO.primaryLight, borderWidth: 1, borderColor: NICO.primary, justifyContent: 'center', alignItems: 'center' },
  audioBtnIcon: { fontSize: FONT_SIZE.xl },
  editBtn:      { backgroundColor: NICO.primaryLight, borderRadius: RADIUS.sm, paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, borderWidth: 1, borderColor: NICO.primary },
  editBtnText:  { fontSize: FONT_SIZE.sm, fontWeight: FONT_WEIGHT.bold, color: NICO.primary },

  frameImage:          { width: '100%', aspectRatio: 1, backgroundColor: '#000' },
  image:               { width: '100%', height: '100%' },
  imagePlaceholder:    { width: '100%', height: '100%', backgroundColor: NICO.primaryLight, justifyContent: 'center', alignItems: 'center', gap: SPACING.sm },
  imagePlaceholderEmoji: { fontSize: scale(48) },
  imagePlaceholderText:  { fontSize: FONT_SIZE.md, color: NICO.textMuted },

  frameText:  { padding: 18, gap: 10 },
  caption:    { fontSize: FONT_SIZE['4xl'], fontWeight: FONT_WEIGHT.extraBold, color: NICO.text },
  narration:  { fontSize: FONT_SIZE.xl, fontWeight: FONT_WEIGHT.semiBold, color: NICO.text, lineHeight: 24 },

  frameNav:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SPACING.base, paddingBottom: SPACING.base },
  navBtn:      { paddingHorizontal: SPACING.base, paddingVertical: 10, borderRadius: RADIUS.sm, backgroundColor: NICO.primary },
  navBtnDisabled: { opacity: 0.3 },
  navBtnText:  { fontSize: FONT_SIZE.sm, fontWeight: FONT_WEIGHT.bold, color: NICO.textOnAccent },
  frameDots:   { flexDirection: 'row', gap: 6 },
  dot:         { width: 8, height: 8, borderRadius: 4, backgroundColor: NICO.border },
  dotActive:   { backgroundColor: NICO.primary, width: 20 },

  actions:             { gap: SPACING.md },
  actionBtn:           { ...BTN_SIZE.lg },
  actionBtnPrimary:    { ...BTN_VARIANT.primary, ...SHADOW.sm },
  actionBtnWarning:    { ...BTN_VARIANT.primary, backgroundColor: NICO.warning },
  actionBtnDisabled:   { opacity: 0.5 },
  actionBtnTextPrimary:{ ...TEXT_STYLE.buttonPrimary },
  approvedBanner:      { backgroundColor: NICO.successLight, borderRadius: RADIUS.lg, paddingVertical: 16, alignItems: 'center' },
  approvedText:        { color: NICO.success, fontWeight: FONT_WEIGHT.bold, fontSize: FONT_SIZE.md },
  actionBtnDelete:     { ...BTN_VARIANT.danger },
  actionBtnTextDelete: { ...TEXT_STYLE.buttonPrimary },


  // Frame editor modal
  editorContainer: { flex: 1, backgroundColor: NICO.screenBg },
  editorHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: SPACING.lg, paddingTop: 56, paddingBottom: SPACING.base,
    backgroundColor: NICO.surface, borderBottomWidth: 1, borderBottomColor: NICO.border,
  },
  editorTitle:       { fontSize: FONT_SIZE.lg, fontWeight: FONT_WEIGHT.extraBold, color: NICO.text },
  editorClose:       { padding: 4 },
  editorCloseText:   { fontSize: FONT_SIZE['3xl'], fontWeight: FONT_WEIGHT.extraBold, color: NICO.text },
  editorContent:     { flex: 1 },
  editorSection:     { paddingHorizontal: SPACING.lg, paddingVertical: SPACING.base },
  editorDivider:     { height: 1, backgroundColor: NICO.border, marginHorizontal: SPACING.lg },
  editorFieldRow:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  editorFieldLabel:  { ...TEXT_STYLE.fieldLabel },
  editorFieldValue:  { ...TEXT_STYLE.fieldValue, lineHeight: 22 },
  editorPencilBtn:   { padding: 4 },
  editorPencilText:  { fontSize: FONT_SIZE.lg },
  editorInlineRow:   { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  editorInlineRowEnd:{ flexDirection: 'row', justifyContent: 'flex-end', gap: SPACING.sm, marginTop: SPACING.sm },
  editorInlineConfirm: {
    backgroundColor: NICO.primary, borderRadius: RADIUS.sm,
    paddingHorizontal: 14, paddingVertical: 10, minWidth: 44, alignItems: 'center',
  },
  editorInlineConfirmText: { color: NICO.textOnAccent, fontWeight: FONT_WEIGHT.bold, fontSize: FONT_SIZE.sm },
  editorInlineDismiss: {
    backgroundColor: NICO.border, borderRadius: RADIUS.sm,
    paddingHorizontal: 14, paddingVertical: 10, alignItems: 'center',
  },
  editorInlineDismissText: { color: NICO.text, fontWeight: FONT_WEIGHT.semiBold, fontSize: FONT_SIZE.sm },
  editorImageSection: { padding: SPACING.lg, backgroundColor: NICO.primaryLight },
  editorImage:  { width: '100%', height: 180, borderRadius: RADIUS.md, marginBottom: 14 },
  editorInput:  {
    backgroundColor: NICO.surface, borderRadius: RADIUS.md, borderWidth: 1, borderColor: NICO.border,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: FONT_SIZE.md, color: NICO.text,
  },
  regenBtn:         { flexDirection: 'row', justifyContent: 'center', backgroundColor: NICO.primaryLight, borderRadius: RADIUS.sm, paddingVertical: 12 },
  regenBtnDisabled: { opacity: 0.5 },
  regenBtnText:     { color: NICO.primary, fontWeight: FONT_WEIGHT.bold, fontSize: FONT_SIZE.md },
  editorActions: {
    padding: SPACING.lg, paddingBottom: 36,
    backgroundColor: NICO.surface, borderTopWidth: 1, borderTopColor: NICO.border,
  },
  editorDoneBtn:     { paddingVertical: 14, borderRadius: RADIUS.md, alignItems: 'center', backgroundColor: NICO.primary },
  editorDoneBtnText: { fontWeight: FONT_WEIGHT.bold, color: NICO.textOnAccent, fontSize: FONT_SIZE.md },
});
