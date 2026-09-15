import React, { useCallback, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, StatusBar, Image, Platform, Modal, Alert, ActivityIndicator,
} from 'react-native';
import AppText from '../../components/AppText';
import { SafeAreaView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as Notifications from 'expo-notifications';
import { useAuth } from '../../lib/AuthContext';
import { supabase } from '../../lib/supabase';
import { COLORS } from '../../constants';
import { GuardianNavParamList } from '../../navigation';

type Nav = NativeStackNavigationProp<GuardianNavParamList>;

const AVATAR_COLORS = [COLORS.statusRed, COLORS.statusPurple, COLORS.statusTeal, COLORS.statusAmber, COLORS.statusBlue, COLORS.statusPink];

type Learner = { id: string; name: string; photo_url: string | null; tutorialCount: number };
type Stats   = { learners: number; tutorials: number; activities: number };

const ACTIONS: {
  label: string; emoji: string;
  badgeBg: string | null; badgeText: string | null;
  screen: keyof GuardianNavParamList; statKey: keyof Stats | null;
}[] = [
  { label: 'Tutorials',   emoji: '📚', badgeBg: null, badgeText: null, screen: 'Learning',           statKey: null },
  { label: 'Connections', emoji: '👥', badgeBg: null,      badgeText: null,      screen: 'GuardianConnections', statKey: null        },
  { label: 'Discussions', emoji: '💬', badgeBg: null,      badgeText: null,      screen: 'Discussions',         statKey: null        },
  { label: 'Events',      emoji: '🎉', badgeBg: null,      badgeText: null,      screen: 'Events',              statKey: null        },
];

export default function GuardianHomeScreen() {
  const navigation = useNavigation<Nav>();
  const { guardian, signOut } = useAuth();
  const [learners, setLearners]         = useState<Learner[]>([]);
  const [stats, setStats]               = useState<Stats>({ learners: 0, tutorials: 0, activities: 0 });
  const [showMenu, setShowMenu]         = useState(false);
  const [messagingDisabled, setMessagingDisabled] = useState(false);
  const [togglingMsg, setTogglingMsg]   = useState(false);
  const insets = useSafeAreaInsets();

  function handleSignOut() {
    setShowMenu(false);
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
    ] = await Promise.all([
      supabase.from('user_profiles').select('id, name, photo_url').eq('guardian_id', guardianId),
      supabase.from('tutorials').select('id', { count: 'exact', head: true }).eq('created_by_guardian_id', guardianId),
      supabase.from('guardian_activity_presets').select('id', { count: 'exact', head: true }).eq('guardian_id', guardianId),
    ]);

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
      supabase.from('user_profiles').select('messaging_disabled').eq('id', profileList[0].id).single()
        .then(({ data }) => { if (data) setMessagingDisabled(!!data.messaging_disabled); });
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

  const initial = guardian?.full_name?.[0]?.toUpperCase() ?? 'G';

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.bloomAccent} />
      <SafeAreaView style={s.safeHeader}>

        {/* Guardian row */}
        <View style={s.guardianRow}>
          <View style={s.guardianLeft}>
            {guardian?.photo_url ? (
              <Image source={{ uri: guardian.photo_url }} style={s.avatarCircle} />
            ) : (
              <View style={s.avatarCircle}>
                <AppText style={s.avatarInitial}>{initial}</AppText>
              </View>
            )}
            <View>
              <AppText style={s.guardianName}>{guardian?.full_name ?? 'Guardian'}</AppText>
            </View>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <TouchableOpacity onPress={() => setShowMenu(true)} activeOpacity={0.75} style={s.hamburgerBtn}>
              <View style={s.hamburgerLine} />
              <View style={s.hamburgerLine} />
              <View style={s.hamburgerLine} />
            </TouchableOpacity>
          </View>
        </View>

      </SafeAreaView>

      {/* Body */}
      <ScrollView
        style={s.body}
        contentContainerStyle={[s.bodyContent, { paddingBottom: 80 + insets.bottom }]}
        showsVerticalScrollIndicator={false}
      >
        {/* ── FOR YOU ── */}
        <View style={s.pillRow}>
          <View style={s.pill}>
            <AppText style={s.pillText}>👤  FOR YOU</AppText>
          </View>
          <View style={s.pillLine} />
        </View>

        <View style={s.actionGrid}>
          {ACTIONS.reduce<typeof ACTIONS[]>((rows, a, i) => {
            if (i % 2 === 0) rows.push([a]); else rows[rows.length - 1].push(a);
            return rows;
          }, []).map((row, ri) => (
            <View key={ri} style={s.actionGridRow}>
              {row.map(action => {
                const count = action.statKey ? stats[action.statKey] : null;
                return (
                  <TouchableOpacity
                    key={action.label}
                    style={s.actionTile}
                    onPress={() => navigation.navigate(action.screen as any)}
                    activeOpacity={0.78}
                  >
                    <AppText style={s.actionEmoji}>{action.emoji}</AppText>
                    <AppText style={s.actionLabel}>{action.label}</AppText>
                    {action.badgeBg && count != null && count > 0 && (
                      <View style={[s.actionBadge, { backgroundColor: action.badgeBg }]}>
                        <AppText style={[s.actionBadgeText, { color: action.badgeText! }]}>{count}</AppText>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          ))}

        </View>

        {/* ── YOUR LEARNER ── */}
        <View style={[s.pillRow, { marginTop: 24 }]}>
          <View style={[s.pill, s.pillLearner]}>
            <AppText style={s.pillText}>🎓  FOR YOUR LEARNER</AppText>
          </View>
          <View style={s.pillLine} />
        </View>

        <View style={s.learnerCenter}>
          {learners.length > 0 ? (
            <TouchableOpacity
              style={s.learnerTile}
              onPress={() => navigation.navigate('EditUser', { userId: learners[0].id })}
              activeOpacity={0.8}
            >
              <View style={s.learnerAvatarRing}>
                {learners[0].photo_url ? (
                  <Image source={{ uri: learners[0].photo_url }} style={s.learnerAvatar} />
                ) : (
                  <View style={[s.learnerAvatar, { backgroundColor: AVATAR_COLORS[0] }]}>
                    <AppText style={s.learnerInitial}>{learners[0].name[0]?.toUpperCase()}</AppText>
                  </View>
                )}
              </View>
              <AppText style={s.learnerName} numberOfLines={1}>{learners[0].name}</AppText>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={s.learnerTile}
              onPress={() => navigation.navigate('CreateUser')}
              activeOpacity={0.8}
            >
              <View style={s.addAvatar}>
                <AppText style={s.addIcon}>+</AppText>
              </View>
              <AppText style={s.addNewLabel}>Add New</AppText>
            </TouchableOpacity>
          )}
        </View>

        {learners.length > 0 && (
          <>
            <View style={s.learnerActionGrid}>
              <TouchableOpacity
                style={s.actionTile}
                onPress={() => navigation.navigate('LearnerFriends')}
                activeOpacity={0.78}
              >
                <AppText style={s.actionEmoji}>👥</AppText>
                <AppText style={s.actionLabel}>Friends</AppText>
              </TouchableOpacity>

              <TouchableOpacity
                style={s.actionTile}
                onPress={() => navigation.navigate('TutorialLibrary', { linkedOnly: true })}
                activeOpacity={0.78}
              >
                <AppText style={s.actionEmoji}>📚</AppText>
                <AppText style={s.actionLabel}>Learn</AppText>
              </TouchableOpacity>
            </View>

            <View style={[s.learnerActionGrid, { marginTop: 8 }]}>
              <TouchableOpacity
                style={s.actionTile}
                onPress={() => navigation.navigate('Activities')}
                activeOpacity={0.78}
              >
                <AppText style={s.actionEmoji}>✅</AppText>
                <AppText style={s.actionLabel}>Activities</AppText>
                {stats.activities > 0 && (
                  <View style={[s.actionBadge, { backgroundColor: '#D4F5E2' }]}>
                    <AppText style={[s.actionBadgeText, { color: '#0A6635' }]}>{stats.activities}</AppText>
                  </View>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={s.actionTile}
                onPress={() => navigation.navigate('Schedule')}
                activeOpacity={0.78}
              >
                <AppText style={s.actionEmoji}>📅</AppText>
                <AppText style={s.actionLabel}>Schedule</AppText>
              </TouchableOpacity>
            </View>

            {/* For your learner */}
            <AppText style={s.sectionLabel}>For your learner</AppText>
            <TouchableOpacity style={s.settingRow} onPress={toggleMessaging} activeOpacity={0.8} disabled={togglingMsg}>
              <View style={s.settingInfo}>
                <AppText style={s.settingLabel}>Disable Messaging</AppText>
                <AppText style={s.settingHint}>Your learner cannot send or receive messages</AppText>
              </View>
              {togglingMsg
                ? <ActivityIndicator size="small" color={COLORS.primary} />
                : (
                  <View style={[s.toggle, messagingDisabled && s.toggleOn]}>
                    <View style={[s.toggleThumb, messagingDisabled && s.toggleThumbOn]} />
                  </View>
                )
              }
            </TouchableOpacity>
          </>
        )}


      </ScrollView>

      {/* Avatar dropdown menu */}
      <Modal visible={showMenu} transparent animationType="fade" onRequestClose={() => setShowMenu(false)}>
        <TouchableOpacity style={s.menuOverlay} activeOpacity={1} onPress={() => setShowMenu(false)}>
          <TouchableOpacity style={s.menuCard} activeOpacity={1} onPress={() => {}}>
            <View style={s.menuHeader}>
              <View style={s.menuAvatar}>
                <AppText style={s.menuAvatarText}>{initial}</AppText>
              </View>
              <View>
                <AppText style={s.menuName}>{guardian?.full_name}</AppText>
                <AppText style={s.menuEmail}>{guardian?.email}</AppText>
              </View>
            </View>

            <View style={s.menuDivider} />

            <TouchableOpacity
              style={s.menuItem}
              onPress={() => { setShowMenu(false); navigation.navigate('LearnerSelect'); }}
              activeOpacity={0.7}
            >
              <AppText style={s.menuItemIcon}>🏠</AppText>
              <AppText style={s.menuItemText}>Home</AppText>
              <AppText style={s.menuItemArr}>›</AppText>
            </TouchableOpacity>

            <View style={s.menuDivider} />

            <TouchableOpacity
              style={s.menuItem}
              onPress={() => { setShowMenu(false); navigation.navigate('Account'); }}
              activeOpacity={0.7}
            >
              <AppText style={s.menuItemIcon}>👤</AppText>
              <AppText style={s.menuItemText}>Account</AppText>
              <AppText style={s.menuItemArr}>›</AppText>
            </TouchableOpacity>

            <View style={s.menuDivider} />

            <TouchableOpacity style={s.menuItem} onPress={handleSignOut} activeOpacity={0.7}>
              <AppText style={s.menuItemIcon}>🚪</AppText>
              <AppText style={[s.menuItemText, { color: COLORS.error }]}>Sign Out</AppText>
              <AppText style={s.menuItemArr}>›</AppText>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

    </View>
  );
}

const s = StyleSheet.create({
  root:       { flex: 1, backgroundColor: COLORS.bloomAccent },
  safeHeader: { backgroundColor: COLORS.bloomAccent },

  // Brand row

  // Guardian row
  guardianRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 18, marginBottom: 8,
  },
  guardianLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatarCircle: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: COLORS.bloomAccent,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.2)',
    overflow: 'hidden',
  },
  avatarInitial: { fontSize: 13, fontWeight: '700', color: '#fff' },
  guardianName:  { fontSize: 15, fontWeight: '600', color: COLORS.bloomOnAccent },
  hamburgerBtn:  { padding: 6, gap: 5, alignItems: 'flex-end', justifyContent: 'center' },
  hamburgerLine: { width: 22, height: 2, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.85)' },
  // Body
  body:        { flex: 1, backgroundColor: COLORS.bloomBody },
  bodyContent: { padding: 14 },

  // Section pill headers
  pillRow:     { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  pill:        { backgroundColor: COLORS.bloomActiveBg, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5 },
  pillLearner: { backgroundColor: COLORS.bloomActiveBg },
  pillText:    { fontSize: 12, fontWeight: '800', color: COLORS.bloomNavy, letterSpacing: 1 },
  pillLine:    { flex: 1, height: 2, backgroundColor: COLORS.bloomSageMid, borderRadius: 2 },

  // Action grid (Option C tile style)
  actionGrid:    { gap: 8, marginBottom: 4 },
  actionGridRow: { flexDirection: 'row', gap: 8 },
  actionTile: {
    flex: 1,
    backgroundColor: COLORS.bloomCard,
    borderRadius: 14,
    paddingVertical: 16, paddingHorizontal: 6,
    alignItems: 'center', gap: 5,
    borderWidth: 1.5, borderColor: '#CAD4E0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  actionEmoji:     { fontSize: 28 },
  actionLabel:     { fontSize: 15, fontWeight: '400', color: COLORS.bloomText, textAlign: 'center' },
  actionBadge:     { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 20 },
  actionBadgeText: { fontSize: 9, fontWeight: '800' },

  // Learner tile (single, centered)
  learnerCenter:  { alignItems: 'center', paddingVertical: 4 },
  learnerStars:   { fontSize: 20, letterSpacing: 4, marginBottom: 8 },
  learnerActionGrid: { flexDirection: 'row', gap: 8, marginTop: 12 },
  learnerTile: {
    width: 130, backgroundColor: '#FFFBEA',
    borderRadius: 20, paddingVertical: 14, paddingHorizontal: 14,
    alignItems: 'center',
    borderWidth: 2.5, borderColor: '#F59E0B',
    shadowColor: '#F59E0B', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28, shadowRadius: 10, elevation: 6,
  },
  learnerAvatarRing: {
    padding: 3, borderRadius: 36,
    borderWidth: 2.5, borderColor: '#F59E0B',
    marginBottom: 8,
  },
  learnerAvatar: {
    width: 56, height: 56, borderRadius: 28,
    justifyContent: 'center', alignItems: 'center',
  },
  learnerInitial: { fontSize: 22, fontWeight: '700', color: '#fff' },
  learnerName:    { fontSize: 14, fontWeight: '700', color: COLORS.bloomText, textAlign: 'center' },
  learnerTag:     { fontSize: 11, fontWeight: '600', color: '#D97706', marginTop: 2, textAlign: 'center' },
  addNewLabel:    { fontSize: 14, fontWeight: '400', color: COLORS.bloomText, textAlign: 'center' },
  learnerMeta:    { fontSize: 11, color: '#AAA', marginTop: 4, textAlign: 'center' },
  addAvatar: {
    width: 72, height: 72, borderRadius: 36, marginBottom: 10,
    borderWidth: 1.5, borderColor: '#C8D6E8', borderStyle: 'dashed',
    justifyContent: 'center', alignItems: 'center',
  },
  addIcon: { fontSize: 28, color: COLORS.bloomAccent, lineHeight: 34 },

  // Avatar dropdown menu
  menuOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-start', paddingTop: 140, paddingHorizontal: 16,
  },
  menuCard: {
    backgroundColor: '#fff', borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18, shadowRadius: 20, elevation: 10,
  },
  menuHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 16,
  },
  menuAvatar: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: COLORS.bloomAccent,
    justifyContent: 'center', alignItems: 'center',
  },
  menuAvatarText: { fontSize: 17, fontWeight: '700', color: '#fff' },
  menuName:       { fontSize: 15, fontWeight: '700', color: COLORS.bloomText },
  menuEmail:      { fontSize: 12, color: COLORS.bloomMuted, marginTop: 2 },
  menuDivider:    { height: 1, backgroundColor: '#F0F4FA' },
  menuItem: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 15, paddingHorizontal: 16,
  },
  menuItemIcon: { fontSize: 18 },
  menuItemText: { flex: 1, fontSize: 15, fontWeight: '600', color: COLORS.bloomText },
  menuItemArr:  { fontSize: 18, color: '#C8D6E8' },

  sectionLabel: { fontSize: 12, fontWeight: '700', color: COLORS.textLight, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 28, marginBottom: 10 },
  settingRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: COLORS.surface, borderRadius: 14,
    borderWidth: 1, borderColor: COLORS.border, padding: 16,
  },
  settingInfo: { flex: 1 },
  settingLabel: { fontSize: 15, fontWeight: '700', color: COLORS.text },
  settingHint:  { fontSize: 12, color: COLORS.textLight, marginTop: 2 },
  toggle: {
    width: 46, height: 26, borderRadius: 13,
    backgroundColor: COLORS.border, justifyContent: 'center', padding: 2,
  },
  toggleOn:      { backgroundColor: COLORS.primary },
  toggleThumb:   { width: 22, height: 22, borderRadius: 11, backgroundColor: '#fff' },
  toggleThumbOn: { alignSelf: 'flex-end' },
});
