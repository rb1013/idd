import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Image, ActivityIndicator, Alert, Dimensions,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/AuthContext';
import { COLORS } from '../../constants';
import { GuardianNavParamList } from '../../navigation';
import {
  loadBiometricUsers, promptBiometric, isBiometricAvailable,
  type BiometricUser,
} from '../../lib/biometricStore';

type Nav = NativeStackNavigationProp<GuardianNavParamList>;

const { width } = Dimensions.get('window');
const TILE_SIZE  = (width - 48 - 14) / 2;
const USER_COLORS = ['#FF6B6B', '#845EF7', '#20C997', '#FF922B', '#339AF0', '#F06595', '#74C0FC'];

export default function LearnerSelectScreen() {
  const navigation = useNavigation<Nav>();
  const { guardian, signOut } = useAuth();

  const [iddUsers, setIddUsers]           = useState<BiometricUser[]>([]);
  const [learnerCount, setLearnerCount]   = useState(0);
  const [loading, setLoading]             = useState(true);
  const [biometricLoading, setBiometricLoading] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => { load(); }, [guardian?.id])
  );

  useEffect(() => {
    if (!loading && learnerCount === 0) {
      navigation.replace('GuardianHome');
    }
  }, [loading, learnerCount]);

  async function load() {
    setLoading(true);
    try {
      const [allUsers, { data: learnerProfiles }] = await Promise.all([
        loadBiometricUsers(),
        guardian
          ? supabase.from('user_profiles').select('id').eq('guardian_id', guardian.id)
          : Promise.resolve({ data: [] }),
      ]);
      const guardianLearnerIds = new Set((learnerProfiles ?? []).map((p: any) => p.id));
      setIddUsers(allUsers.filter(u => guardianLearnerIds.has(u.id)));
      setLearnerCount(guardianLearnerIds.size);
    } finally {
      setLoading(false);
    }
  }

  async function handleLearnerTap(user: BiometricUser) {
    const available = await isBiometricAvailable();
    if (!available) {
      Alert.alert('Biometrics unavailable', 'This device does not have Face ID or fingerprint set up.');
      return;
    }
    setBiometricLoading(user.id);
    const passed = await promptBiometric(`Unlock app for ${user.name}`);
    if (!passed) { setBiometricLoading(null); return; }
    const { error } = await supabase.auth.signInWithPassword({ email: user.email, password: user.password });
    setBiometricLoading(null);
    if (error) Alert.alert('Login failed', error.message);
  }

  const initial = guardian?.full_name?.[0]?.toUpperCase() ?? 'G';

  if (loading) {
    return <View style={s.center}><ActivityIndicator size="large" color={COLORS.bloomAccent} /></View>;
  }

  const hasLearners = iddUsers.length > 0 || learnerCount > 0;

  return (
    <View style={s.root}>
      <ScrollView contentContainerStyle={s.container} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={s.header}>
          <View style={s.appIcon}><Text style={s.appIconEmoji}>🌸</Text></View>
          <Text style={s.appName}>Bloom<Text style={s.appDot}>.</Text></Text>
          <Text style={s.tagline}>Learning made joyful</Text>
        </View>

        <View style={s.body}>
          {/* Guardian tile */}
          <Text style={s.sectionLabel}>GUARDIAN</Text>
          <TouchableOpacity
            style={s.guardianTile}
            onPress={() => navigation.navigate('GuardianHome')}
            activeOpacity={0.85}
          >
            {guardian?.photo_url ? (
              <Image source={{ uri: guardian.photo_url }} style={s.guardianAvatarLarge} />
            ) : (
              <View style={[s.guardianAvatarLarge, s.guardianAvatarFallback]}>
                <Text style={s.guardianAvatarInitial}>{initial}</Text>
              </View>
            )}
            <View style={s.guardianInfo}>
              <Text style={s.guardianFullName}>{guardian?.full_name ?? 'Guardian'}</Text>
              <Text style={s.guardianTileSub}>{guardian?.email ?? ''}</Text>
            </View>
            <Text style={s.guardianChevron}>›</Text>
          </TouchableOpacity>

          {learnerCount > 0 && (
            <Text style={[s.sectionLabel, { marginTop: 28 }]}>WHO'S JOINING TODAY?</Text>
          )}

          {learnerCount > 0 ? (
            <View style={s.tilesGrid}>
              {iddUsers.map((user, i) => {
                const color = USER_COLORS[i % USER_COLORS.length];
                return (
                  <TouchableOpacity
                    key={user.id}
                    style={[s.tile, { shadowColor: color }]}
                    onPress={() => handleLearnerTap(user)}
                    activeOpacity={0.85}
                    disabled={!!biometricLoading}
                  >
                    <View style={[s.tileBar, { backgroundColor: color }]} />
                    <View style={s.tileBody}>
                      <View style={s.avatarWrap}>
                        {user.photo_url ? (
                          <Image source={{ uri: user.photo_url }} style={s.avatar} />
                        ) : (
                          <View style={[s.avatar, s.avatarFallback, { backgroundColor: color + '25' }]}>
                            <Text style={[s.avatarInitial, { color }]}>{user.name[0]?.toUpperCase()}</Text>
                          </View>
                        )}
                        <View style={[s.badge, { backgroundColor: color }]}>
                          {biometricLoading === user.id
                            ? <ActivityIndicator size={11} color="#fff" />
                            : <Text style={s.badgeEmoji}>🫆</Text>
                          }
                        </View>
                      </View>
                      <Text style={s.userName} numberOfLines={2}>{user.name}</Text>
                      <Text style={[s.userSub, { color }]}>Tap to unlock</Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          ) : null}
          {/* Sign out */}
          <TouchableOpacity
            style={s.signOutBtn}
            onPress={() =>
              Alert.alert('Sign out', 'Are you sure you want to sign out?', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Sign out', style: 'destructive', onPress: signOut },
              ])
            }
            activeOpacity={0.75}
          >
            <Text style={s.signOutText}>Sign out</Text>
          </TouchableOpacity>
        </View>

      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root:      { flex: 1, backgroundColor: COLORS.bloomBody },
  center:    { flex: 1, justifyContent: 'center', alignItems: 'center' },
  container: { flexGrow: 1, paddingBottom: 120 },

  // Header
  header: {
    backgroundColor: COLORS.bloomNavy,
    paddingTop: 72, paddingBottom: 44,
    alignItems: 'center',
    borderBottomLeftRadius: 36, borderBottomRightRadius: 36,
  },
  appIcon: {
    width: 88, height: 88, borderRadius: 26,
    backgroundColor: COLORS.bloomAccent,
    justifyContent: 'center', alignItems: 'center', marginBottom: 14,
  },
  appIconEmoji: { fontSize: 48 },
  appName:      { fontSize: 38, fontWeight: '900', color: '#fff', letterSpacing: -1 },
  appDot:       { color: COLORS.bloomDot },
  tagline:      { fontSize: 15, color: 'rgba(255,255,255,0.55)', marginTop: 6, fontWeight: '500', marginBottom: 20 },

  guardianTile: {
    flexDirection: 'row', alignItems: 'center', gap: 16,
    backgroundColor: COLORS.bloomCard, borderRadius: 22,
    padding: 18,
    shadowColor: COLORS.bloomNavy, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1, shadowRadius: 10, elevation: 4,
    borderWidth: 1.5, borderColor: COLORS.bloomBorder,
  },
  guardianAvatarLarge: {
    width: 72, height: 72, borderRadius: 36, flexShrink: 0,
  },
  guardianAvatarFallback: {
    backgroundColor: COLORS.bloomAccent,
    justifyContent: 'center', alignItems: 'center',
  },
  guardianAvatarInitial: { fontSize: 28, fontWeight: '900', color: '#fff' },
  guardianInfo:     { flex: 1, gap: 4 },
  guardianFullName: { fontSize: 18, fontWeight: '900', color: COLORS.bloomText },
  guardianTileSub:  { fontSize: 12, color: COLORS.bloomMuted, fontWeight: '500' },
  guardianChevron:  { fontSize: 24, color: COLORS.bloomMuted, fontWeight: '300' },

  // Body
  body:         { paddingHorizontal: 20, paddingTop: 28 },
  sectionLabel: {
    fontSize: 11, fontWeight: '800', color: COLORS.bloomMuted,
    letterSpacing: 1.8, marginBottom: 16,
  },

  // Tiles
  tilesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  tile: {
    width: TILE_SIZE, backgroundColor: COLORS.bloomCard,
    borderRadius: 22, overflow: 'hidden',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15, shadowRadius: 10, elevation: 5,
  },
  tileBar:  { height: 7 },
  tileBody: { padding: 16, alignItems: 'center', gap: 8 },

  avatarWrap:    { position: 'relative', marginBottom: 2 },
  avatar:        { width: 74, height: 74, borderRadius: 37 },
  avatarFallback:{ justifyContent: 'center', alignItems: 'center' },
  avatarInitial: { fontSize: 28, fontWeight: '900' },

  badge: {
    position: 'absolute', bottom: -2, right: -2,
    width: 26, height: 26, borderRadius: 13,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 2, borderColor: '#fff',
  },
  badgeEmoji: { fontSize: 13 },

  userName: { fontSize: 15, fontWeight: '800', color: COLORS.bloomText, textAlign: 'center' },
  userSub:  { fontSize: 12, fontWeight: '700' },

  // Empty state
  empty:      { alignItems: 'center', paddingTop: 48, gap: 12 },
  emptyEmoji: { fontSize: 56 },
  emptyTitle: { fontSize: 20, fontWeight: '800', color: COLORS.bloomText },
  emptyHint:  { fontSize: 14, color: COLORS.bloomMuted, textAlign: 'center', lineHeight: 20, paddingHorizontal: 20 },

  // Sign out
  signOutBtn: {
    marginTop: 36, alignSelf: 'center',
    paddingVertical: 10, paddingHorizontal: 28,
    borderRadius: 20, borderWidth: 1.5, borderColor: '#FECACA',
    backgroundColor: '#FEF2F2',
  },
  signOutText: { fontSize: 14, fontWeight: '700', color: '#DC2626' },

});
