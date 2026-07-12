import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, Image, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, Alert, ActivityIndicator, Modal, Dimensions,
} from 'react-native';
import { useFocusEffect, useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { supabase } from '../../lib/supabase';
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
  approved:   { bg: '#D1FAE5', text: '#065F46' },
  rejected:   { bg: '#FEE2E2', text: '#991B1B' },
};
const STATUS_LABELS: Record<TutorialStatus, string> = {
  generating: 'Generating…',
  preview:    'Review Needed',
  pending:    'Pending Admin Review',
  approved:   'Approved',
  rejected:   'Rejected by Admin',
};

export default function TutorialPreviewScreen() {
  const navigation = useNavigation<NavProp>();
  const route = useRoute<RouteType>();
  const { tutorialId } = route.params;

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

  // Play audio on frame change
  useEffect(() => {
    if (!currentAudioUrl) return;
    player.seekTo(0);
    player.play();
  }, [frameIndex, currentAudioUrl]);

  // Detect stored audio finishing → auto-advance
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
  const [savingFrame, setSavingFrame] = useState(false);
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

  async function saveFrameEdits() {
    if (!editingFrame || !tutorial) return;
    setSavingFrame(true);
    try {
      const ttsChanged = editTts !== editingFrame.tts_text;
      const { data, error } = await supabase.functions.invoke('regenerate-frame', {
        body: {
          frame_id: editingFrame.id,
          tts_text: editTts,
          // pass image_prompt only if caption changed, to update caption text in DB
          // audio is auto-regenerated by the edge function when tts_text is provided
        },
      });
      if (error || data?.error) throw new Error(data?.error ?? error?.message);
      const updatedFrame = data.frame as TutorialFrame;
      // Also persist caption (regenerate-frame doesn't handle caption separately)
      if (editCaption !== editingFrame.caption) {
        await supabase.from('tutorial_frames').update({ caption: editCaption }).eq('id', editingFrame.id);
        updatedFrame.caption = editCaption;
      }
      setTutorial(prev => {
        if (!prev) return prev;
        return { ...prev, frames: prev.frames.map(f => f.id === updatedFrame.id ? updatedFrame : f) };
      });
      setEditingFrame(null);
    } catch (err: unknown) {
      Alert.alert('Save failed', err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setSavingFrame(false);
    }
  }

  async function regenerateFrameImage() {
    if (!editingFrame) return;
    const imagePrompt = editImagePrompt.trim()
      || (editCaption
        ? `${tutorial?.topic ?? ''} — ${editCaption}: ${editTts}`
        : `${tutorial?.topic ?? ''}: ${editTts}`);
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

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color={COLORS.primary} /></View>;
  }

  if (!tutorial) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Tutorial not found</Text>
      </View>
    );
  }

  if (tutorial.status === 'generating') {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.generatingText}>AI is creating your tutorial…</Text>
        <Text style={styles.generatingHint}>This usually takes 30–60 seconds</Text>
      </View>
    );
  }

  const frames = tutorial.frames ?? [];
  const currentFrame = frames[frameIndex];

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Status banner */}
        <View style={[styles.statusBanner, { backgroundColor: STATUS_COLORS[tutorial.status as TutorialStatus].bg }]}>
          <Text style={[styles.statusBannerText, { color: STATUS_COLORS[tutorial.status as TutorialStatus].text }]}>
            {STATUS_LABELS[tutorial.status as TutorialStatus]}
          </Text>
        </View>

        {/* Rejected admin notes */}
        {tutorial.status === 'rejected' && tutorial.admin_notes && (
          <View style={styles.adminNotesCard}>
            <Text style={styles.adminNotesLabel}>Admin Notes</Text>
            <Text style={styles.adminNotesText}>{tutorial.admin_notes}</Text>
          </View>
        )}

        {/* Tutorial title + meta */}
        <Text style={styles.title}>{tutorial.display_name || tutorial.category}</Text>
        <View style={styles.metaRow}>
          {tutorial.duration_seconds && <MetaBadge text={`${tutorial.duration_seconds}s`} />}
          <MetaBadge text={tutorial.format} />
          <MetaBadge text={tutorial.comprehension_level} />
          {tutorial.link_count > 0 && <MetaBadge text={`🔗 ${tutorial.link_count} user${tutorial.link_count > 1 ? 's' : ''}`} color={COLORS.secondary} />}
        </View>

        {/* Frame viewer */}
        {frames.length > 0 && (
          <View style={styles.frameContainer}>
            <View style={styles.frameHeader}>
              <Text style={styles.frameCounter}>Frame {frameIndex + 1} of {frames.length}</Text>
              <View style={styles.frameHeaderActions}>
                <TouchableOpacity
                  style={[styles.autoPlayBtn, autoPlay && styles.autoPlayBtnActive]}
                  onPress={() => {
                    if (!autoPlay) { setFrameIndex(0); setAutoPlay(true); }
                    else setAutoPlay(false);
                  }}
                  disabled={(tutorial?.frames?.length ?? 0) <= 1}
                >
                  <Text style={[styles.autoPlayBtnText, autoPlay && { color: '#fff' }]}>
                    {autoPlay ? '⏸' : '▶'}
                  </Text>
                </TouchableOpacity>
                {currentFrame?.audio_url && (
                  <TouchableOpacity
                    style={styles.audioBtn}
                    onPress={() => playerStatus.playing ? player.pause() : player.play()}
                  >
                    <Text style={styles.audioBtnText}>{playerStatus.playing ? '⏸' : '🔊'}</Text>
                  </TouchableOpacity>
                )}
                {['preview', 'rejected'].includes(tutorial.status) && (
                  <TouchableOpacity
                    style={styles.editBtn}
                    onPress={() => {
                      if (currentFrame) {
                        setEditCaption(currentFrame.caption ?? '');
                        setEditTts(currentFrame.tts_text ?? '');
                        setEditImagePrompt(currentFrame.image_prompt ?? '');
                        setEditingFrame(currentFrame);
                      }
                    }}
                  >
                    <Text style={styles.editBtnText}>Edit ✏️</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {/* Frame image */}
            <View style={styles.frameImage}>
              {currentFrame?.image_url
                ? <Image source={{ uri: currentFrame.image_url }} style={styles.image} resizeMode="contain" />
                : (
                  <View style={styles.imagePlaceholder}>
                    <Text style={styles.imagePlaceholderEmoji}>🖼</Text>
                    <Text style={styles.imagePlaceholderText}>No image</Text>
                  </View>
                )
              }
            </View>

            {/* Caption + narration */}
            <View style={styles.frameText}>
              {currentFrame?.caption && (
                <Text style={styles.caption}>{currentFrame.caption}</Text>
              )}
              {currentFrame?.tts_text && (
                <Text style={styles.narration}>{currentFrame.tts_text}</Text>
              )}
            </View>

            {/* Frame navigation */}
            <View style={styles.frameNav}>
              <TouchableOpacity
                style={[styles.navBtn, frameIndex === 0 && styles.navBtnDisabled]}
                onPress={() => setFrameIndex(i => Math.max(0, i - 1))}
                disabled={frameIndex === 0}
              >
                <Text style={styles.navBtnText}>← Prev</Text>
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
                <Text style={styles.navBtnText}>Next →</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Action buttons */}
        <View style={styles.actions}>
          {tutorial.status === 'preview' && (
            <TouchableOpacity
              style={[styles.actionBtn, styles.actionBtnPrimary, submitting && styles.actionBtnDisabled]}
              onPress={submitForReview}
              disabled={submitting}
            >
              {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.actionBtnTextPrimary}>Submit for Review</Text>}
            </TouchableOpacity>
          )}
          {tutorial.status === 'pending' && (
            <TouchableOpacity style={[styles.actionBtn, styles.actionBtnWarning]} onPress={withdrawFromReview}>
              <Text style={styles.actionBtnTextPrimary}>Withdraw from Review</Text>
            </TouchableOpacity>
          )}
          {tutorial.status === 'rejected' && (
            <TouchableOpacity
              style={[styles.actionBtn, styles.actionBtnPrimary, submitting && styles.actionBtnDisabled]}
              onPress={submitForReview}
              disabled={submitting}
            >
              {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.actionBtnTextPrimary}>Resubmit for Review</Text>}
            </TouchableOpacity>
          )}
          {tutorial.status === 'approved' && (
            <View style={styles.approvedBanner}>
              <Text style={styles.approvedText}>✅ This tutorial is live in the shared library</Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Frame editor modal */}
      <Modal visible={!!editingFrame} animationType="slide" onRequestClose={() => setEditingFrame(null)}>
        <View style={styles.editorContainer}>
          <View style={styles.editorHeader}>
            <Text style={styles.editorTitle}>Edit Frame {(editingFrame ? frames.indexOf(editingFrame) : 0) + 1}</Text>
            <TouchableOpacity onPress={() => setEditingFrame(null)} style={styles.editorClose}>
              <Text style={styles.editorCloseText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.editorContent}>
            {/* Frame image preview */}
            {editingFrame?.image_url && (
              <Image source={{ uri: editingFrame.image_url }} style={styles.editorImage} resizeMode="cover" />
            )}

            <Text style={styles.editorFieldLabel}>Image prompt</Text>
            <TextInput
              style={[styles.editorInput, { height: 72 }]}
              value={editImagePrompt}
              onChangeText={(t) => setEditImagePrompt(t.slice(0, 60))}
              placeholder="Describe the image you want for this slide…"
              placeholderTextColor={COLORS.textLight}
              maxLength={60}
              multiline
              textAlignVertical="top"
            />
            <Text style={styles.charCount}>{editImagePrompt.length}/60</Text>

            <TouchableOpacity
              style={[styles.regenBtn, regeneratingImage && styles.regenBtnDisabled]}
              onPress={regenerateFrameImage}
              disabled={regeneratingImage}
            >
              {regeneratingImage
                ? <ActivityIndicator color={COLORS.primary} size="small" />
                : <Text style={styles.regenBtnText}>🔄 Regenerate image</Text>
              }
            </TouchableOpacity>

            <Text style={styles.editorFieldLabel}>Caption (max 4 words)</Text>
            <TextInput
              style={styles.editorInput}
              value={editCaption}
              onChangeText={setEditCaption}
              placeholder="e.g. Tap the ball"
              placeholderTextColor={COLORS.textLight}
              maxLength={40}
            />

            <Text style={styles.editorFieldLabel}>Narration text (spoken aloud)</Text>
            <TextInput
              style={[styles.editorInput, { height: 80 }]}
              value={editTts}
              onChangeText={setEditTts}
              placeholder="e.g. Use the inside of your foot to tap the ball forward."
              placeholderTextColor={COLORS.textLight}
              multiline
              textAlignVertical="top"
            />
          </ScrollView>

          <View style={styles.editorActions}>
            <TouchableOpacity style={styles.editorCancel} onPress={() => setEditingFrame(null)} disabled={savingFrame}>
              <Text style={styles.editorCancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.editorSave, savingFrame && { opacity: 0.6 }]} onPress={saveFrameEdits} disabled={savingFrame}>
              {savingFrame
                ? <ActivityIndicator size="small" color="#fff" />
                : <Text style={styles.editorSaveText}>Save Changes</Text>
              }
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function MetaBadge({ text, color }: { text: string; color?: string }) {
  return (
    <View style={[styles.metaBadge, color ? { backgroundColor: `${color}22`, borderColor: color } : {}]}>
      <Text style={[styles.metaBadgeText, color ? { color } : {}]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: 16, paddingBottom: 48 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12, padding: 32 },
  errorText: { fontSize: 16, color: COLORS.textLight },
  generatingText: { fontSize: 18, fontWeight: '700', color: COLORS.text, textAlign: 'center' },
  generatingHint: { fontSize: 14, color: COLORS.textLight, textAlign: 'center' },

  statusBanner: { borderRadius: 14, paddingHorizontal: 16, paddingVertical: 12, marginBottom: 14, alignItems: 'center' },
  statusBannerText: { fontWeight: '800', fontSize: 15 },

  adminNotesCard: { backgroundColor: '#FFF5F5', borderRadius: 12, borderWidth: 1.5, borderColor: COLORS.error, padding: 14, marginBottom: 12 },
  adminNotesLabel: { fontSize: 12, fontWeight: '700', color: COLORS.error, marginBottom: 4 },
  adminNotesText: { fontSize: 14, color: COLORS.text, lineHeight: 20 },

  title: { fontSize: 22, fontWeight: '800', color: COLORS.text, marginBottom: 10 },
  metaRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginBottom: 20 },
  metaBadge: {
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10,
    backgroundColor: COLORS.primaryLight, borderWidth: 1, borderColor: COLORS.primary,
  },
  metaBadgeText: { fontSize: 12, fontWeight: '600', color: COLORS.primary, textTransform: 'capitalize' },

  frameContainer: { backgroundColor: COLORS.surface, borderRadius: 20, overflow: 'hidden', marginBottom: 20 },
  frameHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14 },
  frameCounter: { fontSize: 13, fontWeight: '600', color: COLORS.textLight },
  frameHeaderActions: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  autoPlayBtn: {
    backgroundColor: COLORS.primaryLight, borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: COLORS.primary,
  },
  autoPlayBtnActive: { backgroundColor: COLORS.primary },
  autoPlayBtnText: { fontSize: 13, fontWeight: '700', color: COLORS.primary },
  audioBtn: { backgroundColor: '#F0FDF4', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  audioBtnText: { fontSize: 16 },
  editBtn: { backgroundColor: COLORS.primaryLight, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  editBtnText: { fontSize: 13, fontWeight: '700', color: COLORS.primary },

  frameImage: { width: '100%', aspectRatio: 1, backgroundColor: '#000' },
  image: { width: '100%', height: '100%' },
  imagePlaceholder: {
    width: '100%', height: '100%',
    backgroundColor: COLORS.primaryLight, justifyContent: 'center', alignItems: 'center', gap: 8,
  },
  imagePlaceholderEmoji: { fontSize: 48 },
  imagePlaceholderText: { fontSize: 14, color: COLORS.textLight },

  frameText: { padding: 18, gap: 10 },
  caption: { fontSize: 22, fontWeight: '800', color: COLORS.text },
  narration: { fontSize: 16, color: COLORS.text, lineHeight: 24, opacity: 0.75 },

  frameNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 16 },
  navBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10, backgroundColor: COLORS.primaryLight },
  navBtnDisabled: { opacity: 0.3 },
  navBtnText: { fontSize: 13, fontWeight: '700', color: COLORS.primary },
  frameDots: { flexDirection: 'row', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.border },
  dotActive: { backgroundColor: COLORS.primary, width: 20 },

  actions: { gap: 12 },
  actionBtn: { borderRadius: 14, paddingVertical: 15, alignItems: 'center' },
  actionBtnPrimary: { backgroundColor: COLORS.primary, shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 6 },
  actionBtnWarning: { backgroundColor: COLORS.warning },
  actionBtnDisabled: { opacity: 0.5 },
  actionBtnTextPrimary: { color: '#fff', fontWeight: '800', fontSize: 15 },
  approvedBanner: { backgroundColor: '#D4F0DE', borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  approvedText: { color: COLORS.success, fontWeight: '700', fontSize: 14 },

  // Frame editor modal
  editorContainer: { flex: 1, backgroundColor: COLORS.background },
  editorHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingTop: 56, paddingBottom: 16,
    backgroundColor: COLORS.surface, borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  editorTitle: { fontSize: 18, fontWeight: '800', color: COLORS.text },
  editorClose: { padding: 4 },
  editorCloseText: { fontSize: 22, color: COLORS.textLight },
  editorContent: { flex: 1, padding: 20 },
  editorImage: { width: '100%', height: 200, borderRadius: 16, marginBottom: 12 },
  regenBtn: {
    flexDirection: 'row', justifyContent: 'center',
    backgroundColor: COLORS.primaryLight, borderRadius: 10, paddingVertical: 10, marginBottom: 6,
  },
  regenBtnDisabled: { opacity: 0.5 },
  regenBtnText: { color: COLORS.primary, fontWeight: '700', fontSize: 14 },
  regenNote: { fontSize: 11, color: COLORS.textLight, textAlign: 'center', marginBottom: 20 },
  charCount: { fontSize: 11, color: COLORS.textLight, textAlign: 'right', marginTop: 2 },
  editorFieldLabel: { fontSize: 14, fontWeight: '600', color: COLORS.text, marginBottom: 6, marginTop: 16 },
  editorInput: {
    backgroundColor: COLORS.surface, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: COLORS.text,
  },
  editorActions: {
    flexDirection: 'row', gap: 12, padding: 20, paddingBottom: 36,
    backgroundColor: COLORS.surface, borderTopWidth: 1, borderTopColor: COLORS.border,
  },
  editorCancel: { flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: 'center', backgroundColor: COLORS.border },
  editorCancelText: { fontWeight: '700', color: COLORS.text },
  editorSave: { flex: 2, paddingVertical: 14, borderRadius: 12, alignItems: 'center', backgroundColor: COLORS.primary },
  editorSaveText: { fontWeight: '700', color: '#fff' },
});
