import React, { useCallback, useState } from 'react';
import {
  View, TouchableOpacity, Pressable, StyleSheet, Modal,
  ScrollView, StatusBar, Image, Platform, ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import AppText from '../../components/AppText';
import ContentContainer from '../../components/ContentContainer';
import GuardianFloatingTabBar from '../../components/GuardianFloatingTabBar';
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
  { label: 'Tutorials',   emoji: '📚', sub: 'Create & assign tutorials', ci: 2, screen: 'Learning'           },
  { label: 'Connections', emoji: '👥', sub: 'Connect, share & support', ci: 1, screen: 'GuardianConnections' },
  { label: 'Discussions', emoji: '💬', sub: 'Share stories, advice & everyday moments', ci: 5, screen: 'Discussions'         },
  { label: 'Events',      emoji: '🎉', sub: 'Plan meet-ups and events', ci: 4, screen: 'Events'              },
];

type LearnerTileDef = TileDef & { params?: Record<string, unknown> };

// Teal (ci:0) — messaging toggle
const TOGGLE_COLOR = BUTTERFLY_TILES[0];

const LEARNER_TILES: LearnerTileDef[] = [
  { label: 'Friends',    emoji: '👥', sub: 'Find friends & create a social circle for your child', ci: 0, screen: 'LearnerFriends'                                  },
  { label: 'Learn',      emoji: '📚', sub: 'Manage tutorials for great learning experience',        ci: 0, screen: 'TutorialLibrary', params: { linkedOnly: true }  },
  { label: 'Activities', emoji: '✅', sub: 'Assign daily activities to keep a track',                ci: 0, screen: 'Activities'                                      },
  { label: 'Schedule',   emoji: '📅', sub: 'Mark calendar with upcoming classes',                    ci: 0, screen: 'UserSchedule'                                    },
];

export default function GuardianHomeScreen() {
  const navigation = useNavigation<Nav>();
  const { guardian } = useAuth();
  const [learners, setLearners]                   = useState<Learner[]>([]);
  const [stats, setStats]                         = useState<Stats>({ learners: 0, tutorials: 0, activities: 0 });
  const [messagingDisabled, setMessagingDisabled] = useState(false);
  const [togglingMsg, setTogglingMsg]             = useState(false);
  const [showMessagingInfo, setShowMessagingInfo] = useState(false);
  const [pendingConnections, setPendingConnections] = useState(0);
  const [pendingFriendRequests, setPendingFriendRequests] = useState(0);
  // Learner tile hover/press feedback: label -> a randomly-picked butterfly
  // color while the cursor/finger is on it, reverting to the default grey
  // once it moves away.
  const [tileHoverBg, setTileHoverBg] = useState<Record<string, string>>({});
  // TTS toggle state — commented out for now, will use it later
  // const [ttsDisabled, setTtsDisabled]             = useState(false);
  // const [togglingTts, setTogglingTts]             = useState(false);
  // const [showTtsInfo, setShowTtsInfo]             = useState(false);
  const insets = useSafeAreaInsets();

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
      { count: pendingCount },
    ] = await Promise.all([
      supabase.from('user_profiles').select('id, name, photo_url').eq('guardian_id', guardianId),
      supabase.from('tutorials').select('id', { count: 'exact', head: true }).eq('created_by_guardian_id', guardianId),
      supabase.from('guardian_activity_presets').select('id', { count: 'exact', head: true }).eq('guardian_id', guardianId),
      supabase.from('guardian_connections').select('id', { count: 'exact', head: true }).eq('addressee_id', guardianId).eq('status', 'pending'),
    ]);
    setPendingConnections(pendingCount ?? 0);

    const profileList = profiles ?? [];
    const learnerIds  = profileList.map(p => p.id);

    const [enriched, { count: pendingFriendCount }] = await Promise.all([
      Promise.all(
        profileList.map(async p => {
          const { count } = await supabase
            .from('user_tutorials')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', p.id);
          return { ...p, tutorialCount: count ?? 0 } as Learner;
        })
      ),
      // Incoming = someone else's learner asked to friend one of mine — mirrors the
      // 'incoming' direction LearnerFriendsScreen's own Requests tab computes.
      learnerIds.length > 0
        ? supabase.from('friendships').select('id', { count: 'exact', head: true })
            .in('addressee_id', learnerIds).eq('status', 'pending')
        : Promise.resolve({ count: 0 }),
    ]);
    setPendingFriendRequests(pendingFriendCount ?? 0);

    setLearners(enriched);
    setStats({
      learners:   profileList.length,
      tutorials:  tutorialCount  ?? 0,
      activities: activityCount  ?? 0,
    });

    if (profileList.length > 0) {
      supabase.from('user_profiles').select('messaging_disabled, tts_disabled').eq('id', profileList[0].id).single()
        .then(({ data }) => { if (data) { setMessagingDisabled(!!data.messaging_disabled); /* setTtsDisabled(!!data.tts_disabled); */ } });
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

  function openLearnerTile(tile: LearnerTileDef) {
    // Schedule needs the learner's id/name as route params — the tile grid only
    // ever renders once a learner exists, so learners[0] is guaranteed here.
    if (tile.label === 'Schedule') {
      if (!learners[0]) return;
      navigation.navigate('UserSchedule', { userId: learners[0].id, userName: learners[0].name });
      return;
    }
    navigation.navigate(tile.screen as any, tile.params as any);
  }

  function pickTileHoverColor(label: string) {
    const random = BUTTERFLY_TILES[Math.floor(Math.random() * BUTTERFLY_TILES.length)];
    setTileHoverBg(prev => ({ ...prev, [label]: random.bg }));
  }

  function clearTileHoverColor(label: string) {
    setTileHoverBg(prev => {
      if (!(label in prev)) return prev;
      const next = { ...prev };
      delete next[label];
      return next;
    });
  }

  async function toggleMessaging() {
    if (!learners[0]) return;
    setTogglingMsg(true);
    const newVal = !messagingDisabled;
    await supabase.from('user_profiles').update({ messaging_disabled: newVal }).eq('id', learners[0].id);
    setMessagingDisabled(newVal);
    setTogglingMsg(false);
  }

  /* toggleTts — commented out for now, will use it later, along with the TTS toggle UI below
  async function toggleTts() {
    if (!learners[0]) return;
    setTogglingTts(true);
    const newVal = !ttsDisabled;
    await supabase.from('user_profiles').update({ tts_disabled: newVal }).eq('id', learners[0].id);
    setTtsDisabled(newVal);
    setTogglingTts(false);
  }
  */

  const initial   = guardian?.full_name?.[0]?.toUpperCase() ?? 'G';
  const firstname = learners[0]?.name?.split(' ')[0] ?? 'Learner';
  const hasLearner = learners.length > 0;

  return (
    <View style={s.root}>
      <StatusBar barStyle="dark-content" backgroundColor={NICO.background} />

      {/* ── Header ── */}
      <SafeAreaView edges={['top']} style={s.safeHeader}>
        <View style={s.headerInner}>
          <View style={s.guardianLeft}>
            <LinearGradient
              colors={[...BUTTERFLY_BORDER.colors]}
              start={BUTTERFLY_BORDER.start}
              end={BUTTERFLY_BORDER.end}
              style={s.avatarRing}
            >
              {guardian?.photo_url ? (
                <Image source={{ uri: guardian.photo_url }} style={s.avatarCircle} />
              ) : (
                <View style={s.avatarCircle}>
                  <AppText style={s.avatarInitial}>{initial}</AppText>
                </View>
              )}
            </LinearGradient>
            <AppText style={s.guardianName}>{guardian?.full_name ?? 'Guardian'}</AppText>
          </View>
        </View>
      </SafeAreaView>

      {/* ── Body ── */}
      <ScrollView
        style={s.body}
        contentContainerStyle={s.bodyContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Grey zone: header's own background continues behind the guardian tiles,
            no white gap — hugs its content (label + horizontal tile scroller). */}
        <View style={s.greyZone}>
          <ContentContainer>
            <View style={s.sectionHeaderRow}>
              <AppText style={s.sectionLabel}>Activities For Guardian</AppText>
              <AppText style={s.scrollHintArrow}>→</AppText>
            </View>
          </ContentContainer>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={s.guardianScrollContent}
          >
            {GUARDIAN_TILES.map(tile => {
              const color = BUTTERFLY_TILES[tile.ci];
              const isConnections = tile.screen === 'GuardianConnections';
              const showBadge = isConnections && pendingConnections > 0;
              return (
                <TouchableOpacity
                  key={tile.label}
                  style={[s.guardianCard, { backgroundColor: color.bg }]}
                  onPress={() => navigation.navigate(tile.screen as any)}
                  activeOpacity={0.78}
                >
                  {showBadge && (
                    <View style={s.tileBadge}>
                      <AppText style={s.tileBadgeText}>
                        {pendingConnections > 9 ? '9+' : pendingConnections}
                      </AppText>
                    </View>
                  )}
                  <View style={s.guardianCardIconWrap}>
                    <AppText style={s.guardianCardIcon}>{tile.emoji}</AppText>
                  </View>
                  <AppText style={s.guardianCardTitle}>{tile.label}</AppText>
                  <AppText style={s.guardianCardDesc}>{tile.sub}</AppText>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Off-white learner panel: rounded top edges, sits over the grey zone above,
            fills the rest of the screen. */}
        <View style={s.learnerPanel}>
          <ContentContainer style={s.learnerPanelInner}>

            {/* Learner zone hero */}
            <View style={s.heroRow}>
              {hasLearner ? (
                <LinearGradient
                  colors={[...BUTTERFLY_BORDER.colors]}
                  start={BUTTERFLY_BORDER.start}
                  end={BUTTERFLY_BORDER.end}
                  style={s.learnerHeroRing}
                >
                  <TouchableOpacity
                    style={s.learnerHeroTile}
                    onPress={() => navigation.navigate('EditUser', { userId: learners[0].id })}
                    activeOpacity={0.85}
                  >
                    {learners[0]?.photo_url ? (
                      <Image source={{ uri: learners[0].photo_url }} style={s.learnerHeroPhoto} />
                    ) : (
                      <View style={s.learnerHeroPhoto}>
                        <AppText style={s.learnerHeroInitial}>{firstname[0]?.toUpperCase() ?? 'L'}</AppText>
                      </View>
                    )}
                  </TouchableOpacity>
                </LinearGradient>
              ) : null}
              <AppText style={s.zoneLabel}>
                {hasLearner ? `${firstname}'s zone` : 'Your Learner'}
              </AppText>
            </View>

            {hasLearner ? (
              <>
                <View style={s.learnerTileList}>
                  {LEARNER_TILES.map(tile => {
                    const showBadge = tile.label === 'Friends' && pendingFriendRequests > 0;
                    return (
                      <Pressable
                        key={tile.label}
                        style={[s.learnerRow, tileHoverBg[tile.label] && { backgroundColor: tileHoverBg[tile.label] }]}
                        onPress={() => openLearnerTile(tile)}
                        onHoverIn={() => pickTileHoverColor(tile.label)}
                        onHoverOut={() => clearTileHoverColor(tile.label)}
                        onPressIn={() => pickTileHoverColor(tile.label)}
                        onPressOut={() => clearTileHoverColor(tile.label)}
                      >
                        <View style={s.learnerRowIconWrap}>
                          <AppText style={s.learnerRowIcon}>{tile.emoji}</AppText>
                        </View>
                        <View style={s.learnerRowTextCol}>
                          <AppText style={s.learnerRowTitle}>{tile.label}</AppText>
                          <AppText style={s.learnerRowDesc}>{tile.sub}</AppText>
                        </View>
                        {showBadge && (
                          <View style={[s.tileBadge, s.learnerRowBadge]}>
                            <AppText style={s.tileBadgeText}>
                              {pendingFriendRequests > 9 ? '9+' : pendingFriendRequests}
                            </AppText>
                          </View>
                        )}
                        <AppText style={s.learnerRowChevron}>›</AppText>
                      </Pressable>
                    );
                  })}
                </View>

                {/* Messaging toggle */}
                <TouchableOpacity
                  style={s.settingRow}
                  onPress={toggleMessaging}
                  activeOpacity={0.8}
                  disabled={togglingMsg}
                >
                  <View style={s.settingInfo}>
                    <AppText style={s.settingLabel}>Disable Messaging</AppText>
                    <TouchableOpacity
                      onPress={() => setShowMessagingInfo(true)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      activeOpacity={0.7}
                    >
                      <AppText style={s.infoIcon}>ⓘ</AppText>
                    </TouchableOpacity>
                  </View>
                  {togglingMsg ? (
                    <ActivityIndicator size="small" color={TOGGLE_COLOR.accent} />
                  ) : (
                    <View style={[s.toggle, messagingDisabled && s.toggleOn]}>
                      <View style={[s.toggleThumb, messagingDisabled && s.toggleThumbOn]} />
                    </View>
                  )}
                </TouchableOpacity>

                {/* Messaging info modal */}
                <Modal visible={showMessagingInfo} transparent animationType="fade" onRequestClose={() => setShowMessagingInfo(false)}>
                  <TouchableOpacity style={s.infoOverlay} activeOpacity={1} onPress={() => setShowMessagingInfo(false)}>
                    <View style={s.infoCard} onStartShouldSetResponder={() => true}>
                      <AppText style={s.infoTitle}>Messaging</AppText>
                      <AppText style={s.infoBody}>
                        Your learner can chat with friends they've connected with. Enable this setting to turn off messaging entirely — they won't be able to open or send messages in any friend chats.
                      </AppText>
                      <TouchableOpacity style={s.infoDismiss} onPress={() => setShowMessagingInfo(false)} activeOpacity={0.8}>
                        <AppText style={s.infoDismissText}>Got it</AppText>
                      </TouchableOpacity>
                    </View>
                  </TouchableOpacity>
                </Modal>

                {/* TTS toggle — commented out for now, will use it later
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

                {/* TTS info modal * /}
                <Modal visible={showTtsInfo} transparent animationType="fade" onRequestClose={() => setShowTtsInfo(false)}>
                  <TouchableOpacity style={s.infoOverlay} activeOpacity={1} onPress={() => setShowTtsInfo(false)}>
                    <View style={s.infoCard} onStartShouldSetResponder={() => true}>
                      <AppText style={s.infoTitle}>Text to Speech</AppText>
                      <AppText style={s.infoBody}>
                        Some pages in the learner zone read content aloud automatically. For some children, unexpected audio can feel startling or overwhelming and may cause distress.{'\n\n'}Enable this setting to turn off automatic audio for your learner.
                      </AppText>
                      <TouchableOpacity style={s.infoDismiss} onPress={() => setShowTtsInfo(false)} activeOpacity={0.8}>
                        <AppText style={s.infoDismissText}>Got it</AppText>
                      </TouchableOpacity>
                    </View>
                  </TouchableOpacity>
                </Modal>
                */}
              </>
            ) : (
              <>
                <AppText style={s.emptyHint}>Add a learner to activate this zone</AppText>
                <TouchableOpacity
                  style={s.addBtn}
                  onPress={() => navigation.navigate('CreateUser')}
                  activeOpacity={0.85}
                >
                  <AppText style={s.addBtnText}>+ Add Learner</AppText>
                </TouchableOpacity>
              </>
            )}
          </ContentContainer>
        </View>
      </ScrollView>

      <GuardianFloatingTabBar
        homeIcon="🏠"
        homeLabel="Home"
        onHomePress={() => navigation.navigate('LearnerSelect')}
      />
    </View>
  );
}

const s = StyleSheet.create({
  root:       { flex: 1, backgroundColor: NICO.background },
  safeHeader: { backgroundColor: NICO.background },

  headerInner: {
    flexDirection:    'row',
    justifyContent:   'space-between',
    alignItems:       'center',
    backgroundColor:  NICO.background,
    paddingHorizontal: SPACING.base,
    paddingVertical:  SPACING.md,
  },
  guardianLeft: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  avatarRing: {
    padding: BUTTERFLY_BORDER.width,
    borderRadius: 20 + BUTTERFLY_BORDER.width,
  },
  avatarCircle: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: NICO.primaryLight,
    justifyContent: 'center', alignItems: 'center',
    overflow: 'hidden',
  },
  avatarInitial: { ...TEXT_STYLE.label, color: NICO.primary, fontSize: FONT_SIZE.md },
  guardianName:  { ...TEXT_STYLE.bodyMedium, fontSize: FONT_SIZE.xl, fontWeight: FONT_WEIGHT.extraBold },

  body:        { flex: 1, backgroundColor: NICO.background },
  bodyContent: { flexGrow: 1 },

  // Grey zone — same NICO.background as the header, hugs its own content
  greyZone: { backgroundColor: NICO.background, paddingTop: SPACING.xl, paddingBottom: SPACING['2xl'] },
  sectionHeaderRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.base,
    marginBottom: SPACING.xl,
  },
  sectionLabel: {
    ...TEXT_STYLE.cardTitle,
    color:        NICO.primary,
    textAlign:    'left',
  },
  scrollHintArrow: {
    fontSize:   FONT_SIZE['3xl'],
    fontWeight: FONT_WEIGHT.black,
    color:      NICO.text,
  },
  guardianScrollContent: { flexDirection: 'row', gap: SPACING.md, paddingHorizontal: SPACING.base },
  guardianCard: {
    width: scale(148),
    borderRadius: RADIUS.xl,
    padding: SPACING.md,
    gap: SPACING.sm,
  },
  guardianCardIconWrap: {
    width: scale(44), height: scale(44), borderRadius: RADIUS.md,
    backgroundColor: NICO.surface,
    justifyContent: 'center', alignItems: 'center',
  },
  guardianCardIcon:  { fontSize: scale(22) },
  guardianCardTitle: { ...TEXT_STYLE.bodyMedium, fontWeight: FONT_WEIGHT.extraBold, color: NICO.text },
  guardianCardDesc:  { fontSize: FONT_SIZE.sm, color: NICO.text, fontWeight: FONT_WEIGHT.medium, lineHeight: scale(16) },

  tileBadge: {
    position: 'absolute', top: SPACING.xs, right: SPACING.xs,
    backgroundColor: NICO.error, borderRadius: RADIUS.full,
    minWidth: scale(20), height: scale(20), paddingHorizontal: 4,
    justifyContent: 'center', alignItems: 'center', zIndex: 1,
  },
  tileBadgeText: { fontSize: scale(10), fontWeight: FONT_WEIGHT.extraBold, color: '#fff' },

  // Off-white learner panel — sits over the grey zone, fills the rest of the screen
  learnerPanel: {
    flexGrow: 1,
    backgroundColor: NICO.screenBg,
    // 20% more than the standard RADIUS['3xl'] (28)
    borderTopLeftRadius: RADIUS['3xl'] * 1.2,
    borderTopRightRadius: RADIUS['3xl'] * 1.2,
  },
  learnerPanelInner: { padding: SPACING.base, paddingBottom: SPACING['2xl'], gap: SPACING.base },

  heroRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  learnerHeroRing: {
    padding: BUTTERFLY_BORDER.width,
    borderRadius: RADIUS.xl + BUTTERFLY_BORDER.width,
    ...SHADOW.sm,
  },
  learnerHeroTile: {
    width: scale(56), height: scale(56),
    borderRadius: RADIUS.xl, overflow: 'hidden',
  },
  learnerHeroPhoto: {
    width: '100%', height: '100%',
    backgroundColor: NICO.primaryLight,
    justifyContent: 'center', alignItems: 'center',
  },
  learnerHeroInitial: { ...TEXT_STYLE.displayHero, color: NICO.primary, fontSize: FONT_SIZE['3xl'] },
  zoneLabel: { ...TEXT_STYLE.cardTitle, color: NICO.primary },

  // Learner tiles — vertical rows, curved off-white pills sitting on the white panel
  learnerTileList: { gap: SPACING.sm },
  learnerRow: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.md,
    backgroundColor: NICO.backgroundLight,
    borderRadius: RADIUS['2xl'],
    padding: SPACING.md,
    position: 'relative',
  },
  learnerRowIconWrap: {
    width: scale(44), height: scale(44), borderRadius: RADIUS.full,
    backgroundColor: NICO.surface,
    justifyContent: 'center', alignItems: 'center',
  },
  learnerRowIcon: { fontSize: scale(20) },
  learnerRowTextCol: { flex: 1, gap: 2 },
  learnerRowTitle: { ...TEXT_STYLE.bodyMedium, fontWeight: FONT_WEIGHT.extraBold, color: NICO.text },
  learnerRowDesc: { fontSize: FONT_SIZE.sm, color: NICO.text, fontWeight: FONT_WEIGHT.medium, lineHeight: scale(16) },
  learnerRowBadge: { position: 'absolute', top: SPACING.sm, right: SPACING.xl + SPACING.sm },
  learnerRowChevron: { fontSize: FONT_SIZE.xl, color: NICO.textMuted },

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

  // Messaging info modal
  infoOverlay:    { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', alignItems: 'center', padding: SPACING.xl },
  infoCard: {
    backgroundColor: NICO.screenBg, borderRadius: RADIUS.xl,
    padding: SPACING.lg, gap: SPACING.md, maxWidth: 360, width: '100%',
  },
  infoTitle:       { ...TEXT_STYLE.cardTitle, fontSize: FONT_SIZE.xl },
  infoBody:        { ...TEXT_STYLE.body, lineHeight: 22, color: NICO.text },
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

});
