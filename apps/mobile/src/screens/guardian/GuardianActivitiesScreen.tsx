import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, ActivityIndicator, Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/AuthContext';
import { COLORS } from '../../constants';
import { ACTIVITY_PRESETS, PRESET_MAP } from '../../lib/activityPresets';

const MAX_ACTIVITIES = 10;

// ── Report helpers ────────────────────────────────────────────────────────────

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
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function GuardianActivitiesScreen() {
  const { guardian } = useAuth();
  const [tab, setTab] = useState<'setup' | 'report'>('setup');

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
    const { data } = await supabase.rpc('get_activity_report', { p_guardian_id: guardian.id });
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
      return <View style={styles.center}><ActivityIndicator size="large" color={COLORS.primary} /></View>;
    }
    return (
      <ScrollView contentContainerStyle={styles.setupContent}>

        {/* Quota bar */}
        <View style={styles.quotaCard}>
          <View>
            <Text style={styles.quotaLabel}>Activities selected</Text>
            {saveStatus === 'saving' && <Text style={styles.saveHint}>Saving…</Text>}
            {saveStatus === 'saved'  && <Text style={[styles.saveHint, { color: '#5CBB7A' }]}>✓ Saved</Text>}
          </View>
          <View style={styles.quotaRight}>
            <Text style={styles.quotaCount}>{selectedKeys.length}</Text>
            <Text style={styles.quotaMax}> / {MAX_ACTIVITIES}</Text>
          </View>
        </View>

        <Text style={styles.setupHint}>
          These activities will appear every day for all users under your account.
        </Text>

        {/* Preset grid — 3 columns */}
        <View style={styles.presetGrid}>
          {ACTIVITY_PRESETS.map(preset => {
            const isSelected = selectedKeys.includes(preset.key);
            const isDisabled = !isSelected && selectedKeys.length >= MAX_ACTIVITIES;
            return (
              <TouchableOpacity
                key={preset.key}
                style={[
                  styles.presetCard,
                  isSelected && { borderColor: preset.color, backgroundColor: preset.bgColor },
                  isDisabled && styles.presetCardDisabled,
                ]}
                onPress={() => togglePreset(preset.key)}
                disabled={isDisabled}
                activeOpacity={0.75}
              >
                <Text style={styles.presetEmoji}>{preset.emoji}</Text>
                <Text style={styles.presetName}>{preset.name}</Text>
                {isSelected && (
                  <View style={[styles.presetTick, { backgroundColor: preset.color }]}>
                    <Text style={styles.presetTickText}>✓</Text>
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
      return <View style={styles.center}><ActivityIndicator size="large" color={COLORS.primary} /></View>;
    }

    const todayIso = new Date().toISOString().slice(0, 10);
    const last7Dates = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - i);
      return d.toISOString().slice(0, 10);
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
        <View style={styles.center}>
          <Text style={styles.emptyEmoji}>📊</Text>
          <Text style={styles.emptyTitle}>No data yet</Text>
          <Text style={styles.emptyHint}>Activity completions will appear here</Text>
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
      <ScrollView contentContainerStyle={styles.reportContent}>
        <Text style={styles.reportHint}>Last 7 days · Data auto-deleted after 7 days</Text>
        {Array.from(byUser.entries()).map(([userId, days]) => {
          const userName = days[0].userName;
          const totalActs = selectedKeys.length;

          return (
            <View key={userId} style={styles.reportUserCard}>
              {/* User header */}
              <View style={styles.reportUserHeader}>
                <View style={[styles.reportAvatar, { backgroundColor: avatarColor(userName) }]}>
                  <Text style={styles.reportAvatarText}>{userName[0]}</Text>
                </View>
                <View style={styles.reportUserInfo}>
                  <Text style={styles.reportUserName}>{userName}</Text>
                </View>
              </View>

              {/* 7-day rows — today always first */}
              {days.map(day => {
                const isToday = day.logDate === todayIso;
                const pct = totalActs > 0 ? day.completedKeys.size / totalActs : 0;
                return (
                  <View key={day.logDate} style={[styles.reportDayRow, isToday && styles.reportDayRowToday]}>
                    {/* Line 1: date + bar + count */}
                    <View style={styles.reportDayTopRow}>
                      <Text style={[styles.reportDayLabel, isToday && styles.reportDayLabelToday]}>
                        {isToday ? 'Today' : shortDate(day.logDate)}
                      </Text>
                      <View style={styles.reportMiniBarBg}>
                        <View style={[styles.reportMiniBar, { width: `${pct * 100}%` }]} />
                      </View>
                      <Text style={styles.reportDayCount}>{day.completedKeys.size}/{totalActs}</Text>
                    </View>
                    {/* Line 2: activity pips (wrappable) */}
                    <View style={styles.reportDayPips}>
                      {selectedKeys.map(key => {
                        const preset = PRESET_MAP[key];
                        const done = day.completedKeys.has(key);
                        return (
                          <View
                            key={key}
                            style={[
                              styles.pip,
                              done
                                ? { backgroundColor: preset?.bgColor ?? '#D4F5E2', borderColor: preset?.color ?? '#5CBB7A', borderWidth: 2 }
                                : styles.pipEmpty,
                            ]}
                          >
                            <Text style={[styles.pipEmoji, !done && styles.pipEmojiDim]}>
                              {preset?.emoji ?? '?'}
                            </Text>
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
    <View style={styles.container}>
      {/* Segmented tabs */}
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tabBtn, tab === 'setup' && styles.tabBtnActive]}
          onPress={() => switchTab('setup')}
        >
          <Text style={[styles.tabLabel, tab === 'setup' && styles.tabLabelActive]}>✅  Activities</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabBtn, tab === 'report' && styles.tabBtnActive]}
          onPress={() => switchTab('report')}
        >
          <Text style={[styles.tabLabel, tab === 'report' && styles.tabLabelActive]}>📊  Report</Text>
        </TouchableOpacity>
      </View>

      {tab === 'setup' ? renderSetup() : renderReport()}
    </View>
  );
}

const AVATAR_COLORS = ['#5CBB7A', '#9B59B6', '#F5A623', '#4A90E2', '#E53E3E', '#1ABC9C'];
function avatarColor(name: string) {
  return AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length];
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12, padding: 32 },
  emptyEmoji: { fontSize: 56 },
  emptyTitle: { fontSize: 20, fontWeight: '800', color: COLORS.text },
  emptyHint: { fontSize: 14, color: COLORS.textLight, textAlign: 'center' },

  // Tabs
  tabs: {
    flexDirection: 'row', backgroundColor: COLORS.surface,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  tabBtn: {
    flex: 1, paddingVertical: 14, alignItems: 'center',
    borderBottomWidth: 3, borderBottomColor: 'transparent',
  },
  tabBtnActive: { borderBottomColor: COLORS.primary },
  tabLabel: { fontSize: 15, fontWeight: '700', color: COLORS.textLight },
  tabLabelActive: { color: COLORS.primary },

  // Setup
  setupContent: { padding: 16, gap: 16, paddingBottom: 40 },
  setupHint: { fontSize: 13, color: COLORS.textLight, lineHeight: 20 },

  quotaCard: {
    backgroundColor: COLORS.surface, borderRadius: 16, padding: 16,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },
  quotaLabel: { fontSize: 15, fontWeight: '600', color: COLORS.textLight },
  saveHint: { fontSize: 12, fontWeight: '700', color: COLORS.textLight, marginTop: 2 },
  quotaRight: { flexDirection: 'row', alignItems: 'baseline' },
  quotaCount: { fontSize: 28, fontWeight: '900', color: COLORS.primary },
  quotaMax: { fontSize: 16, fontWeight: '700', color: COLORS.textLight },

  presetGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  presetCard: {
    width: '30%', backgroundColor: COLORS.surface,
    borderRadius: 16, padding: 12, alignItems: 'center', gap: 6,
    borderWidth: 2.5, borderColor: 'transparent',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
    position: 'relative',
  },
  presetCardDisabled: { opacity: 0.35 },
  presetEmoji: { fontSize: 28 },
  presetName: { fontSize: 11, fontWeight: '700', color: COLORS.text, textAlign: 'center', lineHeight: 15 },
  presetTick: {
    position: 'absolute', top: -7, right: -7,
    width: 22, height: 22, borderRadius: 11,
    justifyContent: 'center', alignItems: 'center',
  },
  presetTickText: { fontSize: 12, fontWeight: '900', color: '#fff' },

  // Report
  reportContent: { padding: 16, gap: 14, paddingBottom: 40 },
  reportHint: { fontSize: 12, color: COLORS.textLight, textAlign: 'center' },

  reportUserCard: {
    backgroundColor: COLORS.surface, borderRadius: 20, padding: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.07, shadowRadius: 10, elevation: 3,
    gap: 10,
  },
  reportUserHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 4 },
  reportAvatar: {
    width: 44, height: 44, borderRadius: 22,
    justifyContent: 'center', alignItems: 'center',
  },
  reportAvatarText: { fontSize: 18, fontWeight: '900', color: '#fff' },
  reportUserInfo: { flex: 1 },
  reportUserName: { fontSize: 17, fontWeight: '900', color: COLORS.text },
  reportUserSub: { fontSize: 12, color: COLORS.textLight, marginTop: 2 },

  reportDayRow: {
    borderTopWidth: 1, borderTopColor: COLORS.border, paddingTop: 10, gap: 8,
  },
  reportDayRowToday: { backgroundColor: '#EFF6FF', borderRadius: 12, paddingHorizontal: 8, marginHorizontal: -8, paddingBottom: 8 },
  reportDayTopRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  reportDayLabel: { fontSize: 12, fontWeight: '700', color: COLORS.textLight, width: 80 },
  reportDayLabelToday: { color: '#2563EB' },
  reportDayPips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  pip: {
    width: 34, height: 34, borderRadius: 10,
    justifyContent: 'center', alignItems: 'center',
  },
  pipEmpty: { backgroundColor: '#F0F4F8', borderWidth: 2, borderColor: '#E5EAF0' },
  pipEmoji: { fontSize: 18 },
  pipEmojiDim: { opacity: 0.2 },
  reportMiniBarBg: { flex: 1, height: 7, backgroundColor: COLORS.border, borderRadius: 4, overflow: 'hidden' },
  reportMiniBar: { height: 7, borderRadius: 4, backgroundColor: '#5CBB7A' },
  reportDayCount: { fontSize: 12, fontWeight: '800', color: COLORS.text, width: 28, textAlign: 'right' },
});
