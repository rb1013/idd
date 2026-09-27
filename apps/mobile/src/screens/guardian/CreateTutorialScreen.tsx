import React, { useEffect, useState } from 'react';
import {
  View, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, Alert, ActivityIndicator, Modal,
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
  NICO, TEXT_STYLE, SPACING, RADIUS, SHADOW, FONT_SIZE, FONT_WEIGHT,
  BTN_SIZE, BTN_VARIANT, INPUT, BUTTERFLY_BORDER, BUTTERFLY_TILES, scale,
} from '../../constants/theme';
import { LinearGradient } from 'expo-linear-gradient';

// Defaults saved to every tutorial. To re-enable guardian customisation,
// convert each field back to useState initialised from this object.
const TUTORIAL_DEFAULTS = {
  visual_style: '2D Animation',
  image_style: 'Simple & Bold',
  pacing: 0.5,              // 'normal'
  tone: 0.5,                // 'calm'
  comprehension_level: 'easy',
  background_audio: 'None',
} as const;

export default function CreateTutorialScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<GuardianNavParamList>>();
  const { guardian } = useAuth();

  useNicoHeader(navigation);

  const [targetSkill, setTargetSkill] = useState('');
  const [coreAction, setCoreAction] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [quota, setQuota] = useState<{ used: number; limit: number } | null>(null);
  const [defaultDuration, setDefaultDuration] = useState(25);
  const [targetSkills, setTargetSkills] = useState<string[]>([]);
  const [showSkillPicker, setShowSkillPicker] = useState(false);

  const title = [targetSkill, coreAction].filter(Boolean).join(': ');

  useEffect(() => {
    if (guardian) loadQuota(guardian.id);
    supabase.from('tutorial_skills').select('label').order('label')
      .then(({ data }) => setTargetSkills((data ?? []).map((r: any) => r.label)));
  }, [guardian]);

  async function loadQuota(guardianId: string) {
    const [{ data }, { data: settings }] = await Promise.all([
      supabase.from('guardian_tutorial_quota').select('count').eq('guardian_id', guardianId).eq('month', new Date().toISOString().slice(0, 7)).single(),
      supabase.from('app_settings').select('tutorial_quota_limit, tutorial_default_duration').single(),
    ]);
    const limit = settings?.tutorial_quota_limit ?? 10;
    setQuota({ used: data?.count ?? 0, limit });
    if (settings?.tutorial_default_duration) setDefaultDuration(settings.tutorial_default_duration);
  }

  async function handleSubmit() {
    if (!targetSkill) { Alert.alert('Required', 'Please select a target skill'); return; }
    if (!coreAction.trim()) { Alert.alert('Required', 'Please describe the core action'); return; }
    if (!guardian) return;
    if (quota && quota.used >= quota.limit) {
      Alert.alert('Quota Reached', `You have used all ${quota.limit} tutorials for this month.`); return;
    }

    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-tutorial', {
        body: {
          guardian_id: guardian.id,
          title,
          display_name: displayName.trim() || null,
          target_skill: targetSkill,
          core_action: coreAction.trim(),
          format: 'slideshow',
          visual_style: TUTORIAL_DEFAULTS.visual_style,
          image_style: TUTORIAL_DEFAULTS.image_style,
          pacing: TUTORIAL_DEFAULTS.pacing,
          tone: TUTORIAL_DEFAULTS.tone,
          duration_seconds: defaultDuration,
          comprehension_level: TUTORIAL_DEFAULTS.comprehension_level,
          language: 'English',
          background_audio: TUTORIAL_DEFAULTS.background_audio,
          is_public: isPublic,
        },
      });
      if (error || data?.error) throw new Error(data?.error ?? error?.message);
      navigation.replace('Learning', { initialTab: 'pending' });
    } catch (err: unknown) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Something went wrong.');
      setSubmitting(false);
    }
  }

  return (
    <ScrollView
      style={s.container}
      contentContainerStyle={s.content}
      keyboardShouldPersistTaps="handled"
    >
      <RainbowDivider />

      {/* Quota pill */}
      {quota && (
        <View style={s.quotaPill}>
          <AppText style={s.quotaLabel}>Monthly quota</AppText>
          <AppText style={[s.quotaCount, quota.used >= quota.limit && { color: NICO.error }]}>
            {quota.used} / {quota.limit} used
          </AppText>
        </View>
      )}

      <View style={s.infoBanner}>
        <AppText style={s.infoText}>ℹ️  Shared tutorials are reviewed by an admin before becoming visible to other guardians.</AppText>
      </View>

      {/* Form card */}
      <View style={s.formCard}>
        <FieldBlock label="Target Skill *">
          <LinearGradient
            colors={[...BUTTERFLY_BORDER.colors]}
            start={BUTTERFLY_BORDER.start}
            end={BUTTERFLY_BORDER.end}
            style={s.selectGradient}
          >
            <TouchableOpacity style={s.selectRow} onPress={() => setShowSkillPicker(true)} activeOpacity={0.75}>
              <AppText style={[s.selectValue, !targetSkill && s.selectPlaceholder]}>
                {targetSkill || 'Select a skill…'}
              </AppText>
              {targetSkill
                ? <TouchableOpacity onPress={() => setTargetSkill('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <AppText style={s.selectClear}>✕</AppText>
                  </TouchableOpacity>
                : <AppText style={s.selectChevron}>›</AppText>
              }
            </TouchableOpacity>
          </LinearGradient>
        </FieldBlock>

        <Divider />

        <FieldBlock label="Core Action *" hint="e.g. Dribbling a soccer ball (max 60 chars)">
          <LinearGradient
            colors={[...BUTTERFLY_BORDER.colors]}
            start={BUTTERFLY_BORDER.start}
            end={BUTTERFLY_BORDER.end}
            style={s.inputGradient}
          >
            <TextInput
              style={s.input}
              value={coreAction}
              onChangeText={t => setCoreAction(t.slice(0, 60))}
              placeholder="Describe what the user will learn to do…"
              placeholderTextColor={NICO.textMuted}
              maxLength={60}
              returnKeyType="done"
            />
          </LinearGradient>
          <AppText style={s.charCount}>{coreAction.length}/60</AppText>
        </FieldBlock>

        <Divider />

        <FieldBlock label="Tutorial Name" hint="Short friendly name shown to your user (e.g. 'Soccer Fun'). Optional — auto-generated if left blank.">
          <LinearGradient
            colors={[...BUTTERFLY_BORDER.colors]}
            start={BUTTERFLY_BORDER.start}
            end={BUTTERFLY_BORDER.end}
            style={s.inputGradient}
          >
            <TextInput
              style={s.input}
              value={displayName}
              onChangeText={t => setDisplayName(t.slice(0, 60))}
              placeholder="Give it a name your user will recognise…"
              placeholderTextColor={NICO.textMuted}
              maxLength={60}
              returnKeyType="done"
            />
          </LinearGradient>
          <AppText style={s.charCount}>{displayName.length}/40</AppText>
        </FieldBlock>

        <Divider />

        <FieldBlock label="Share with other guardians" hint="When approved, this tutorial will appear in the shared library for all guardians to use.">
          <TouchableOpacity style={s.shareToggleRow} onPress={() => setIsPublic(v => !v)} activeOpacity={0.7}>
            <View style={[s.shareToggle, isPublic && s.shareToggleOn]}>
              <View style={[s.shareThumb, isPublic && s.shareThumbOn]} />
            </View>
          </TouchableOpacity>
        </FieldBlock>
      </View>

      {/* Submit */}
      <TouchableOpacity
        style={[s.submitBtn, submitting && s.submitBtnDisabled]}
        onPress={handleSubmit}
        disabled={submitting}
      >
        {submitting
          ? <ActivityIndicator color={NICO.textOnAccent} />
          : <AppText style={s.submitText}>✨  Create Tutorial</AppText>
        }
      </TouchableOpacity>
      <AppText style={s.footerNote}>AI generation takes upto 1-2 mins</AppText>

      <Modal visible={showSkillPicker} transparent animationType="slide" onRequestClose={() => setShowSkillPicker(false)}>
        <TouchableOpacity style={s.sheetBackdrop} activeOpacity={1} onPress={() => setShowSkillPicker(false)}>
          <View style={s.sheet} onStartShouldSetResponder={() => true}>
            <View style={s.sheetHdr}>
              <TouchableOpacity onPress={() => setShowSkillPicker(false)}>
                <AppText style={s.sheetCancel}>Cancel</AppText>
              </TouchableOpacity>
              <AppText style={s.sheetTitle}>Target Skill</AppText>
              <View style={{ width: 60 }} />
            </View>
            <ScrollView style={{ maxHeight: 360 }}>
              {targetSkills.map(skill => (
                <TouchableOpacity
                  key={skill}
                  style={[s.sheetOption, targetSkill === skill && s.sheetOptionActive]}
                  onPress={() => { setTargetSkill(skill); setShowSkillPicker(false); }}
                  activeOpacity={0.7}
                >
                  <AppText style={[s.sheetOptionText, targetSkill === skill && s.sheetOptionTextActive]}>{skill}</AppText>
                  {targetSkill === skill && <AppText style={s.sheetCheck}>✓</AppText>}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
    </ScrollView>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function FieldBlock({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <View style={s.fieldBlock}>
      <AppText style={s.fieldLabel}>{label}</AppText>
      {hint ? <AppText style={s.fieldHint}>{hint}</AppText> : null}
      {children}
    </View>
  );
}

function Divider() {
  return <View style={s.divider} />;
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: NICO.screenBg },
  content:   { padding: SPACING.base, paddingBottom: 120, gap: SPACING.md },

  quotaPill: {
    backgroundColor: NICO.primaryLight, borderRadius: RADIUS.lg,
    padding: 13, flexDirection: 'row',
    justifyContent: 'space-between', alignItems: 'center',
  },
  quotaLabel: { fontSize: FONT_SIZE.md, fontWeight: FONT_WEIGHT.semiBold, color: NICO.text },
  quotaCount: { fontSize: FONT_SIZE.md, fontWeight: FONT_WEIGHT.extraBold, color: NICO.primary },

  infoBanner: {
    backgroundColor: BUTTERFLY_TILES[2].bg, borderRadius: RADIUS.md,
    borderLeftWidth: 4, borderLeftColor: BUTTERFLY_TILES[2].accent,
    padding: SPACING.md,
  },
  infoText: { fontSize: FONT_SIZE.md, color: NICO.text, lineHeight: 20, fontWeight: FONT_WEIGHT.semiBold },

  formCard: {
    backgroundColor: NICO.surface, borderRadius: RADIUS.xl, padding: SPACING.base,
    ...SHADOW.sm,
  },

  // Field
  fieldBlock: { gap: SPACING.sm, paddingVertical: 14 },
  fieldLabel: { fontSize: FONT_SIZE.md, fontWeight: FONT_WEIGHT.bold, color: NICO.text },
  fieldHint:  { fontSize: FONT_SIZE.sm, color: NICO.text, fontWeight: FONT_WEIGHT.medium },
  divider:    { height: 1, backgroundColor: NICO.border },

  // Input with butterfly border
  inputGradient:  { padding: BUTTERFLY_BORDER.width, borderRadius: RADIUS.md + BUTTERFLY_BORDER.width },
  input:          { ...INPUT.base, borderWidth: 0 },
  charCount:      { fontSize: FONT_SIZE.sm, color: NICO.text, fontWeight: FONT_WEIGHT.medium, alignSelf: 'flex-end' },

  // Skill selector
  selectGradient: { padding: BUTTERFLY_BORDER.width, borderRadius: RADIUS.md + BUTTERFLY_BORDER.width },
  selectRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: NICO.surface, borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.base, paddingVertical: 13, gap: SPACING.sm,
  },
  selectValue:      { flex: 1, fontSize: FONT_SIZE.md, fontWeight: FONT_WEIGHT.semiBold, color: NICO.text },
  selectPlaceholder:{ color: NICO.textMuted, fontWeight: FONT_WEIGHT.regular },
  selectClear:      { fontSize: FONT_SIZE.md, color: NICO.textMuted, fontWeight: FONT_WEIGHT.bold, paddingHorizontal: 4 },
  selectChevron:    { fontSize: FONT_SIZE.xl, color: NICO.textMuted, lineHeight: 26 },

  // Share toggle
  shareToggleRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  shareToggle:    { width: 52, height: 30, borderRadius: 15, backgroundColor: NICO.border, justifyContent: 'center', padding: 2 },
  shareToggleOn:  { backgroundColor: NICO.primary },
  shareThumb:     { width: 26, height: 26, borderRadius: 13, backgroundColor: '#fff' },
  shareThumbOn:   { alignSelf: 'flex-end' },

  // Submit
  submitBtn:        { ...BTN_SIZE.lg, ...BTN_VARIANT.primary, ...SHADOW.md },
  submitBtnDisabled:{ opacity: 0.5 },
  submitText:       { ...TEXT_STYLE.buttonPrimary },
  footerNote:       { fontSize: FONT_SIZE.sm, color: NICO.text, fontWeight: FONT_WEIGHT.medium, textAlign: 'center', lineHeight: 18 },

  // Skill picker sheet
  sheetBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: NICO.surface, borderTopLeftRadius: RADIUS.xl, borderTopRightRadius: RADIUS.xl,
    paddingBottom: 32,
  },
  sheetHdr: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg, paddingVertical: SPACING.base,
    borderBottomWidth: 1, borderBottomColor: NICO.border,
  },
  sheetTitle:          { fontSize: FONT_SIZE.md, fontWeight: FONT_WEIGHT.extraBold, color: NICO.text },
  sheetCancel:         { fontSize: FONT_SIZE.md, color: NICO.textMuted, fontWeight: FONT_WEIGHT.semiBold, width: 60 },
  sheetOption: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg, paddingVertical: SPACING.base,
    borderBottomWidth: 1, borderBottomColor: NICO.border,
  },
  sheetOptionActive:     { backgroundColor: NICO.primaryLight },
  sheetOptionText:       { fontSize: FONT_SIZE.md, fontWeight: FONT_WEIGHT.semiBold, color: NICO.text },
  sheetOptionTextActive: { color: NICO.primary, fontWeight: FONT_WEIGHT.bold },
  sheetCheck:            { fontSize: FONT_SIZE.md, color: NICO.primary, fontWeight: FONT_WEIGHT.extraBold },
});
