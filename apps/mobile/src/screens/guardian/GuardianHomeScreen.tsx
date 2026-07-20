import React, { useCallback, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, StatusBar, Image, Platform, Modal, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as Notifications from 'expo-notifications';
import { useAuth } from '../../lib/AuthContext';
import { supabase } from '../../lib/supabase';
import { COLORS } from '../../constants';
import { GuardianNavParamList } from '../../navigation';

type Nav = NativeStackNavigationProp<GuardianNavParamList>;

const AVATAR_COLORS = ['#FF6B6B', '#845EF7', '#20C997', '#F59E0B', '#3B82F6', '#EC4899'];

type Learner = { id: string; name: string; photo_url: string | null; tutorialCount: number };
type Stats   = { learners: number; tutorials: number; activities: number };

const ACTIONS: {
  label: string; emoji: string;
  badgeBg: string | null; badgeText: string | null;
  screen: keyof GuardianNavParamList; statKey: keyof Stats | null;
}[] = [
  { label: 'Tutorials',     emoji: '📚', badgeBg: '#DAEAFF', badgeText: '#1E5CA8', screen: 'Learning',     statKey: 'tutorials'  },
  { label: 'Activities',    emoji: '✅', badgeBg: '#D4F5E2', badgeText: '#0A6635', screen: 'Activities',   statKey: 'activities' },
  { label: 'Schedule',      emoji: '📅', badgeBg: null,      badgeText: null,      screen: 'Schedule',          statKey: null         },
  { label: 'Connections',   emoji: '👥', badgeBg: null,      badgeText: null,      screen: 'GuardianConnections', statKey: null         },
  { label: 'Discussions',   emoji: '💬', badgeBg: null,      badgeText: null,      screen: 'Discussions',         statKey: null         },
  { label: 'Events',        emoji: '🎉', badgeBg: null,      badgeText: null,      screen: 'Events',              statKey: null         },
];

export default function GuardianHomeScreen() {
  const navigation = useNavigation<Nav>();
  const { guardian, signOut } = useAuth();
  const [learners, setLearners]   = useState<Learner[]>([]);
  const [stats, setStats]         = useState<Stats>({ learners: 0, tutorials: 0, activities: 0 });
  const [showMenu, setShowMenu]   = useState(false);

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

  const firstName = guardian?.full_name?.split(' ')[0] ?? 'Guardian';
  const initial   = guardian?.full_name?.[0]?.toUpperCase() ?? 'G';

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.bloomNavy} />
      <SafeAreaView style={s.safeHeader}>

        {/* Brand row */}
        <View style={s.brandRow}>
          <View style={s.appIcon}>
            <Text style={s.appIconEmoji}>🌸</Text>
          </View>
          <Text style={s.appName}>
            Bloom<Text style={s.appDot}>.</Text>
          </Text>
        </View>

        {/* Guardian row */}
        <View style={s.guardianRow}>
          <TouchableOpacity
            style={s.guardianLeft}
            onPress={() => setShowMenu(true)}
            activeOpacity={0.75}
          >
            <View style={s.avatarCircle}>
              <Text style={s.avatarInitial}>{initial}</Text>
            </View>
            <View>
              <Text style={s.guardianName}>{firstName}</Text>
              <Text style={s.guardianRole}>Guardian  ▾</Text>
            </View>
          </TouchableOpacity>
        </View>

      </SafeAreaView>

      {/* Body */}
      <ScrollView
        style={s.body}
        contentContainerStyle={s.bodyContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── FOR YOU ── */}
        <View style={s.pillRow}>
          <View style={s.pill}>
            <Text style={s.pillText}>👤  FOR YOU</Text>
          </View>
          <View style={s.pillLine} />
        </View>

        <View style={s.actionGrid}>
          {ACTIONS.reduce<typeof ACTIONS[]>((rows, a, i) => {
            if (i % 3 === 0) rows.push([a]); else rows[rows.length - 1].push(a);
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
                    <Text style={s.actionEmoji}>{action.emoji}</Text>
                    <Text style={s.actionLabel}>{action.label}</Text>
                    {action.badgeBg && count != null && count > 0 && (
                      <View style={[s.actionBadge, { backgroundColor: action.badgeBg }]}>
                        <Text style={[s.actionBadgeText, { color: action.badgeText! }]}>{count}</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          ))}
        </View>

        {/* ── YOUR LEARNERS ── */}
        <View style={[s.pillRow, { marginTop: 24 }]}>
          <View style={[s.pill, s.pillLearner]}>
            <Text style={s.pillText}>🎓  YOUR LEARNERS</Text>
          </View>
          <View style={s.pillLine} />
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.learnersScroll}
        >
          {learners.map((l, i) => (
            <TouchableOpacity
              key={l.id}
              style={s.learnerTile}
              onPress={() => navigation.navigate('EditUser', { userId: l.id })}
              activeOpacity={0.8}
            >
              {l.photo_url ? (
                <Image source={{ uri: l.photo_url }} style={s.learnerAvatar} />
              ) : (
                <View style={[s.learnerAvatar, { backgroundColor: AVATAR_COLORS[i % AVATAR_COLORS.length] }]}>
                  <Text style={s.learnerInitial}>{l.name[0]?.toUpperCase()}</Text>
                </View>
              )}
              <Text style={s.learnerName} numberOfLines={1}>{l.name.split(' ')[0]}</Text>
              <Text style={s.learnerMeta}>{l.tutorialCount} tutorial{l.tutorialCount !== 1 ? 's' : ''}</Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity
            style={s.learnerTile}
            onPress={() => navigation.navigate('CreateUser')}
            activeOpacity={0.8}
          >
            <View style={s.addAvatar}>
              <Text style={s.addIcon}>+</Text>
            </View>
            <Text style={s.learnerName}>Add New</Text>
            <Text style={s.learnerMeta}> </Text>
          </TouchableOpacity>
        </ScrollView>

        <View style={[s.communityRow, { marginTop: 14 }]}>
          <TouchableOpacity
            style={s.communityTile}
            onPress={() => navigation.navigate('LearnerDiscovery')}
            activeOpacity={0.78}
          >
            <Text style={s.communityEmoji}>🔍</Text>
            <View style={s.communityInfo}>
              <Text style={s.communityLabel}>Find Friends</Text>
              <Text style={s.communityHint}>Discover learners for your learner to connect with</Text>
            </View>
            <Text style={s.communityArr}>›</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={s.communityTile}
            onPress={() => navigation.navigate('LearnerFriendRequests')}
            activeOpacity={0.78}
          >
            <Text style={s.communityEmoji}>🤝</Text>
            <View style={s.communityInfo}>
              <Text style={s.communityLabel}>Friend Requests</Text>
              <Text style={s.communityHint}>Accept or decline incoming connection requests</Text>
            </View>
            <Text style={s.communityArr}>›</Text>
          </TouchableOpacity>
        </View>

      </ScrollView>

      {/* Avatar dropdown menu */}
      <Modal visible={showMenu} transparent animationType="fade" onRequestClose={() => setShowMenu(false)}>
        <TouchableOpacity style={s.menuOverlay} activeOpacity={1} onPress={() => setShowMenu(false)}>
          <TouchableOpacity style={s.menuCard} activeOpacity={1} onPress={() => {}}>
            <View style={s.menuHeader}>
              <View style={s.menuAvatar}>
                <Text style={s.menuAvatarText}>{initial}</Text>
              </View>
              <View>
                <Text style={s.menuName}>{guardian?.full_name}</Text>
                <Text style={s.menuEmail}>{guardian?.email}</Text>
              </View>
            </View>

            <View style={s.menuDivider} />

            <TouchableOpacity
              style={s.menuItem}
              onPress={() => { setShowMenu(false); navigation.navigate('Account'); }}
              activeOpacity={0.7}
            >
              <Text style={s.menuItemIcon}>👤</Text>
              <Text style={s.menuItemText}>Account</Text>
              <Text style={s.menuItemArr}>›</Text>
            </TouchableOpacity>

            <View style={s.menuDivider} />

            <TouchableOpacity style={s.menuItem} onPress={handleSignOut} activeOpacity={0.7}>
              <Text style={s.menuItemIcon}>🚪</Text>
              <Text style={[s.menuItemText, { color: '#E53E3E' }]}>Sign Out</Text>
              <Text style={s.menuItemArr}>›</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

    </View>
  );
}

const s = StyleSheet.create({
  root:       { flex: 1, backgroundColor: COLORS.bloomNavy },
  safeHeader: { backgroundColor: COLORS.bloomNavy },

  // Brand row
  brandRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 9, paddingTop: 10, paddingHorizontal: 18, marginBottom: 10,
  },
  appIcon: {
    width: 30, height: 30, borderRadius: 8,
    backgroundColor: COLORS.bloomAccent,
    justifyContent: 'center', alignItems: 'center',
  },
  appIconEmoji: { fontSize: 16 },
  appName:      { fontSize: 18, fontWeight: '700', color: '#fff', letterSpacing: -0.3 },
  appDot:       { color: COLORS.bloomDot },

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
  },
  avatarInitial: { fontSize: 13, fontWeight: '700', color: '#fff' },
  guardianName:  { fontSize: 15, fontWeight: '600', color: '#fff' },
  guardianRole:  { fontSize: 10, color: 'rgba(255,255,255,0.45)', marginTop: 1 },
  // Body
  body:        { flex: 1, backgroundColor: COLORS.bloomBody },
  bodyContent: { padding: 14, paddingBottom: 32 },

  // Section pill headers
  pillRow:     { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  pill:        { backgroundColor: '#FEF9E7', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5 },
  pillLearner: { backgroundColor: '#FEF9E7' },
  pillText:    { fontSize: 11, fontWeight: '900', color: '#92400E', letterSpacing: 0.6 },
  pillLine:    { flex: 1, height: 2.5, backgroundColor: '#C8D4E0', borderRadius: 2 },

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
  actionLabel:     { fontSize: 12, fontWeight: '900', color: COLORS.bloomText, textAlign: 'center' },
  actionBadge:     { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 20 },
  actionBadgeText: { fontSize: 9, fontWeight: '800' },

  // Learner tiles
  learnersScroll: { gap: 8, paddingBottom: 4 },
  learnerTile: {
    width: 74, backgroundColor: COLORS.bloomCard,
    borderRadius: 12, padding: 12, paddingHorizontal: 6,
    alignItems: 'center', borderWidth: 1, borderColor: COLORS.bloomBorder,
  },
  learnerAvatar: {
    width: 40, height: 40, borderRadius: 20,
    marginBottom: 7, justifyContent: 'center', alignItems: 'center',
  },
  learnerInitial: { fontSize: 15, fontWeight: '700', color: '#fff' },
  learnerName:    { fontSize: 9, fontWeight: '700', color: COLORS.bloomText, textAlign: 'center' },
  learnerMeta:    { fontSize: 8, color: '#AAA', marginTop: 2, textAlign: 'center' },
  addAvatar: {
    width: 40, height: 40, borderRadius: 20, marginBottom: 7,
    borderWidth: 1.5, borderColor: '#C8D6E8', borderStyle: 'dashed',
    justifyContent: 'center', alignItems: 'center',
  },
  addIcon: { fontSize: 18, color: COLORS.bloomAccent, lineHeight: 22 },

  // Community section
  communityRow: { gap: 8 },
  communityTile: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: COLORS.bloomCard, borderRadius: 16, padding: 16,
    borderWidth: 1.5, borderColor: '#CAD4E0',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },
  communityEmoji: { fontSize: 28 },
  communityInfo:  { flex: 1, gap: 2 },
  communityLabel: { fontSize: 15, fontWeight: '800', color: COLORS.bloomText },
  communityHint:  { fontSize: 12, color: COLORS.bloomMuted, lineHeight: 16 },
  communityArr:   { fontSize: 20, color: '#C8D6E8', fontWeight: '300' },

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
});
