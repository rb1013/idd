import React, { useCallback, useState } from 'react';
import {
  View, StyleSheet, TouchableOpacity,
  ScrollView, ActivityIndicator,
} from 'react-native';
import AppText from '../../components/AppText';
import RainbowDivider from '../../components/RainbowDivider';
import useNicoHeader from '../../hooks/useNicoHeader';
import * as Speech from 'expo-speech';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/AuthContext';
import { PRESET_MAP } from '../../lib/activityPresets';
import {
  NICO, TEXT_STYLE, SPACING, RADIUS, SHADOW, FONT_SIZE, FONT_WEIGHT,
  BUTTERFLY_TILES, scale,
} from '../../constants/theme';

interface ActivityItem {
  activity_id: string;
  preset_key: string;
  sort_order: number;
  completed: boolean;
}

const NO_ACTIVITIES_MSG = "No activities yet! Ask your guardian to add some fun activities for you!";

// Pass the learner's own local calendar date to the RPCs rather than letting
// them fall back to the database's current_date (UTC on Supabase) — otherwise
// evening hours in any timezone behind UTC can log/read "today" as tomorrow.
function toLocalDateStr(d: Date): string {
  const y  = d.getFullYear();
  const m  = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

function NoActivitiesState() {
  useFocusEffect(useCallback(() => {
    return () => { Speech.stop(); };
  }, []));

  return (
    <View style={noActStyles.container}>
      <RainbowDivider />
      <View style={noActStyles.content}>
        <AppText style={noActStyles.emoji}>😊</AppText>
        <AppText style={noActStyles.title}>No activities yet!</AppText>
        <AppText style={noActStyles.hint}>Ask your guardian to add some fun activities for you!</AppText>
        <TouchableOpacity
          style={noActStyles.speakBtn}
          onPress={() => Speech.speak(NO_ACTIVITIES_MSG, { rate: 0.65, pitch: 1.0 })}
          activeOpacity={0.75}
        >
          <AppText style={noActStyles.speakIcon}>🔊</AppText>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const noActStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: NICO.screenBg },
  content:   { flex: 1, justifyContent: 'center', alignItems: 'center', padding: SPACING.xl, gap: SPACING.md },
  emoji:    { fontSize: scale(80) },
  title:    { fontSize: FONT_SIZE['2xl'], fontWeight: FONT_WEIGHT.black, color: NICO.text, textAlign: 'center' },
  hint:     { ...TEXT_STYLE.screenHint, textAlign: 'center', lineHeight: 24 },
  speakBtn: {
    marginTop: SPACING.sm, alignItems: 'center', justifyContent: 'center',
    width: scale(52), height: scale(52), borderRadius: RADIUS.full,
    backgroundColor: BUTTERFLY_TILES[2].bg, borderWidth: 1.5, borderColor: BUTTERFLY_TILES[2].accent,
  },
  speakIcon: { fontSize: FONT_SIZE.lg },
});

function todayLabel(): string {
  return new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
}

export default function ActivitiesScreen() {
  const navigation = useNavigation();
  const { activeUser } = useAuth();
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);

  useNicoHeader(navigation);

  const load = useCallback(async () => {
    if (!activeUser) return;
    const { data } = await supabase.rpc('get_user_activities_today', {
      p_user_id: activeUser.id,
      p_today: toLocalDateStr(new Date()),
    });
    setActivities((data || []) as ActivityItem[]);
    setLoading(false);
  }, [activeUser]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function toggle(item: ActivityItem) {
    const next = !item.completed;
    // Optimistic update — move done items to end, pending to front
    setActivities(prev => {
      const updated = prev.map(a =>
        a.activity_id === item.activity_id ? { ...a, completed: next } : a,
      );
      return [
        ...updated.filter(a => !a.completed),
        ...updated.filter(a => a.completed),
      ];
    });
    await supabase.rpc('toggle_user_activity', {
      p_user_id:    activeUser!.id,
      p_activity_id: item.activity_id,
      p_completed:  next,
      p_today:      toLocalDateStr(new Date()),
    });
  }

  if (loading) {
    return <View style={s.center}><ActivityIndicator size="large" color={NICO.primary} /></View>;
  }

  if (activities.length === 0) {
    return <NoActivitiesState />;
  }

  const done  = activities.filter(a => a.completed).length;
  const total = activities.length;
  const allDone = done === total;
  const pct = total > 0 ? done / total : 0;

  return (
    <View style={s.root}>
      <RainbowDivider />
      <ScrollView contentContainerStyle={s.content}>

        {/* Progress header */}
        <View style={s.progressCard}>
          <AppText style={s.progressDate}>{todayLabel()}</AppText>
          <View style={s.progressRow}>
            <AppText style={s.progressLabel}>
              {allDone ? '🎉 All done!' : `${done} of ${total} done`}
            </AppText>
            <AppText style={s.progressFraction}>{done}/{total}</AppText>
          </View>
          <View style={s.barBg}>
            <View style={[s.barFill, { width: `${pct * 100}%` }]} />
          </View>
        </View>

        {allDone && (
          <View style={s.doneBanner}>
            <AppText style={s.doneBannerText}>🌟 Amazing job today! Keep it up!</AppText>
          </View>
        )}

        {/* Activity cards */}
        {activities.map((item, idx) => {
          const preset = PRESET_MAP[item.preset_key];
          if (!preset) return null;
          const tile = BUTTERFLY_TILES[idx % BUTTERFLY_TILES.length];
          return (
            <TouchableOpacity
              key={item.activity_id}
              style={[
                s.card,
                { backgroundColor: tile.bg, borderLeftColor: tile.accent },
                item.completed && s.cardDone,
              ]}
              onPress={() => toggle(item)}
              activeOpacity={0.8}
            >
              <View style={[s.iconWrap, { backgroundColor: tile.accent + '40' }]}>
                <AppText style={s.icon}>{preset.emoji}</AppText>
              </View>

              <AppText style={[s.name, item.completed && s.nameDone]}>
                {preset.name}
              </AppText>

              <TouchableOpacity
                style={s.speakBtn}
                onPress={() => Speech.speak(preset.name, { rate: 0.65, pitch: 1.0 })}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <AppText style={s.speakIcon}>🔊</AppText>
              </TouchableOpacity>

              <View style={[
                s.checkbox,
                item.completed
                  ? { backgroundColor: NICO.success, borderColor: NICO.success }
                  : { borderColor: tile.accent },
              ]}>
                {item.completed && <AppText style={s.checkmark}>✓</AppText>}
              </View>
            </TouchableOpacity>
          );
        })}

      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: NICO.screenBg },
  content: { padding: SPACING.base, gap: SPACING.sm, paddingBottom: 40 },
  center: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
    backgroundColor: NICO.screenBg, padding: SPACING.xl, gap: SPACING.md,
  },

  progressCard: {
    backgroundColor: NICO.surface, borderRadius: RADIUS.xl, padding: SPACING.lg,
    borderWidth: 1, borderColor: NICO.border,
    ...SHADOW.sm, gap: SPACING.sm,
  },
  progressDate: { fontSize: FONT_SIZE.sm, fontWeight: FONT_WEIGHT.semiBold, color: NICO.textMuted },
  progressRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: SPACING.sm },
  progressLabel: { fontSize: FONT_SIZE.xl, fontWeight: FONT_WEIGHT.semiBold, color: NICO.text },
  progressFraction: { fontSize: FONT_SIZE.lg, fontWeight: FONT_WEIGHT.bold, color: NICO.textMuted },
  barBg: { height: 10, backgroundColor: NICO.border, borderRadius: 5, overflow: 'hidden' },
  barFill: {
    height: 10, borderRadius: 5,
    backgroundColor: NICO.success,
  },

  doneBanner: {
    backgroundColor: NICO.success, borderRadius: RADIUS.lg, padding: SPACING.md, alignItems: 'center',
  },
  doneBannerText: { fontSize: FONT_SIZE.lg, fontWeight: FONT_WEIGHT.semiBold, color: '#fff' },

  card: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.md,
    borderRadius: RADIUS.lg, paddingVertical: SPACING.sm, paddingHorizontal: SPACING.md, borderLeftWidth: 5,
    ...SHADOW.sm,
  },
  cardDone: { opacity: 0.6 },

  iconWrap: {
    width: scale(46), height: scale(46), borderRadius: RADIUS.md,
    justifyContent: 'center', alignItems: 'center', flexShrink: 0,
  },
  icon: { fontSize: scale(26) },

  name: { flex: 1, fontSize: FONT_SIZE.lg, fontWeight: FONT_WEIGHT.semiBold, color: NICO.text },
  nameDone: { textDecorationLine: 'line-through', color: NICO.textMuted },

  speakBtn: {
    backgroundColor: 'rgba(0,0,0,0.08)', borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.sm, paddingVertical: 3, flexShrink: 0,
  },
  speakIcon: { fontSize: FONT_SIZE.sm },

  checkbox: {
    width: scale(32), height: scale(32), borderRadius: scale(16), borderWidth: 2.5,
    justifyContent: 'center', alignItems: 'center', flexShrink: 0,
  },
  checkmark: { fontSize: FONT_SIZE.md, fontWeight: FONT_WEIGHT.black, color: '#fff' },
});
