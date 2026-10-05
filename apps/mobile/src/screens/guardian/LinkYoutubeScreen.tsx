import React, { useState } from 'react';
import {
  View, TextInput, TouchableOpacity, StyleSheet, Image,
  ActivityIndicator, ScrollView, Alert, Dimensions,
} from 'react-native';
import AppText from '../../components/AppText';
import RainbowDivider from '../../components/RainbowDivider';
import useNicoHeader from '../../hooks/useNicoHeader';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/AuthContext';
import { GuardianNavParamList } from '../../navigation';
import {
  NICO, SPACING, RADIUS, SHADOW, FONT_SIZE, FONT_WEIGHT,
  BTN_SIZE, BTN_VARIANT, INPUT, BUTTERFLY_BORDER, scale,
} from '../../constants/theme';
import { LinearGradient } from 'expo-linear-gradient';

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

  useNicoHeader(navigation);

  const [url, setUrl]               = useState('');
  const [previewing, setPreviewing] = useState(false);
  const [saving, setSaving]         = useState(false);
  const [videoId, setVideoId]       = useState<string | null>(null);
  const [title, setTitle]           = useState('');
  const [thumbnail, setThumbnail]   = useState<string | null>(null);
  const [fetchError, setFetchError] = useState('');

  async function handlePreview() {
    setFetchError('');
    if (!url.trim()) { Alert.alert('Required', 'Please enter a YouTube URL.'); return; }
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

  function cancelPreview() {
    setUrl('');
    setVideoId(null);
    setTitle('');
    setThumbnail(null);
    setFetchError('');
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
    <View style={s.root}>
      <RainbowDivider />
      <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
        {/* Ads disclaimer */}
        <View style={s.disclaimerBanner}>
          <AppText style={s.disclaimerText}>
            ⚠️  YouTube videos may show ads. Co-Heart is not responsible for any ads. Please supervise the ads.
          </AppText>
        </View>

        {/* URL input */}
        <AppText style={s.label}>YouTube URL<AppText style={s.required}> *</AppText></AppText>
        <View style={s.inputRow}>
          <LinearGradient colors={[...BUTTERFLY_BORDER.colors]} start={BUTTERFLY_BORDER.start} end={BUTTERFLY_BORDER.end} style={s.urlInputGradient}>
            <TextInput
              style={s.urlInput}
              value={url}
              onChangeText={v => { setUrl(v); setVideoId(null); setFetchError(''); }}
              placeholder="https://www.youtube.com/watch?v=..."
              placeholderTextColor={NICO.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
            />
          </LinearGradient>
          <TouchableOpacity
            style={[s.previewBtn, (!url.trim() || previewing) && s.btnDisabled]}
            onPress={handlePreview}
            disabled={!url.trim() || previewing}
            activeOpacity={0.8}
          >
            {previewing
              ? <ActivityIndicator color={NICO.textOnAccent} />
              : <AppText style={s.previewBtnText}>Preview</AppText>
            }
          </TouchableOpacity>
        </View>

        {fetchError ? <AppText style={s.errorText}>{fetchError}</AppText> : null}

        {/* Preview card */}
        {videoId && (
          <View style={s.previewCard}>
            <TouchableOpacity
              style={s.closeBtn}
              onPress={cancelPreview}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              activeOpacity={0.75}
            >
              <AppText style={s.closeBtnText}>✕</AppText>
            </TouchableOpacity>
            {thumbnail && (
              <Image source={{ uri: thumbnail }} style={s.thumbImage} resizeMode="cover" />
            )}
            <AppText style={s.titleLabel}>Title (editable)</AppText>
            <LinearGradient colors={[...BUTTERFLY_BORDER.colors]} start={BUTTERFLY_BORDER.start} end={BUTTERFLY_BORDER.end} style={s.titleInputGradient}>
              <TextInput
                style={s.titleInput}
                value={title}
                onChangeText={setTitle}
                placeholder="Video title"
                placeholderTextColor={NICO.textMuted}
                maxLength={30}
              />
            </LinearGradient>
            <AppText style={s.videoIdNote}>Video ID: {videoId}</AppText>

            <TouchableOpacity
              style={[s.saveBtn, saving && s.btnDisabled]}
              onPress={handleSave}
              disabled={saving}
              activeOpacity={0.85}
            >
              {saving
                ? <ActivityIndicator color={NICO.textOnAccent} />
                : <AppText style={s.saveBtnText}>Save to My Tutorials</AppText>
              }
            </TouchableOpacity>
          </View>
        )}

        {/* How it works note */}
        <View style={s.infoCard}>
          <AppText style={s.infoTitle}>How this works</AppText>
          <AppText style={s.infoText}>• The video is not downloaded or stored — only the YouTube link is saved.</AppText>
          <AppText style={s.infoText}>• The video plays inside the Co-Heart app using YouTube's embedded player.</AppText>
          <AppText style={s.infoText}>• Saved as private — visible only to you.</AppText>
          <AppText style={s.infoText}>• No admin review needed for YouTube links.</AppText>
          <AppText style={s.infoText}>• Only <AppText style={s.infoTextBold}>public</AppText> YouTube videos can be linked. Private, unlisted, or age-restricted videos will not work.</AppText>
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root:    { flex: 1, backgroundColor: NICO.screenBg },
  content: { padding: SPACING.base, gap: SPACING.md, paddingBottom: 40 },

  disclaimerBanner: {
    backgroundColor: NICO.errorLight, borderRadius: RADIUS.md,
    borderLeftWidth: 4, borderLeftColor: NICO.error,
    padding: SPACING.md,
  },
  disclaimerText: { fontSize: FONT_SIZE.sm, color: NICO.text, lineHeight: 20, fontWeight: FONT_WEIGHT.bold },

  label: { fontSize: FONT_SIZE.md, fontWeight: FONT_WEIGHT.bold, color: NICO.text, marginBottom: -6 },
  required: { fontSize: FONT_SIZE['2xl'], fontWeight: FONT_WEIGHT.black, color: NICO.error },

  inputRow: { flexDirection: 'row', gap: SPACING.sm, alignItems: 'center' },
  urlInputGradient: { flex: 1, padding: BUTTERFLY_BORDER.width, borderRadius: RADIUS.md + BUTTERFLY_BORDER.width },
  urlInput:  { ...INPUT.base, borderWidth: 0 },
  previewBtn: { ...BTN_SIZE.md, ...BTN_VARIANT.primary, minWidth: scale(90) },
  previewBtnText: { color: NICO.textOnAccent, fontWeight: FONT_WEIGHT.extraBold, fontSize: FONT_SIZE.sm },
  btnDisabled: { opacity: 0.5 },

  errorText: { fontSize: FONT_SIZE.sm, color: NICO.error, fontWeight: FONT_WEIGHT.medium },

  previewCard: {
    backgroundColor: NICO.surface, borderRadius: RADIUS.xl, overflow: 'hidden',
    borderWidth: 1, borderColor: NICO.border, position: 'relative',
    ...SHADOW.sm,
  },
  closeBtn: {
    position: 'absolute', top: SPACING.sm, right: SPACING.sm, zIndex: 2,
    width: scale(32), height: scale(32), borderRadius: scale(16),
    backgroundColor: 'rgba(255,255,255,0.92)',
    justifyContent: 'center', alignItems: 'center',
    ...SHADOW.sm,
  },
  closeBtnText: { fontSize: FONT_SIZE.lg, fontWeight: FONT_WEIGHT.black, color: NICO.text },
  thumbImage:   { width: '100%', height: width * 0.5, backgroundColor: NICO.background },
  titleLabel:   { fontSize: FONT_SIZE.xs, fontWeight: FONT_WEIGHT.bold, color: NICO.textMuted, marginTop: SPACING.md, marginHorizontal: SPACING.base },
  titleInputGradient: { marginHorizontal: SPACING.base, marginTop: SPACING.xs, padding: BUTTERFLY_BORDER.width, borderRadius: RADIUS.md + BUTTERFLY_BORDER.width },
  titleInput: { ...INPUT.base, borderWidth: 0 },
  videoIdNote: { fontSize: FONT_SIZE.xs, color: NICO.textMuted, marginHorizontal: SPACING.base, marginTop: SPACING.xs },
  saveBtn:     { ...BTN_SIZE.lg, ...BTN_VARIANT.primary, margin: SPACING.base },
  saveBtnText: { color: NICO.textOnAccent, fontWeight: FONT_WEIGHT.extraBold, fontSize: FONT_SIZE.md },

  infoCard: {
    backgroundColor: NICO.surface, borderRadius: RADIUS.xl, padding: SPACING.base, gap: SPACING.sm,
    borderWidth: 1, borderColor: NICO.border,
    ...SHADOW.sm,
  },
  infoTitle:    { fontSize: FONT_SIZE.md, fontWeight: FONT_WEIGHT.extraBold, color: NICO.text, marginBottom: 2 },
  infoText:     { fontSize: FONT_SIZE.sm, color: NICO.text, lineHeight: 20, fontWeight: FONT_WEIGHT.semiBold },
  infoTextBold: { fontWeight: FONT_WEIGHT.extraBold, color: NICO.text },
});
