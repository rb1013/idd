import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, Image, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, Alert, ActivityIndicator, Modal, Dimensions,
} from 'react-native';
import AppText from '../../components/AppText';
import { useFocusEffect, useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/AuthContext';
import { COLORS } from '../../constants';
import { GuardianNavParamList } from '../../navigation';
import type { TutorialWithFrames, TutorialFrame, TutorialStatus } from '../../types';

const { width } = Dimensions.get('window');

type NavProp = NativeStackNavigationProp<GuardianNavParamList, 'TutorialPreview'>;
type RouteType = RouteProp<GuardianNavParamList, 'TutorialPreview'>;

const STATUS_COLORS: Record<TutorialStatus, { bg: string; text: string }> = {
  generating: { bg: '#E8ECEF', text: '#5D6D7E' },
  preview:    { bg: '#FEF3CD', text: '#B7791F' },
  pending:    { bg: '#DBEAFE', text: '#1D4ED8' },
  approved:   { bg: COLORS.statusGreenLight, text: COLORS.statusGreenDark },
  rejected:   { bg: COLORS.statusRedLight, text: '#991B1B' },
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
      if (error || data?.error) throw new Error(data?.error ?? error?.message);
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

  async function regenerateFrameImage() {
    if (!editingFrame) return;
    const guardianDescription = editImagePrompt.trim()
      || (editCaption
        ? `${tutorial?.topic ?? ''} — ${editCaption}: ${editTts}`
        : `${tutorial?.topic ?? ''}: ${editTts}`);
    // Wrap the guardian's plain-English description with visual style context
    const visualStyle = tutorial?.visual_style ?? '2D Animation';
    const imageStyle = tutorial?.image_style ?? 'Simple & Bold';
    const imagePrompt = `${guardianDescription}. Style: ${visualStyle}, ${imageStyle}.`;
    setRegeneratingImage(true);
    try {
      const { data, error } = await supabase.functions.invoke('regenerate-frame', {
        body: {
          frame_id: editingFrame.id,
          image_prompt: imagePrompt,
        },
      });
      if (error || data?.error) throw new Error(data?.error ?? error?.message);
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

  async function regenerateTutorial() {
    Alert.alert('Re-generate Tutorial', 'This will discard the current frames and generate the tutorial again using the same settings.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Re-generate', onPress: async () => {
          // Clear existing frames and reset status
          await supabase.from('tutorial_frames').delete().eq('tutorial_id', tutorialId);
          await supabase.from('tutorials').update({ status: 'generating', updated_at: new Date().toISOString() }).eq('id', tutorialId);
          setTutorial(prev => prev ? { ...prev, status: 'generating', frames: [] } : prev);
          setFrameIndex(0);
          // Queue a new job
          await supabase.from('tutorial_jobs').insert({ tutorial_id: tutorialId });
          // Restart poll
          load();
        },
      },
    ]);
  }

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color={COLORS.bloomAccent} /></View>;
  }

  if (!tutorial) {
    return (
      <View style={styles.center}>
        <AppText style={styles.errorText}>Tutorial not found</AppText>
      </View>
    );
  }

  if (tutorial.status === 'generating') {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.bloomAccent} />
        <AppText style={styles.generatingText}>AI is creating your tutorial…</AppText>
        <AppText style={styles.generatingHint}>This usually takes 30–60 seconds</AppText>
      </View>
    );
  }

  const frames = tutorial.frames ?? [];
  const currentFrame = frames[frameIndex];
  const isCreator = guardian?.id === tutorial.created_by_guardian_id;

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Status banner — creator only */}
        {isCreator && (
          <View style={[styles.statusBanner, { backgroundColor: STATUS_COLORS[tutorial.status as TutorialStatus].bg }]}>
            <AppText style={[styles.statusBannerText, { color: STATUS_COLORS[tutorial.status as TutorialStatus].text }]}>
              {STATUS_LABELS[tutorial.status as TutorialStatus]}
            </AppText>
          </View>
        )}

        {/* Rejected admin notes — creator only */}
        {isCreator && tutorial.status === 'rejected' && tutorial.admin_notes && (
          <View style={styles.adminNotesCard}>
            <AppText style={styles.adminNotesLabel}>Admin Notes</AppText>
            <AppText style={styles.adminNotesText}>{tutorial.admin_notes}</AppText>
          </View>
        )}

        {/* Tutorial title */}
        <AppText style={styles.title}>{tutorial.display_name || tutorial.category}</AppText>

        {/* Frame viewer */}
        {frames.length > 0 && (
          <View style={styles.frameContainer}>
            {/* Play All — top */}
            <View style={styles.frameActions}>
              <TouchableOpacity
                style={[styles.autoPlayBtn, autoPlay && styles.autoPlayBtnActive]}
                onPress={() => {
                  if (!autoPlay) { setFrameIndex(0); setAutoPlay(true); }
                  else setAutoPlay(false);
                }}
                disabled={(tutorial?.frames?.length ?? 0) <= 1}
              >
                <AppText style={styles.autoPlayBtnText}>
                  {autoPlay ? '⏸  Stop' : '▶  Play video'}
                </AppText>
              </TouchableOpacity>
            </View>

            {/* Frame image */}
            <View style={styles.frameImage}>
              {currentFrame?.image_url
                ? <Image source={{ uri: currentFrame.image_url }} style={styles.image} resizeMode="contain" />
                : (
                  <View style={styles.imagePlaceholder}>
                    <AppText style={styles.imagePlaceholderEmoji}>🖼</AppText>
                    <AppText style={styles.imagePlaceholderText}>No image</AppText>
                  </View>
                )
              }
            </View>

            {/* Replay + Edit — below frame, above counter */}
            <View style={styles.frameSlideActions}>
              {currentFrame?.audio_url && (
                <TouchableOpacity
                  style={styles.audioBtn}
                  onPress={() => {
                    if (playerStatus.playing) { player.pause(); }
                    else { player.pause(); player.seekTo(0); player.play(); }
                  }}
                >
                  <AppText style={styles.audioBtnText}>
                    {playerStatus.playing ? '⏸  Pause' : '🔊  Replay slide'}
                  </AppText>
                </TouchableOpacity>
              )}
              {isCreator && ['preview', 'rejected'].includes(tutorial.status) && (
                <TouchableOpacity
                  style={styles.editBtn}
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
                  <AppText style={styles.editBtnText}>✏️  Edit slide</AppText>
                </TouchableOpacity>
              )}
            </View>

            {/* Frame counter */}
            <View style={styles.frameHeader}>
              <AppText style={styles.frameCounter}>Frame {frameIndex + 1} of {frames.length}</AppText>
            </View>

            {/* Caption + narration */}
            <View style={styles.frameText}>
              {currentFrame?.caption && (
                <AppText style={styles.caption}>{currentFrame.caption}</AppText>
              )}
              {currentFrame?.tts_text && (
                <AppText style={styles.narration}>{currentFrame.tts_text}</AppText>
              )}
            </View>

            {/* Frame navigation */}
            <View style={styles.frameNav}>
              <TouchableOpacity
                style={[styles.navBtn, frameIndex === 0 && styles.navBtnDisabled]}
                onPress={() => setFrameIndex(i => Math.max(0, i - 1))}
                disabled={frameIndex === 0}
              >
                <AppText style={styles.navBtnText}>← Prev</AppText>
              </TouchableOpacity>
              <View style={styles.frameDots}>
                {frames.map((_, i) => (
                  <TouchableOpacity key={i} onPress={() => setFrameIndex(i)}>
                    <View style={[styles.dot, i === frameIndex && styles.dotActive]} />
                  </TouchableOpacity>
                ))}
              </View>
              <TouchableOpacity
                style={[styles.navBtn, frameIndex === frames.length - 1 && styles.navBtnDisabled]}
                onPress={() => setFrameIndex(i => Math.min(frames.length - 1, i + 1))}
                disabled={frameIndex === frames.length - 1}
              >
                <AppText style={styles.navBtnText}>Next →</AppText>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Action buttons — creator only */}
        {isCreator && <View style={styles.actions}>
          {tutorial.status === 'preview' && (
            <TouchableOpacity
              style={[styles.actionBtn, styles.actionBtnPrimary, submitting && styles.actionBtnDisabled]}
              onPress={submitForReview}
              disabled={submitting}
            >
              {submitting ? <ActivityIndicator color="#fff" /> : <AppText style={styles.actionBtnTextPrimary}>Submit for Review</AppText>}
            </TouchableOpacity>
          )}
          {tutorial.status === 'pending' && (
            <TouchableOpacity style={[styles.actionBtn, styles.actionBtnWarning]} onPress={withdrawFromReview}>
              <AppText style={styles.actionBtnTextPrimary}>Withdraw from Review</AppText>
            </TouchableOpacity>
          )}
          {tutorial.status === 'rejected' && (
            <TouchableOpacity
              style={[styles.actionBtn, styles.actionBtnPrimary, submitting && styles.actionBtnDisabled]}
              onPress={submitForReview}
              disabled={submitting}
            >
              {submitting ? <ActivityIndicator color="#fff" /> : <AppText style={styles.actionBtnTextPrimary}>Resubmit for Review</AppText>}
            </TouchableOpacity>
          )}
          {tutorial.status === 'approved' && (
            <View style={styles.approvedBanner}>
              <AppText style={styles.approvedText}>✅ This tutorial is live in the shared library</AppText>
            </View>
          )}
          <TouchableOpacity style={[styles.actionBtn, styles.actionBtnDelete]} onPress={deleteTutorial}>
            <AppText style={styles.actionBtnTextDelete}>Delete Tutorial</AppText>
          </TouchableOpacity>
        </View>}

        {/* Guardian inputs used to generate this tutorial — creator only */}
        {isCreator && tutorial.source === 'ai_generated' && (
          <View style={styles.inputsCard}>
            <AppText style={styles.inputsCardTitle}>Generation Settings</AppText>
            <View style={styles.inputsGrid}>
              {tutorial.category      && <InputRow label="Skill"         value={tutorial.category} />}
              {tutorial.core_action   && <InputRow label="Core Action"   value={tutorial.core_action} />}
              {tutorial.duration_seconds && <InputRow label="Duration"   value={`${tutorial.duration_seconds}s`} />}
              {tutorial.comprehension_level && <InputRow label="Level"   value={tutorial.comprehension_level} />}
            </View>

            {['preview', 'rejected'].includes(tutorial.status) && (
              <TouchableOpacity style={styles.regenTutorialBtn} onPress={regenerateTutorial} activeOpacity={0.8}>
                <AppText style={styles.regenTutorialBtnText}>🔄  Re-generate Tutorial</AppText>
              </TouchableOpacity>
            )}
          </View>
        )}
      </ScrollView>

      {/* Frame editor modal */}
      <Modal visible={!!editingFrame} animationType="slide" onRequestClose={() => setEditingFrame(null)}>
        <View style={styles.editorContainer}>
          <View style={styles.editorHeader}>
            <AppText style={styles.editorTitle}>Edit Frame {(editingFrame ? frames.indexOf(editingFrame) : 0) + 1}</AppText>
            <TouchableOpacity onPress={() => setEditingFrame(null)} style={styles.editorClose}>
              <AppText style={styles.editorCloseText}>✕</AppText>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.editorContent} keyboardShouldPersistTaps="handled">

            {/* ── Caption ── */}
            <View style={styles.editorSection}>
              <View style={styles.editorFieldRow}>
                <AppText style={styles.editorFieldLabel}>Caption</AppText>
                {!editingCaption && (
                  <TouchableOpacity onPress={() => setEditingCaption(true)} style={styles.editorPencilBtn}>
                    <AppText style={styles.editorPencilText}>✏️</AppText>
                  </TouchableOpacity>
                )}
              </View>
              {editingCaption ? (
                <View style={styles.editorInlineRow}>
                  <TextInput
                    style={[styles.editorInput, { flex: 1 }]}
                    value={editCaption}
                    onChangeText={t => setEditCaption(t.slice(0, 50))}
                    placeholder="e.g. Tap the ball"
                    placeholderTextColor={COLORS.bloomMuted}
                    maxLength={50}
                    autoFocus
                  />
                  <TouchableOpacity
                    style={[styles.editorInlineConfirm, savingCaption && { opacity: 0.5 }]}
                    onPress={saveCaptionEdit}
                    disabled={savingCaption}
                  >
                    {savingCaption
                      ? <ActivityIndicator size="small" color="#fff" />
                      : <AppText style={styles.editorInlineConfirmText}>✓</AppText>
                    }
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.editorInlineDismiss}
                    onPress={() => { setEditCaption(editingFrame?.caption ?? ''); setEditingCaption(false); }}
                  >
                    <AppText style={styles.editorInlineDismissText}>✕</AppText>
                  </TouchableOpacity>
                </View>
              ) : (
                <AppText style={styles.editorFieldValue}>{editCaption || '—'}</AppText>
              )}
            </View>

            <View style={styles.editorDivider} />

            {/* ── Narration ── */}
            <View style={styles.editorSection}>
              <View style={styles.editorFieldRow}>
                <AppText style={styles.editorFieldLabel}>Narration text</AppText>
                {!editingNarration && (
                  <TouchableOpacity onPress={() => setEditingNarration(true)} style={styles.editorPencilBtn}>
                    <AppText style={styles.editorPencilText}>✏️</AppText>
                  </TouchableOpacity>
                )}
              </View>
              {editingNarration ? (
                <>
                  <TextInput
                    style={[styles.editorInput, { height: 90 }]}
                    value={editTts}
                    onChangeText={t => setEditTts(t.slice(0, 150))}
                    placeholder="e.g. Use the inside of your foot to tap the ball forward."
                    placeholderTextColor={COLORS.bloomMuted}
                    multiline
                    textAlignVertical="top"
                    maxLength={150}
                    autoFocus
                  />
                  <View style={styles.editorInlineRowEnd}>
                    <TouchableOpacity
                      style={styles.editorInlineDismiss}
                      onPress={() => { setEditTts(editingFrame?.tts_text ?? ''); setEditingNarration(false); }}
                    >
                      <AppText style={styles.editorInlineDismissText}>Cancel</AppText>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.editorInlineConfirm, savingNarration && { opacity: 0.5 }]}
                      onPress={saveNarrationEdit}
                      disabled={savingNarration}
                    >
                      {savingNarration
                        ? <ActivityIndicator size="small" color="#fff" />
                        : <AppText style={styles.editorInlineConfirmText}>Save &amp; regenerate audio</AppText>
                      }
                    </TouchableOpacity>
                  </View>
                </>
              ) : (
                <AppText style={styles.editorFieldValue}>{editTts || '—'}</AppText>
              )}
            </View>

            <View style={styles.editorDivider} />

            {/* ── Image regeneration ── */}
            <View style={styles.editorImageSection}>
              {editingFrame?.image_url && (
                <Image source={{ uri: editingFrame.image_url }} style={styles.editorImage} resizeMode="cover" />
              )}
              <AppText style={styles.editorFieldLabel}>What should the image show?</AppText>
              <TextInput
                style={[styles.editorInput, { height: 80, marginBottom: 10 }]}
                value={editImagePrompt}
                onChangeText={t => setEditImagePrompt(t.slice(0, 150))}
                placeholder="e.g. A child kicking a soccer ball on a green field"
                placeholderTextColor={COLORS.bloomMuted}
                multiline
                textAlignVertical="top"
                maxLength={150}
              />
              <TouchableOpacity
                style={[styles.regenBtn, regeneratingImage && styles.regenBtnDisabled]}
                onPress={regenerateFrameImage}
                disabled={regeneratingImage}
              >
                {regeneratingImage
                  ? <ActivityIndicator color={COLORS.bloomAccent} size="small" />
                  : <AppText style={styles.regenBtnText}>🔄  Regenerate image</AppText>
                }
              </TouchableOpacity>
            </View>

          </ScrollView>

          <View style={styles.editorActions}>
            <TouchableOpacity style={styles.editorDoneBtn} onPress={() => setEditingFrame(null)}>
              <AppText style={styles.editorDoneBtnText}>Done</AppText>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function InputRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.inputRow}>
      <AppText style={styles.inputRowLabel}>{label}</AppText>
      <AppText style={styles.inputRowValue} numberOfLines={2}>{value}</AppText>
    </View>
  );
}

function MetaBadge({ text, color }: { text: string; color?: string }) {
  return (
    <View style={[styles.metaBadge, color ? { backgroundColor: `${color}22`, borderColor: color } : {}]}>
      <AppText style={[styles.metaBadgeText, color ? { color } : {}]}>{text}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bloomBody },
  content: { padding: 16, paddingBottom: 48 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12, padding: 32 },
  errorText: { fontSize: 16, color: COLORS.bloomMuted },
  generatingText: { fontSize: 18, fontWeight: '700', color: COLORS.bloomText, textAlign: 'center' },
  generatingHint: { fontSize: 14, color: COLORS.bloomMuted, textAlign: 'center' },

  statusBanner: { borderRadius: 14, paddingHorizontal: 16, paddingVertical: 12, marginBottom: 14, alignItems: 'center' },
  statusBannerText: { fontWeight: '800', fontSize: 15 },

  adminNotesCard: { backgroundColor: '#FFF5F5', borderRadius: 12, borderWidth: 1.5, borderColor: COLORS.error, padding: 14, marginBottom: 12 },
  adminNotesLabel: { fontSize: 12, fontWeight: '700', color: COLORS.error, marginBottom: 4 },
  adminNotesText: { fontSize: 14, color: COLORS.bloomText, lineHeight: 20 },

  title: { fontSize: 22, fontWeight: '800', color: COLORS.bloomText, marginBottom: 10 },
  metaRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginBottom: 20 },
  metaBadge: {
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10,
    backgroundColor: COLORS.bloomActiveBg, borderWidth: 1, borderColor: COLORS.bloomAccent,
  },
  metaBadgeText: { fontSize: 12, fontWeight: '600', color: COLORS.bloomAccent, textTransform: 'capitalize' },

  frameContainer: { backgroundColor: COLORS.bloomCard, borderRadius: 20, overflow: 'hidden', marginBottom: 20 },
  frameActions: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 8,
    padding: 14, paddingBottom: 8,
  },
  frameSlideActions: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 8,
    paddingHorizontal: 14, paddingTop: 10, paddingBottom: 4,
  },
  frameHeader: { paddingHorizontal: 14, paddingTop: 6, paddingBottom: 10 },
  frameCounter: { fontSize: 13, fontWeight: '600', color: COLORS.bloomMuted },
  autoPlayBtn: {
    backgroundColor: COLORS.bloomAccent, borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 8,
  },
  autoPlayBtnActive: { backgroundColor: COLORS.bloomNavy },
  autoPlayBtnText: { fontSize: 13, fontWeight: '700', color: COLORS.bloomOnAccent },
  audioBtn: { backgroundColor: '#F0FDF4', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: '#86EFAC' },
  audioBtnText: { fontSize: 13, fontWeight: '700', color: '#166534' },
  editBtn: { backgroundColor: COLORS.bloomActiveBg, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: COLORS.bloomAccent },
  editBtnText: { fontSize: 13, fontWeight: '700', color: COLORS.bloomAccent },

  frameImage: { width: '100%', aspectRatio: 1, backgroundColor: '#000' },
  image: { width: '100%', height: '100%' },
  imagePlaceholder: {
    width: '100%', height: '100%',
    backgroundColor: COLORS.bloomActiveBg, justifyContent: 'center', alignItems: 'center', gap: 8,
  },
  imagePlaceholderEmoji: { fontSize: 48 },
  imagePlaceholderText: { fontSize: 14, color: COLORS.bloomMuted },

  frameText: { padding: 18, gap: 10 },
  caption: { fontSize: 22, fontWeight: '800', color: COLORS.bloomText },
  narration: { fontSize: 16, color: COLORS.bloomText, lineHeight: 24, opacity: 0.75 },

  frameNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 16 },
  navBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10, backgroundColor: COLORS.bloomAccent },
  navBtnDisabled: { opacity: 0.3 },
  navBtnText: { fontSize: 13, fontWeight: '700', color: COLORS.bloomOnAccent },
  frameDots: { flexDirection: 'row', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.bloomBorder },
  dotActive: { backgroundColor: COLORS.bloomAccent, width: 20 },

  actions: { gap: 12 },
  actionBtn: { borderRadius: 14, paddingVertical: 15, alignItems: 'center' },
  actionBtnPrimary: { backgroundColor: COLORS.bloomAccent, shadowColor: COLORS.bloomAccent, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 6 },
  actionBtnWarning: { backgroundColor: COLORS.warning },
  actionBtnDisabled: { opacity: 0.5 },
  actionBtnTextPrimary: { color: COLORS.bloomOnAccent, fontWeight: '800', fontSize: 15 },
  approvedBanner: { backgroundColor: COLORS.secondaryLight, borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  approvedText: { color: COLORS.success, fontWeight: '700', fontSize: 14 },
  actionBtnDelete: { backgroundColor: COLORS.statusRedLight, borderWidth: 1.5, borderColor: '#FCA5A5' },
  actionBtnTextDelete: { color: '#991B1B', fontWeight: '700', fontSize: 15 },

  // Guardian inputs card
  inputsCard: {
    marginTop: 20, backgroundColor: COLORS.bloomCard, borderRadius: 18,
    borderWidth: 1.5, borderColor: COLORS.bloomBorder, padding: 18, gap: 14,
  },
  inputsCardTitle: { fontSize: 14, fontWeight: '700', color: COLORS.bloomMuted, textTransform: 'uppercase', letterSpacing: 0.6 },
  inputsGrid: { gap: 0 },
  inputRow: {
    flexDirection: 'row', alignItems: 'flex-start',
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: COLORS.bloomBorder,
  },
  inputRowLabel: { width: 100, fontSize: 13, fontWeight: '600', color: COLORS.bloomMuted },
  inputRowValue: { flex: 1, fontSize: 14, fontWeight: '600', color: COLORS.bloomText, textTransform: 'capitalize' },

  regenTutorialBtn: {
    backgroundColor: COLORS.bloomActiveBg, borderRadius: 12, paddingVertical: 13,
    alignItems: 'center', marginTop: 4,
  },
  regenTutorialBtnText: { fontSize: 14, fontWeight: '700', color: COLORS.bloomAccent },

  // Frame editor modal
  editorContainer: { flex: 1, backgroundColor: COLORS.bloomBody },
  editorHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingTop: 56, paddingBottom: 16,
    backgroundColor: COLORS.bloomCard, borderBottomWidth: 1, borderBottomColor: COLORS.bloomBorder,
  },
  editorTitle: { fontSize: 18, fontWeight: '800', color: COLORS.bloomText },
  editorClose: { padding: 4 },
  editorCloseText: { fontSize: 22, color: COLORS.bloomMuted },
  editorContent: { flex: 1 },
  editorSection: { paddingHorizontal: 20, paddingVertical: 16 },
  editorDivider: { height: 1, backgroundColor: COLORS.bloomBorder, marginHorizontal: 20 },
  editorFieldRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  editorFieldLabel: { fontSize: 13, fontWeight: '700', color: COLORS.bloomMuted, textTransform: 'uppercase', letterSpacing: 0.5 },
  editorFieldValue: { fontSize: 15, color: COLORS.bloomText, lineHeight: 22 },
  editorPencilBtn: { padding: 4 },
  editorPencilText: { fontSize: 18 },
  editorInlineRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  editorInlineRowEnd: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 8 },
  editorInlineConfirm: {
    backgroundColor: COLORS.bloomAccent, borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 10, minWidth: 44, alignItems: 'center',
  },
  editorInlineConfirmText: { color: COLORS.bloomOnAccent, fontWeight: '700', fontSize: 13 },
  editorInlineDismiss: {
    backgroundColor: COLORS.bloomBorder, borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 10, alignItems: 'center',
  },
  editorInlineDismissText: { color: COLORS.bloomText, fontWeight: '600', fontSize: 13 },
  editorImageSection: { padding: 20, backgroundColor: '#F0F4FF' },
  editorImage: { width: '100%', height: 180, borderRadius: 14, marginBottom: 14 },
  editorInput: {
    backgroundColor: COLORS.bloomCard, borderRadius: 12, borderWidth: 1, borderColor: COLORS.bloomBorder,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: COLORS.bloomText,
  },
  regenBtn: {
    flexDirection: 'row', justifyContent: 'center',
    backgroundColor: COLORS.bloomActiveBg, borderRadius: 10, paddingVertical: 12,
  },
  regenBtnDisabled: { opacity: 0.5 },
  regenBtnText: { color: COLORS.bloomAccent, fontWeight: '700', fontSize: 14 },
  editorActions: {
    padding: 20, paddingBottom: 36,
    backgroundColor: COLORS.bloomCard, borderTopWidth: 1, borderTopColor: COLORS.bloomBorder,
  },
  editorDoneBtn: { paddingVertical: 14, borderRadius: 12, alignItems: 'center', backgroundColor: COLORS.bloomAccent },
  editorDoneBtnText: { fontWeight: '700', color: COLORS.bloomOnAccent, fontSize: 15 },
});
