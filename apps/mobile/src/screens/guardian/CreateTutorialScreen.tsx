import React, { useEffect, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, Alert, ActivityIndicator, Modal,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/AuthContext';
import { COLORS, TUTORIAL_DURATIONS } from '../../constants';
import { GuardianNavParamList } from '../../navigation';

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

  const [targetSkill, setTargetSkill] = useState('');
  const [coreAction, setCoreAction] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [duration, setDuration] = useState(20);
  const [submitting, setSubmitting] = useState(false);
  const [quota, setQuota] = useState<{ used: number; limit: number } | null>(null);
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
      supabase.from('app_settings').select('tutorial_quota_limit').single(),
    ]);
    const limit = settings?.tutorial_quota_limit ?? 10;
    setQuota({ used: data?.count ?? 0, limit });
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
          duration_seconds: duration,
          comprehension_level: TUTORIAL_DEFAULTS.comprehension_level,
          language: 'English',
          background_audio: TUTORIAL_DEFAULTS.background_audio,
        },
      });
      if (error || data?.error) throw new Error(data?.error ?? error?.message);
      navigation.replace('Learning', { initialTab: 'my' });
    } catch (err: unknown) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Something went wrong.');
      setSubmitting(false);
    }
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      {/* Quota pill */}
      {quota && (
        <View style={styles.quotaPill}>
          <Text style={styles.quotaLabel}>Monthly quota</Text>
          <Text style={[styles.quotaCount, quota.used >= quota.limit && { color: COLORS.error }]}>
            {quota.used} / {quota.limit} used
          </Text>
        </View>
      )}

      {/* Form card */}
      <View style={styles.formCard}>
        <FieldBlock label="Target Skill *">
          <TouchableOpacity style={styles.selectRow} onPress={() => setShowSkillPicker(true)} activeOpacity={0.75}>
            <Text style={[styles.selectValue, !targetSkill && styles.selectPlaceholder]}>
              {targetSkill || 'Select a skill…'}
            </Text>
            {targetSkill
              ? <TouchableOpacity onPress={() => setTargetSkill('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Text style={styles.selectClear}>✕</Text>
                </TouchableOpacity>
              : <Text style={styles.selectChevron}>›</Text>
            }
          </TouchableOpacity>
        </FieldBlock>

        <Divider />

        <FieldBlock label="Core Action *" hint="e.g. Dribbling a soccer ball (max 60 chars)">
          <TextInput
            style={styles.input}
            value={coreAction}
            onChangeText={t => setCoreAction(t.slice(0, 60))}
            placeholder="Describe what the user will learn to do…"
            placeholderTextColor={COLORS.bloomMuted}
            maxLength={60}
            returnKeyType="done"
          />
          <Text style={styles.charCount}>{coreAction.length}/60</Text>
        </FieldBlock>

        <Divider />

        <FieldBlock label="Tutorial Name" hint="Short friendly name shown to your user (e.g. 'Soccer Fun'). Optional — auto-generated if left blank.">
          <TextInput
            style={styles.input}
            value={displayName}
            onChangeText={t => setDisplayName(t.slice(0, 40))}
            placeholder="Give it a name your user will recognise…"
            placeholderTextColor={COLORS.bloomMuted}
            maxLength={40}
            returnKeyType="done"
          />
          <Text style={styles.charCount}>{displayName.length}/40</Text>
        </FieldBlock>

        <Divider />

        <FieldBlock label="Duration">
          <SegRow
            options={TUTORIAL_DURATIONS.map(d => ({ key: String(d), label: `${d}s` }))}
            value={String(duration)}
            onSelect={v => setDuration(Number(v))}
          />
        </FieldBlock>
      </View>

      {/* Submit */}
      <TouchableOpacity
        style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
        onPress={handleSubmit}
        disabled={submitting}
      >
        {submitting
          ? <ActivityIndicator color="#fff" />
          : <Text style={styles.submitText}>✨  Create Tutorial</Text>
        }
      </TouchableOpacity>
      <Text style={styles.footerNote}>
        Uses 1 of your {quota?.limit ?? 10} monthly credits · AI generation takes ~30 seconds
      </Text>

      <Modal visible={showSkillPicker} transparent animationType="slide" onRequestClose={() => setShowSkillPicker(false)}>
        <TouchableOpacity style={styles.sheetBackdrop} activeOpacity={1} onPress={() => setShowSkillPicker(false)}>
          <View style={styles.sheet} onStartShouldSetResponder={() => true}>
            <View style={styles.sheetHdr}>
              <TouchableOpacity onPress={() => setShowSkillPicker(false)}>
                <Text style={styles.sheetCancel}>Cancel</Text>
              </TouchableOpacity>
              <Text style={styles.sheetTitle}>Target Skill</Text>
              <View style={{ width: 60 }} />
            </View>
            <ScrollView style={{ maxHeight: 360 }}>
              {targetSkills.map(s => (
                <TouchableOpacity
                  key={s}
                  style={[styles.sheetOption, targetSkill === s && styles.sheetOptionActive]}
                  onPress={() => { setTargetSkill(s); setShowSkillPicker(false); }}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.sheetOptionText, targetSkill === s && styles.sheetOptionTextActive]}>{s}</Text>
                  {targetSkill === s && <Text style={styles.sheetCheck}>✓</Text>}
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
    <View style={styles.fieldBlock}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {hint ? <Text style={styles.fieldHint}>{hint}</Text> : null}
      {children}
    </View>
  );
}

function Divider() {
  return <View style={styles.divider} />;
}

function SegRow({ options, value, onSelect, activeColor = COLORS.bloomAccent }: {
  options: { key: string; label: string }[];
  value: string;
  onSelect: (v: string) => void;
  activeColor?: string;
}) {
  return (
    <View style={styles.segRow}>
      {options.map(o => (
        <TouchableOpacity
          key={o.key}
          style={[styles.seg, value === o.key && styles.segActive]}
          onPress={() => onSelect(o.key)}
        >
          <Text style={[styles.segText, value === o.key && [styles.segTextActive, { color: activeColor }]]}>
            {o.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bloomBody },
  content: { padding: 14, paddingBottom: 120, gap: 12 },

  quotaPill: {
    backgroundColor: '#EBF4FF', borderRadius: 14,
    padding: 13, flexDirection: 'row',
    justifyContent: 'space-between', alignItems: 'center',
  },
  quotaLabel: { fontSize: 14, fontWeight: '600', color: COLORS.bloomText },
  quotaCount: { fontSize: 14, fontWeight: '800', color: COLORS.bloomAccent },

  formCard: {
    backgroundColor: COLORS.bloomCard, borderRadius: 20, padding: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07, shadowRadius: 10, elevation: 3,
  },

  // Field
  fieldBlock: { gap: 8, paddingVertical: 14 },
  fieldLabel: { fontSize: 15, fontWeight: '700', color: COLORS.bloomText },
  fieldHint: { fontSize: 12, color: COLORS.bloomMuted },
  divider: { height: 1, backgroundColor: COLORS.bloomBorder },

  // Input
  input: {
    backgroundColor: COLORS.bloomBody, borderRadius: 12, borderWidth: 1.5, borderColor: COLORS.bloomBorder,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: COLORS.bloomText,
  },
  charCount: { fontSize: 11, color: COLORS.bloomMuted, alignSelf: 'flex-end' },

  // Segment control
  segRow: {
    flexDirection: 'row', backgroundColor: COLORS.bloomBody,
    borderRadius: 12, padding: 3, gap: 3,
  },
  seg: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center' },
  segActive: {
    backgroundColor: COLORS.bloomCard,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1, shadowRadius: 2, elevation: 1,
  },
  segText: { fontSize: 13, fontWeight: '600', color: COLORS.bloomMuted },
  segTextActive: { fontWeight: '800', color: COLORS.bloomAccent },

  // Submit
  submitBtn: {
    backgroundColor: COLORS.bloomNavy, borderRadius: 18,
    paddingVertical: 17, alignItems: 'center',
    shadowColor: COLORS.bloomNavy, shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4, shadowRadius: 12, elevation: 8,
  },
  submitBtnDisabled: { opacity: 0.5 },
  submitText: { color: '#fff', fontWeight: '800', fontSize: 17 },
  footerNote: { fontSize: 12, color: COLORS.bloomMuted, textAlign: 'center', lineHeight: 18 },

  // Target skill selector row
  selectRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.bloomBody, borderRadius: 12,
    borderWidth: 1.5, borderColor: COLORS.bloomBorder,
    paddingHorizontal: 14, paddingVertical: 13, gap: 8,
  },
  selectValue: { flex: 1, fontSize: 15, fontWeight: '600', color: COLORS.bloomText },
  selectPlaceholder: { color: COLORS.bloomMuted, fontWeight: '400' },
  selectClear: { fontSize: 15, color: COLORS.bloomMuted, fontWeight: '700', paddingHorizontal: 4 },
  selectChevron: { fontSize: 22, color: COLORS.bloomMuted, lineHeight: 26 },
  // Skill picker sheet
  sheetBackdrop: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: COLORS.bloomCard, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingBottom: 32,
  },
  sheetHdr: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 16,
    borderBottomWidth: 1, borderBottomColor: COLORS.bloomBorder,
  },
  sheetTitle: { fontSize: 16, fontWeight: '800', color: COLORS.bloomText },
  sheetCancel: { fontSize: 15, color: COLORS.bloomMuted, fontWeight: '600', width: 60 },
  sheetOption: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 16,
    borderBottomWidth: 1, borderBottomColor: COLORS.bloomBorder,
  },
  sheetOptionActive: { backgroundColor: '#DAEAFF' },
  sheetOptionText: { fontSize: 15, fontWeight: '600', color: COLORS.bloomText },
  sheetOptionTextActive: { color: COLORS.bloomAccent, fontWeight: '700' },
  sheetCheck: { fontSize: 16, color: COLORS.bloomAccent, fontWeight: '800' },
});
