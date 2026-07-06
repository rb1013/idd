import React, { useEffect, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, Alert, ActivityIndicator, LayoutAnimation,
  Platform, UIManager,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/AuthContext';
import {
  COLORS, LANGUAGES, TUTORIAL_TARGET_SKILLS, TUTORIAL_VISUAL_STYLES,
  TUTORIAL_IMAGE_STYLES, TUTORIAL_AUDIO, TUTORIAL_DURATIONS, TUTORIAL_COMPREHENSION,
} from '../../constants';
import { GuardianNavParamList } from '../../navigation';

if (Platform.OS === 'android') {
  UIManager.setLayoutAnimationEnabledExperimental?.(true);
}

type Format = 'video' | 'slideshow' | 'cards';

const FORMAT_OPTIONS: { key: Format; emoji: string; label: string }[] = [
  { key: 'video',     emoji: '🎬', label: 'Video' },
  { key: 'slideshow', emoji: '🖼',  label: 'Slideshow' },
  { key: 'cards',     emoji: '🃏', label: 'Cards' },
];

const SECTION_COLORS = ['#4A90E2', '#9B59B6', '#1ABC9C'] as const;

export default function CreateTutorialScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<GuardianNavParamList>>();
  const { guardian } = useAuth();

  // Section open state: 1 = open, 2 & 3 start collapsed
  const [openSection, setOpenSection] = useState<1 | 2 | 3>(1);
  const [doneSection, setDoneSection] = useState<Set<number>>(new Set());

  // Section 1
  const [targetSkill, setTargetSkill] = useState('');
  const [coreAction, setCoreAction] = useState('');
  const [format, setFormat] = useState<Format>('slideshow');
  const [duration, setDuration] = useState(20);

  // Section 2
  const [visualStyle, setVisualStyle] = useState('2D Animation');
  const [imageStyle, setImageStyle] = useState('Simple & Bold');
  const [pacing, setPacing] = useState<'slow' | 'normal'>('normal');
  const [tone, setTone] = useState<'calm' | 'enthusiastic'>('calm');

  // Section 3
  const [comprehension, setComprehension] = useState('easy');
  const [language, setLanguage] = useState('English');
  const [backgroundAudio, setBackgroundAudio] = useState('None');

  const [submitting, setSubmitting] = useState(false);
  const [quota, setQuota] = useState<{ used: number; limit: number } | null>(null);

  const title = [targetSkill, coreAction].filter(Boolean).join(': ');

  useEffect(() => {
    if (guardian) loadQuota(guardian.id);
  }, [guardian]);

  useEffect(() => {
    if (format !== 'video' && visualStyle === 'Real Human') setVisualStyle('2D Animation');
  }, [format]);

  async function loadQuota(guardianId: string) {
    const { data } = await supabase
      .from('guardian_tutorial_quota')
      .select('count')
      .eq('guardian_id', guardianId)
      .eq('month', new Date().toISOString().slice(0, 7))
      .single();
    setQuota({ used: data?.count ?? 0, limit: 10 });
  }

  function toggleSection(n: 1 | 2 | 3) {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpenSection(prev => (prev === n ? (1 as 1) : n));
  }

  function advanceToSection(next: 2 | 3) {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setDoneSection(prev => new Set([...prev, next - 1]));
    setOpenSection(next);
  }

  function getSummary(n: number): string {
    if (n === 1) return [targetSkill, FORMAT_OPTIONS.find(f => f.key === format)?.label, `${duration}s`].filter(Boolean).join(' · ');
    if (n === 2) return [visualStyle, pacing === 'slow' ? 'Slow' : 'Normal', tone === 'calm' ? 'Calm' : 'Enthusiastic'].join(' · ');
    if (n === 3) return [comprehension.charAt(0).toUpperCase() + comprehension.slice(1), language, backgroundAudio].join(' · ');
    return '';
  }

  const availableVisualStyles = format === 'video'
    ? TUTORIAL_VISUAL_STYLES
    : TUTORIAL_VISUAL_STYLES.filter(s => s !== 'Real Human');

  async function handleSubmit() {
    if (!targetSkill) { Alert.alert('Required', 'Please select a target skill'); return; }
    if (!coreAction.trim()) { Alert.alert('Required', 'Please describe the core action'); return; }
    if (!guardian) return;
    if (quota && quota.used >= quota.limit) {
      Alert.alert('Quota Reached', 'You have used all 10 tutorials for this month.'); return;
    }

    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-tutorial', {
        body: {
          guardian_id: guardian.id,
          title,
          target_skill: targetSkill,
          core_action: coreAction.trim(),
          format,
          visual_style: visualStyle,
          image_style: imageStyle,
          pacing: pacing === 'slow' ? 0.2 : 0.8,
          tone: tone === 'calm' ? 0.2 : 0.8,
          duration_seconds: duration,
          comprehension_level: comprehension,
          language,
          background_audio: backgroundAudio,
        },
      });
      if (error || data?.error) throw new Error(data?.error ?? error?.message);
      navigation.replace('TutorialPreview', { tutorialId: data.tutorial_id as string });
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
          <Text style={[styles.quotaCount, quota.used >= 10 && { color: COLORS.error }]}>
            {quota.used} / {quota.limit} used
          </Text>
        </View>
      )}

      {/* ── SECTION 1 ── */}
      <SectionCard
        number={1}
        title="What to Teach"
        color={SECTION_COLORS[0]}
        isOpen={openSection === 1}
        isDone={doneSection.has(1)}
        summary={getSummary(1)}
        onToggle={() => toggleSection(1)}
      >
        <FieldBlock label="Target Skill *">
          <View style={styles.chipGrid}>
            {TUTORIAL_TARGET_SKILLS.map(s => (
              <TouchableOpacity
                key={s}
                style={[styles.chip, targetSkill === s && [styles.chipActive, { backgroundColor: SECTION_COLORS[0], borderColor: SECTION_COLORS[0] }]]}
                onPress={() => setTargetSkill(s)}
              >
                <Text style={[styles.chipText, targetSkill === s && styles.chipTextActive]}>{s}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </FieldBlock>

        <Divider />

        <FieldBlock label="Core Action *" hint="e.g. Dribbling a soccer ball (max 60 chars)">
          <TextInput
            style={styles.input}
            value={coreAction}
            onChangeText={t => setCoreAction(t.slice(0, 60))}
            placeholder="Describe what the user will learn to do…"
            placeholderTextColor={COLORS.textLight}
            maxLength={60}
            returnKeyType="done"
          />
          <Text style={styles.charCount}>{coreAction.length}/60</Text>
        </FieldBlock>

        <Divider />

        <FieldBlock label="Format *">
          <View style={styles.formatRow}>
            {FORMAT_OPTIONS.map(f => (
              <TouchableOpacity
                key={f.key}
                style={[styles.formatOpt, format === f.key && styles.formatOptActive]}
                onPress={() => setFormat(f.key)}
              >
                <Text style={styles.formatEmoji}>{f.emoji}</Text>
                <Text style={[styles.formatLabel, format === f.key && { color: SECTION_COLORS[0] }]}>{f.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
          {format === 'video' && (
            <Text style={styles.hint}>Video coming soon — choose Slideshow or Cards for instant generation.</Text>
          )}
        </FieldBlock>

        <Divider />

        <FieldBlock label="Duration">
          <SegRow
            options={TUTORIAL_DURATIONS.map(d => ({ key: String(d), label: `${d}s` }))}
            value={String(duration)}
            onSelect={v => setDuration(Number(v))}
          />
        </FieldBlock>

        <NextButton label="Next: Look & Feel →" color={SECTION_COLORS[0]} onPress={() => advanceToSection(2)} />
      </SectionCard>

      {/* ── SECTION 2 ── */}
      <SectionCard
        number={2}
        title="Look & Feel"
        color={SECTION_COLORS[1]}
        isOpen={openSection === 2}
        isDone={doneSection.has(2)}
        summary={getSummary(2)}
        onToggle={() => toggleSection(2)}
      >
        <FieldBlock label="Visual Style *">
          <View style={styles.chipGrid}>
            {availableVisualStyles.map(s => (
              <TouchableOpacity
                key={s}
                style={[styles.chip, visualStyle === s && [styles.chipActive, { backgroundColor: SECTION_COLORS[1], borderColor: SECTION_COLORS[1] }]]}
                onPress={() => setVisualStyle(s)}
              >
                <Text style={[styles.chipText, visualStyle === s && styles.chipTextActive]}>{s}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </FieldBlock>

        <Divider />

        <FieldBlock label="Image Style *">
          <View style={styles.chipGrid}>
            {TUTORIAL_IMAGE_STYLES.map(s => (
              <TouchableOpacity
                key={s}
                style={[styles.chip, imageStyle === s && [styles.chipActive, { backgroundColor: SECTION_COLORS[1], borderColor: SECTION_COLORS[1] }]]}
                onPress={() => setImageStyle(s)}
              >
                <Text style={[styles.chipText, imageStyle === s && styles.chipTextActive]}>{s}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </FieldBlock>

        <Divider />

        <FieldBlock label="Pacing">
          <View style={styles.toggleRow}>
            {(['slow', 'normal'] as const).map(p => (
              <TouchableOpacity
                key={p}
                style={[styles.toggleOpt, pacing === p && [styles.toggleOptActive, { borderColor: SECTION_COLORS[1], backgroundColor: '#F5EEFF' }]]}
                onPress={() => setPacing(p)}
              >
                <Text style={styles.toggleEmoji}>{p === 'slow' ? '🐢' : '▶️'}</Text>
                <Text style={[styles.toggleLabel, pacing === p && { color: SECTION_COLORS[1] }]}>
                  {p === 'slow' ? 'Slow' : 'Normal'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </FieldBlock>

        <Divider />

        <FieldBlock label="Tone">
          <View style={styles.toggleRow}>
            {(['calm', 'enthusiastic'] as const).map(t => (
              <TouchableOpacity
                key={t}
                style={[styles.toggleOpt, tone === t && [styles.toggleOptActive, { borderColor: SECTION_COLORS[1], backgroundColor: '#F5EEFF' }]]}
                onPress={() => setTone(t)}
              >
                <Text style={styles.toggleEmoji}>{t === 'calm' ? '😌' : '🎉'}</Text>
                <Text style={[styles.toggleLabel, tone === t && { color: SECTION_COLORS[1] }]}>
                  {t === 'calm' ? 'Calm' : 'Enthusiastic'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </FieldBlock>

        <NextButton label="Next: Context →" color={SECTION_COLORS[1]} onPress={() => advanceToSection(3)} />
      </SectionCard>

      {/* ── SECTION 3 ── */}
      <SectionCard
        number={3}
        title="Context"
        color={SECTION_COLORS[2]}
        isOpen={openSection === 3}
        isDone={doneSection.has(3)}
        summary={getSummary(3)}
        onToggle={() => toggleSection(3)}
      >
        <FieldBlock label="Comprehension Level">
          <SegRow
            options={TUTORIAL_COMPREHENSION.map(c => ({ key: c, label: c.charAt(0).toUpperCase() + c.slice(1) }))}
            value={comprehension}
            onSelect={setComprehension}
            activeColor={SECTION_COLORS[2]}
          />
        </FieldBlock>

        <Divider />

        <FieldBlock label="Language">
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.langScroll} contentContainerStyle={styles.langContent}>
            {LANGUAGES.map(l => (
              <TouchableOpacity
                key={l}
                style={[styles.chip, language === l && [styles.chipActive, { backgroundColor: SECTION_COLORS[2], borderColor: SECTION_COLORS[2] }]]}
                onPress={() => setLanguage(l)}
              >
                <Text style={[styles.chipText, language === l && styles.chipTextActive]}>{l}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </FieldBlock>

        <Divider />

        <FieldBlock label="Background Audio">
          <SegRow
            options={TUTORIAL_AUDIO.map(a => ({ key: a, label: a }))}
            value={backgroundAudio}
            onSelect={setBackgroundAudio}
            activeColor={SECTION_COLORS[2]}
          />
        </FieldBlock>
      </SectionCard>

      {/* Title preview */}
      {title.length > 0 && (
        <View style={styles.previewPill}>
          <Text style={styles.previewPillLabel}>Tutorial title</Text>
          <Text style={styles.previewPillText}>"{title}"</Text>
        </View>
      )}

      {/* Submit */}
      <TouchableOpacity
        style={[styles.submitBtn, (submitting || format === 'video') && styles.submitBtnDisabled]}
        onPress={handleSubmit}
        disabled={submitting || format === 'video'}
      >
        {submitting
          ? <ActivityIndicator color="#fff" />
          : <Text style={styles.submitText}>✨  Create Tutorial</Text>
        }
      </TouchableOpacity>
      <Text style={styles.footerNote}>
        Uses 1 of your {quota?.limit ?? 10} monthly credits · AI generation takes ~30 seconds
      </Text>
    </ScrollView>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SectionCard({
  number, title, color, isOpen, isDone, summary, onToggle, children,
}: {
  number: number; title: string; color: string;
  isOpen: boolean; isDone: boolean; summary: string;
  onToggle: () => void; children: React.ReactNode;
}) {
  return (
    <View style={styles.sectionCard}>
      <TouchableOpacity style={[styles.sectionBand, { backgroundColor: color }]} onPress={onToggle} activeOpacity={0.85}>
        <View style={styles.sectionNum}><Text style={styles.sectionNumText}>{number}</Text></View>
        <Text style={styles.sectionTitle}>{title}</Text>
        {!isOpen && isDone && summary ? (
          <Text style={styles.sectionSummary} numberOfLines={1}>{summary}</Text>
        ) : null}
        {isDone && !isOpen && <Text style={styles.sectionTick}>✓</Text>}
        <Text style={[styles.sectionArrow, !isOpen && styles.sectionArrowCollapsed]}>▼</Text>
      </TouchableOpacity>
      {isOpen && <View style={styles.sectionContent}>{children}</View>}
    </View>
  );
}

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

function SegRow({ options, value, onSelect, activeColor = COLORS.primary }: {
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

function NextButton({ label, color, onPress }: { label: string; color: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={[styles.nextBtn, { backgroundColor: color }]} onPress={onPress}>
      <Text style={styles.nextBtnText}>{label}</Text>
    </TouchableOpacity>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F0F4F8' },
  content: { padding: 14, paddingBottom: 48, gap: 12 },

  quotaPill: {
    backgroundColor: '#EBF4FF', borderRadius: 14,
    padding: 13, flexDirection: 'row',
    justifyContent: 'space-between', alignItems: 'center',
  },
  quotaLabel: { fontSize: 14, fontWeight: '600', color: COLORS.text },
  quotaCount: { fontSize: 14, fontWeight: '800', color: COLORS.primary },

  // Section card
  sectionCard: {
    backgroundColor: COLORS.surface, borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07, shadowRadius: 10, elevation: 3,
  },
  sectionBand: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 10 },
  sectionNum: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.28)',
    justifyContent: 'center', alignItems: 'center',
  },
  sectionNumText: { color: '#fff', fontWeight: '800', fontSize: 14 },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: '#fff', flex: 1 },
  sectionSummary: { fontSize: 12, color: 'rgba(255,255,255,0.8)', flex: 2, fontWeight: '500' },
  sectionTick: { color: '#fff', fontSize: 16, fontWeight: '800', marginRight: 2 },
  sectionArrow: { color: 'rgba(255,255,255,0.9)', fontSize: 14, fontWeight: '700' },
  sectionArrowCollapsed: { transform: [{ rotate: '-90deg' }] },
  sectionContent: { padding: 16, gap: 0 },

  // Field
  fieldBlock: { gap: 8, paddingVertical: 14 },
  fieldLabel: { fontSize: 15, fontWeight: '700', color: COLORS.text },
  fieldHint: { fontSize: 12, color: COLORS.textLight },
  divider: { height: 1, backgroundColor: '#F0F4F8' },

  // Input
  input: {
    backgroundColor: '#F0F4F8', borderRadius: 12, borderWidth: 1.5, borderColor: COLORS.border,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: COLORS.text,
  },
  charCount: { fontSize: 11, color: COLORS.textLight, alignSelf: 'flex-end' },

  // Chips
  chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20,
    backgroundColor: '#F0F4F8', borderWidth: 1.5, borderColor: COLORS.border,
  },
  chipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  chipText: { fontSize: 13, fontWeight: '600', color: COLORS.text },
  chipTextActive: { color: '#fff', fontWeight: '700' },

  // Format picker
  formatRow: { flexDirection: 'row', gap: 10 },
  formatOpt: {
    flex: 1, borderRadius: 14, borderWidth: 2, borderColor: COLORS.border,
    backgroundColor: '#F0F4F8', alignItems: 'center', paddingVertical: 14, gap: 6,
  },
  formatOptActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primaryLight },
  formatEmoji: { fontSize: 28 },
  formatLabel: { fontSize: 13, fontWeight: '700', color: COLORS.textLight },
  hint: { fontSize: 12, color: COLORS.warning, lineHeight: 17, marginTop: 6 },

  // Segment control
  segRow: {
    flexDirection: 'row', backgroundColor: '#F0F4F8',
    borderRadius: 12, padding: 3, gap: 3,
  },
  seg: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center' },
  segActive: {
    backgroundColor: COLORS.surface,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1, shadowRadius: 2, elevation: 1,
  },
  segText: { fontSize: 13, fontWeight: '600', color: COLORS.textLight },
  segTextActive: { fontWeight: '800', color: COLORS.primary },

  // Toggle (pacing / tone)
  toggleRow: { flexDirection: 'row', gap: 10 },
  toggleOpt: {
    flex: 1, borderRadius: 14, borderWidth: 2, borderColor: COLORS.border,
    backgroundColor: '#F0F4F8', alignItems: 'center', paddingVertical: 14, gap: 6,
  },
  toggleOptActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primaryLight },
  toggleEmoji: { fontSize: 24 },
  toggleLabel: { fontSize: 13, fontWeight: '700', color: COLORS.textLight },

  // Language scroll
  langScroll: { marginHorizontal: -16 },
  langContent: { paddingHorizontal: 16, gap: 8 },

  // Next button inside section
  nextBtn: {
    marginTop: 8, borderRadius: 12, paddingVertical: 13, alignItems: 'center',
  },
  nextBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },

  // Title preview
  previewPill: {
    backgroundColor: COLORS.primaryLight, borderRadius: 14,
    padding: 14, gap: 4,
  },
  previewPillLabel: { fontSize: 12, color: COLORS.primary, fontWeight: '600' },
  previewPillText: { fontSize: 15, fontWeight: '700', color: COLORS.text },

  // Submit
  submitBtn: {
    backgroundColor: COLORS.primary, borderRadius: 18,
    paddingVertical: 17, alignItems: 'center',
    shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4, shadowRadius: 12, elevation: 8,
  },
  submitBtnDisabled: { opacity: 0.5 },
  submitText: { color: '#fff', fontWeight: '800', fontSize: 17 },
  footerNote: { fontSize: 12, color: COLORS.textLight, textAlign: 'center', lineHeight: 18 },
});
