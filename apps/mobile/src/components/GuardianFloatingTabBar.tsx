import React from 'react';
import { View, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AppText from './AppText';
import { useAuth } from '../lib/AuthContext';
import useHasUnreadNotifications from '../hooks/useHasUnreadNotifications';
import { GuardianNavParamList } from '../navigation';
import { NICO, TEXT_STYLE, SPACING, RADIUS, SHADOW, FONT_WEIGHT, scale } from '../constants/theme';

type Nav = NativeStackNavigationProp<GuardianNavParamList>;

interface GuardianFloatingTabBarProps {
  /** Defaults match GuardianTabBar's own defaults for the home item. */
  homeIcon?: string;
  homeLabel?: string;
  onHomePress?: () => void;
}

/**
 * Floating-pill variant of GuardianTabBar — same behavior (unread-notifications
 * dot, sign-out confirmation, per-route active highlighting, home-item props),
 * restyled as a rounded card with margin from the screen edges instead of a
 * flush full-width bar. Now the single shared bottom bar across all guardian
 * tile screens; the original GuardianTabBar is unused but left in place.
 */
export default function GuardianFloatingTabBar({ homeIcon = '🗂️', homeLabel = 'Dashboard', onHomePress }: GuardianFloatingTabBarProps) {
  const navigation = useNavigation<Nav>();
  const route = useRoute();
  const insets = useSafeAreaInsets();
  const { signOut, guardian } = useAuth();
  const hasUnread = useHasUnreadNotifications(guardian?.id);

  function handleSignOut() {
    Alert.alert('Sign out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: signOut },
    ]);
  }

  const dashboardActive     = route.name === 'GuardianHome';
  const notificationsActive = route.name === 'Notifications';
  const accountActive       = route.name === 'Account';
  const resourcesActive     = route.name === 'Resources';

  return (
    <View style={[s.wrap, { paddingBottom: (insets.bottom || SPACING.sm) + SPACING.xs }]}>
      <View style={s.bar}>
        <TouchableOpacity
          style={s.item}
          onPress={onHomePress ?? (() => navigation.navigate('GuardianHome'))}
          activeOpacity={0.75}
        >
          <View style={[s.iconCircle, dashboardActive && s.iconCircleActive]}>
            <AppText style={s.icon}>{homeIcon}</AppText>
          </View>
          <AppText style={[s.label, dashboardActive && s.labelActive]}>{homeLabel}</AppText>
        </TouchableOpacity>
        <TouchableOpacity style={s.item} onPress={() => navigation.navigate('Notifications')} activeOpacity={0.75}>
          <View style={[s.iconCircle, notificationsActive && s.iconCircleActive]}>
            <AppText style={s.icon}>🔔</AppText>
            {hasUnread && <View style={s.unreadDot} />}
          </View>
          <AppText style={[s.label, notificationsActive && s.labelActive]}>Notifications</AppText>
        </TouchableOpacity>
        <TouchableOpacity style={s.item} onPress={() => navigation.navigate('Account')} activeOpacity={0.75}>
          <View style={[s.iconCircle, accountActive && s.iconCircleActive]}>
            <AppText style={s.icon}>👤</AppText>
          </View>
          <AppText style={[s.label, accountActive && s.labelActive]}>Account</AppText>
        </TouchableOpacity>
        <TouchableOpacity style={s.item} onPress={() => navigation.navigate('Resources')} activeOpacity={0.75}>
          <View style={[s.iconCircle, resourcesActive && s.iconCircleActive]}>
            <AppText style={s.icon}>📖</AppText>
          </View>
          <AppText style={[s.label, resourcesActive && s.labelActive]}>Resources</AppText>
        </TouchableOpacity>
        <TouchableOpacity style={s.item} onPress={handleSignOut} activeOpacity={0.75}>
          <View style={s.iconCircle}>
            <AppText style={s.icon}>🚪</AppText>
          </View>
          <AppText style={[s.label, s.labelSignOut]}>Sign Out</AppText>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { paddingHorizontal: SPACING.base, paddingTop: SPACING.xs, backgroundColor: NICO.background },
  bar: {
    flexDirection:   'row',
    backgroundColor: NICO.surface,
    borderRadius:    RADIUS['2xl'],
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.xs,
    ...SHADOW.lg,
  },
  item: { flex: 1, alignItems: 'center', gap: 3 },
  iconCircle: {
    width: scale(34), height: scale(34), borderRadius: scale(17),
    justifyContent: 'center', alignItems: 'center',
  },
  iconCircleActive: { backgroundColor: NICO.tealLight },
  icon:  { fontSize: scale(17) },
  label: { ...TEXT_STYLE.caption, color: NICO.textMuted },
  labelActive:  { color: NICO.teal, fontWeight: FONT_WEIGHT.extraBold },
  labelSignOut: { color: NICO.error },
  unreadDot: {
    position: 'absolute', top: -2, right: -2,
    width: 9, height: 9, borderRadius: 5,
    backgroundColor: NICO.error,
  },
});
