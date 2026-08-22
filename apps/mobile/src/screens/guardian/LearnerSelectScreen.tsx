import React, { useCallback, useRef, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Image, ActivityIndicator, Alert, Dimensions, Modal, TextInput,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/AuthContext';
import { COLORS } from '../../constants';
import { GuardianNavParamList } from '../../navigation';
import {
  loadBiometricUsers, promptBiometric, isBiometricAvailable, saveBiometricUser,
  type BiometricUser,
} from '../../lib/biometricStore';

type Nav = NativeStackNavigationProp<GuardianNavParamList>;

const { width } = Dimensions.get('window');
const TILE_SIZE  = (width - 48 - 14) / 2;
const USER_COLORS = ['#FF6B6B', '#845EF7', '#20C997', '#FF922B', '#339AF0', '#F06595', '#74C0FC'];

type LearnerTile = {
  id: string;
  name: string;
  photo_url: string | null;
  biometricUser: BiometricUser | null;
};

export default function LearnerSelectScreen() {
  const navigation = useNavigation<Nav>();
  const { guardian, signOut } = useAuth();

  const [learners, setLearners]         = useState<LearnerTile[]>([]);
  const [loading, setLoading]           = useState(true);
  const [biometricLoading, setBiometricLoading] = useState<string | null>(null);

  // Guardian PIN modal
  const [showPinModal, setShowPinModal]       = useState(false);
  const [pin, setPin]                         = useState('');
  const [pinLoading, setPinLoading]           = useState(false);
  const [pinError, setPinError]               = useState('');
  // Forgot PIN flow: verify password → set new PIN
  const [forgotPin, setForgotPin]       = useState(false);
  const [verified, setVerified]         = useState(false);
  const [verifyPassword, setVerifyPassword] = useState('');
  const [newPin, setNewPin]             = useState('');
  const [confirmPin, setConfirmPin]     = useState('');
  const pinInputRef = useRef<TextInput>(null);

  useFocusEffect(
    useCallback(() => { load(); }, [guardian?.id])
  );

  async function load() {
    setLoading(true);
    try {
      const [bioUsers, { data: profiles }] = await Promise.all([
        loadBiometricUsers(),
        guardian
          ? supabase.from('user_profiles').select('id, name, photo_url').eq('guardian_id', guardian.id)
          : Promise.resolve({ data: [] }),
      ]);
      const bioMap = new Map(bioUsers.map(u => [u.id, u]));
      setLearners(
        (profiles ?? []).map(p => ({
          id: p.id,
          name: p.name,
          photo_url: p.photo_url,
          biometricUser: bioMap.get(p.id) ?? null,
        }))
      );
    } finally {
      setLoading(false);
    }
  }

  // ── Guardian PIN verification ─────────────────────────────────────────────

  function openPinModal() {
    setPin('');
    setPinError('');
    setForgotPin(false);
    setVerified(false);
    setVerifyPassword('');
    setNewPin('');
    setConfirmPin('');
    setShowPinModal(true);
    setTimeout(() => pinInputRef.current?.focus(), 100);
  }

  function closeForgot() {
    setForgotPin(false);
    setVerified(false);
    setVerifyPassword('');
    setNewPin('');
    setConfirmPin('');
    setPinError('');
  }

  async function handleVerifyPassword() {
    if (!verifyPassword || !guardian?.email) return;
    setPinLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: guardian.email,
      password: verifyPassword,
    });
    setPinLoading(false);
    if (error) { setPinError('Incorrect password. Please try again.'); return; }
    setVerified(true);
    setPinError('');
  }

  async function handleSetNewPin() {
    if (newPin.length !== 6) return;
    if (newPin !== confirmPin) { setPinError('PINs do not match.'); return; }
    setPinLoading(true);
    const { error } = await supabase.rpc('set_guardian_pin', { pin_input: newPin });
    setPinLoading(false);
    if (error) { setPinError('Failed to save PIN. Please try again.'); return; }
    setShowPinModal(false);
    closeForgot();
    navigation.navigate('GuardianHome');
  }

  async function handlePinSubmit() {
    if (pin.length !== 6) return;
    setPinLoading(true);
    const { data, error } = await supabase.rpc('verify_guardian_pin', { pin_input: pin });
    setPinLoading(false);
    if (error || !data) {
      setPinError('Incorrect PIN. Please try again.');
      setPin('');
      return;
    }
    setShowPinModal(false);
    setPin('');
    navigation.navigate('GuardianHome');
  }

  // ── Learner biometric login ───────────────────────────────────────────────

  async function handleLearnerTap(tile: LearnerTile) {
    const available = await isBiometricAvailable();
    if (!available) {
      Alert.alert(
        'Biometrics not set up',
        'Please set up Face ID or fingerprint in your device Settings first.',
      );
      return;
    }

    setBiometricLoading(tile.id);

    if (!tile.biometricUser) {
      // Credentials not in store — shouldn't happen for new profiles
      setBiometricLoading(null);
      Alert.alert('Login not set up', 'Biometric login is not set up for this learner. Please edit their profile to configure it.');
      return;
    }

    const passed = await promptBiometric(`Unlock app for ${tile.name}`);
    if (!passed) { setBiometricLoading(null); return; }

    const { error } = await supabase.auth.signInWithPassword({
      email: tile.biometricUser.email,
      password: tile.biometricUser.password,
    });
    setBiometricLoading(null);
    if (error) Alert.alert('Login failed', error.message);
  }

  const initial = guardian?.full_name?.[0]?.toUpperCase() ?? 'G';

  if (loading) {
    return <View style={s.center}><ActivityIndicator size="large" color={COLORS.bloomAccent} /></View>;
  }

  return (
    <View style={s.root}>
      <ScrollView contentContainerStyle={s.container} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={s.header}>
          <LinearGradient colors={['#5BC8F5', '#FFB830']} style={s.appIcon}>
            <Text style={s.appIconEmoji}>☀️</Text>
          </LinearGradient>
          <Text style={s.appName}>Ray<Text style={s.appDot}>.</Text></Text>
          <Text style={s.tagline}>Guiding light for every day</Text>
        </View>

        <View style={s.body}>
          <View style={s.tilesGrid}>
            {/* Guardian tile */}
            <TouchableOpacity style={s.guardianTile} onPress={openPinModal} activeOpacity={0.85}>
              <View style={[s.tileBar, { backgroundColor: COLORS.bloomNavy }]} />
              <View style={[s.tileBody, s.guardianTileBody]}>
                <View style={s.avatarWrap}>
                  {guardian?.photo_url ? (
                    <Image source={{ uri: guardian.photo_url }} style={s.avatar} />
                  ) : (
                    <View style={[s.avatar, s.avatarFallback, { backgroundColor: COLORS.bloomAccent + '25' }]}>
                      <Text style={[s.avatarInitial, { color: COLORS.bloomAccent }]}>{initial}</Text>
                    </View>
                  )}
                </View>
                <Text style={s.userName}>{guardian?.full_name ?? 'Guardian'}</Text>
                <Text style={[s.userSub, { color: COLORS.bloomAccent }]}>Guardian</Text>
              </View>
              <View style={s.guardianRoleBadge}>
                <Text style={s.guardianRoleEmoji}>🤓</Text>
              </View>
            </TouchableOpacity>

            {learners.map((tile, i) => {
                const color = USER_COLORS[i % USER_COLORS.length];
                const hasCredentials = !!tile.biometricUser;
                return (
                  <TouchableOpacity
                    key={tile.id}
                    style={[s.tile, { shadowColor: color }]}
                    onPress={() => handleLearnerTap(tile)}
                    activeOpacity={0.85}
                    disabled={!!biometricLoading}
                  >
                    <View style={[s.tileBar, { backgroundColor: color }]} />
                    <View style={s.tileBody}>
                      <View style={s.avatarWrap}>
                        {tile.photo_url ? (
                          <Image source={{ uri: tile.photo_url }} style={s.avatar} />
                        ) : (
                          <View style={[s.avatar, s.avatarFallback, { backgroundColor: color + '25' }]}>
                            <Text style={[s.avatarInitial, { color }]}>{tile.name[0]?.toUpperCase()}</Text>
                          </View>
                        )}
                        <View style={[s.badge, { backgroundColor: hasCredentials ? color : COLORS.bloomMuted }]}>
                          {biometricLoading === tile.id
                            ? <ActivityIndicator size={11} color="#fff" />
                            : <Text style={s.badgeEmoji}>{hasCredentials ? '🫆' : '🔒'}</Text>
                          }
                        </View>
                      </View>
                      <Text style={s.userName} numberOfLines={2}>{tile.name}</Text>
                      <Text style={[s.userSub, { color: hasCredentials ? color : COLORS.bloomMuted }]}>
                        {hasCredentials ? 'Tap to unlock' : 'Setup needed'}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>

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

      {/* PIN Modal */}
      <Modal visible={showPinModal} transparent animationType="fade" onRequestClose={() => setShowPinModal(false)}>
        <TouchableOpacity style={s.pinOverlay} activeOpacity={1} onPress={() => setShowPinModal(false)}>
          <TouchableOpacity style={s.pinCard} activeOpacity={1} onPress={() => {}}>

            {/* ── PIN entry ── */}
            {!forgotPin && (
              <>
                <Text style={s.pinTitle}>Guardian Mode</Text>
                <Text style={s.pinSubtitle}>Enter your 6-digit PIN</Text>

                <TouchableOpacity style={s.pinDotsRow} activeOpacity={1} onPress={() => pinInputRef.current?.focus()}>
                  {[0, 1, 2, 3, 4, 5].map(i => (
                    <View key={i} style={[s.pinDot, pin.length > i && s.pinDotFilled]} />
                  ))}
                </TouchableOpacity>
                <TextInput
                  ref={pinInputRef}
                  style={s.hiddenInput}
                  value={pin}
                  onChangeText={(v) => { setPin(v.replace(/[^0-9]/g, '').slice(0, 6)); setPinError(''); }}
                  keyboardType="number-pad"
                  maxLength={6}
                  autoFocus
                />

                {pinError ? <Text style={s.pinError}>{pinError}</Text> : null}

                <TouchableOpacity
                  style={[s.pinSubmitBtn, pin.length !== 6 && { opacity: 0.5 }]}
                  onPress={handlePinSubmit}
                  disabled={pinLoading || pin.length !== 6}
                  activeOpacity={0.85}
                >
                  {pinLoading
                    ? <ActivityIndicator color="#fff" />
                    : <Text style={s.pinSubmitText}>Continue</Text>
                  }
                </TouchableOpacity>

                <TouchableOpacity style={s.forgotBtn} onPress={() => { setForgotPin(true); setPinError(''); }} activeOpacity={0.7}>
                  <Text style={s.forgotBtnText}>Forgot PIN?</Text>
                </TouchableOpacity>
              </>
            )}

            {/* ── Step 1: verify password ── */}
            {forgotPin && !verified && (
              <>
                <Text style={s.pinTitle}>Reset PIN</Text>
                <Text style={s.pinSubtitle}>Enter your account password to continue</Text>

                <TextInput
                  style={s.passwordInput}
                  value={verifyPassword}
                  onChangeText={setVerifyPassword}
                  secureTextEntry
                  placeholder="Account password"
                  placeholderTextColor={COLORS.bloomMuted}
                  autoFocus
                  autoCapitalize="none"
                />

                {pinError ? <Text style={s.pinError}>{pinError}</Text> : null}

                <TouchableOpacity
                  style={[s.pinSubmitBtn, !verifyPassword && { opacity: 0.5 }]}
                  onPress={handleVerifyPassword}
                  disabled={pinLoading || !verifyPassword}
                  activeOpacity={0.85}
                >
                  {pinLoading
                    ? <ActivityIndicator color="#fff" />
                    : <Text style={s.pinSubmitText}>Verify</Text>
                  }
                </TouchableOpacity>

                <TouchableOpacity style={s.forgotBtn} onPress={closeForgot} activeOpacity={0.7}>
                  <Text style={s.forgotBtnText}>← Back to PIN</Text>
                </TouchableOpacity>
              </>
            )}

            {/* ── Step 2: set new PIN ── */}
            {forgotPin && verified && (
              <>
                <Text style={s.pinTitle}>Set New PIN</Text>
                <Text style={s.pinSubtitle}>Choose a new 6-digit PIN</Text>

                <TextInput
                  style={s.passwordInput}
                  value={newPin}
                  onChangeText={(v) => { setNewPin(v.replace(/[^0-9]/g, '').slice(0, 6)); setPinError(''); }}
                  keyboardType="number-pad"
                  maxLength={6}
                  secureTextEntry
                  placeholder="New PIN"
                  placeholderTextColor={COLORS.bloomMuted}
                  autoFocus
                />
                <TextInput
                  style={s.passwordInput}
                  value={confirmPin}
                  onChangeText={(v) => { setConfirmPin(v.replace(/[^0-9]/g, '').slice(0, 6)); setPinError(''); }}
                  keyboardType="number-pad"
                  maxLength={6}
                  secureTextEntry
                  placeholder="Confirm PIN"
                  placeholderTextColor={COLORS.bloomMuted}
                />

                {pinError ? <Text style={s.pinError}>{pinError}</Text> : null}

                <TouchableOpacity
                  style={[s.pinSubmitBtn, (newPin.length !== 6 || confirmPin.length !== 6) && { opacity: 0.5 }]}
                  onPress={handleSetNewPin}
                  disabled={pinLoading || newPin.length !== 6 || confirmPin.length !== 6}
                  activeOpacity={0.85}
                >
                  {pinLoading
                    ? <ActivityIndicator color="#fff" />
                    : <Text style={s.pinSubmitText}>Save New PIN</Text>
                  }
                </TouchableOpacity>
              </>
            )}

          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
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
    justifyContent: 'center', alignItems: 'center', marginBottom: 14,
  },
  appIconEmoji: { fontSize: 48 },
  appName:      { fontSize: 38, fontWeight: '900', color: '#fff', letterSpacing: -1 },
  appDot:       { color: COLORS.bloomDot },
  tagline:      { fontSize: 15, color: 'rgba(255,255,255,0.55)', marginTop: 6, fontWeight: '500', marginBottom: 20 },

  guardianTile: {
    width: TILE_SIZE,
    backgroundColor: COLORS.bloomCard, borderRadius: 22,
    overflow: 'hidden', position: 'relative',
    shadowColor: COLORS.bloomNavy, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15, shadowRadius: 10, elevation: 5,
  },
  guardianTileBody: { paddingVertical: 20 },
  guardianRoleBadge: {
    position: 'absolute', top: 14, right: 14,
    backgroundColor: COLORS.bloomNavy,
    width: 32, height: 32, borderRadius: 16,
    justifyContent: 'center', alignItems: 'center',
  },
  guardianRoleEmoji: { fontSize: 17 },

  body:         { paddingHorizontal: 20, paddingTop: 28, alignItems: 'center' },

  // Tiles
  tilesGrid: { flexDirection: 'column', alignItems: 'center', gap: 14 },
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

  signOutBtn: {
    marginTop: 36, alignSelf: 'center',
    paddingVertical: 10, paddingHorizontal: 28,
    borderRadius: 20, borderWidth: 1.5, borderColor: '#FECACA',
    backgroundColor: '#FEF2F2',
  },
  signOutText: { fontSize: 14, fontWeight: '700', color: '#DC2626' },

  // PIN Modal
  pinOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center', alignItems: 'center',
  },
  pinCard: {
    backgroundColor: '#fff', borderRadius: 28,
    paddingHorizontal: 32, paddingTop: 32, paddingBottom: 28,
    width: width - 56, alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.3, shadowRadius: 32, elevation: 16,
  },
  pinTitle:    { fontSize: 22, fontWeight: '900', color: COLORS.bloomText, marginBottom: 6 },
  pinSubtitle: { fontSize: 14, color: COLORS.bloomMuted, marginBottom: 28, textAlign: 'center' },

  pinDotsRow: { flexDirection: 'row', gap: 14, marginBottom: 8 },
  pinDot: {
    width: 18, height: 18, borderRadius: 9,
    borderWidth: 2, borderColor: COLORS.bloomBorder,
    backgroundColor: 'transparent',
  },
  pinDotFilled: { backgroundColor: COLORS.bloomAccent, borderColor: COLORS.bloomAccent },
  hiddenInput: { position: 'absolute', opacity: 0, width: 1, height: 1 },

  pinError: { fontSize: 13, color: COLORS.error, marginTop: 4, marginBottom: 8 },

  forgotBtn:     { paddingVertical: 12 },
  forgotBtnText: { fontSize: 13, color: COLORS.bloomAccent, fontWeight: '600' },

  passwordInput: {
    width: '100%', backgroundColor: COLORS.bloomBody,
    borderWidth: 1.5, borderColor: COLORS.bloomBorder,
    borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14,
    fontSize: 16, color: COLORS.bloomText, marginBottom: 8,
  },

  pinSubmitBtn: {
    width: '100%', backgroundColor: COLORS.bloomNavy,
    borderRadius: 16, paddingVertical: 16,
    alignItems: 'center', marginTop: 20, marginBottom: 8,
  },
  pinSubmitText: { color: '#fff', fontSize: 16, fontWeight: '800' },

});
