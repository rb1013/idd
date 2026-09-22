import React from 'react';
import { View, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AppText from './AppText';
import { useAuth } from '../lib/AuthContext';
import { GuardianNavParamList } from '../navigation';
import { NICO, TEXT_STYLE, SPACING, FONT_WEIGHT, scale } from '../constants/theme';

type Nav = NativeStackNavigationProp<GuardianNavParamList>;

/**
 * Persistent bottom bar shown only on the 4 top-level guardian tile screens
 * (Tutorials, Connections, Discussions, Events) — not on their sub-pages.
 * Mirrors the links on the guardian dashboard's own bottom bar.
 */
export default function GuardianTabBar() {
  const navigation = useNavigation<Nav>();
  const route = useRoute();
  const insets = useSafeAreaInsets();
  const { signOut } = useAuth();

  function handleSignOut() {
    Alert.alert('Sign out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: signOut },
    ]);
  }

  const dashboardActive     = route.name === 'GuardianHome';
  const notificationsActive = route.name === 'Notifications';
  const accountActive       = route.name === 'Account';

  return (
    <View style={s.bar}>
      <View style={[s.inner, { paddingBottom: insets.bottom || SPACING.sm }]}>
        <TouchableOpacity style={s.item} onPress={() => navigation.navigate('GuardianHome')} activeOpacity={0.75}>
          <AppText style={s.icon}>🗂️</AppText>
          <AppText style={[s.label, dashboardActive && s.labelActive]}>Dashboard</AppText>
        </TouchableOpacity>
        <TouchableOpacity style={s.item} onPress={() => navigation.navigate('Notifications')} activeOpacity={0.75}>
          <AppText style={s.icon}>🔔</AppText>
          <AppText style={[s.label, notificationsActive && s.labelActive]}>Notifications</AppText>
        </TouchableOpacity>
        <TouchableOpacity style={s.item} onPress={() => navigation.navigate('Account')} activeOpacity={0.75}>
          <AppText style={s.icon}>👤</AppText>
          <AppText style={[s.label, accountActive && s.labelActive]}>Account</AppText>
        </TouchableOpacity>
        <TouchableOpacity style={s.item} onPress={handleSignOut} activeOpacity={0.75}>
          <AppText style={s.icon}>🚪</AppText>
          <AppText style={[s.label, s.labelSignOut]}>Sign Out</AppText>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  bar: {
    backgroundColor: NICO.surface,
    borderTopWidth: 1,
    borderTopColor: NICO.border,
  },
  inner: {
    flexDirection: 'row',
    paddingTop: SPACING.sm,
    paddingHorizontal: SPACING.sm,
  },
  item:         { flex: 1, alignItems: 'center', gap: 3, paddingVertical: SPACING.xs },
  icon:         { fontSize: scale(22) },
  label:        { ...TEXT_STYLE.caption, color: NICO.textMuted },
  labelActive:  { color: NICO.primary, fontWeight: FONT_WEIGHT.extraBold },
  labelSignOut: { color: NICO.error },
});
