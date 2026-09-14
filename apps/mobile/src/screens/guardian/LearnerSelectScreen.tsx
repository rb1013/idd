import React, { useCallback, useRef, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Image, ActivityIndicator, Alert, Dimensions, Modal, TextInput,
} from 'react-native';
import AppText from '../../components/AppText';
import AppLogo from '../../components/AppLogo';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/AuthContext';
import { COLORS } from '../../constants';
import { GuardianNavParamList } from '../../navigation';
import {
  loadBiometricUsers, promptBiometric, isBiometricAvailable, saveBiometricUser,
  fetchAndCacheCredentials,
  type BiometricUser,
} from '../../lib/biometricStore';

type Nav = NativeStackNavigationProp<GuardianNavParamList>;

const { width } = Dimensions.get('window');
const TILE_SIZE  = width - 56;
const USER_COLORS = [COLORS.statusRed, COLORS.statusPurple, COLORS.statusTeal, '#FF922B', '#339AF0', '#F06595', '#74C0FC'];

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
    // Biometric check removed — guardian session is sufficient authentication.
    // The code below is preserved and can be re-enabled if biometric is needed in future.
    // const available = await isBiometricAvailable();
    // if (!available) {
    //   Alert.alert(
    //     'Biometrics not set up',
    //     'Please set up Face ID or fingerprint in your device Settings first.',
    //   );
    //   return;
    // }

    setBiometricLoading(tile.id);

    let biometricUser = tile.biometricUser;

    if (!biometricUser) {
      // No local credentials — try fetching from Supabase (cross-device sync)
      const fetched = await fetchAndCacheCredentials(tile.id, tile.name, tile.photo_url);
      if (!fetched) {
        setBiometricLoading(null);
        Alert.alert('Login not available', 'Please create this learner profile again to enable login on this device.');
        return;
      }
      // Re-read from SecureStore after caching
      const users = await loadBiometricUsers();
      biometricUser = users.find(u => u.id === tile.id) ?? null;
      if (!biometricUser) { setBiometricLoading(null); return; }
    }

    // Biometric prompt removed — tap goes directly to sign-in.
    // const passed = await promptBiometric(`Unlock app for ${tile.name}`);
    // if (!passed) { setBiometricLoading(null); return; }

    const { error } = await supabase.auth.signInWithPassword({
      email: biometricUser.email,
      password: biometricUser.password,
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
          <AppLogo />
        </View>

        <View style={s.body}>
          <View style={s.tilesGrid}>
            {/* Guardian tile */}
            <TouchableOpacity style={s.guardianTile} onPress={openPinModal} activeOpacity={0.85}>
              <View style={[s.tileBar, { backgroundColor: COLORS.bloomAccent }]} />
              <View style={[s.tileBody, s.guardianTileBody]}>
                <View style={s.avatarWrap}>
                  {guardian?.photo_url ? (
                    <Image source={{ uri: guardian.photo_url }} style={s.avatar} />
                  ) : (
                    <View style={[s.avatar, s.avatarFallback, { backgroundColor: COLORS.bloomAccent + '25' }]}>
                      <AppText style={[s.avatarInitial, { color: COLORS.bloomAccent }]}>{initial}</AppText>
                    </View>
                  )}
                </View>
                <AppText style={s.userName}>{guardian?.full_name ?? 'Guardian'}</AppText>
              </View>
            </TouchableOpacity>

            {learners.map((tile, i) => {
                const color = COLORS.bloomOrange;
                const hasCredentials = !!tile.biometricUser;
                return (
                  <TouchableOpacity
                    key={tile.id}
                    style={[s.tile, { shadowColor: color, borderWidth: 2, borderColor: color }]}
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
                            <AppText style={[s.avatarInitial, { color }]}>{tile.name[0]?.toUpperCase()}</AppText>
                          </View>
                        )}
                      </View>
                      <AppText style={s.userName} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.6}>{tile.name}</AppText>
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
            <AppText style={s.signOutText}>Sign out</AppText>
          </TouchableOpacity>
        </View>

      </ScrollView>

      {/* PIN Modal */}
      <Modal visible={showPinModal} transparent animationType="fade" onRequestClose={() => setShowPinModal(false)}>
        <TouchableOpacity style={s.pinOverlay} activeOpacity={1} onPress={() => setShowPinModal(false)}>
          <TouchableOpacity style={s.pinCard} activeOpacity={1} onPress={() => {}}>

            <TouchableOpacity style={s.pinClose} onPress={() => setShowPinModal(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <AppText style={s.pinCloseText}>✕</AppText>
            </TouchableOpacity>

            {/* ── PIN entry ── */}
            {!forgotPin && (
              <>
                <AppText style={s.pinTitle}>Guardian Mode</AppText>
                <AppText style={s.pinSubtitle}>Enter your 6-digit PIN</AppText>

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

                {pinError ? <AppText style={s.pinError}>{pinError}</AppText> : null}

                <TouchableOpacity
                  style={[s.pinSubmitBtn, pin.length !== 6 && { opacity: 0.5 }]}
                  onPress={handlePinSubmit}
                  disabled={pinLoading || pin.length !== 6}
                  activeOpacity={0.85}
                >
                  {pinLoading
                    ? <ActivityIndicator color="#fff" />
                    : <AppText style={s.pinSubmitText}>Continue</AppText>
                  }
                </TouchableOpacity>

                <TouchableOpacity style={s.forgotBtn} onPress={() => { setForgotPin(true); setPinError(''); }} activeOpacity={0.7}>
                  <AppText style={s.forgotBtnText}>Forgot PIN?</AppText>
                </TouchableOpacity>
              </>
            )}

            {/* ── Step 1: verify password ── */}
            {forgotPin && !verified && (
              <>
                <AppText style={s.pinTitle}>Reset PIN</AppText>
                <AppText style={s.pinSubtitle}>Enter your account password to continue</AppText>

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

                {pinError ? <AppText style={s.pinError}>{pinError}</AppText> : null}

                <TouchableOpacity
                  style={[s.pinSubmitBtn, !verifyPassword && { opacity: 0.5 }]}
                  onPress={handleVerifyPassword}
                  disabled={pinLoading || !verifyPassword}
                  activeOpacity={0.85}
                >
                  {pinLoading
                    ? <ActivityIndicator color="#fff" />
                    : <AppText style={s.pinSubmitText}>Verify</AppText>
                  }
                </TouchableOpacity>

                <TouchableOpacity style={s.forgotBtn} onPress={closeForgot} activeOpacity={0.7}>
                  <AppText style={s.forgotBtnText}>← Back to PIN</AppText>
                </TouchableOpacity>
              </>
            )}

            {/* ── Step 2: set new PIN ── */}
            {forgotPin && verified && (
              <>
                <AppText style={s.pinTitle}>Set New PIN</AppText>
                <AppText style={s.pinSubtitle}>Choose a new 6-digit PIN</AppText>

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

                {pinError ? <AppText style={s.pinError}>{pinError}</AppText> : null}

                <TouchableOpacity
                  style={[s.pinSubmitBtn, (newPin.length !== 6 || confirmPin.length !== 6) && { opacity: 0.5 }]}
                  onPress={handleSetNewPin}
                  disabled={pinLoading || newPin.length !== 6 || confirmPin.length !== 6}
                  activeOpacity={0.85}
                >
                  {pinLoading
                    ? <ActivityIndicator color="#fff" />
                    : <AppText style={s.pinSubmitText}>Save New PIN</AppText>
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
    backgroundColor: COLORS.bloomAccent,
    paddingTop: 54, paddingBottom: 30,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 260,
    borderBottomLeftRadius: 36, borderBottomRightRadius: 36,
  },

  guardianTile: {
    width: TILE_SIZE,
    backgroundColor: COLORS.bloomCard, borderRadius: 22,
    overflow: 'hidden', position: 'relative',
    borderWidth: 2, borderColor: COLORS.bloomAccent,
    shadowColor: COLORS.bloomAccent, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.22, shadowRadius: 12, elevation: 6,
  },
  guardianTileBody: { paddingVertical: 20 },
  guardianRoleBadge: {
    position: 'absolute', top: 14, right: 14,
    backgroundColor: COLORS.bloomAccent,
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
    shadowOpacity: 0.22, shadowRadius: 12, elevation: 6,
  },
  tileBar:  { height: 7 },
  tileBody: { padding: 16, alignItems: 'center', gap: 8 },

  avatarWrap:    { position: 'relative', marginBottom: 2 },
  avatar:        { width: 90, height: 90, borderRadius: 45 },
  avatarFallback:{ justifyContent: 'center', alignItems: 'center' },
  avatarInitial: { fontSize: 28, fontWeight: '900' },

  badge: {
    position: 'absolute', bottom: -4, right: -4,
    width: 36, height: 36, borderRadius: 18,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 2.5, borderColor: '#fff',
    backgroundColor: '#fff',
  },
  badgeEmoji: { fontSize: 18 },

  userName: { fontSize: 15, fontWeight: '800', color: COLORS.bloomText, textAlign: 'center' },
  userSub:  { fontSize: 12, fontWeight: '700' },

  signOutBtn: {
    marginTop: 36, alignSelf: 'center',
    paddingVertical: 10, paddingHorizontal: 28,
    borderRadius: 20, borderWidth: 1.5, borderColor: 'rgba(45,49,46,0.25)',
    backgroundColor: 'rgba(45,49,46,0.15)',
  },
  signOutText: { fontSize: 14, fontWeight: '700', color: COLORS.bloomActiveText },

  // PIN Modal
  pinOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center', alignItems: 'center',
  },
  pinCard: {
    backgroundColor: '#fff', borderRadius: 28,
    paddingHorizontal: 32, paddingTop: 40, paddingBottom: 28,
    width: width - 56, alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.3, shadowRadius: 32, elevation: 16,
  },
  pinClose: { position: 'absolute', top: 14, right: 16, padding: 4 },
  pinCloseText: { fontSize: 18, color: COLORS.bloomMuted, fontWeight: '600' },
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
    width: '100%', backgroundColor: COLORS.bloomAccent,
    borderRadius: 16, paddingVertical: 16,
    alignItems: 'center', marginTop: 20, marginBottom: 8,
  },
  pinSubmitText: { color: COLORS.bloomOnAccent, fontSize: 16, fontWeight: '800' },

});
