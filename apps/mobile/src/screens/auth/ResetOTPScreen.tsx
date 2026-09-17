import React, { useRef, useState } from 'react';
import {
  View, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import AppText from '../../components/AppText';
import { supabase } from '../../lib/supabase';
import {
  NICO, TEXT_STYLE, SPACING, RADIUS, BTN_SIZE, BTN_VARIANT, FONT_SIZE, FONT_WEIGHT,
} from '../../constants/theme';

type RouteParams = { email: string };

export default function ResetOTPScreen() {
  const route      = useRoute<RouteProp<{ params: RouteParams }, 'params'>>();
  const navigation = useNavigation<any>();
  const { email }  = route.params;

  const [digits, setDigits]       = useState(['', '', '', '', '', '']);
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const [resent, setResent]       = useState(false);

  const inputs = useRef<(TextInput | null)[]>([]);

  function handleChange(text: string, index: number) {
    const digit = text.replace(/[^0-9]/g, '').slice(-1);
    const next  = [...digits];
    next[index] = digit;
    setDigits(next);
    if (digit && index < 5) inputs.current[index + 1]?.focus();
    if (next.every(d => d !== '')) verify(next.join(''));
  }

  function handleKeyPress(key: string, index: number) {
    if (key === 'Backspace' && !digits[index] && index > 0) {
      inputs.current[index - 1]?.focus();
    }
  }

  async function verify(code: string) {
    setVerifying(true);
    const { error } = await supabase.auth.verifyOtp({
      email,
      token: code,
      type: 'recovery',
    });
    setVerifying(false);
    if (error) {
      Alert.alert('Invalid code', 'The code is incorrect or has expired. Please try again.');
      setDigits(['', '', '', '', '', '']);
      inputs.current[0]?.focus();
    }
    // On success, AuthContext fires PASSWORD_RECOVERY → pendingPasswordReset = true
    // Navigation automatically shows ResetPasswordScreen
  }

  async function resend() {
    setResending(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: 'nicoidd://auth/callback',
    });
    setResending(false);
    if (error) {
      Alert.alert('Could not resend', error.message);
    } else {
      setResent(true);
      setDigits(['', '', '', '', '', '']);
      inputs.current[0]?.focus();
      setTimeout(() => setResent(false), 4000);
    }
  }

  const code = digits.join('');

  return (
    <KeyboardAvoidingView style={s.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={s.container}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={s.content}>
          <AppText style={s.title}>Enter Reset Code</AppText>
          <AppText style={s.body}>
            We sent a 6-digit code to{'\n'}
            <AppText style={s.emailHighlight}>{email}</AppText>
          </AppText>
          <AppText style={s.hint}>Open the email on any device and type the code here</AppText>

          <View style={s.boxRow}>
            {digits.map((d, i) => (
              <TextInput
                key={i}
                ref={el => { inputs.current[i] = el; }}
                style={[s.box, d ? s.boxFilled : null]}
                value={d}
                onChangeText={text => handleChange(text, i)}
                onKeyPress={({ nativeEvent }) => handleKeyPress(nativeEvent.key, i)}
                keyboardType="number-pad"
                maxLength={1}
                selectTextOnFocus
                autoFocus={i === 0}
                editable={!verifying}
              />
            ))}
          </View>

          {verifying && (
            <View style={s.verifyingRow}>
              <ActivityIndicator color={NICO.primary} />
              <AppText style={s.verifyingText}>Verifying…</AppText>
            </View>
          )}

          {resent && (
            <View style={s.resentBadge}>
              <AppText style={s.resentText}>✓ New code sent</AppText>
            </View>
          )}

          {!verifying && (
            <TouchableOpacity
              style={[s.btn, code.length < 6 && s.btnDisabled]}
              onPress={() => verify(code)}
              disabled={code.length < 6}
              activeOpacity={0.85}
            >
              <AppText style={s.btnText}>Verify</AppText>
            </TouchableOpacity>
          )}

          <TouchableOpacity onPress={resend} disabled={resending} activeOpacity={0.7} style={s.resendBtn}>
            {resending
              ? <ActivityIndicator color={NICO.primary} />
              : <AppText style={s.resendText}>Didn't get it? Resend code</AppText>
            }
          </TouchableOpacity>

          <TouchableOpacity onPress={() => navigation.navigate('Login')} style={s.backBtn} activeOpacity={0.7}>
            <AppText style={s.backBtnText}>← Back to Sign In</AppText>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  root:      { flex: 1, backgroundColor: NICO.surface },
  container: { flexGrow: 1, justifyContent: 'center', paddingBottom: '30%' },

  content: {
    paddingHorizontal: SPACING.base,
    paddingVertical:   SPACING['3xl'],
    alignItems:        'center',
    gap:               SPACING.md,
  },

  title:          { ...TEXT_STYLE.screenTitle, textAlign: 'center', marginBottom: SPACING.xs },
  body:           { ...TEXT_STYLE.hint, textAlign: 'center' },
  emailHighlight: { ...TEXT_STYLE.hint, fontWeight: FONT_WEIGHT.bold, color: NICO.text },
  hint:           { ...TEXT_STYLE.hint, textAlign: 'center' },

  boxRow: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.sm },
  box: {
    width:           46,
    height:          56,
    borderRadius:    RADIUS.md,
    borderWidth:     1.5,
    borderColor:     NICO.border,
    backgroundColor: NICO.surface,
    fontSize:        FONT_SIZE['2xl'],
    fontWeight:      FONT_WEIGHT.bold,
    color:           NICO.text,
    textAlign:       'center',
  },
  boxFilled: {
    borderColor:     NICO.primary,
    backgroundColor: NICO.primaryLight,
  },

  verifyingRow:  { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  verifyingText: { ...TEXT_STYLE.hint },

  btn:         { ...BTN_SIZE.lg, ...BTN_VARIANT.primary },
  btnDisabled: { opacity: 0.4 },
  btnText:     { ...TEXT_STYLE.buttonPrimary },

  resentBadge: {
    backgroundColor: NICO.primaryLight,
    borderRadius:    RADIUS.md,
    paddingVertical:   SPACING.sm,
    paddingHorizontal: SPACING.base,
    borderWidth:     1.5,
    borderColor:     NICO.primary,
  },
  resentText: { color: NICO.primary, fontWeight: FONT_WEIGHT.bold, fontSize: FONT_SIZE.sm },

  resendBtn:  { marginTop: SPACING.xs },
  resendText: { ...TEXT_STYLE.link },

  backBtn:     { marginTop: SPACING.xs },
  backBtnText: { ...TEXT_STYLE.link },
});
