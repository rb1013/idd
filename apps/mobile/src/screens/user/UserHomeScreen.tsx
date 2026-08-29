import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, TouchableOpacity, Pressable, StyleSheet, Image, SafeAreaView,
  Modal, Dimensions, ScrollView, Animated,
} from 'react-native';
import * as Speech from 'expo-speech';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/AuthContext';
import { loadGuardianCredentials } from '../../lib/biometricStore';
import { COLORS } from '../../constants';
import { UserStackParamList } from '../../navigation';
import { ScheduleItem } from '../../types';
import { refreshScheduleNotifications } from '../../lib/scheduleNotifications';
import AvatarWithMood from '../../components/AvatarWithMood';

function LogoutIcon() {
  const c = '#fff';
  return (
    <View style={{ width: 38, height: 38 }}>
      <View style={{ position: 'absolute', top: 2, left: 2, width: 9, height: 9, borderRadius: 4.5, backgroundColor: c }} />
      <View style={{ position: 'absolute', top: 12, left: 4, width: 3.5, height: 12, borderRadius: 1.75, backgroundColor: c, transform: [{ rotate: '10deg' }] }} />
      <View style={{ position: 'absolute', top: 22, left: 8, width: 3.5, height: 9, borderRadius: 1.75, backgroundColor: c, transform: [{ rotate: '20deg' }] }} />
      <View style={{ position: 'absolute', top: 22, left: 1, width: 3.5, height: 9, borderRadius: 1.75, backgroundColor: c, transform: [{ rotate: '-20deg' }] }} />
      <View style={{ position: 'absolute', top: 14, left: 7, width: 9, height: 3.5, borderRadius: 1.75, backgroundColor: c, transform: [{ rotate: '-25deg' }] }} />
      <View style={{ position: 'absolute', top: 4, left: 20, right: 2, height: 3.5, borderRadius: 1.75, backgroundColor: c }} />
      <View style={{ position: 'absolute', top: 4, right: 2, bottom: 4, width: 3.5, borderRadius: 1.75, backgroundColor: c }} />
      <View style={{ position: 'absolute', bottom: 4, left: 20, right: 2, height: 3.5, borderRadius: 1.75, backgroundColor: c }} />
      <View style={{ position: 'absolute', top: 17, left: 16, width: 14, height: 3.5, borderRadius: 1.75, backgroundColor: c }} />
      <View style={{ position: 'absolute', top: 10, left: 23, width: 3.5, height: 10, borderRadius: 1.75, backgroundColor: c, transform: [{ rotate: '45deg' }] }} />
      <View style={{ position: 'absolute', top: 17, left: 23, width: 3.5, height: 10, borderRadius: 1.75, backgroundColor: c, transform: [{ rotate: '-45deg' }] }} />
    </View>
  );
}

const MOODS = [
  { emoji: '😊', label: 'Happy' },
  { emoji: '😔', label: 'Sad' },
  { emoji: '😡', label: 'Angry' },
  { emoji: '😴', label: 'Tired' },
  { emoji: '😰', label: 'Anxious' },
  { emoji: '🤩', label: 'Excited' },
  { emoji: '😌', label: 'Calm' },
  { emoji: '😕', label: 'Confused' },
  { emoji: '🤒', label: 'Unwell' },
  { emoji: '😎', label: 'Confident' },
  { emoji: '🥰', label: 'Loved' },
  { emoji: '😤', label: 'Frustrated' },
  { emoji: '🥳', label: 'Celebrating' },
  { emoji: '😢', label: 'Crying' },
  { emoji: '😶', label: 'Blank' },
  { emoji: '🤗', label: 'Grateful' },
];

const { width } = Dimensions.get('window');
const TILE_W = (width - 48 - 16) / 2;

// ── Schedule helpers ──────────────────────────────────────────────────────

function nowMinsOfDay(): number {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes();
}

function startMinsOfDay(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

function findNextClass(items: ScheduleItem[]): { item: ScheduleItem; state: 'upcoming' | 'now' } | null {
  const now = nowMinsOfDay();
  const happeningNow = items.find(i => {
    const diff = startMinsOfDay(i.start_time) - now;
    return diff >= -15 && diff <= 0;
  });
  if (happeningNow) return { item: happeningNow, state: 'now' };
  const upcoming = items.find(i => startMinsOfDay(i.start_time) > now);
  if (upcoming) return { item: upcoming, state: 'upcoming' };
  return null;
}

function timeUntil(startTime: string): string {
  const diff = startMinsOfDay(startTime) - nowMinsOfDay();
  if (diff <= 0) return 'Starting now';
  if (diff < 60) return `In ${diff} min${diff === 1 ? '' : 's'}`;
  const h = Math.floor(diff / 60), m = diff % 60;
  return m > 0 ? `In ${h}h ${m}m` : `In ${h}h`;
}

function formatTime(t: string): string {
  const [h, m] = t.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  return `${h % 12 || 12}:${m.toString().padStart(2, '0')} ${period}`;
}

// ── Component ─────────────────────────────────────────────────────────────

export default function UserHomeScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<UserStackParamList>>();
  const { activeUser, setActiveUser, signOut } = useAuth();
  const [showMoodPicker, setShowMoodPicker] = useState(false);
  const [showUserCard, setShowUserCard] = useState(false);
  const [activityProgress, setActivityProgress] = useState<{ done: number; total: number }>({ done: 0, total: 0 });
  const [scheduleItems, setScheduleItems] = useState<ScheduleItem[]>([]);

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const pulseLoop = useRef<Animated.CompositeAnimation | null>(null);

  useFocusEffect(useCallback(() => {
    if (!activeUser) return;
    Promise.all([
      supabase.rpc('get_user_activities_today', { p_user_id: activeUser.id }),
      supabase.rpc('get_user_schedule_today',   { p_user_id: activeUser.id }),
    ]).then(([{ data: acts }, { data: sched }]) => {
      const list = (acts || []) as { completed: boolean }[];
      setActivityProgress({ done: list.filter(a => a.completed).length, total: list.length });
      const schedList = (sched || []) as ScheduleItem[];
      setScheduleItems(schedList);
      refreshScheduleNotifications(schedList);
    });
  }, [activeUser]));

  const nextClass = findNextClass(scheduleItems);

  useEffect(() => {
    if (nextClass?.state === 'now') {
      pulseLoop.current = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 0.3, duration: 700, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1,   duration: 700, useNativeDriver: true }),
        ])
      );
      pulseLoop.current.start();
    } else {
      pulseLoop.current?.stop();
      pulseAnim.setValue(1);
    }
    return () => { pulseLoop.current?.stop(); };
  }, [nextClass?.state]);

  const firstName = activeUser?.name?.split(' ')[0] ?? 'there';

  async function handleReturnHome() {
    const creds = await loadGuardianCredentials();
    if (creds) {
      await supabase.auth.signInWithPassword({ email: creds.email, password: creds.password });
    } else {
      signOut();
    }
  }

  function openUserCard() {
    Speech.speak(`Hi ${activeUser?.name ?? firstName}`, { rate: 0.85, pitch: 1.0 });
    setShowUserCard(true);
  }

  async function selectMood(m: { emoji: string; label: string }) {
    setShowMoodPicker(false);
    if (!activeUser) return;
    setActiveUser({ ...activeUser, current_mood: m.emoji });
    await supabase.from('user_profiles').update({ current_mood: m.emoji }).eq('id', activeUser.id);
  }

  function speakMood(label: string) {
    Speech.speak(label, { rate: 0.8, pitch: 1.0, volume: 0.7 });
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.homeBtn} onPress={handleReturnHome} activeOpacity={0.75}>
          <Text style={styles.homeIcon}>🏠</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.greeting}>Hi, {firstName}! 👋</Text>
        </View>
        <TouchableOpacity style={styles.avatarBtn} onPress={openUserCard} activeOpacity={0.85}>
          <AvatarWithMood
            name={activeUser?.name ?? '?'}
            photo={activeUser?.photo_url}
            size={68}
            mood={activeUser?.current_mood}
          />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >

        {/* Schedule tile — hidden when no upcoming class today */}
        {nextClass && (
          <TouchableOpacity
            style={[
              styles.scheduleTile,
              nextClass.state === 'now' ? styles.scheduleTileNow : styles.scheduleTileUpcoming,
            ]}
            activeOpacity={0.88}
          >
            <View style={styles.scheduleLeft}>
              <Text style={styles.scheduleEmoji}>{nextClass.item.emoji}</Text>
              <View>
                <Text style={styles.scheduleTitle}>{nextClass.item.title}</Text>
                <Text style={styles.scheduleTime}>
                  {formatTime(nextClass.item.start_time)} – {formatTime(nextClass.item.end_time)}
                </Text>
              </View>
            </View>
            <View style={styles.scheduleRight}>
              {nextClass.state === 'now' ? (
                <View style={styles.nowBadge}>
                  <Animated.View style={[styles.nowDot, { opacity: pulseAnim }]} />
                  <Text style={styles.nowBadgeTxt}>Now</Text>
                </View>
              ) : (
                <Text style={styles.untilTxt}>{timeUntil(nextClass.item.start_time)}</Text>
              )}
            </View>
          </TouchableOpacity>
        )}

        {/* Explore section */}
        <Text style={styles.sectionLabel}>🌈  Explore</Text>

        <View style={styles.grid}>
          <TouchableOpacity style={[styles.tile, styles.friendsTile]} onPress={() => navigation.navigate('FriendsHub')} activeOpacity={0.85}>
            <Text style={styles.tileEmoji}>🤝</Text>
            <Text style={styles.tileTitle}>Friends</Text>
            <Text style={styles.tileSub}>Meet new people{'\n'}and connect</Text>
            <Pressable style={styles.tileSpeakBtn} onPress={() => Speech.speak('Friends. Meet new people and connect.', { rate: 0.8, pitch: 1.1 })}>
              <Text style={styles.tileSpeakIcon}>🔊</Text>
            </Pressable>
          </TouchableOpacity>

          {/* Activities tile */}
          <TouchableOpacity style={[styles.tile, styles.activitiesTile]} onPress={() => navigation.navigate('Activities')} activeOpacity={0.85}>
            <Text style={styles.tileEmoji}>✅</Text>
            <Text style={styles.tileTitle}>Activities</Text>
            {activityProgress.total > 0 ? (
              <Text style={styles.actProgress}>
                {activityProgress.done === activityProgress.total ? '🎉 All done!' : `${activityProgress.done}/${activityProgress.total} done`}
              </Text>
            ) : (
              <Text style={styles.tileSub}>Your daily{'\n'}activities</Text>
            )}
            <Pressable style={styles.tileSpeakBtn} onPress={() => Speech.speak(
              activityProgress.total > 0
                ? `Activities. ${activityProgress.done} of ${activityProgress.total} done.`
                : 'Activities. Your daily activities.',
              { rate: 0.8, pitch: 1.1 }
            )}>
              <Text style={styles.tileSpeakIcon}>🔊</Text>
            </Pressable>
          </TouchableOpacity>

          {/* Messages tile removed — messaging is accessible inside Friends
          <TouchableOpacity style={[styles.tile, styles.messagesTile]} onPress={() => navigation.navigate('Messages')} activeOpacity={0.85}>
            <Text style={styles.tileEmoji}>💬</Text>
            <Text style={styles.tileTitle}>Messages</Text>
            <Text style={styles.tileSub}>Chat with{'\n'}your friends</Text>
          </TouchableOpacity>
          */}

          <TouchableOpacity style={[styles.tile, styles.moodTile]} onPress={() => setShowMoodPicker(true)} activeOpacity={0.85}>
            <Text style={styles.tileEmoji}>{activeUser?.current_mood ?? '😊'}</Text>
            <Text style={styles.tileTitle}>My Mood</Text>
            <Text style={styles.tileSub}>How are you{'\n'}feeling today?</Text>
            <Pressable style={styles.tileSpeakBtn} onPress={() => Speech.speak('My Mood. How are you feeling today?', { rate: 0.8, pitch: 1.1 })}>
              <Text style={styles.tileSpeakIcon}>🔊</Text>
            </Pressable>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.tile, styles.learnTile]} onPress={() => navigation.navigate('Tutorials')} activeOpacity={0.85}>
            <Text style={styles.tileEmoji}>📚</Text>
            <Text style={styles.tileTitle}>Learn</Text>
            <Text style={styles.tileSub}>Watch videos and{'\n'}discover new things</Text>
            <Pressable style={styles.tileSpeakBtn} onPress={() => Speech.speak('Learn. Watch videos and discover new things.', { rate: 0.8, pitch: 1.1 })}>
              <Text style={styles.tileSpeakIcon}>🔊</Text>
            </Pressable>
          </TouchableOpacity>
        </View>

        <View style={{ height: 32 }} />
      </ScrollView>

      {/* User card */}
      <Modal visible={showUserCard} transparent animationType="fade" onRequestClose={() => setShowUserCard(false)}>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setShowUserCard(false)}>
          <TouchableOpacity style={styles.userCard} activeOpacity={1} onPress={() => {}}>
            <TouchableOpacity
              style={styles.closeBtn}
              onPress={() => setShowUserCard(false)}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
            <AvatarWithMood
              name={activeUser?.name ?? '?'}
              photo={activeUser?.photo_url}
              size={88}
              mood={activeUser?.current_mood}
            />
            <Text style={styles.userCardName}>Hi, {activeUser?.name}!</Text>
            <TouchableOpacity
              style={styles.logoutBtn}
              onPress={signOut}
              onLongPress={() => Speech.speak('Log out', { rate: 0.85, pitch: 1.0 })}
              delayLongPress={400}
              activeOpacity={0.8}
            >
              <LogoutIcon />
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Mood picker */}
      <Modal visible={showMoodPicker} transparent animationType="fade" onRequestClose={() => setShowMoodPicker(false)}>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setShowMoodPicker(false)}>
          <TouchableOpacity style={styles.pickerCard} activeOpacity={1} onPress={() => {}}>
            <TouchableOpacity
              style={styles.closeBtn}
              onPress={() => setShowMoodPicker(false)}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
            <Text style={styles.pickerTitle}>How are you feeling?</Text>
            <View style={styles.moodRow}>
              {MOODS.map(m => (
                <TouchableOpacity
                  key={m.emoji}
                  style={[styles.moodOption, activeUser?.current_mood === m.emoji && styles.moodOptionSelected]}
                  onPress={() => selectMood(m)}
                  onLongPress={() => speakMood(m.label)}
                  delayLongPress={400}
                  activeOpacity={0.8}
                >
                  <Text style={styles.moodEmoji}>{m.emoji}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 12,
    gap: 8,
  },
  homeBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: COLORS.primaryLight,
    justifyContent: 'center', alignItems: 'center',
    flexShrink: 0,
  },
  homeIcon: { fontSize: 22 },
  headerCenter: { flex: 1 },
  greeting: { fontSize: 22, fontWeight: '800', color: COLORS.text },
  subGreeting: { fontSize: 13, color: COLORS.textLight, marginTop: 3 },

  avatarBtn: { position: 'relative' },
  avatar: { width: 68, height: 68, borderRadius: 34 },
  avatarPlaceholder: {
    width: 68, height: 68, borderRadius: 34,
    backgroundColor: COLORS.primaryLight,
    justifyContent: 'center', alignItems: 'center',
  },
  avatarText: { fontSize: 26, fontWeight: '700', color: COLORS.primary },
  moodBadge: {
    position: 'absolute', bottom: -2, right: -2,
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2, shadowRadius: 4, elevation: 4,
    borderWidth: 2, borderColor: COLORS.background,
  },
  moodBadgeEmoji: { fontSize: 16 },

  scrollContent: { paddingHorizontal: 16, paddingBottom: 16, gap: 14 },

  // Schedule tile
  scheduleTile: {
    borderRadius: 22,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderLeftWidth: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  scheduleTileUpcoming: { backgroundColor: '#EDE9FE', borderLeftColor: '#7C3AED' },
  scheduleTileNow:      { backgroundColor: '#D1FAE5', borderLeftColor: '#059669' },
  scheduleLeft: { flexDirection: 'row', alignItems: 'center', gap: 14, flex: 1 },
  scheduleEmoji: { fontSize: 36 },
  scheduleTitle: { fontSize: 17, fontWeight: '800', color: COLORS.text, marginBottom: 2 },
  scheduleTime:  { fontSize: 12, color: COLORS.textLight },
  scheduleRight: { alignItems: 'flex-end', paddingLeft: 8 },
  untilTxt: { fontSize: 13, fontWeight: '700', color: '#7C3AED' },
  nowBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#A7F3D0', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 },
  nowDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#059669' },
  nowBadgeTxt: { fontSize: 13, fontWeight: '800', color: '#065F46' },

  // Activities tile
  activitiesTile: { backgroundColor: '#2563EB' },
  actProgress:    { fontSize: 15, fontWeight: '800', color: '#fff', marginTop: 4 },

  // Section label
  sectionLabel: { fontSize: 20, fontWeight: '800', color: COLORS.text, paddingLeft: 4, marginTop: 10 },

  // Feature grid
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  tile: {
    width: TILE_W,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 4,
  },
  friendsTile:  { backgroundColor: '#5CBB7A' },
  // messagesTile: { backgroundColor: '#4A90E2' }, // Messages tile removed
  moodTile:     { backgroundColor: '#F5A623' },
  learnTile:    { backgroundColor: '#9B59B6' },
  tileEmoji: { fontSize: 40, marginBottom: 8 },
  tileTitle: { fontSize: 18, fontWeight: '800', color: '#fff', marginBottom: 4 },
  tileSub:   { fontSize: 12, color: 'rgba(255,255,255,0.85)', textAlign: 'center', lineHeight: 16 },
  tileSpeakBtn: {
    marginTop: 10, backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 16, paddingHorizontal: 12, paddingVertical: 4,
  },
  tileSpeakIcon: { fontSize: 15 },

  // User card
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', alignItems: 'center' },
  userCard: {
    backgroundColor: '#fff', borderRadius: 28,
    paddingHorizontal: 32, paddingTop: 16, paddingBottom: 36,
    width: width - 80, alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.25, shadowRadius: 24, elevation: 12,
  },
  userCardAvatar: { width: 88, height: 88, borderRadius: 44, marginBottom: 16 },
  userCardAvatarPlaceholder: {
    width: 88, height: 88, borderRadius: 44,
    backgroundColor: COLORS.primaryLight,
    justifyContent: 'center', alignItems: 'center', marginBottom: 16,
  },
  userCardAvatarText: { fontSize: 36, fontWeight: '800', color: COLORS.primary },
  userCardName: { fontSize: 22, fontWeight: '800', color: COLORS.text, marginBottom: 28 },
  logoutBtn: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: '#E53E3E',
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#E53E3E', shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4, shadowRadius: 12, elevation: 8,
  },

  // Mood picker
  pickerCard: {
    backgroundColor: '#fff', borderRadius: 28,
    paddingHorizontal: 20, paddingTop: 20, paddingBottom: 28,
    width: width - 48, alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.25, shadowRadius: 24, elevation: 12,
  },
  closeBtn: {
    alignSelf: 'flex-end', width: 40, height: 40, borderRadius: 12,
    justifyContent: 'center', alignItems: 'center',
    backgroundColor: COLORS.border, marginBottom: 8,
  },
  closeBtnText: { fontSize: 20, fontWeight: '900', color: COLORS.text, lineHeight: 22 },
  pickerTitle: { fontSize: 20, fontWeight: '800', color: COLORS.text, marginBottom: 20 },
  moodRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'center' },
  moodOption: {
    alignItems: 'center', gap: 4, padding: 10, borderRadius: 16, width: 72,
    backgroundColor: COLORS.surface, borderWidth: 2, borderColor: 'transparent',
  },
  moodOptionSelected: { borderColor: COLORS.primary, backgroundColor: COLORS.primaryLight },
  moodEmoji: { fontSize: 34 },
  moodLabel: { fontSize: 11, fontWeight: '700', color: COLORS.textLight, textAlign: 'center' },
});
