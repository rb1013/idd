import React, { useCallback, useState } from 'react';
import {
  View, TouchableOpacity, StyleSheet, Modal,
  ScrollView, StatusBar, Image, Platform, Alert, ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import AppText from '../../components/AppText';
import ContentContainer from '../../components/ContentContainer';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as Notifications from 'expo-notifications';
import { useAuth } from '../../lib/AuthContext';
import { supabase } from '../../lib/supabase';
import {
  NICO, TEXT_STYLE, SPACING, RADIUS, SHADOW, BUTTERFLY_BORDER, BUTTERFLY_TILES, FONT_SIZE, FONT_WEIGHT, BTN_SIZE, BTN_VARIANT, scale,
} from '../../constants/theme';
import { GuardianNavParamList } from '../../navigation';

type Nav = NativeStackNavigationProp<GuardianNavParamList>;

type Learner = { id: string; name: string; photo_url: string | null; tutorialCount: number };
type Stats   = { learners: number; tutorials: number; activities: number };

type TileDef = { label: string; emoji: string; sub: string; ci: number; screen: keyof GuardianNavParamList };

const GUARDIAN_TILES: TileDef[] = [
  { label: 'Tutorials',   emoji: '📚', sub: 'Manage content', ci: 2, screen: 'Learning'           },
  { label: 'Connections', emoji: '👥', sub: 'My network',     ci: 1, screen: 'GuardianConnections' },
  { label: 'Discussions', emoji: '💬', sub: 'Community',      ci: 5, screen: 'Discussions'         },
  { label: 'Events',      emoji: '🎉', sub: 'Coming up',      ci: 4, screen: 'Events'              },
];

type LearnerTileDef = TileDef & { params?: Record<string, unknown> };

// Coral (ci:3) — learner tiles
const LEARNER_TILE_COLOR = BUTTERFLY_TILES[3];
// Teal (ci:0) — messaging toggle
const TOGGLE_COLOR = BUTTERFLY_TILES[0];

const LEARNER_TILES: LearnerTileDef[] = [
  { label: 'Friends',    emoji: '👥', sub: 'Social',     ci: 0, screen: 'LearnerFriends'                                  },
  { label: 'Learn',      emoji: '📚', sub: 'Tutorials',  ci: 0, screen: 'TutorialLibrary', params: { linkedOnly: true }  },
  { label: 'Activities', emoji: '✅', sub: 'Daily tasks', ci: 0, screen: 'Activities'                                      },
  { label: 'Schedule',   emoji: '📅', sub: 'Calendar',   ci: 0, screen: 'Schedule'                                        },
];

export default function GuardianHomeScreen() {
  const navigation = useNavigation<Nav>();
  const { guardian, signOut } = useAuth();
  const [learners, setLearners]                   = useState<Learner[]>([]);
  const [stats, setStats]                         = useState<Stats>({ learners: 0, tutorials: 0, activities: 0 });
  const [messagingDisabled, setMessagingDisabled] = useState(false);
  const [togglingMsg, setTogglingMsg]             = useState(false);
  const [unreadCount, setUnreadCount]             = useState(0);
  const [ttsDisabled, setTtsDisabled]             = useState(false);
  const [togglingTts, setTogglingTts]             = useState(false);
  const [showTtsInfo, setShowTtsInfo]             = useState(false);
  const insets = useSafeAreaInsets();

  function handleSignOut() {
    Alert.alert('Sign out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: signOut },
    ]);
  }

  useFocusEffect(
    useCallback(() => {
      if (!guardian) return;
      loadData(guardian.id);
      registerPushToken(guardian.id);
    }, [guardian?.id])
  );

  async function loadData(guardianId: string) {
    const [
      { data: profiles },
      { count: tutorialCount },
      { count: activityCount },
      { count: unread },
    ] = await Promise.all([
      supabase.from('user_profiles').select('id, name, photo_url').eq('guardian_id', guardianId),
      supabase.from('tutorials').select('id', { count: 'exact', head: true }).eq('created_by_guardian_id', guardianId),
      supabase.from('guardian_activity_presets').select('id', { count: 'exact', head: true }).eq('guardian_id', guardianId),
      supabase.from('notifications').select('id', { count: 'exact', head: true }).eq('guardian_id', guardianId).eq('read', false),
    ]);
    setUnreadCount(unread ?? 0);

    const profileList = profiles ?? [];

    const enriched = await Promise.all(
      profileList.map(async p => {
        const { count } = await supabase
          .from('user_tutorials')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', p.id);
        return { ...p, tutorialCount: count ?? 0 } as Learner;
      })
    );

    setLearners(enriched);
    setStats({
      learners:   profileList.length,
      tutorials:  tutorialCount  ?? 0,
      activities: activityCount  ?? 0,
    });

    if (profileList.length > 0) {
      supabase.from('user_profiles').select('messaging_disabled, tts_disabled').eq('id', profileList[0].id).single()
        .then(({ data }) => { if (data) { setMessagingDisabled(!!data.messaging_disabled); setTtsDisabled(!!data.tts_disabled); } });
    }
  }

  async function registerPushToken(guardianId: string) {
    if (Platform.OS === 'web') return;
    try {
      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== 'granted') return;
      const token = (await Notifications.getExpoPushTokenAsync()).data;
      if (!token) return;
      await supabase.from('guardians').update({ expo_push_token: token }).eq('id', guardianId);
    } catch {
      // Requires EAS project — skip silently
    }
  }

  async function toggleMessaging() {
    if (!learners[0]) return;
    setTogglingMsg(true);
    const newVal = !messagingDisabled;
    await supabase.from('user_profiles').update({ messaging_disabled: newVal }).eq('id', learners[0].id);
    setMessagingDisabled(newVal);
    setTogglingMsg(false);
  }

  async function toggleTts() {
    if (!learners[0]) return;
    setTogglingTts(true);
    const newVal = !ttsDisabled;
    await supabase.from('user_profiles').update({ tts_disabled: newVal }).eq('id', learners[0].id);
    setTtsDisabled(newVal);
    setTogglingTts(false);
  }

  const initial   = guardian?.full_name?.[0]?.toUpperCase() ?? 'G';
  const firstname = learners[0]?.name?.split(' ')[0] ?? 'Learner';
  const hasLearner = learners.length > 0;

  return (
    <View style={s.root}>
      <StatusBar barStyle="dark-content" backgroundColor={NICO.background} />

      {/* ── Header ── */}
      <SafeAreaView edges={['top']} style={s.safeHeader}>
        <LinearGradient
          colors={[...BUTTERFLY_BORDER.colors]}
          start={BUTTERFLY_BORDER.start}
          end={BUTTERFLY_BORDER.end}
          style={s.headerBorder}
        >
          <View style={s.headerInner}>
            <View style={s.guardianLeft}>
              {guardian?.photo_url ? (
                <Image source={{ uri: guardian.photo_url }} style={s.avatarCircle} />
              ) : (
                <View style={s.avatarCircle}>
                  <AppText style={s.avatarInitial}>{initial}</AppText>
                </View>
              )}
              <AppText style={s.guardianName}>{guardian?.full_name ?? 'Guardian'}</AppText>
            </View>

            <TouchableOpacity
              onPress={() => navigation.navigate('Notifications')}
              activeOpacity={0.75}
              style={s.bellBtn}
            >
              <AppText style={s.bellIcon}>🔔</AppText>
              {unreadCount > 0 && (
                <View style={s.bellBadge}>
                  <AppText style={s.bellBadgeText}>{unreadCount > 9 ? '9+' : unreadCount}</AppText>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </LinearGradient>
      </SafeAreaView>

      {/* ── Body ── */}
      <ScrollView
        style={s.body}
        contentContainerStyle={[s.bodyContent, { paddingBottom: SPACING['2xl'] + insets.bottom }]}
        showsVerticalScrollIndicator={false}
      >
        <ContentContainer>

          {/* Your Dashboard */}
          <AppText style={s.sectionLabel}>Your Dashboard</AppText>
          <View style={s.tileGrid}>
            {([[0, 1], [2, 3]] as [number, number][]).map((pair, ri) => (
              <View key={ri} style={s.guardianTileRow}>
                {pair.map(idx => {
                  const tile = GUARDIAN_TILES[idx];
                  const color = BUTTERFLY_TILES[tile.ci];
                  return (
                    <TouchableOpacity
                      key={tile.label}
                      style={[s.tile, s.guardianTile, { backgroundColor: color.bg }]}
                      onPress={() => navigation.navigate(tile.screen as any)}
                      activeOpacity={0.78}
                    >
                      <AppText style={s.tileEmoji}>{tile.emoji}</AppText>
                      <AppText style={s.tileLabel}>{tile.label}</AppText>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ))}
          </View>

          {/* Learner zone */}
          <LinearGradient
            colors={[...BUTTERFLY_BORDER.colors]}
            start={BUTTERFLY_BORDER.start}
            end={BUTTERFLY_BORDER.end}
            style={s.zoneBorder}
          >
          <View style={s.zoneCard}>
            <AppText style={s.zoneLabel}>
              {hasLearner ? `${firstname}'s zone` : 'Your Learner'}
            </AppText>

            {hasLearner ? (
              <>
                {([[0, 1], [2, 3]] as [number, number][]).map((pair, ri) => (
                  <View key={ri} style={s.tileRow}>
                    {pair.map(idx => {
                      const tile = LEARNER_TILES[idx];
                      return (
                        <TouchableOpacity
                          key={tile.label}
                          style={[s.tile, { backgroundColor: LEARNER_TILE_COLOR.bg }]}
                          onPress={() => navigation.navigate(tile.screen as any, tile.params as any)}
                          activeOpacity={0.78}
                        >
                          <AppText style={s.tileEmoji}>{tile.emoji}</AppText>
                          <AppText style={s.tileLabel}>{tile.label}</AppText>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                ))}

                {/* Messaging toggle */}
                <TouchableOpacity
                  style={s.settingRow}
                  onPress={toggleMessaging}
                  activeOpacity={0.8}
                  disabled={togglingMsg}
                >
                  <View style={s.settingInfo}>
                    <AppText style={s.settingLabel}>Disable Messaging</AppText>
                  </View>
                  {togglingMsg ? (
                    <ActivityIndicator size="small" color={TOGGLE_COLOR.accent} />
                  ) : (
                    <View style={[s.toggle, messagingDisabled && s.toggleOn]}>
                      <View style={[s.toggleThumb, messagingDisabled && s.toggleThumbOn]} />
                    </View>
                  )}
                </TouchableOpacity>

                {/* TTS toggle */}
                <TouchableOpacity
                  style={s.settingRow}
                  onPress={toggleTts}
                  activeOpacity={0.8}
                  disabled={togglingTts}
                >
                  <View style={s.settingInfo}>
                    <AppText style={s.settingLabel}>Disable Text to Speech 🔊</AppText>
                    <TouchableOpacity
                      onPress={() => setShowTtsInfo(true)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      activeOpacity={0.7}
                    >
                      <AppText style={s.infoIcon}>ⓘ</AppText>
                    </TouchableOpacity>
                  </View>
                  {togglingTts ? (
                    <ActivityIndicator size="small" color={TOGGLE_COLOR.accent} />
                  ) : (
                    <View style={[s.toggle, ttsDisabled && s.toggleOn]}>
                      <View style={[s.toggleThumb, ttsDisabled && s.toggleThumbOn]} />
                    </View>
                  )}
                </TouchableOpacity>

                {/* TTS info modal */}
                <Modal visible={showTtsInfo} transparent animationType="fade" onRequestClose={() => setShowTtsInfo(false)}>
                  <TouchableOpacity style={s.infoOverlay} activeOpacity={1} onPress={() => setShowTtsInfo(false)}>
                    <View style={s.infoCard} onStartShouldSetResponder={() => true}>
                      <AppText style={s.infoTitle}>Text to Speech</AppText>
                      <AppText style={s.infoBody}>
                        Some pages in the learner zone read content aloud automatically. For some children, unexpected audio can feel startling or overwhelming and may cause distress.{'\n\n'}Enable this setting to turn off all automatic voice reading for your learner.
                      </AppText>
                      <TouchableOpacity style={s.infoDismiss} onPress={() => setShowTtsInfo(false)} activeOpacity={0.8}>
                        <AppText style={s.infoDismissText}>Got it</AppText>
                      </TouchableOpacity>
                    </View>
                  </TouchableOpacity>
                </Modal>
              </>
            ) : (
              <>
                <AppText style={s.emptyHint}>Add a learner to unlock their zone</AppText>
                <TouchableOpacity
                  style={s.addBtn}
                  onPress={() => navigation.navigate('CreateUser')}
                  activeOpacity={0.85}
                >
                  <AppText style={s.addBtnText}>+ Add Learner</AppText>
                </TouchableOpacity>
              </>
            )}
          </View>
          </LinearGradient>

        </ContentContainer>
      </ScrollView>

      {/* ── Bottom bar ── */}
      <View style={s.bottomBar}>
        <View style={[s.bottomBarInner, { paddingBottom: insets.bottom || SPACING.sm }]}>
          <TouchableOpacity style={s.navItem} onPress={() => navigation.navigate('LearnerSelect')} activeOpacity={0.75}>
            <AppText style={s.navIcon}>🏠</AppText>
            <AppText style={[s.navLabel, s.navLabelActive]}>Home</AppText>
          </TouchableOpacity>
          <TouchableOpacity
            style={s.navItem}
            onPress={() => navigation.navigate('Account')}
            activeOpacity={0.75}
          >
            <AppText style={s.navIcon}>👤</AppText>
            <AppText style={s.navLabel}>Account</AppText>
          </TouchableOpacity>
          <TouchableOpacity
            style={s.navItem}
            onPress={handleSignOut}
            activeOpacity={0.75}
          >
            <AppText style={s.navIcon}>🚪</AppText>
            <AppText style={[s.navLabel, s.navLabelSignOut]}>Sign Out</AppText>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root:       { flex: 1, backgroundColor: NICO.screenBg },
  safeHeader: { backgroundColor: NICO.background },

  headerBorder: {
    paddingBottom:   BUTTERFLY_BORDER.width,
    paddingLeft:     BUTTERFLY_BORDER.width,
    paddingRight:    BUTTERFLY_BORDER.width,
  },
  headerInner: {
    flexDirection:    'row',
    justifyContent:   'space-between',
    alignItems:       'center',
    backgroundColor:  NICO.background,
    paddingHorizontal: SPACING.base,
    paddingVertical:  SPACING.md,
  },
  guardianLeft: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  avatarCircle: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: NICO.primaryLight,
    justifyContent: 'center', alignItems: 'center',
    overflow: 'hidden',
  },
  avatarInitial: { ...TEXT_STYLE.label, color: NICO.primary, fontSize: FONT_SIZE.md },
  guardianName:  { ...TEXT_STYLE.bodyMedium },
  bellBtn:       { padding: SPACING.xs, position: 'relative' },
  bellIcon:      { fontSize: scale(22) },
  bellBadge: {
    position: 'absolute', top: 0, right: 0,
    backgroundColor: NICO.error, borderRadius: RADIUS.full,
    minWidth: scale(16), height: scale(16), paddingHorizontal: 3,
    justifyContent: 'center', alignItems: 'center',
  },
  bellBadgeText: { fontSize: scale(9), fontWeight: FONT_WEIGHT.extraBold, color: '#fff' },

  body:        { flex: 1 },
  bodyContent: { padding: SPACING.base, paddingTop: SPACING.xl, gap: SPACING.base },

  sectionLabel: {
    ...TEXT_STYLE.cardTitle,
    marginBottom: SPACING.md,
  },

  tileGrid:        { gap: SPACING.md },
  tileRow:         { flexDirection: 'row', gap: SPACING.md },
  guardianTileRow: { flexDirection: 'row', gap: SPACING.sm, justifyContent: 'center' },
  tile: {
    flex: 1,
    borderRadius:      RADIUS.lg,
    paddingVertical:   SPACING.md,
    paddingHorizontal: SPACING.sm,
    alignItems:        'center',
    gap:               SPACING.xs,
    ...SHADOW.sm,
  },
  guardianTile: { flex: 0, width: '40%' },
  tileEmoji: { fontSize: 24 },
  tileLabel: { ...TEXT_STYLE.bodyMedium, textAlign: 'center' },

  zoneBorder: {
    borderRadius: RADIUS['2xl'] + BUTTERFLY_BORDER.width,
    padding:      BUTTERFLY_BORDER.width,
    marginTop:    SPACING.xl,
    ...SHADOW.md,
  },
  zoneCard: {
    backgroundColor: NICO.surface,
    borderRadius:    RADIUS['2xl'],
    padding:         SPACING.base,
    gap:             SPACING.md,
  },
  zoneLabel: {
    ...TEXT_STYLE.cardTitle,
    textAlign: 'center',
    color:     NICO.primary,
  },

  emptyHint: { ...TEXT_STYLE.hint, textAlign: 'center' },
  addBtn: {
    alignSelf:       'center',
    backgroundColor: NICO.primary,
    borderRadius:    RADIUS.xl,
    paddingVertical:  SPACING.sm,
    paddingHorizontal: SPACING.xl,
    ...SHADOW.btnPrimary,
  },
  addBtnText: { ...TEXT_STYLE.buttonSmall },

  settingRow: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.md,
    backgroundColor: BUTTERFLY_TILES[0].bg,
    borderRadius:    RADIUS.md,
    padding:         SPACING.md,
  },
  settingInfo:    { flex: 1, flexDirection: 'row', alignItems: 'center', gap: SPACING.xs },
  settingLabel:   { ...TEXT_STYLE.bodyMedium, flex: 1 },
  infoIcon:       { fontSize: FONT_SIZE.lg, color: NICO.text, fontWeight: FONT_WEIGHT.extraBold },

  // TTS info modal
  infoOverlay:    { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', alignItems: 'center', padding: SPACING.xl },
  infoCard: {
    backgroundColor: NICO.screenBg, borderRadius: RADIUS.xl,
    padding: SPACING.lg, gap: SPACING.md, maxWidth: 360, width: '100%',
  },
  infoTitle:       { ...TEXT_STYLE.cardTitle, fontSize: FONT_SIZE.xl },
  infoBody:        { ...TEXT_STYLE.body, lineHeight: 22, color: NICO.textMuted },
  infoDismiss: {
    ...BTN_SIZE.md, ...BTN_VARIANT.primary, alignSelf: 'flex-end',
  },
  infoDismissText: { ...TEXT_STYLE.buttonPrimary },
  toggle: {
    width: 46, height: 26, borderRadius: 13,
    backgroundColor: NICO.border, justifyContent: 'center', padding: 2,
  },
  toggleOn:      { backgroundColor: BUTTERFLY_TILES[0].accent },
  toggleThumb:   { width: 22, height: 22, borderRadius: 11, backgroundColor: NICO.surface },
  toggleThumbOn: { alignSelf: 'flex-end' },

  bottomBar: {
    backgroundColor: NICO.surface,
    borderTopWidth:  1,
    borderTopColor:  NICO.border,
  },
  bottomBarInner: {
    flexDirection:    'row',
    paddingTop:       SPACING.sm,
    paddingHorizontal: SPACING.sm,
  },
  navItem:         { flex: 1, alignItems: 'center', gap: 3, paddingVertical: SPACING.xs },
  navIcon:         { fontSize: 22 },
  navLabel:        { ...TEXT_STYLE.caption, color: NICO.textMuted },
  navLabelActive:  { color: NICO.primary },
  navLabelSignOut: { color: NICO.error },
});
