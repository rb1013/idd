import React, { useRef, useState } from 'react';
import {
  View, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import AppText from '../../components/AppText';
import { supabase } from '../../lib/supabase';
import { COLORS } from '../../constants';

type RouteParams = { email: string };

export default function OTPVerificationScreen() {
  const route     = useRoute<RouteProp<{ params: RouteParams }, 'params'>>();
  const navigation = useNavigation<any>();
  const { email } = route.params;

  const [digits, setDigits]     = useState(['', '', '', '', '', '']);
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const [resent, setResent]       = useState(false);

  const inputs = useRef<(TextInput | null)[]>([]);

  function handleChange(text: string, index: number) {
    const digit = text.replace(/[^0-9]/g, '').slice(-1);
    const next  = [...digits];
    next[index] = digit;
    setDigits(next);

    if (digit && index < 5) {
      inputs.current[index + 1]?.focus();
    }
    if (next.every(d => d !== '')) {
      verify(next.join(''));
    }
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
      type: 'signup',
    });
    setVerifying(false);
    if (error) {
      Alert.alert('Invalid code', 'The code is incorrect or has expired. Please try again.');
      setDigits(['', '', '', '', '', '']);
      inputs.current[0]?.focus();
    }
    // On success, AuthContext onAuthStateChange fires and handles navigation + guardian profile creation
  }

  async function resend() {
    setResending(true);
    const { error } = await supabase.auth.resend({ type: 'signup', email });
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
    <KeyboardAvoidingView style={s.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <AppText style={s.emoji}>✉️</AppText>
      <AppText style={s.title}>Enter your code</AppText>
      <AppText style={s.body}>
        We sent a 6-digit code to{'\n'}
        <AppText style={s.email}>{email}</AppText>
      </AppText>

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
          <ActivityIndicator color={COLORS.bloomAccent} />
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
          style={[s.verifyBtn, code.length < 6 && s.verifyBtnDisabled]}
          onPress={() => verify(code)}
          disabled={code.length < 6}
          activeOpacity={0.8}
        >
          <AppText style={s.verifyBtnText}>Verify</AppText>
        </TouchableOpacity>
      )}

      <TouchableOpacity onPress={resend} disabled={resending} activeOpacity={0.7} style={s.resendBtn}>
        {resending
          ? <ActivityIndicator color={COLORS.bloomAccent} />
          : <AppText style={s.resendText}>Didn't get it? Resend code</AppText>
        }
      </TouchableOpacity>

      <TouchableOpacity onPress={() => navigation.navigate('Login')} style={s.backBtn} activeOpacity={0.7}>
        <AppText style={s.backBtnText}>← Back to sign in</AppText>
      </TouchableOpacity>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1, backgroundColor: COLORS.bloomBody,
    alignItems: 'center', justifyContent: 'center',
    padding: 32, gap: 16,
  },
  emoji: { fontSize: 56, marginBottom: 4 },
  title: { fontSize: 26, fontWeight: '900', color: COLORS.bloomText, textAlign: 'center' },
  body:  { fontSize: 16, color: COLORS.bloomMuted, textAlign: 'center', lineHeight: 24 },
  email: { fontWeight: '700', color: COLORS.bloomText },

  boxRow: { flexDirection: 'row', gap: 10, marginTop: 8 },
  box: {
    width: 46, height: 56, borderRadius: 10,
    borderWidth: 1.5, borderColor: COLORS.bloomBorder,
    backgroundColor: COLORS.surface,
    fontSize: 24, fontWeight: '700', color: COLORS.bloomText,
    textAlign: 'center',
  },
  boxFilled: { borderColor: COLORS.bloomAccent, backgroundColor: COLORS.bloomActiveBg },

  verifyingRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  verifyingText: { color: COLORS.bloomMuted, fontSize: 14 },

  verifyBtn: {
    marginTop: 4, backgroundColor: COLORS.bloomAccent,
    borderRadius: 12, paddingVertical: 14, paddingHorizontal: 40,
  },
  verifyBtnDisabled: { opacity: 0.4 },
  verifyBtnText: { color: COLORS.bloomOnAccent, fontWeight: '700', fontSize: 16 },

  resentBadge: {
    backgroundColor: COLORS.bloomActiveBg, borderRadius: 10,
    paddingVertical: 10, paddingHorizontal: 20,
    borderWidth: 1.5, borderColor: COLORS.bloomSageMid,
  },
  resentText: { color: COLORS.bloomActiveText, fontWeight: '700', fontSize: 14 },

  resendBtn: { marginTop: 4 },
  resendText: { fontSize: 14, color: COLORS.bloomAccent, fontWeight: '600' },

  backBtn: { marginTop: 4 },
  backBtnText: { fontSize: 14, color: COLORS.bloomMuted, fontWeight: '600' },
});
