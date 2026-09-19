import React, { useCallback, useRef, useState } from 'react';
import {
  View, ScrollView, TouchableOpacity, StyleSheet,
  Image, ActivityIndicator, Alert, Modal, TextInput,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import AppText from '../../components/AppText';
import AppLogo from '../../components/AppLogo';
import ContentContainer from '../../components/ContentContainer';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/AuthContext';
import { GuardianNavParamList } from '../../navigation';
import {
  loadBiometricUsers, fetchAndCacheCredentials, type BiometricUser,
} from '../../lib/biometricStore';
import {
  NICO, TEXT_STYLE, SPACING, RADIUS, SHADOW, INPUT, BTN_SIZE, BTN_VARIANT,
  BUTTERFLY_BORDER, BUTTERFLY_TILES, FONT_SIZE, FONT_WEIGHT,
} from '../../constants/theme';

type Nav = NativeStackNavigationProp<GuardianNavParamList>;

type LearnerTile = {
  id: string;
  name: string;
  photo_url: string | null;
  biometricUser: BiometricUser | null;
};

export default function LearnerSelectScreen() {
  const navigation = useNavigation<Nav>();
  const { guardian, signOut } = useAuth();

  const [learners, setLearners]                   = useState<LearnerTile[]>([]);
  const [loading, setLoading]                     = useState(true);
  const [biometricLoading, setBiometricLoading]   = useState<string | null>(null);

  const [showPinModal, setShowPinModal]   = useState(false);
  const [pin, setPin]                     = useState('');
  const [pinLoading, setPinLoading]       = useState(false);
  const [pinError, setPinError]           = useState('');
  const [forgotPin, setForgotPin]         = useState(false);
  const [verified, setVerified]           = useState(false);
  const [verifyPassword, setVerifyPassword] = useState('');
  const [newPin, setNewPin]               = useState('');
  const [confirmPin, setConfirmPin]       = useState('');
  const pinInputRef = useRef<TextInput>(null);

  useFocusEffect(useCallback(() => { load(); }, [guardian?.id]));

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
          id: p.id, name: p.name, photo_url: p.photo_url,
          biometricUser: bioMap.get(p.id) ?? null,
        }))
      );
    } finally {
      setLoading(false);
    }
  }

  function openPinModal() {
    setPin(''); setPinError(''); setForgotPin(false); setVerified(false);
    setVerifyPassword(''); setNewPin(''); setConfirmPin('');
    setShowPinModal(true);
    setTimeout(() => pinInputRef.current?.focus(), 100);
  }

  function closeForgot() {
    setForgotPin(false); setVerified(false);
    setVerifyPassword(''); setNewPin(''); setConfirmPin(''); setPinError('');
  }

  async function handleVerifyPassword() {
    if (!verifyPassword || !guardian?.email) return;
    setPinLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email: guardian.email, password: verifyPassword });
    setPinLoading(false);
    if (error) { setPinError('Incorrect password. Please try again.'); return; }
    setVerified(true); setPinError('');
  }

  async function handleSetNewPin() {
    if (newPin.length !== 6) return;
    if (newPin !== confirmPin) { setPinError('PINs do not match.'); return; }
    setPinLoading(true);
    const { error } = await supabase.rpc('set_guardian_pin', { pin_input: newPin });
    setPinLoading(false);
    if (error) { setPinError('Failed to save PIN. Please try again.'); return; }
    setShowPinModal(false); closeForgot();
    navigation.navigate('GuardianHome');
  }

  async function handlePinSubmit() {
    if (pin.length !== 6) return;
    setPinLoading(true);
    const { data, error } = await supabase.rpc('verify_guardian_pin', { pin_input: pin });
    setPinLoading(false);
    if (error || !data) { setPinError('Incorrect PIN. Please try again.'); setPin(''); return; }
    setShowPinModal(false); setPin('');
    navigation.navigate('GuardianHome');
  }

  async function handleLearnerTap(tile: LearnerTile) {
    setBiometricLoading(tile.id);
    let biometricUser = tile.biometricUser;
    if (!biometricUser) {
      const fetched = await fetchAndCacheCredentials(tile.id, tile.name, tile.photo_url);
      if (!fetched) {
        setBiometricLoading(null);
        Alert.alert('Login not available', 'Please create this learner profile again to enable login on this device.');
        return;
      }
      const users = await loadBiometricUsers();
      biometricUser = users.find(u => u.id === tile.id) ?? null;
      if (!biometricUser) { setBiometricLoading(null); return; }
    }
    const { error } = await supabase.auth.signInWithPassword({ email: biometricUser.email, password: biometricUser.password });
    setBiometricLoading(null);
    if (error) Alert.alert('Login failed', error.message);
  }

  const initial = guardian?.full_name?.[0]?.toUpperCase() ?? 'G';

  if (loading) {
    return <View style={s.center}><ActivityIndicator size="large" color={NICO.primary} /></View>;
  }

  return (
    <View style={s.root}>
      <ScrollView contentContainerStyle={s.container} showsVerticalScrollIndicator={false}>

        {/* Header — full width with butterfly gradient border */}
        <LinearGradient
          colors={[...BUTTERFLY_BORDER.colors]}
          start={BUTTERFLY_BORDER.start}
          end={BUTTERFLY_BORDER.end}
          style={s.headerBorder}
        >
          <View style={s.header}>
            <AppLogo />
          </View>
        </LinearGradient>

        <ContentContainer>
          <View style={s.body}>

            {/* Guardian tile */}
            <LinearGradient
              colors={[...BUTTERFLY_BORDER.colors]}
              start={BUTTERFLY_BORDER.start}
              end={BUTTERFLY_BORDER.end}
              style={s.tileBorder}
            >
              <TouchableOpacity style={[s.tile, { backgroundColor: NICO.greenLight }]} onPress={openPinModal} activeOpacity={0.85}>
                <View style={s.tileBody}>
                  <View style={s.avatarWrap}>
                    {guardian?.photo_url ? (
                      <Image source={{ uri: guardian.photo_url }} style={s.avatar} />
                    ) : (
                      <View style={[s.avatar, s.avatarFallback, { backgroundColor: NICO.green + '30' }]}>
                        <AppText style={[s.avatarInitial, { color: NICO.green }]}>{initial}</AppText>
                      </View>
                    )}
                  </View>
                  <AppText style={s.userName}>{guardian?.full_name ?? 'Guardian'}</AppText>
                </View>
              </TouchableOpacity>
            </LinearGradient>

            {/* Learner tiles */}
            {learners.map((tile) => (
              <LinearGradient
                key={tile.id}
                colors={[...BUTTERFLY_BORDER.colors]}
                start={BUTTERFLY_BORDER.start}
                end={BUTTERFLY_BORDER.end}
                style={s.tileBorder}
              >
                <TouchableOpacity
                  style={[s.tile, { backgroundColor: NICO.orangeLight }]}
                  onPress={() => handleLearnerTap(tile)}
                  activeOpacity={0.85}
                  disabled={!!biometricLoading}
                >
                  <View style={s.tileBody}>
                    <View style={s.avatarWrap}>
                      {tile.photo_url ? (
                        <Image source={{ uri: tile.photo_url }} style={s.avatar} />
                      ) : (
                        <View style={[s.avatar, s.avatarFallback, { backgroundColor: NICO.orange + '30' }]}>
                          <AppText style={[s.avatarInitial, { color: NICO.orange }]}>{tile.name[0]?.toUpperCase()}</AppText>
                        </View>
                      )}
                    </View>
                    {biometricLoading === tile.id
                      ? <ActivityIndicator color={NICO.orange} />
                      : <AppText style={s.userName} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.6}>{tile.name}</AppText>
                    }
                  </View>
                </TouchableOpacity>
              </LinearGradient>
            ))}

            {/* Sign out */}
            <TouchableOpacity
              style={s.signOutBtn}
              onPress={() => Alert.alert('Sign out', 'Are you sure you want to sign out?', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Sign out', style: 'destructive', onPress: signOut },
              ])}
              activeOpacity={0.75}
            >
              <AppText style={s.signOutText}>Sign Out</AppText>
            </TouchableOpacity>

          </View>
        </ContentContainer>

      </ScrollView>

      {/* PIN Modal */}
      <Modal visible={showPinModal} transparent animationType="fade" onRequestClose={() => setShowPinModal(false)}>
        <TouchableOpacity style={s.pinOverlay} activeOpacity={1} onPress={() => setShowPinModal(false)}>
          <TouchableOpacity style={s.pinCard} activeOpacity={1} onPress={() => {}}>

            <TouchableOpacity style={s.pinClose} onPress={() => setShowPinModal(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <AppText style={s.pinCloseText}>✕</AppText>
            </TouchableOpacity>

            {/* PIN entry */}
            {!forgotPin && (
              <>
                <AppText style={s.pinTitle}>Guardian Mode</AppText>
                <AppText style={s.pinSubtitle}>Enter your 6-digit PIN</AppText>
                <TouchableOpacity style={s.pinDotsRow} activeOpacity={1} onPress={() => pinInputRef.current?.focus()}>
                  {[0,1,2,3,4,5].map(i => (
                    <View key={i} style={[s.pinDot, pin.length > i && s.pinDotFilled]} />
                  ))}
                </TouchableOpacity>
                <TextInput
                  ref={pinInputRef}
                  style={s.hiddenInput}
                  value={pin}
                  onChangeText={v => { setPin(v.replace(/[^0-9]/g, '').slice(0, 6)); setPinError(''); }}
                  keyboardType="number-pad"
                  maxLength={6}
                  autoFocus
                />
                {pinError ? <AppText style={s.pinError}>{pinError}</AppText> : null}
                <TouchableOpacity
                  style={[s.pinSubmitBtn, pin.length !== 6 && s.pinSubmitDisabled]}
                  onPress={handlePinSubmit}
                  disabled={pinLoading || pin.length !== 6}
                  activeOpacity={0.85}
                >
                  {pinLoading ? <ActivityIndicator color={NICO.textOnAccent} /> : <AppText style={s.pinSubmitText}>Continue</AppText>}
                </TouchableOpacity>
                <TouchableOpacity style={s.forgotBtn} onPress={() => { setForgotPin(true); setPinError(''); }} activeOpacity={0.7}>
                  <AppText style={s.forgotBtnText}>Forgot PIN?</AppText>
                </TouchableOpacity>
              </>
            )}

            {/* Step 1: verify password */}
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
                  placeholderTextColor={NICO.textMuted}
                  autoFocus
                  autoCapitalize="none"
                />
                {pinError ? <AppText style={s.pinError}>{pinError}</AppText> : null}
                <TouchableOpacity
                  style={[s.pinSubmitBtn, !verifyPassword && s.pinSubmitDisabled]}
                  onPress={handleVerifyPassword}
                  disabled={pinLoading || !verifyPassword}
                  activeOpacity={0.85}
                >
                  {pinLoading ? <ActivityIndicator color={NICO.textOnAccent} /> : <AppText style={s.pinSubmitText}>Verify</AppText>}
                </TouchableOpacity>
                <TouchableOpacity style={s.forgotBtn} onPress={closeForgot} activeOpacity={0.7}>
                  <AppText style={s.forgotBtnText}>← Back to PIN</AppText>
                </TouchableOpacity>
              </>
            )}

            {/* Step 2: set new PIN */}
            {forgotPin && verified && (
              <>
                <AppText style={s.pinTitle}>Set New PIN</AppText>
                <AppText style={s.pinSubtitle}>Choose a new 6-digit PIN</AppText>
                <TextInput
                  style={s.passwordInput}
                  value={newPin}
                  onChangeText={v => { setNewPin(v.replace(/[^0-9]/g, '').slice(0, 6)); setPinError(''); }}
                  keyboardType="number-pad" maxLength={6} secureTextEntry
                  placeholder="New PIN" placeholderTextColor={NICO.textMuted} autoFocus
                />
                <TextInput
                  style={s.passwordInput}
                  value={confirmPin}
                  onChangeText={v => { setConfirmPin(v.replace(/[^0-9]/g, '').slice(0, 6)); setPinError(''); }}
                  keyboardType="number-pad" maxLength={6} secureTextEntry
                  placeholder="Confirm PIN" placeholderTextColor={NICO.textMuted}
                />
                {pinError ? <AppText style={s.pinError}>{pinError}</AppText> : null}
                <TouchableOpacity
                  style={[s.pinSubmitBtn, (newPin.length !== 6 || confirmPin.length !== 6) && s.pinSubmitDisabled]}
                  onPress={handleSetNewPin}
                  disabled={pinLoading || newPin.length !== 6 || confirmPin.length !== 6}
                  activeOpacity={0.85}
                >
                  {pinLoading ? <ActivityIndicator color={NICO.textOnAccent} /> : <AppText style={s.pinSubmitText}>Save New PIN</AppText>}
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
  root:      { flex: 1, backgroundColor: NICO.surface },
  center:    { flex: 1, justifyContent: 'center', alignItems: 'center' },
  container: { flexGrow: 1, paddingBottom: SPACING['4xl'] ?? 80 },

  // Header
  headerBorder: {
    paddingBottom:           BUTTERFLY_BORDER.width,
    borderBottomLeftRadius:  RADIUS['2xl'] + BUTTERFLY_BORDER.width,
    borderBottomRightRadius: RADIUS['2xl'] + BUTTERFLY_BORDER.width,
  },
  header: {
    backgroundColor:         NICO.background,
    paddingTop:              SPACING['3xl'] + SPACING.base,
    paddingBottom:           SPACING['2xl'],
    alignItems:              'center',
    borderBottomLeftRadius:  RADIUS['2xl'],
    borderBottomRightRadius: RADIUS['2xl'],
  },

  body: { paddingHorizontal: SPACING.base, paddingTop: SPACING.xl, alignItems: 'center', gap: SPACING.md },

  // Tiles
  tileBorder: {
    width:        '50%',
    borderRadius: RADIUS.xl + BUTTERFLY_BORDER.width,
    padding:      BUTTERFLY_BORDER.width,
    shadowColor:  '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation:    5,
  },
  tile: {
    borderRadius: RADIUS.xl,
    overflow:     'hidden',
  },
  tileBar:  { height: 7 },
  tileBody: { padding: SPACING.base, alignItems: 'center', gap: SPACING.sm },

  avatarWrap:     { position: 'relative', marginBottom: SPACING.xs },
  avatar:         { width: 80, height: 80, borderRadius: 40 },
  avatarFallback: { justifyContent: 'center', alignItems: 'center' },
  avatarInitial:  { fontSize: FONT_SIZE['2xl'], fontWeight: FONT_WEIGHT.black },

  userName: { ...TEXT_STYLE.bodyMedium, textAlign: 'center' },

  signOutBtn: {
    marginTop:         SPACING.lg,
    paddingVertical:   SPACING.sm,
    paddingHorizontal: SPACING.xl,
    borderRadius:      RADIUS.xl,
    borderWidth:       1.5,
    borderColor:       NICO.border,
  },
  signOutText: { ...TEXT_STYLE.labelSmall },

  // PIN Modal
  pinOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  pinCard: {
    backgroundColor:  NICO.surface,
    borderRadius:     RADIUS['2xl'],
    paddingHorizontal: SPACING.xl,
    paddingTop:       SPACING['3xl'],
    paddingBottom:    SPACING.xl,
    width:            '85%',
    maxWidth:         420,
    alignItems:       'center',
    ...SHADOW.btnPrimary,
  },
  pinClose:     { position: 'absolute', top: SPACING.md, right: SPACING.base, padding: SPACING.xs },
  pinCloseText: { ...TEXT_STYLE.bodyLarge, color: NICO.textMuted },
  pinTitle:     { ...TEXT_STYLE.modalTitle, marginBottom: SPACING.xs },
  pinSubtitle:  { ...TEXT_STYLE.hint, textAlign: 'center', marginBottom: SPACING.xl },

  pinDotsRow:   { flexDirection: 'row', gap: SPACING.md, marginBottom: SPACING.sm },
  pinDot: {
    width: 18, height: 18, borderRadius: 9,
    borderWidth: 2, borderColor: NICO.border,
    backgroundColor: 'transparent',
  },
  pinDotFilled:  { backgroundColor: NICO.primary, borderColor: NICO.primary },
  hiddenInput:   { position: 'absolute', opacity: 0, width: 1, height: 1 },

  pinError: { ...TEXT_STYLE.errorMessage, marginTop: SPACING.xs, marginBottom: SPACING.sm },

  forgotBtn:     { paddingVertical: SPACING.sm },
  forgotBtnText: { ...TEXT_STYLE.link },

  passwordInput: { ...INPUT.base, alignSelf: 'stretch', marginBottom: SPACING.sm },

  pinSubmitBtn:      { ...BTN_SIZE.lg, ...BTN_VARIANT.primary, alignSelf: 'stretch', marginTop: SPACING.lg, marginBottom: SPACING.sm },
  pinSubmitDisabled: { opacity: 0.4 },
  pinSubmitText:     { ...TEXT_STYLE.buttonPrimary },
});
