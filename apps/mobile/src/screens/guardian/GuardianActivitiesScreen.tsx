import React, { useCallback, useState } from 'react';
import {
  View, StyleSheet, TouchableOpacity,
  ScrollView, ActivityIndicator, Alert,
} from 'react-native';
import AppText from '../../components/AppText';
import RainbowDivider from '../../components/RainbowDivider';
import GuardianFloatingTabBar from '../../components/GuardianFloatingTabBar';
import useNicoHeader from '../../hooks/useNicoHeader';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/AuthContext';
import { ACTIVITY_PRESETS, PRESET_MAP } from '../../lib/activityPresets';
import {
  NICO, TEXT_STYLE, SPACING, RADIUS, SHADOW, FONT_SIZE, FONT_WEIGHT, scale,
} from '../../constants/theme';

const MAX_ACTIVITIES = 10;

// ── Report helpers ────────────────────────────────────────────────────────────

// Pass the guardian's own local calendar date to get_activity_report rather
// than letting it fall back to the database's current_date (UTC on Supabase),
// which could shift the 7-day window by a day depending on timezone.
function toLocalDateStr(d: Date): string {
  const y  = d.getFullYear();
  const m  = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

interface ReportRow {
  user_id: string;
  user_name: string;
  preset_key: string;
  log_date: string;
  completed: boolean;
}

interface UserDaySummary {
  userId: string;
  userName: string;
  logDate: string;
  completedKeys: Set<string>;
  totalKeys: string[];
}

function buildReport(rows: ReportRow[], presetKeys: string[]): UserDaySummary[] {
  const map = new Map<string, UserDaySummary>();
  rows.forEach(r => {
    const k = `${r.user_id}|${r.log_date}`;
    if (!map.has(k)) {
      map.set(k, { userId: r.user_id, userName: r.user_name, logDate: r.log_date, completedKeys: new Set(), totalKeys: presetKeys });
    }
    if (r.completed) map.get(k)!.completedKeys.add(r.preset_key);
  });
  return Array.from(map.values()).sort((a, b) =>
    a.userName.localeCompare(b.userName) || b.logDate.localeCompare(a.logDate),
  );
}

function shortDate(iso: string) {
  const d = new Date(iso + 'T12:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function GuardianActivitiesScreen() {
  const navigation = useNavigation();
  const { guardian } = useAuth();
  const [tab, setTab] = useState<'setup' | 'report'>('setup');

  useNicoHeader(navigation);

  // Setup state
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [setupLoading, setSetupLoading] = useState(true);

  // Report state
  const [reportRows, setReportRows] = useState<ReportRow[]>([]);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportLoaded, setReportLoaded] = useState(false);

  useFocusEffect(useCallback(() => {
    loadSetup();
  }, [guardian]));

  async function loadSetup() {
    if (!guardian) return;
    setSetupLoading(true);
    const { data } = await supabase.rpc('get_guardian_activities', { p_guardian_id: guardian.id });
    const keys = ((data || []) as { preset_key: string }[]).map(r => r.preset_key);
    setSelectedKeys(keys);
    setSetupLoading(false);
  }

  async function loadReport() {
    if (!guardian || reportLoaded) return;
    setReportLoading(true);
    const { data } = await supabase.rpc('get_activity_report', {
      p_guardian_id: guardian.id,
      p_today: toLocalDateStr(new Date()),
    });
    setReportRows((data || []) as ReportRow[]);
    setReportLoaded(true);
    setReportLoading(false);
  }

  function switchTab(t: 'setup' | 'report') {
    setTab(t);
    if (t === 'report') loadReport();
  }

  async function togglePreset(key: string) {
    if (!guardian) return;
    let next: string[];
    setSelectedKeys(prev => {
      if (prev.includes(key)) {
        next = prev.filter(k => k !== key);
      } else {
        if (prev.length >= MAX_ACTIVITIES) { next = prev; return prev; }
        next = [...prev, key];
      }
      return next;
    });
    // next may be undefined if at max — guard
    if (next! === undefined) return;
    setSaveStatus('saving');
    const { error } = await supabase.rpc('set_guardian_activities', {
      p_guardian_id: guardian.id,
      p_preset_keys: next!,
    });
    if (error) { Alert.alert('Error', error.message); setSaveStatus('idle'); return; }
    setSaveStatus('saved');
    setTimeout(() => setSaveStatus('idle'), 1500);
  }

  // ── Setup tab ──────────────────────────────────────────────────────────────

  function renderSetup() {
    if (setupLoading) {
      return <View style={s.center}><ActivityIndicator size="large" color={NICO.primary} /></View>;
    }
    return (
      <ScrollView contentContainerStyle={s.setupContent}>

        {/* Quota bar */}
        <View style={s.quotaCard}>
          <View>
            <AppText style={s.quotaLabel}>Activities selected</AppText>
            {saveStatus === 'saving' && <AppText style={s.saveHint}>Saving…</AppText>}
            {saveStatus === 'saved'  && <AppText style={[s.saveHint, { color: NICO.success }]}>✓ Saved</AppText>}
          </View>
          <View style={s.quotaRight}>
            <AppText style={s.quotaCount}>{selectedKeys.length}</AppText>
            <AppText style={s.quotaMax}> / {MAX_ACTIVITIES}</AppText>
          </View>
        </View>

        <AppText style={s.setupHint}>
          These activities will appear every day for all users under your account.
        </AppText>

        {/* Preset grid — 3 columns */}
        <View style={s.presetGrid}>
          {ACTIVITY_PRESETS.map(preset => {
            const isSelected = selectedKeys.includes(preset.key);
            const isDisabled = !isSelected && selectedKeys.length >= MAX_ACTIVITIES;
            return (
              <TouchableOpacity
                key={preset.key}
                style={[
                  s.presetCard,
                  isSelected && { borderColor: preset.color, backgroundColor: preset.bgColor },
                  isDisabled && s.presetCardDisabled,
                ]}
                onPress={() => togglePreset(preset.key)}
                disabled={isDisabled}
                activeOpacity={0.75}
              >
                <AppText style={s.presetEmoji}>{preset.emoji}</AppText>
                <AppText style={s.presetName}>{preset.name}</AppText>
                {isSelected && (
                  <View style={[s.presetTick, { backgroundColor: preset.color }]}>
                    <AppText style={s.presetTickText}>✓</AppText>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

      </ScrollView>
    );
  }

  // ── Report tab ─────────────────────────────────────────────────────────────

  function renderReport() {
    if (reportLoading) {
      return <View style={s.center}><ActivityIndicator size="large" color={NICO.primary} /></View>;
    }

    const todayIso = toLocalDateStr(new Date());
    const last7Dates = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - i);
      return toLocalDateStr(d);
    });

    const summaries = buildReport(reportRows, selectedKeys);

    // Group by user, then fill in missing dates so today always appears
    const byUser = new Map<string, UserDaySummary[]>();
    summaries.forEach(s => {
      if (!byUser.has(s.userId)) byUser.set(s.userId, []);
      byUser.get(s.userId)!.push(s);
    });

    // If no rows at all, seed one placeholder so the date grid still renders
    // (guardian can still see the empty grid even before any completions)
    if (byUser.size === 0) {
      return (
        <View style={s.center}>
          <AppText style={s.emptyEmoji}>📊</AppText>
          <AppText style={s.emptyTitle}>No data yet</AppText>
          <AppText style={s.emptyHint}>Activity completions will appear here</AppText>
        </View>
      );
    }

    // Ensure all 7 dates exist for each user (fill empties), newest first
    byUser.forEach((days, userId) => {
      const existing = new Set(days.map(d => d.logDate));
      const userName = days[0].userName;
      last7Dates.forEach(date => {
        if (!existing.has(date)) {
          days.push({ userId, userName, logDate: date, completedKeys: new Set(), totalKeys: selectedKeys });
        }
      });
      days.sort((a, b) => b.logDate.localeCompare(a.logDate));
      byUser.set(userId, days);
    });

    return (
      <ScrollView contentContainerStyle={s.reportContent}>
        <AppText style={s.reportHint}>Last 7 days · Data auto-deleted after 7 days</AppText>
        {Array.from(byUser.entries()).map(([userId, days]) => {
          const totalActs = selectedKeys.length;

          return (
            <View key={userId} style={s.reportUserCard}>
              {/* 7-day rows — today always first */}
              {days.map(day => {
                const isToday = day.logDate === todayIso;
                const pct = totalActs > 0 ? day.completedKeys.size / totalActs : 0;
                return (
                  <View key={day.logDate} style={[s.reportDayRow, isToday && s.reportDayRowToday]}>
                    {/* Line 1: date + bar + count */}
                    <View style={s.reportDayTopRow}>
                      <AppText style={[s.reportDayLabel, isToday && s.reportDayLabelToday]}>
                        {isToday ? 'Today' : shortDate(day.logDate)}
                      </AppText>
                      <View style={s.reportMiniBarBg}>
                        <View style={[s.reportMiniBar, { width: `${pct * 100}%` }]} />
                      </View>
                      <AppText style={s.reportDayCount}>{day.completedKeys.size}/{totalActs}</AppText>
                    </View>
                    {/* Line 2: activity pips (wrappable) */}
                    <View style={s.reportDayPips}>
                      {selectedKeys.map(key => {
                        const preset = PRESET_MAP[key];
                        const done = day.completedKeys.has(key);
                        return (
                          <View
                            key={key}
                            style={[
                              s.pip,
                              done
                                ? { backgroundColor: preset?.bgColor ?? NICO.successLight, borderColor: preset?.color ?? NICO.success, borderWidth: 2 }
                                : s.pipEmpty,
                            ]}
                          >
                            <AppText style={[s.pipEmoji, !done && s.pipEmojiDim]}>
                              {preset?.emoji ?? '?'}
                            </AppText>
                          </View>
                        );
                      })}
                    </View>
                  </View>
                );
              })}
            </View>
          );
        })}
      </ScrollView>
    );
  }

  return (
    <View style={s.container}>
      <RainbowDivider />

      {/* Segmented tabs */}
      <View style={s.tabs}>
        <TouchableOpacity
          style={[s.tabBtn, tab === 'setup' && s.tabBtnActive]}
          onPress={() => switchTab('setup')}
          activeOpacity={0.75}
        >
          <AppText style={[s.tabLabel, tab === 'setup' && s.tabLabelActive]}>✅  Activities</AppText>
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.tabBtn, tab === 'report' && s.tabBtnActive]}
          onPress={() => switchTab('report')}
          activeOpacity={0.75}
        >
          <AppText style={[s.tabLabel, tab === 'report' && s.tabLabelActive]}>📊  Report</AppText>
        </TouchableOpacity>
      </View>

      <View style={s.tabPane}>
        {tab === 'setup' ? renderSetup() : renderReport()}
      </View>

      <GuardianFloatingTabBar />
    </View>
  );
}

const AVATAR_COLORS = [NICO.teal, NICO.orange, NICO.coral, NICO.pink, NICO.purple, NICO.primary];
function avatarColor(name: string) {
  return AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length];
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: NICO.screenBg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: SPACING.md, padding: SPACING.xl },
  emptyEmoji: { fontSize: scale(56) },
  emptyTitle: { fontSize: FONT_SIZE.xl, fontWeight: FONT_WEIGHT.extraBold, color: NICO.text },
  emptyHint: { ...TEXT_STYLE.screenHint, textAlign: 'center' },

  // Tabs
  tabs: {
    flexDirection: 'row', backgroundColor: NICO.surface,
    borderBottomWidth: 1, borderBottomColor: NICO.border,
  },
  tabBtn: {
    flex: 1, paddingVertical: SPACING.md, alignItems: 'center',
    borderBottomWidth: 2.5, borderBottomColor: 'transparent',
  },
  tabBtnActive: { borderBottomColor: NICO.primary },
  tabLabel: { fontSize: FONT_SIZE.md, fontWeight: FONT_WEIGHT.bold, color: NICO.textMuted },
  tabLabelActive: { color: NICO.primary, fontWeight: FONT_WEIGHT.extraBold },
  tabPane: { flex: 1, backgroundColor: NICO.screenBg },

  // Setup
  setupContent: { padding: SPACING.base, gap: SPACING.base, paddingBottom: 40 },
  setupHint: { ...TEXT_STYLE.screenHint, lineHeight: 20 },

  quotaCard: {
    backgroundColor: NICO.surface, borderRadius: RADIUS.xl, padding: SPACING.base,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderWidth: 1, borderColor: NICO.border,
    ...SHADOW.sm,
  },
  quotaLabel: { fontSize: FONT_SIZE.md, fontWeight: FONT_WEIGHT.semiBold, color: NICO.textMuted },
  saveHint: { fontSize: FONT_SIZE.xs, fontWeight: FONT_WEIGHT.bold, color: NICO.textMuted, marginTop: 2 },
  quotaRight: { flexDirection: 'row', alignItems: 'baseline' },
  quotaCount: { fontSize: FONT_SIZE['3xl'], fontWeight: FONT_WEIGHT.black, color: NICO.primary },
  quotaMax: { fontSize: FONT_SIZE.lg, fontWeight: FONT_WEIGHT.bold, color: NICO.textMuted },

  presetGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  presetCard: {
    width: '30%', backgroundColor: NICO.surface,
    borderRadius: RADIUS.xl, padding: SPACING.md, alignItems: 'center', gap: SPACING.xs,
    borderWidth: 2.5, borderColor: 'transparent',
    ...SHADOW.sm,
    position: 'relative',
  },
  presetCardDisabled: { opacity: 0.35 },
  presetEmoji: { fontSize: scale(28) },
  presetName: { fontSize: FONT_SIZE.xs, fontWeight: FONT_WEIGHT.bold, color: NICO.text, textAlign: 'center', lineHeight: 15 },
  presetTick: {
    position: 'absolute', top: -7, right: -7,
    width: scale(22), height: scale(22), borderRadius: scale(11),
    justifyContent: 'center', alignItems: 'center',
  },
  presetTickText: { fontSize: FONT_SIZE.sm, fontWeight: FONT_WEIGHT.black, color: '#fff' },

  // Report
  reportContent: { padding: SPACING.base, gap: SPACING.md, paddingBottom: 40 },
  reportHint: { ...TEXT_STYLE.screenHint, textAlign: 'center' },

  reportUserCard: {
    backgroundColor: NICO.surface, borderRadius: RADIUS['2xl'], padding: SPACING.base,
    borderWidth: 1, borderColor: NICO.border,
    ...SHADOW.md,
    gap: SPACING.sm,
  },
  reportUserHeader: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, marginBottom: 4 },
  reportAvatar: {
    width: scale(44), height: scale(44), borderRadius: scale(22),
    justifyContent: 'center', alignItems: 'center',
  },
  reportAvatarText: { fontSize: FONT_SIZE.lg, fontWeight: FONT_WEIGHT.black, color: '#fff' },
  reportUserInfo: { flex: 1 },
  reportUserName: { fontSize: FONT_SIZE.lg, fontWeight: FONT_WEIGHT.black, color: NICO.text },

  reportDayRow: {
    borderTopWidth: 1, borderTopColor: NICO.border, paddingTop: SPACING.sm, gap: SPACING.xs,
  },
  reportDayRowToday: { backgroundColor: NICO.primaryLight, borderRadius: RADIUS.lg, paddingHorizontal: SPACING.sm, marginHorizontal: -SPACING.sm, paddingBottom: SPACING.sm },
  reportDayTopRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  reportDayLabel: { fontSize: FONT_SIZE.xs, fontWeight: FONT_WEIGHT.bold, color: NICO.textMuted, width: scale(80) },
  reportDayLabelToday: { color: NICO.primary },
  reportDayPips: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.xs },
  pip: {
    width: scale(34), height: scale(34), borderRadius: RADIUS.md,
    justifyContent: 'center', alignItems: 'center',
  },
  pipEmpty: { backgroundColor: NICO.background, borderWidth: 2, borderColor: NICO.border },
  pipEmoji: { fontSize: FONT_SIZE.md },
  pipEmojiDim: { opacity: 0.2 },
  reportMiniBarBg: { flex: 1, height: 7, backgroundColor: NICO.border, borderRadius: 4, overflow: 'hidden' },
  reportMiniBar: { height: 7, borderRadius: 4, backgroundColor: NICO.success },
  reportDayCount: { fontSize: FONT_SIZE.xs, fontWeight: FONT_WEIGHT.extraBold, color: NICO.text, width: scale(28), textAlign: 'right' },
});
