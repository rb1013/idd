import React, { useCallback, useLayoutEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, ActivityIndicator,
} from 'react-native';
import AppText from '../../components/AppText';
import * as Speech from 'expo-speech';
import { useFocusEffect, useIsFocused, useNavigation } from '@react-navigation/native';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/AuthContext';
import { COLORS, USER_HEADER, USER_TILE_CYCLE } from '../../constants';
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
      const t = setTimeout(() => Speech.speak(NO_ACTIVITIES_MSG, { rate: 0.65, pitch: 1.0 }), 600);
      return () => { clearTimeout(t); Speech.stop(); };
    }
    return () => { Speech.stop(); };
  }, []));

  return (
    <View style={noActStyles.container}>
      <AppText style={noActStyles.emoji}>😊</AppText>
      <AppText style={noActStyles.title}>No activities yet!</AppText>
      <AppText style={noActStyles.hint}>Ask your guardian to add some fun activities for you!</AppText>
      <TouchableOpacity
        style={noActStyles.speakBtn}
        onPress={() => Speech.speak(NO_ACTIVITIES_MSG, { rate: 0.65, pitch: 1.0 })}
        activeOpacity={0.75}
      >
        <AppText style={noActStyles.speakIcon}>🔊</AppText>
        <AppText style={noActStyles.speakText}>Hear this again</AppText>
      </TouchableOpacity>
    </View>
  );
}

const noActStyles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40, gap: 14, backgroundColor: USER_HEADER.pageBackground },
  emoji:    { fontSize: 80 },
  title:    { fontSize: 24, fontWeight: '900', color: COLORS.text, textAlign: 'center' },
  hint:     { fontSize: 16, color: COLORS.textLight, textAlign: 'center', lineHeight: 24 },
  speakBtn: {
    marginTop: 8, flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 22, paddingVertical: 12, borderRadius: 24,
    backgroundColor: '#FDEADB', borderWidth: 1.5, borderColor: '#D4A888',
  },
  speakIcon: { fontSize: 18 },
  speakText: { fontSize: 15, fontWeight: '700', color: USER_HEADER.backgroundColor },
});

function todayLabel(): string {
  return new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
}

export default function ActivitiesScreen() {
  const navigation = useNavigation();
  const { activeUser } = useAuth();
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerStyle:      { backgroundColor: USER_HEADER.backgroundColor },
      headerTintColor:  USER_HEADER.tintColor,
      headerTitleStyle: { color: USER_HEADER.tintColor, fontWeight: '900' as const, fontSize: 18 },
    });
  }, [navigation]);

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
        <AppText style={styles.progressDate}>{todayLabel()}</AppText>
        <View style={styles.progressRow}>
          <AppText style={styles.progressLabel}>
            {allDone ? '🎉 All done!' : `${done} of ${total} done`}
          </AppText>
<AppText style={styles.progressFraction}>{done}/{total}</AppText>
        </View>
        <View style={styles.barBg}>
          <View style={[styles.barFill, { width: `${pct * 100}%` }]} />
        </View>
      </View>

      {allDone && (
        <View style={styles.doneBanner}>
          <AppText style={styles.doneBannerText}>🌟 Amazing job today! Keep it up!</AppText>
        </View>
      )}

      {/* Activity cards */}
      {activities.map((item, idx) => {
        const preset = PRESET_MAP[item.preset_key];
        if (!preset) return null;
        const tile = USER_TILE_CYCLE[idx % USER_TILE_CYCLE.length];
        return (
          <TouchableOpacity
            key={item.activity_id}
            style={[
              styles.card,
              { backgroundColor: tile.backgroundColor, borderLeftColor: tile.borderColor },
              item.completed && styles.cardDone,
            ]}
            onPress={() => toggle(item)}
            activeOpacity={0.8}
          >
            <View style={[styles.iconWrap, { backgroundColor: tile.borderColor + '40' }]}>
              <AppText style={styles.icon}>{preset.emoji}</AppText>
            </View>

            <AppText style={[styles.name, item.completed && styles.nameDone]}>
              {preset.name}
            </AppText>

            <TouchableOpacity
              style={styles.speakBtn}
              onPress={() => Speech.speak(preset.name, { rate: 0.65, pitch: 1.0 })}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <AppText style={styles.speakIcon}>🔊</AppText>
            </TouchableOpacity>

            <View style={[
              styles.checkbox,
              item.completed
                ? { backgroundColor: '#5CBB7A', borderColor: '#5CBB7A' }
                : { borderColor: tile.borderColor },
            ]}>
              {item.completed && <AppText style={styles.checkmark}>✓</AppText>}
            </View>
          </TouchableOpacity>
        );
      })}

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: USER_HEADER.pageBackground },
  content: { padding: 16, gap: 12, paddingBottom: 40 },
  center: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
    backgroundColor: USER_HEADER.pageBackground, padding: 32, gap: 12,
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
  progressRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  progressSpeakBtn: { backgroundColor: 'rgba(0,0,0,0.07)', borderRadius: 14, paddingHorizontal: 10, paddingVertical: 4 },
  progressSpeakIcon: { fontSize: 15 },
  progressLabel: { fontSize: 20, fontWeight: '600', color: COLORS.text },
  progressFraction: { fontSize: 16, fontWeight: '700', color: COLORS.textLight },
  barBg: { height: 10, backgroundColor: COLORS.border, borderRadius: 5, overflow: 'hidden' },
  barFill: {
    height: 10, borderRadius: 5,
    backgroundColor: '#5CBB7A',
  },

  doneBanner: {
    backgroundColor: '#5CBB7A', borderRadius: 16, padding: 14, alignItems: 'center',
  },
  doneBannerText: { fontSize: 17, fontWeight: '600', color: '#fff' },

  card: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderRadius: 16, paddingVertical: 10, paddingHorizontal: 14, borderLeftWidth: 5,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },
  cardDone: { opacity: 0.6 },

  iconWrap: {
    width: 46, height: 46, borderRadius: 13,
    justifyContent: 'center', alignItems: 'center', flexShrink: 0,
  },
  icon: { fontSize: 26 },

  name: { flex: 1, fontSize: 17, fontWeight: '600', color: COLORS.text },
  nameDone: { textDecorationLine: 'line-through', color: COLORS.textLight },

  speakBtn: {
    backgroundColor: 'rgba(0,0,0,0.08)', borderRadius: 14,
    paddingHorizontal: 10, paddingVertical: 3, flexShrink: 0,
  },
  speakIcon: { fontSize: 14 },

  checkbox: {
    width: 32, height: 32, borderRadius: 16, borderWidth: 2.5,
    justifyContent: 'center', alignItems: 'center', flexShrink: 0,
  },
  checkmark: { fontSize: 16, fontWeight: '900', color: '#fff' },
});
