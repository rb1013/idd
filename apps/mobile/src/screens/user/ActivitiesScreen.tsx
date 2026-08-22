import React, { useCallback, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, ActivityIndicator,
} from 'react-native';
import * as Speech from 'expo-speech';
import { useFocusEffect, useIsFocused } from '@react-navigation/native';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/AuthContext';
import { COLORS } from '../../constants';
import { PRESET_MAP } from '../../lib/activityPresets';

interface ActivityItem {
  activity_id: string;
  preset_key: string;
  sort_order: number;
  completed: boolean;
}

const NO_ACTIVITIES_MSG = "No activities yet! Ask your guardian to add some fun activities for you!";

function NoActivitiesState() {
  const spokenRef = useRef(false);
  useFocusEffect(useCallback(() => {
    if (!spokenRef.current) {
      spokenRef.current = true;
      const t = setTimeout(() => Speech.speak(NO_ACTIVITIES_MSG, { rate: 0.8, pitch: 1.1 }), 600);
      return () => { clearTimeout(t); Speech.stop(); };
    }
    return () => { Speech.stop(); };
  }, []));

  return (
    <View style={noActStyles.container}>
      <Text style={noActStyles.emoji}>😊</Text>
      <Text style={noActStyles.title}>No activities yet!</Text>
      <Text style={noActStyles.hint}>Ask your guardian to add some fun activities for you!</Text>
      <TouchableOpacity
        style={noActStyles.speakBtn}
        onPress={() => Speech.speak(NO_ACTIVITIES_MSG, { rate: 0.8, pitch: 1.1 })}
        activeOpacity={0.75}
      >
        <Text style={noActStyles.speakIcon}>🔊</Text>
        <Text style={noActStyles.speakText}>Hear this again</Text>
      </TouchableOpacity>
    </View>
  );
}

const noActStyles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40, gap: 14, backgroundColor: COLORS.background },
  emoji:    { fontSize: 80 },
  title:    { fontSize: 24, fontWeight: '900', color: COLORS.text, textAlign: 'center' },
  hint:     { fontSize: 16, color: COLORS.textLight, textAlign: 'center', lineHeight: 24 },
  speakBtn: {
    marginTop: 8, flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 22, paddingVertical: 12, borderRadius: 24,
    backgroundColor: '#EFF6FF', borderWidth: 1.5, borderColor: '#BFDBFE',
  },
  speakIcon: { fontSize: 18 },
  speakText: { fontSize: 15, fontWeight: '700', color: '#2563EB' },
});

function todayLabel(): string {
  return new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
}

export default function ActivitiesScreen() {
  const { activeUser } = useAuth();
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!activeUser) return;
    const { data } = await supabase.rpc('get_user_activities_today', { p_user_id: activeUser.id });
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
    });
  }

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color={COLORS.primary} /></View>;
  }

  if (activities.length === 0) {
    return <NoActivitiesState />;
  }

  const done  = activities.filter(a => a.completed).length;
  const total = activities.length;
  const allDone = done === total;
  const pct = total > 0 ? done / total : 0;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>

      {/* Progress header */}
      <View style={styles.progressCard}>
        <Text style={styles.progressDate}>{todayLabel()}</Text>
        <View style={styles.progressRow}>
          <Text style={styles.progressLabel}>
            {allDone ? '🎉 All done!' : `${done} of ${total} done`}
          </Text>
          <Text style={styles.progressFraction}>{done}/{total}</Text>
        </View>
        <View style={styles.barBg}>
          <View style={[styles.barFill, { width: `${pct * 100}%` }]} />
        </View>
      </View>

      {allDone && (
        <View style={styles.doneBanner}>
          <Text style={styles.doneBannerText}>🌟 Amazing job today! Keep it up!</Text>
        </View>
      )}

      {/* Activity cards */}
      {activities.map(item => {
        const preset = PRESET_MAP[item.preset_key];
        if (!preset) return null;
        return (
          <TouchableOpacity
            key={item.activity_id}
            style={[
              styles.card,
              { backgroundColor: preset.bgColor, borderLeftColor: preset.color },
              item.completed && styles.cardDone,
            ]}
            onPress={() => toggle(item)}
            activeOpacity={0.8}
          >
            <View style={[styles.iconWrap, { backgroundColor: preset.color + '25' }]}>
              <Text style={styles.icon}>{preset.emoji}</Text>
            </View>

            <Text style={[styles.name, item.completed && styles.nameDone]}>
              {preset.name}
            </Text>

            <View style={[
              styles.checkbox,
              item.completed
                ? { backgroundColor: '#5CBB7A', borderColor: '#5CBB7A' }
                : { borderColor: preset.color },
            ]}>
              {item.completed && <Text style={styles.checkmark}>✓</Text>}
            </View>
          </TouchableOpacity>
        );
      })}

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: 16, gap: 12, paddingBottom: 40 },
  center: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
    backgroundColor: COLORS.background, padding: 32, gap: 12,
  },
  emptyEmoji: { fontSize: 64 },
  emptyTitle: { fontSize: 22, fontWeight: '900', color: COLORS.text },
  emptyHint: { fontSize: 15, color: COLORS.textLight, textAlign: 'center' },

  progressCard: {
    backgroundColor: COLORS.surface, borderRadius: 20, padding: 18,
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.07, shadowRadius: 10, elevation: 3, gap: 10,
  },
  progressDate: { fontSize: 13, fontWeight: '600', color: COLORS.textLight },
  progressRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  progressLabel: { fontSize: 20, fontWeight: '900', color: COLORS.text },
  progressFraction: { fontSize: 16, fontWeight: '700', color: COLORS.textLight },
  barBg: { height: 10, backgroundColor: COLORS.border, borderRadius: 5, overflow: 'hidden' },
  barFill: {
    height: 10, borderRadius: 5,
    backgroundColor: '#5CBB7A',
  },

  doneBanner: {
    backgroundColor: '#5CBB7A', borderRadius: 16, padding: 14, alignItems: 'center',
  },
  doneBannerText: { fontSize: 17, fontWeight: '800', color: '#fff' },

  card: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    borderRadius: 20, padding: 16, borderLeftWidth: 6,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },
  cardDone: { opacity: 0.6 },

  iconWrap: {
    width: 64, height: 64, borderRadius: 18,
    justifyContent: 'center', alignItems: 'center', flexShrink: 0,
  },
  icon: { fontSize: 36 },

  name: { flex: 1, fontSize: 20, fontWeight: '900', color: COLORS.text },
  nameDone: { textDecorationLine: 'line-through', color: COLORS.textLight },

  checkbox: {
    width: 40, height: 40, borderRadius: 20, borderWidth: 3,
    justifyContent: 'center', alignItems: 'center', flexShrink: 0,
  },
  checkmark: { fontSize: 20, fontWeight: '900', color: '#fff' },
});
