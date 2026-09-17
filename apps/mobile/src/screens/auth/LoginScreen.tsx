import React, { useState } from 'react';
import {
  View, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, Alert, ActivityIndicator, ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import AppText from '../../components/AppText';
import AppLogo from '../../components/AppLogo';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { supabase } from '../../lib/supabase';
import { saveGuardianCredentials } from '../../lib/biometricStore';
import {
  NICO, TEXT_STYLE, SPACING, RADIUS, INPUT, BTN_SIZE, BTN_VARIANT, BUTTERFLY_BORDER,
} from '../../constants/theme';
import { RootStackParamList } from '../../navigation';

type Props = { navigation: NativeStackNavigationProp<RootStackParamList, 'Login'> };

export default function LoginScreen({ navigation }: Props) {
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading]   = useState(false);

  async function handleLogin() {
    if (!email || !password) { Alert.alert('Please fill in all fields'); return; }
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) { Alert.alert('Login failed', error.message); return; }
    await saveGuardianCredentials({ email, password });
  }

  return (
    <KeyboardAvoidingView style={s.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={s.container}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Logo + tagline with butterfly gradient border */}
        <LinearGradient
          colors={[...BUTTERFLY_BORDER.colors]}
          start={BUTTERFLY_BORDER.start}
          end={BUTTERFLY_BORDER.end}
          style={s.logoBorder}
        >
          <View style={s.logoSection}>
            <AppLogo />
          </View>
        </LinearGradient>

        {/* Form */}
        <View style={s.form}>
          <AppText style={s.title}>Welcome</AppText>
          <AppText style={s.subtitle}>Sign in to your NICO account</AppText>

          <LinearGradient
            colors={[...BUTTERFLY_BORDER.colors]}
            start={BUTTERFLY_BORDER.start}
            end={BUTTERFLY_BORDER.end}
            style={s.emailBorder}
          >
            <TextInput
              style={s.emailInput}
              placeholder="Email address"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              placeholderTextColor={NICO.textMuted}
            />
          </LinearGradient>
          <LinearGradient
            colors={[...BUTTERFLY_BORDER.colors]}
            start={BUTTERFLY_BORDER.start}
            end={BUTTERFLY_BORDER.end}
            style={s.emailBorder}
          >
            <TextInput
              style={s.emailInput}
              placeholder="Password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              placeholderTextColor={NICO.textMuted}
            />
          </LinearGradient>

          <TouchableOpacity
            style={[s.btn, loading && s.btnLoading]}
            onPress={handleLogin}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading
              ? <ActivityIndicator color={NICO.textOnAccent} />
              : <AppText style={s.btnText}>Sign In</AppText>
            }
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => navigation.navigate('ForgotPassword')}
            activeOpacity={0.7}
            style={s.forgotBtn}
          >
            <AppText style={s.forgotText}>Forgot Password?</AppText>
          </TouchableOpacity>

          <View style={s.dividerRow}>
            <View style={s.dividerLine} />
            <AppText style={s.dividerText}>NEW TO NICO?</AppText>
            <View style={s.dividerLine} />
          </View>

          <TouchableOpacity
            style={s.registerBox}
            onPress={() => navigation.navigate('GuardianRegister')}
            activeOpacity={0.85}
          >
            <AppText style={s.registerHint}>Create your account to get started</AppText>
            <AppText style={s.registerLink}>Create Account</AppText>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  root:      { flex: 1, backgroundColor: NICO.surface },
  container: { flexGrow: 1 },

  logoBorder: {
    paddingBottom:           BUTTERFLY_BORDER.width,
    paddingHorizontal:       BUTTERFLY_BORDER.width,
    borderBottomLeftRadius:  RADIUS['2xl'] + BUTTERFLY_BORDER.width,
    borderBottomRightRadius: RADIUS['2xl'] + BUTTERFLY_BORDER.width,
  },
  logoSection: {
    alignItems:              'center',
    paddingTop:              SPACING['3xl'] + SPACING.base,
    paddingBottom:           SPACING['3xl'],
    backgroundColor:         NICO.background,
    borderBottomLeftRadius:  RADIUS['2xl'],
    borderBottomRightRadius: RADIUS['2xl'],
  },

  form: {
    paddingHorizontal: SPACING.base,
    paddingTop:        SPACING['2xl'],
    paddingBottom:     SPACING['2xl'],
  },

  title:    { ...TEXT_STYLE.screenTitle, marginBottom: SPACING.xs, textAlign: 'center' },
  subtitle: { ...TEXT_STYLE.hint, marginBottom: SPACING.xl, textAlign: 'center' },

  input:      { ...INPUT.base, marginBottom: SPACING.md },

  emailBorder: {
    borderRadius:      RADIUS.md + BUTTERFLY_BORDER.width,
    padding:           BUTTERFLY_BORDER.width,
    marginBottom:      SPACING.md,
  },
  emailInput: {
    ...INPUT.base,
    borderWidth: 0,
  },

  btn:        { ...BTN_SIZE.lg, ...BTN_VARIANT.primary, marginTop: SPACING.xs },
  btnLoading: { opacity: 0.7 },
  btnText:    { ...TEXT_STYLE.buttonPrimary },

  forgotBtn:  { alignSelf: 'center', marginTop: SPACING.md, marginBottom: SPACING.lg },
  forgotText: { ...TEXT_STYLE.link },

  dividerRow:  { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, marginBottom: SPACING.lg },
  dividerLine: { flex: 1, height: 1, backgroundColor: NICO.border },
  dividerText: { ...TEXT_STYLE.caption },

  registerBox: {
    backgroundColor: NICO.background,
    borderWidth:     1,
    borderColor:     NICO.border,
    borderRadius:    RADIUS.xl,
    padding:         SPACING.base,
    alignItems:      'center',
    gap:             SPACING.sm,
  },
  registerHint: { ...TEXT_STYLE.hint, textAlign: 'center' },
  registerLink: { ...TEXT_STYLE.link },
});
