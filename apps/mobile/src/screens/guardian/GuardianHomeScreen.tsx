import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  SafeAreaView, Modal, Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '../../lib/AuthContext';
import { COLORS } from '../../constants';
import { GuardianNavParamList } from '../../navigation';

type Nav = NativeStackNavigationProp<GuardianNavParamList>;

const TILES: {
  label: string;
  sub: string;
  emoji: string;
  accentColor: string;
  bgColor: string;
  screen: keyof GuardianNavParamList;
  wide?: boolean;
}[] = [
  { label: 'Profiles',      sub: 'Manage your users',  emoji: '👥', accentColor: '#6366F1', bgColor: '#EEF2FF', screen: 'Profiles', wide: true },
  { label: 'Schedule',      sub: 'Set classes',         emoji: '📅', accentColor: '#8B5CF6', bgColor: '#F5F3FF', screen: 'Schedule' },
  { label: 'Activities',    sub: 'Daily tasks',         emoji: '✅', accentColor: '#10B981', bgColor: '#ECFDF5', screen: 'Activities' },
  { label: 'Learning',      sub: 'Tutorials',           emoji: '📚', accentColor: '#F59E0B', bgColor: '#FFFBEB', screen: 'Learning' },
  { label: 'Notifications', sub: 'Updates',             emoji: '🔔', accentColor: '#EF4444', bgColor: '#FEF2F2', screen: 'Notifications' },
];

export default function GuardianHomeScreen() {
  const navigation = useNavigation<Nav>();
  const { guardian, signOut } = useAuth();
  const [showSettings, setShowSettings] = useState(false);

  const firstName = guardian?.full_name?.split(' ')[0] ?? 'Guardian';

  function getGreeting() {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  }

  function handleSignOut() {
    setShowSettings(false);
    Alert.alert('Sign out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: signOut },
    ]);
  }

  return (
    <SafeAreaView style={styles.container}>

      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>{getGreeting()}, {firstName}</Text>
          <Text style={styles.sub}>Guardian Portal</Text>
        </View>
        <TouchableOpacity style={styles.gearBtn} onPress={() => setShowSettings(true)} activeOpacity={0.7}>
          <Text style={styles.gearIcon}>⚙️</Text>
        </TouchableOpacity>
      </View>

      {/* Tiles */}
      <View style={styles.tilesWrap}>
        {TILES.map(tile => {
          if (tile.wide) {
            return (
              <TouchableOpacity
                key={tile.label}
                style={[styles.tileWide, { borderLeftColor: tile.accentColor }]}
                onPress={() => navigation.navigate(tile.screen as any)}
                activeOpacity={0.82}
              >
                <View style={[styles.tileIconBg, { backgroundColor: tile.bgColor }]}>
                  <Text style={styles.tileIconEmoji}>{tile.emoji}</Text>
                </View>
                <View style={styles.tileTxt}>
                  <Text style={styles.tileTitle}>{tile.label}</Text>
                  <Text style={styles.tileSub}>{tile.sub}</Text>
                </View>
                <Text style={styles.tileArrow}>›</Text>
              </TouchableOpacity>
            );
          }
          return null;
        })}

        {/* 2-column rows */}
        <View style={styles.tileRow}>
          {TILES.filter(t => !t.wide).slice(0, 2).map(tile => (
            <TouchableOpacity
              key={tile.label}
              style={[styles.tileHalf, { borderTopColor: tile.accentColor }]}
              onPress={() => navigation.navigate(tile.screen as any)}
              activeOpacity={0.82}
            >
              <Text style={styles.halfEmoji}>{tile.emoji}</Text>
              <Text style={styles.halfTitle}>{tile.label}</Text>
              <Text style={styles.halfSub}>{tile.sub}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.tileRow}>
          {TILES.filter(t => !t.wide).slice(2, 4).map(tile => (
            <TouchableOpacity
              key={tile.label}
              style={[styles.tileHalf, { borderTopColor: tile.accentColor }]}
              onPress={() => navigation.navigate(tile.screen as any)}
              activeOpacity={0.82}
            >
              <Text style={styles.halfEmoji}>{tile.emoji}</Text>
              <Text style={styles.halfTitle}>{tile.label}</Text>
              <Text style={styles.halfSub}>{tile.sub}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Settings modal */}
      <Modal visible={showSettings} transparent animationType="fade" onRequestClose={() => setShowSettings(false)}>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setShowSettings(false)}>
          <TouchableOpacity style={styles.settingsCard} activeOpacity={1} onPress={() => {}}>
            <Text style={styles.settingsTitle}>Settings</Text>

            <TouchableOpacity
              style={styles.settingsItem}
              onPress={() => { setShowSettings(false); navigation.navigate('Account'); }}
            >
              <Text style={styles.settingsItemIcon}>👤</Text>
              <Text style={styles.settingsItemText}>Account</Text>
            </TouchableOpacity>

            <View style={styles.settingsDivider} />

            <TouchableOpacity
              style={styles.settingsItem}
              onPress={() => { setShowSettings(false); navigation.navigate('CreateUser'); }}
            >
              <Text style={styles.settingsItemIcon}>➕</Text>
              <Text style={styles.settingsItemText}>Create New Profile</Text>
            </TouchableOpacity>

            <View style={styles.settingsDivider} />

            <TouchableOpacity style={[styles.settingsItem, { paddingBottom: 4 }]} onPress={handleSignOut}>
              <Text style={styles.settingsItemIcon}>🚪</Text>
              <Text style={[styles.settingsItemText, { color: '#EF4444' }]}>Sign Out</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },

  header: {
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 18,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  greeting: { fontSize: 22, fontWeight: '900', color: '#111827' },
  sub:      { fontSize: 14, color: '#9CA3AF', marginTop: 3 },
  gearBtn: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center', alignItems: 'center',
  },
  gearIcon: { fontSize: 20 },

  tilesWrap: { padding: 16, gap: 12, flex: 1 },

  tileWide: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    borderLeftWidth: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 2,
  },
  tileIconBg: {
    width: 52, height: 52,
    borderRadius: 15,
    justifyContent: 'center', alignItems: 'center',
    flexShrink: 0,
  },
  tileIconEmoji: { fontSize: 26 },
  tileTxt: { flex: 1 },
  tileTitle: { fontSize: 18, fontWeight: '800', color: '#111827' },
  tileSub:   { fontSize: 13, color: '#9CA3AF', marginTop: 3 },
  tileArrow: { fontSize: 20, color: '#D1D5DB' },

  tileRow: { flexDirection: 'row', gap: 12 },
  tileHalf: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 18,
    borderTopWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 2,
  },
  halfEmoji: { fontSize: 28, marginBottom: 10 },
  halfTitle: { fontSize: 16, fontWeight: '800', color: '#111827' },
  halfSub:   { fontSize: 12, color: '#9CA3AF', marginTop: 3 },

  // Settings modal
  overlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,.45)',
    justifyContent: 'center', alignItems: 'center',
  },
  settingsCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    paddingTop: 20,
    paddingBottom: 8,
    width: 280,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.2,
    shadowRadius: 24,
    elevation: 12,
    overflow: 'hidden',
  },
  settingsTitle: {
    fontSize: 17, fontWeight: '800', color: '#111827',
    textAlign: 'center', marginBottom: 12,
  },
  settingsDivider: { height: 1, backgroundColor: '#F3F4F6' },
  settingsItem: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 14, paddingHorizontal: 20,
  },
  settingsItemIcon: { fontSize: 18 },
  settingsItemText: { fontSize: 15, fontWeight: '600', color: '#111827' },
});
