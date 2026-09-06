import React, { useState } from 'react';
import {
  View, TextInput, TouchableOpacity, StyleSheet, Image,
  ActivityIndicator, ScrollView, Alert, Dimensions,
} from 'react-native';
import AppText from '../../components/AppText';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/AuthContext';
import { COLORS } from '../../constants';
import { GuardianNavParamList } from '../../navigation';

const { width } = Dimensions.get('window');
type NavProp = NativeStackNavigationProp<GuardianNavParamList>;

function extractVideoId(raw: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
  ];
  for (const p of patterns) {
    const m = raw.match(p);
    if (m) return m[1];
  }
  return null;
}

export default function LinkYoutubeScreen() {
  const navigation = useNavigation<NavProp>();
  const { guardian } = useAuth();

  const [url, setUrl]               = useState('');
  const [previewing, setPreviewing] = useState(false);
  const [saving, setSaving]         = useState(false);
  const [videoId, setVideoId]       = useState<string | null>(null);
  const [title, setTitle]           = useState('');
  const [thumbnail, setThumbnail]   = useState<string | null>(null);
  const [fetchError, setFetchError] = useState('');

  async function handlePreview() {
    setFetchError('');
    const id = extractVideoId(url.trim());
    if (!id) {
      setFetchError('Could not find a valid YouTube video ID. Please check the URL.');
      return;
    }
    setPreviewing(true);
    try {
      const oembedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${id}&format=json`;
      const res = await fetch(oembedUrl);
      if (!res.ok) throw new Error('Video not found or not embeddable.');
      const data = await res.json();
      setVideoId(id);
      setTitle(data.title ?? '');
      setThumbnail(data.thumbnail_url ?? null);
    } catch (e: any) {
      setFetchError(e.message ?? 'Could not load video info. Check the URL and try again.');
      setVideoId(null);
    } finally {
      setPreviewing(false);
    }
  }

  async function handleSave() {
    if (!videoId || !guardian) return;
    setSaving(true);
    const embedUrl = `https://www.youtube.com/embed/${videoId}?rel=0&modestbranding=1&fs=0`;
    const { error } = await supabase.from('tutorials').insert({
      title:                  title || 'YouTube Video',
      display_name:           title || 'YouTube Video',
      description:            'Linked YouTube video',
      category:               'YouTube',
      format:                 'video',
      topic:                  null,
      comprehension_level:    'easy',
      duration_seconds:       null,
      ai_prompt:              null,
      status:                 'approved',
      source:                 'youtube',
      created_by_guardian_id: guardian.id,
      video_url:              embedUrl,
      thumbnail_url:          thumbnail ?? null,
      is_public:              false,
    });
    setSaving(false);
    if (error) {
      Alert.alert('Save failed', error.message);
      return;
    }
    Alert.alert('Saved!', 'YouTube video added to your tutorials.', [
      { text: 'OK', onPress: () => navigation.goBack() },
    ]);
  }

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      {/* Ads disclaimer */}
      <View style={styles.disclaimerBanner}>
        <AppText style={styles.disclaimerText}>
          ⚠️  YouTube videos may show ads. For a distraction-free learner experience, consider using ad-free sources.
        </AppText>
      </View>

      {/* URL input */}
      <AppText style={styles.label}>YouTube URL</AppText>
      <View style={styles.inputRow}>
        <TextInput
          style={styles.urlInput}
          value={url}
          onChangeText={v => { setUrl(v); setVideoId(null); setFetchError(''); }}
          placeholder="https://www.youtube.com/watch?v=..."
          placeholderTextColor={COLORS.bloomMuted}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
        />
        <TouchableOpacity
          style={[styles.previewBtn, (!url.trim() || previewing) && { opacity: 0.5 }]}
          onPress={handlePreview}
          disabled={!url.trim() || previewing}
          activeOpacity={0.8}
        >
          {previewing
            ? <ActivityIndicator color={COLORS.bloomOnAccent} />
            : <AppText style={styles.previewBtnText}>Preview</AppText>
          }
        </TouchableOpacity>
      </View>

      {fetchError ? <AppText style={styles.errorText}>{fetchError}</AppText> : null}

      {/* Preview card */}
      {videoId && (
        <View style={styles.previewCard}>
          {thumbnail && (
            <Image source={{ uri: thumbnail }} style={styles.thumbImage} resizeMode="cover" />
          )}
          <AppText style={styles.titleLabel}>Title (editable)</AppText>
          <TextInput
            style={styles.titleInput}
            value={title}
            onChangeText={setTitle}
            placeholder="Video title"
            placeholderTextColor={COLORS.bloomMuted}
          />
          <AppText style={styles.videoIdNote}>Video ID: {videoId}</AppText>

          <TouchableOpacity
            style={[styles.saveBtn, saving && { opacity: 0.6 }]}
            onPress={handleSave}
            disabled={saving}
            activeOpacity={0.85}
          >
            {saving
              ? <ActivityIndicator color={COLORS.bloomOnAccent} />
              : <AppText style={styles.saveBtnText}>Save to My Tutorials</AppText>
            }
          </TouchableOpacity>
        </View>
      )}

      {/* How it works note */}
      <View style={styles.infoCard}>
        <AppText style={styles.infoTitle}>How this works</AppText>
        <AppText style={styles.infoText}>• The video is not downloaded or stored — only the YouTube link is saved.</AppText>
        <AppText style={styles.infoText}>• The video plays inside the ELIS app using YouTube's embedded player.</AppText>
        <AppText style={styles.infoText}>• Saved as private — visible only to you and your learner.</AppText>
        <AppText style={styles.infoText}>• No admin review needed for YouTube links.</AppText>
        <AppText style={styles.infoText}>• Only <AppText style={styles.infoTextBold}>public</AppText> YouTube videos can be linked. Private, unlisted, or age-restricted videos will not work.</AppText>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root:    { flex: 1, backgroundColor: COLORS.bloomBody },
  content: { padding: 16, gap: 14, paddingBottom: 40 },

  disclaimerBanner: {
    backgroundColor: '#FEF3CD', borderRadius: 14, padding: 14,
    borderWidth: 1.5, borderColor: '#F6D860',
  },
  disclaimerText: { fontSize: 13, color: '#92640A', lineHeight: 20 },

  label: { fontSize: 14, fontWeight: '700', color: COLORS.bloomText, marginBottom: -6 },

  inputRow: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  urlInput: {
    flex: 1, backgroundColor: COLORS.bloomCard, borderRadius: 14,
    borderWidth: 1.5, borderColor: COLORS.bloomBorder,
    paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 14, color: COLORS.bloomText,
  },
  previewBtn: {
    backgroundColor: COLORS.bloomAccent, borderRadius: 14,
    paddingHorizontal: 18, paddingVertical: 13, minWidth: 80, alignItems: 'center',
  },
  previewBtnText: { color: COLORS.bloomOnAccent, fontWeight: '800', fontSize: 14 },

  errorText: { fontSize: 13, color: COLORS.error, fontWeight: '500' },

  previewCard: {
    backgroundColor: COLORS.bloomCard, borderRadius: 18, overflow: 'hidden',
    borderWidth: 1.5, borderColor: COLORS.bloomBorder,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 8, elevation: 3,
  },
  thumbImage:   { width: '100%', height: width * 0.5, backgroundColor: COLORS.bloomActiveBg },
  titleLabel:   { fontSize: 12, fontWeight: '700', color: COLORS.bloomMuted, marginTop: 14, marginHorizontal: 16 },
  titleInput: {
    marginHorizontal: 16, marginTop: 6,
    backgroundColor: COLORS.bloomBody, borderRadius: 10,
    borderWidth: 1.5, borderColor: COLORS.bloomBorder,
    paddingHorizontal: 12, paddingVertical: 10,
    fontSize: 15, fontWeight: '600', color: COLORS.bloomText,
  },
  videoIdNote: { fontSize: 11, color: COLORS.bloomMuted, marginHorizontal: 16, marginTop: 6 },
  saveBtn: {
    margin: 16, backgroundColor: COLORS.bloomAccent, borderRadius: 14,
    paddingVertical: 14, alignItems: 'center',
  },
  saveBtnText: { color: COLORS.bloomOnAccent, fontWeight: '800', fontSize: 15 },

  infoCard: {
    backgroundColor: COLORS.bloomActiveBg, borderRadius: 16, padding: 16, gap: 8,
    borderWidth: 1.5, borderColor: COLORS.bloomSageMid,
  },
  infoTitle:     { fontSize: 14, fontWeight: '800', color: COLORS.bloomText, marginBottom: 2 },
  infoText:      { fontSize: 13, color: COLORS.bloomText, lineHeight: 20 },
  infoTextBold:  { fontWeight: '800', color: COLORS.bloomText },
});
