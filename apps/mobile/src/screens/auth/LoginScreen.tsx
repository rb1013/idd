import React, { useCallback, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, Alert, ActivityIndicator,
  ScrollView, Image, Dimensions,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { supabase } from '../../lib/supabase';
import {
  loadGuardianProfile, loadBiometricUsers, promptBiometric, isBiometricAvailable,
  type GuardianProfile, type BiometricUser,
} from '../../lib/biometricStore';
import { COLORS } from '../../constants';
import { RootStackParamList } from '../../navigation';

type Props = { navigation: NativeStackNavigationProp<RootStackParamList, 'Login'> };

type ScreenView = 'tiles' | 'guardian-login';

const { width } = Dimensions.get('window');
const TILE_SIZE = (width - 48 - 14) / 2;

const USER_COLORS = ['#FF6B6B', '#845EF7', '#20C997', '#FF922B', '#339AF0', '#F06595', '#74C0FC'];

export default function LoginScreen({ navigation }: Props) {
  const [view, setView] = useState<ScreenView>('tiles');
  const [guardianProfile, setGuardianProfile] = useState<GuardianProfile | null>(null);
  const [iddUsers, setIddUsers] = useState<BiometricUser[]>([]);
  const [tilesLoaded, setTilesLoaded] = useState(false);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [biometricLoading, setBiometricLoading] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      loadTiles();
    }, []),
  );

  async function loadTiles() {
    const [gp, users] = await Promise.all([loadGuardianProfile(), loadBiometricUsers()]);
    setGuardianProfile(gp);
    setIddUsers(users);
    setTilesLoaded(true);
    if (!gp && users.length === 0) setView('guardian-login');
    else setView('tiles');
  }

  async function handleGuardianLogin() {
    if (!email || !password) { Alert.alert('Please fill in all fields'); return; }
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) Alert.alert('Login failed', error.message);
  }

  async function handleIddUserTap(user: BiometricUser) {
    const available = await isBiometricAvailable();
    if (!available) {
      Alert.alert(
        'Biometrics unavailable',
        'This device does not have Face ID or fingerprint set up. Please ask your Guardian to log you in.',
      );
      return;
    }
    setBiometricLoading(user.id);
    const passed = await promptBiometric(`Unlock app for ${user.name}`);
    if (!passed) { setBiometricLoading(null); return; }

    const { error } = await supabase.auth.signInWithPassword({ email: user.email, password: user.password });
    setBiometricLoading(null);
    if (error) Alert.alert('Login failed', error.message);
  }

  if (!tilesLoaded) {
    return <View style={styles.center}><ActivityIndicator size="large" color={COLORS.primary} /></View>;
  }

  // ── Tiles view ──────────────────────────────────────────────────────────────
  if (view === 'tiles') {
    return (
      <ScrollView contentContainerStyle={styles.tilesContainer} showsVerticalScrollIndicator={false}>

        {/* App header */}
        <View style={styles.appHeader}>
          <View style={styles.appIconWrap}>
            <Text style={styles.appIconEmoji}>🌸</Text>
          </View>
          <Text style={styles.appName}>Bloom</Text>
          <Text style={styles.appTagline}>Learning made joyful</Text>
        </View>

        <View style={styles.sectionsWrap}>

          {/* Guardian section */}
          {guardianProfile && (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>GUARDIAN</Text>
              <TouchableOpacity style={styles.guardianTile} onPress={() => setView('guardian-login')} activeOpacity={0.85}>
                <View style={styles.guardianAvatarWrap}>
                  {guardianProfile.photo_url
                    ? <Image source={{ uri: guardianProfile.photo_url }} style={styles.guardianAvatar} />
                    : (
                      <View style={[styles.guardianAvatar, styles.avatarPlaceholder, { backgroundColor: '#64748B20' }]}>
                        <Text style={[styles.avatarInitial, { color: '#64748B' }]}>{guardianProfile.name[0]?.toUpperCase()}</Text>
                      </View>
                    )
                  }
                  <View style={styles.guardianBadge}>
                    <Text style={styles.badgeEmoji}>🔒</Text>
                  </View>
                </View>
                <View style={styles.guardianInfo}>
                  <Text style={styles.guardianName}>{guardianProfile.name}</Text>
                  <Text style={styles.guardianSub}>Tap to sign in</Text>
                </View>
                <Text style={styles.guardianChevron}>›</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* IDD users section */}
          {iddUsers.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>WHO'S JOINING TODAY?</Text>
              <View style={styles.tilesGrid}>
                {iddUsers.map((user, index) => {
                  const color = USER_COLORS[index % USER_COLORS.length];
                  return (
                    <TouchableOpacity
                      key={user.id}
                      style={[styles.userTile, { shadowColor: color }]}
                      onPress={() => handleIddUserTap(user)}
                      activeOpacity={0.85}
                      disabled={!!biometricLoading}
                    >
                      <View style={[styles.userTileBar, { backgroundColor: color }]} />
                      <View style={styles.userTileBody}>
                        <View style={styles.userAvatarWrap}>
                          {user.photo_url
                            ? <Image source={{ uri: user.photo_url }} style={styles.userAvatar} />
                            : (
                              <View style={[styles.userAvatar, styles.avatarPlaceholder, { backgroundColor: color + '25' }]}>
                                <Text style={[styles.avatarInitial, { color }]}>{user.name[0]?.toUpperCase()}</Text>
                              </View>
                            )
                          }
                          <View style={[styles.userBadge, { backgroundColor: color }]}>
                            {biometricLoading === user.id
                              ? <ActivityIndicator size={11} color="#fff" />
                              : <Text style={styles.badgeEmoji}>🫆</Text>
                            }
                          </View>
                        </View>
                        <Text style={styles.userName} numberOfLines={2}>{user.name}</Text>
                        <Text style={[styles.userSub, { color }]}>Tap to unlock</Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}

        </View>
      </ScrollView>
    );
  }

  // ── Guardian email/password form ────────────────────────────────────────────
  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.formInner} keyboardShouldPersistTaps="handled">
        {(guardianProfile || iddUsers.length > 0) && (
          <TouchableOpacity style={styles.backRow} onPress={() => setView('tiles')}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>
        )}

        <Text style={styles.title}>Guardian Sign In</Text>
        <Text style={styles.subtitle}>Sign in to manage profiles and tutorials</Text>

        <TextInput
          style={styles.input}
          placeholder="Email"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          placeholderTextColor={COLORS.textLight}
        />
        <TextInput
          style={styles.input}
          placeholder="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          placeholderTextColor={COLORS.textLight}
        />

        <TouchableOpacity style={styles.button} onPress={handleGuardianLogin} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Sign In</Text>}
        </TouchableOpacity>

        <TouchableOpacity onPress={() => navigation.navigate('GuardianRegister')}>
          <Text style={styles.link}>New Guardian? <Text style={styles.linkBold}>Create account</Text></Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background },
  container: { flex: 1, backgroundColor: COLORS.background },

  // ── Tiles ──
  tilesContainer: { flexGrow: 1, backgroundColor: '#F4F2FF' },

  appHeader: {
    backgroundColor: COLORS.primary,
    paddingTop: 72,
    paddingBottom: 44,
    alignItems: 'center',
    borderBottomLeftRadius: 36,
    borderBottomRightRadius: 36,
  },
  appIconWrap: {
    width: 88, height: 88, borderRadius: 26,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 14,
  },
  appIconEmoji: { fontSize: 48 },
  appName: { fontSize: 38, fontWeight: '900', color: '#fff', letterSpacing: -1 },
  appTagline: { fontSize: 15, color: 'rgba(255,255,255,0.75)', marginTop: 6, fontWeight: '500' },

  sectionsWrap: { paddingHorizontal: 20, paddingTop: 28, paddingBottom: 48 },

  section: { marginBottom: 28 },
  sectionLabel: {
    fontSize: 11, fontWeight: '800', color: COLORS.textLight,
    letterSpacing: 1.8, marginBottom: 12,
  },

  // Guardian tile — horizontal card
  guardianTile: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: '#fff', borderRadius: 20, padding: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08, shadowRadius: 12, elevation: 4,
    borderWidth: 1, borderColor: '#E2E8F0',
  },
  guardianAvatarWrap: { position: 'relative' },
  guardianAvatar: { width: 58, height: 58, borderRadius: 29 },
  guardianInfo: { flex: 1 },
  guardianName: { fontSize: 17, fontWeight: '800', color: COLORS.text },
  guardianSub: { fontSize: 13, color: COLORS.textLight, marginTop: 2, fontWeight: '500' },
  guardianBadge: {
    position: 'absolute', bottom: -2, right: -2,
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: '#64748B',
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 2, borderColor: '#fff',
  },
  guardianChevron: { fontSize: 26, color: COLORS.textLight, fontWeight: '300' },

  // User tiles — 2-column colorful grid
  tilesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  userTile: {
    width: TILE_SIZE,
    backgroundColor: '#fff',
    borderRadius: 22,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 5,
  },
  userTileBar: { height: 7 },
  userTileBody: { padding: 16, alignItems: 'center', gap: 8 },
  userAvatarWrap: { position: 'relative', marginBottom: 2 },
  userAvatar: { width: 74, height: 74, borderRadius: 37 },
  userBadge: {
    position: 'absolute', bottom: -2, right: -2,
    width: 26, height: 26, borderRadius: 13,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 2, borderColor: '#fff',
  },
  userName: { fontSize: 15, fontWeight: '800', color: COLORS.text, textAlign: 'center' },
  userSub: { fontSize: 12, fontWeight: '700' },

  // Shared avatar helpers
  avatarPlaceholder: { justifyContent: 'center', alignItems: 'center' },
  avatarInitial: { fontSize: 28, fontWeight: '900' },
  badgeEmoji: { fontSize: 13 },

  // ── Guardian form ──
  formInner: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  backRow: { marginBottom: 24 },
  backText: { fontSize: 16, color: COLORS.primary, fontWeight: '600' },
  title: { fontSize: 28, fontWeight: '900', color: COLORS.text, marginBottom: 8, textAlign: 'center' },
  subtitle: { fontSize: 14, color: COLORS.textLight, marginBottom: 32, textAlign: 'center' },
  input: {
    backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border,
    borderRadius: 12, padding: 16, fontSize: 16, color: COLORS.text, marginBottom: 16,
  },
  button: {
    backgroundColor: COLORS.primary, borderRadius: 12,
    padding: 16, alignItems: 'center', marginBottom: 16,
  },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  link: { textAlign: 'center', color: COLORS.textLight, fontSize: 14 },
  linkBold: { color: COLORS.primary, fontWeight: '600' },
});
