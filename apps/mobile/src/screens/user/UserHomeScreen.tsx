import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, TouchableOpacity, Pressable, StyleSheet,
  Modal, Dimensions, ScrollView, Animated, StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import AppText from '../../components/AppText';
import * as Speech from 'expo-speech';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/AuthContext';
import { loadGuardianCredentials } from '../../lib/biometricStore';
import { UserStackParamList } from '../../navigation';
import { ScheduleItem } from '../../types';
import { refreshScheduleNotifications } from '../../lib/scheduleNotifications';
import AvatarWithMood from '../../components/AvatarWithMood';
import ContentContainer from '../../components/ContentContainer';
import {
  NICO, TEXT_STYLE, SPACING, RADIUS, SHADOW, FONT_SIZE, FONT_WEIGHT,
  BUTTERFLY_BORDER, BUTTERFLY_TILES, MAX_CONTENT_WIDTH, IS_TABLET, scale,
} from '../../constants/theme';

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
const CONTENT_W = IS_TABLET && MAX_CONTENT_WIDTH ? MAX_CONTENT_WIDTH : width;
const TILE_W = (CONTENT_W - 48 - 16) / 2;

// Fixed feature colors — consistent with the guardian dashboard's own tile assignments
const FRIENDS_COLOR    = BUTTERFLY_TILES[0]; // teal
const ACTIVITIES_COLOR = BUTTERFLY_TILES[1]; // orange
const LEARN_COLOR      = BUTTERFLY_TILES[2]; // pink — matches guardian's own "Tutorials" tile
const MOOD_COLOR       = BUTTERFLY_TILES[4]; // coral

// ── Schedule helpers ──────────────────────────────────────────────────────

function toLocalDateStr(d: Date): string {
  const y  = d.getFullYear();
  const m  = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

function nowMinsOfDay(): number {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes();
}

function startMinsOfDay(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

type ScheduleState = 'now' | 'upcoming' | 'past';

// All of today's classes, grouped and ordered: happening now first, then
// upcoming (soonest first — already true since the RPC sorts by start_time),
// then already-finished classes (most recently ended first).
function classifySchedule(items: ScheduleItem[]): { item: ScheduleItem; state: ScheduleState }[] {
  const now = nowMinsOfDay();
  const nowItems: ScheduleItem[] = [];
  const upcoming: ScheduleItem[] = [];
  const past: ScheduleItem[] = [];
  for (const i of items) {
    const diff = startMinsOfDay(i.start_time) - now;
    if (diff >= -15 && diff <= 0) nowItems.push(i);
    else if (diff > 0) upcoming.push(i);
    else past.push(i);
  }
  past.reverse();
  return [
    ...nowItems.map(item => ({ item, state: 'now' as const })),
    ...upcoming.map(item => ({ item, state: 'upcoming' as const })),
    ...past.map(item => ({ item, state: 'past' as const })),
  ];
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
    // Pass the learner's own local calendar date rather than letting the RPCs
    // use the database's current_date (UTC on Supabase) — otherwise evening
    // hours in any timezone behind UTC make the DB think it's already
    // tomorrow, silently hiding today's later classes/activities.
    const today = toLocalDateStr(new Date());
    Promise.all([
      supabase.rpc('get_user_activities_today', { p_user_id: activeUser.id, p_today: today }),
      supabase.rpc('get_user_schedule_today',   { p_user_id: activeUser.id, p_today: today }),
    ]).then(([{ data: acts }, { data: sched }]) => {
      const list = (acts || []) as { completed: boolean }[];
      setActivityProgress({ done: list.filter(a => a.completed).length, total: list.length });
      const schedList = (sched || []) as ScheduleItem[];
      setScheduleItems(schedList);
      refreshScheduleNotifications(schedList);
    });
  }, [activeUser]));

  const scheduleRows = classifySchedule(scheduleItems);
  const hasNowClass = scheduleRows.some(r => r.state === 'now');

  useEffect(() => {
    if (hasNowClass) {
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
  }, [hasNowClass]);

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
    Speech.speak(`Hi ${activeUser?.name ?? firstName}`, { rate: 0.65, pitch: 1.0 });
  }

  async function selectMood(m: { emoji: string; label: string }) {
    setShowMoodPicker(false);
    if (!activeUser) return;
    setActiveUser({ ...activeUser, current_mood: m.emoji });
    await supabase.from('user_profiles').update({ current_mood: m.emoji }).eq('id', activeUser.id);
  }

  function speakMood(label: string) {
    Speech.speak(label, { rate: 0.65, pitch: 1.0, volume: 0.7 });
  }

  return (
    <View style={s.root}>
      <StatusBar barStyle="dark-content" backgroundColor={NICO.background} />
      <SafeAreaView edges={['top']} style={s.safeHeader}>
        <LinearGradient
          colors={[...BUTTERFLY_BORDER.colors]}
          start={BUTTERFLY_BORDER.start}
          end={BUTTERFLY_BORDER.end}
          style={s.headerBorder}
        >
          <View style={s.headerInner}>
            <TouchableOpacity style={s.homeBtn} onPress={handleReturnHome} activeOpacity={0.75}>
              <AppText style={s.homeIcon}>🏠</AppText>
            </TouchableOpacity>
            <View style={s.headerCenter}>
              <AppText style={s.greeting}>Hi, {firstName}</AppText>
            </View>
            <TouchableOpacity style={s.avatarBtn} onPress={openUserCard} activeOpacity={0.85}>
              <AvatarWithMood
                name={activeUser?.name ?? '?'}
                photo={activeUser?.photo_url}
                size={56}
                mood={activeUser?.current_mood}
              />
            </TouchableOpacity>
          </View>
        </LinearGradient>
      </SafeAreaView>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
      >

        {/* Today's schedule — hidden when there are no classes today */}
        {scheduleRows.length > 0 && (
          <View style={s.scheduleList}>
            {scheduleRows.map(({ item, state }, index) => {
              const tile = BUTTERFLY_TILES[index % BUTTERFLY_TILES.length];
              return (
              <TouchableOpacity
                key={item.id}
                style={[
                  s.scheduleTile,
                  state === 'now' ? s.scheduleTileNow
                    : state === 'past' ? s.scheduleTilePast
                    : { backgroundColor: tile.bg, borderLeftColor: tile.accent },
                ]}
                activeOpacity={0.88}
              >
                <View style={s.scheduleLeft}>
                  <AppText style={s.scheduleEmoji}>{item.emoji}</AppText>
                  <View>
                    <AppText style={[s.scheduleTitle, state === 'past' && s.scheduleTitlePast]}>{item.title}</AppText>
                    <AppText style={s.scheduleTime}>
                      {formatTime(item.start_time)} – {formatTime(item.end_time)}
                    </AppText>
                  </View>
                </View>
                <View style={s.scheduleRight}>
                  {state === 'now' ? (
                    <View style={s.nowBadge}>
                      <Animated.View style={[s.nowDot, { opacity: pulseAnim }]} />
                      <AppText style={s.nowBadgeTxt}>Now</AppText>
                    </View>
                  ) : state === 'upcoming' ? (
                    <AppText style={s.untilTxt}>{timeUntil(item.start_time)}</AppText>
                  ) : (
                    <AppText style={s.finishedTxt}>Finished</AppText>
                  )}
                  <Pressable
                    style={s.scheduleSpeakBtn}
                    hitSlop={10}
                    onPress={() => {
                      const when = state === 'now' ? 'right now' : state === 'past' ? 'earlier today' : `today at ${formatTime(item.start_time)}`;
                      Speech.speak(`${item.title}, ${when}`, { rate: 0.65, pitch: 1.0 });
                    }}
                  >
                    <AppText style={s.scheduleSpeakIcon}>🔊</AppText>
                  </Pressable>
                </View>
              </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* Explore section */}

        <ContentContainer style={s.gridContainer}>
        <View style={s.grid}>
          <TouchableOpacity style={[s.tile, { backgroundColor: FRIENDS_COLOR.bg, borderColor: FRIENDS_COLOR.accent }]} onPress={() => navigation.navigate('FriendsHub')} activeOpacity={0.85}>
            <AppText style={s.tileEmoji}>🤝</AppText>
            <AppText style={s.tileTitle}>Friends</AppText>
            <AppText style={s.tileSub}>Meet new people{'\n'}and connect</AppText>
            <Pressable style={s.tileSpeakBtn} onPress={() => Speech.speak('Friends. Meet new people and connect.', { rate: 0.65, pitch: 1.0 })}>
              <AppText style={s.tileSpeakIcon}>🔊</AppText>
            </Pressable>
          </TouchableOpacity>

          {/* Activities tile */}
          <TouchableOpacity style={[s.tile, { backgroundColor: ACTIVITIES_COLOR.bg, borderColor: ACTIVITIES_COLOR.accent }]} onPress={() => navigation.navigate('Activities')} activeOpacity={0.85}>
            <AppText style={s.tileEmoji}>✅</AppText>
            <AppText style={s.tileTitle}>Activities</AppText>
            {activityProgress.total > 0 ? (
              <AppText style={s.actProgress}>
                {activityProgress.done === activityProgress.total ? '🎉 All done!' : `${activityProgress.done}/${activityProgress.total} done`}
              </AppText>
            ) : (
              <AppText style={s.tileSub}>Your daily{'\n'}activities</AppText>
            )}
            <Pressable style={s.tileSpeakBtn} onPress={() => Speech.speak(
              activityProgress.total > 0
                ? `Activities. ${activityProgress.done} of ${activityProgress.total} done.`
                : 'Activities. Your daily activities.',
              { rate: 0.65, pitch: 1.0 }
            )}>
              <AppText style={s.tileSpeakIcon}>🔊</AppText>
            </Pressable>
          </TouchableOpacity>

          <TouchableOpacity style={[s.tile, { backgroundColor: MOOD_COLOR.bg, borderColor: MOOD_COLOR.accent }]} onPress={() => setShowMoodPicker(true)} activeOpacity={0.85}>
            <AppText style={s.tileEmoji}>{activeUser?.current_mood ?? '😊'}</AppText>
            <AppText style={s.tileTitle}>My Mood</AppText>
            <AppText style={s.tileSub}>How are you{'\n'}feeling today?</AppText>
            <Pressable style={s.tileSpeakBtn} onPress={() => Speech.speak('My Mood. How are you feeling today?', { rate: 0.65, pitch: 1.0 })}>
              <AppText style={s.tileSpeakIcon}>🔊</AppText>
            </Pressable>
          </TouchableOpacity>

          <TouchableOpacity style={[s.tile, { backgroundColor: LEARN_COLOR.bg, borderColor: LEARN_COLOR.accent }]} onPress={() => navigation.navigate('Tutorials')} activeOpacity={0.85}>
            <AppText style={s.tileEmoji}>📚</AppText>
            <AppText style={s.tileTitle}>Learn</AppText>
            <AppText style={s.tileSub}>Watch videos and{'\n'}discover new things</AppText>
            <Pressable style={s.tileSpeakBtn} onPress={() => Speech.speak('Learn. Watch videos and discover new things.', { rate: 0.65, pitch: 1.0 })}>
              <AppText style={s.tileSpeakIcon}>🔊</AppText>
            </Pressable>
          </TouchableOpacity>
        </View>
        </ContentContainer>

        <View style={{ height: 32 }} />
      </ScrollView>

      {/* User card */}
      <Modal visible={showUserCard} transparent animationType="fade" onRequestClose={() => setShowUserCard(false)}>
        <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={() => setShowUserCard(false)}>
          <TouchableOpacity style={s.userCard} activeOpacity={1} onPress={() => {}}>
            <TouchableOpacity
              style={s.closeBtn}
              onPress={() => setShowUserCard(false)}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <AppText style={s.closeBtnText}>✕</AppText>
            </TouchableOpacity>
            <AvatarWithMood
              name={activeUser?.name ?? '?'}
              photo={activeUser?.photo_url}
              size={88}
              mood={activeUser?.current_mood}
            />
            <AppText style={s.userCardName}>Hi, {activeUser?.name}!</AppText>
            <TouchableOpacity
              style={s.logoutBtn}
              onPress={signOut}
              onLongPress={() => Speech.speak('Log out', { rate: 0.65, pitch: 1.0 })}
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
        <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={() => setShowMoodPicker(false)}>
          <TouchableOpacity style={s.pickerCard} activeOpacity={1} onPress={() => {}}>
            <TouchableOpacity
              style={s.closeBtn}
              onPress={() => setShowMoodPicker(false)}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <AppText style={s.closeBtnText}>✕</AppText>
            </TouchableOpacity>
            <AppText style={s.pickerTitle}>How are you feeling?</AppText>
            <View style={s.moodRow}>
              {MOODS.map(m => (
                <TouchableOpacity
                  key={m.emoji}
                  style={[s.moodOption, activeUser?.current_mood === m.emoji && s.moodOptionSelected]}
                  onPress={() => selectMood(m)}
                  onLongPress={() => speakMood(m.label)}
                  delayLongPress={400}
                  activeOpacity={0.8}
                >
                  <AppText style={s.moodEmoji}>{m.emoji}</AppText>
                </TouchableOpacity>
              ))}
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  root:       { flex: 1, backgroundColor: NICO.screenBg },
  safeHeader: { backgroundColor: NICO.background },

  headerBorder: {
    paddingBottom: BUTTERFLY_BORDER.width,
    paddingLeft:   BUTTERFLY_BORDER.width,
    paddingRight:  BUTTERFLY_BORDER.width,
  },
  headerInner: {
    flexDirection:     'row',
    justifyContent:    'space-between',
    alignItems:        'center',
    backgroundColor:   NICO.background,
    paddingHorizontal: SPACING.base,
    paddingVertical:   SPACING.sm,
    gap:               SPACING.sm,
  },
  homeBtn: {
    width: scale(44), height: scale(44), borderRadius: scale(22),
    backgroundColor: NICO.primaryLight,
    justifyContent: 'center', alignItems: 'center',
    flexShrink: 0,
  },
  homeIcon: { fontSize: FONT_SIZE.xl },
  headerCenter: { flex: 1, alignItems: 'center' },
  greeting: { ...TEXT_STYLE.cardTitle, fontSize: FONT_SIZE.xl },

  avatarBtn: { position: 'relative' },

  scrollContent: {
    flexGrow: 1, justifyContent: 'center',
    paddingHorizontal: SPACING.base, paddingTop: SPACING.md, paddingBottom: SPACING.base, gap: SPACING.md,
  },

  // Schedule list
  scheduleList: { gap: SPACING.sm },
  scheduleTile: {
    borderRadius: RADIUS.lg,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderLeftWidth: 4,
    ...SHADOW.sm,
  },
  scheduleTileNow:      { backgroundColor: NICO.successLight, borderLeftColor: NICO.success },
  scheduleTilePast:     { backgroundColor: NICO.background, borderLeftColor: NICO.border, opacity: 0.6, ...SHADOW.none },
  scheduleLeft: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, flex: 1 },
  scheduleEmoji: { fontSize: scale(36) },
  scheduleTitle: { fontSize: FONT_SIZE.md, fontWeight: FONT_WEIGHT.extraBold, color: NICO.text, marginBottom: 2 },
  scheduleTitlePast: { color: NICO.textMuted },
  scheduleTime:  { fontSize: FONT_SIZE.sm, fontWeight: FONT_WEIGHT.semiBold, color: NICO.textMuted },
  scheduleRight: { alignItems: 'flex-end', paddingLeft: SPACING.sm, gap: SPACING.sm },
  scheduleSpeakBtn: { padding: 4, backgroundColor: 'rgba(0,0,0,0.08)', borderRadius: RADIUS.md, width: scale(28), height: scale(28), justifyContent: 'center', alignItems: 'center' },
  scheduleSpeakIcon: { fontSize: FONT_SIZE.sm },
  untilTxt: { fontSize: FONT_SIZE.sm, fontWeight: FONT_WEIGHT.bold, color: NICO.textMuted },
  finishedTxt: { fontSize: FONT_SIZE.sm, fontWeight: FONT_WEIGHT.medium, color: NICO.textMuted },
  nowBadge: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs, backgroundColor: NICO.success, borderRadius: RADIUS.full, paddingHorizontal: SPACING.sm, paddingVertical: SPACING.xs },
  nowDot: { width: scale(8), height: scale(8), borderRadius: scale(4), backgroundColor: '#fff' },
  nowBadgeTxt: { fontSize: FONT_SIZE.sm, fontWeight: FONT_WEIGHT.extraBold, color: '#fff' },

  actProgress: { fontSize: FONT_SIZE.sm, fontWeight: FONT_WEIGHT.extraBold, color: NICO.text, marginTop: SPACING.xs, textAlign: 'center' },

  // Feature grid
  gridContainer: { alignSelf: 'center' },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: SPACING.md,
  },
  tile: {
    width: TILE_W,
    borderRadius: RADIUS['2xl'],
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.sm,
    ...SHADOW.md,
  },
  tileEmoji: { fontSize: scale(40), marginBottom: SPACING.sm },
  tileTitle: { fontSize: FONT_SIZE.lg, fontWeight: FONT_WEIGHT.extraBold, color: NICO.text, marginBottom: SPACING.xs },
  tileSub:   { fontSize: FONT_SIZE.sm, fontWeight: FONT_WEIGHT.semiBold, color: NICO.textMuted, textAlign: 'center', lineHeight: 16 },
  tileSpeakBtn: {
    marginTop: SPACING.sm, backgroundColor: 'rgba(0,0,0,0.08)',
    borderRadius: RADIUS.md, paddingHorizontal: SPACING.md, paddingVertical: 4,
  },
  tileSpeakIcon: { fontSize: FONT_SIZE.sm },

  // User card
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', alignItems: 'center' },
  userCard: {
    backgroundColor: NICO.surface, borderRadius: RADIUS['3xl'],
    paddingHorizontal: SPACING.xl, paddingTop: SPACING.base, paddingBottom: SPACING['2xl'],
    width: width - 80, alignItems: 'center',
    ...SHADOW.lg,
  },
  userCardName: { fontSize: FONT_SIZE['2xl'], fontWeight: FONT_WEIGHT.black, color: NICO.text, marginBottom: SPACING.xl },
  logoutBtn: {
    width: scale(72), height: scale(72), borderRadius: scale(36),
    backgroundColor: NICO.error,
    justifyContent: 'center', alignItems: 'center',
    ...SHADOW.md,
  },

  // Mood picker
  pickerCard: {
    backgroundColor: NICO.surface, borderRadius: RADIUS['3xl'],
    paddingHorizontal: SPACING.lg, paddingTop: SPACING.lg, paddingBottom: SPACING.xl,
    width: width - 48, alignItems: 'center',
    ...SHADOW.lg,
  },
  closeBtn: {
    alignSelf: 'flex-end', width: scale(40), height: scale(40), borderRadius: RADIUS.md,
    justifyContent: 'center', alignItems: 'center',
    backgroundColor: NICO.background, marginBottom: SPACING.sm,
  },
  closeBtnText: { fontSize: FONT_SIZE.xl, fontWeight: FONT_WEIGHT.black, color: NICO.text, lineHeight: 22 },
  pickerTitle: { fontSize: FONT_SIZE['2xl'], fontWeight: FONT_WEIGHT.black, color: NICO.text, marginBottom: SPACING.lg },
  moodRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm, justifyContent: 'center' },
  moodOption: {
    alignItems: 'center', gap: 4, padding: SPACING.sm, borderRadius: RADIUS.lg, width: scale(72),
    backgroundColor: NICO.background, borderWidth: 2, borderColor: 'transparent',
  },
  moodOptionSelected: { borderColor: NICO.primary, backgroundColor: NICO.primaryLight },
  moodEmoji: { fontSize: scale(34) },
});
