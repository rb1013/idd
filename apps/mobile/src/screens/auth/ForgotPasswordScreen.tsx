import React, { useState } from 'react';
import {
  View, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import AppText from '../../components/AppText';
import { supabase } from '../../lib/supabase';
import { COLORS } from '../../constants';

export default function ForgotPasswordScreen() {
  const navigation = useNavigation<any>();
  const [email, setEmail]     = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSend() {
    const normalised = email.trim().toLowerCase();
    if (!normalised) { Alert.alert('Please enter your email address'); return; }
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(normalised, {
      redirectTo: 'nicoidd://auth/callback',
    });
    setLoading(false);
    if (error) {
      Alert.alert('Error', error.message);
    } else {
      navigation.navigate('ResetOTP', { email: normalised });
    }
  }

  return (
    <KeyboardAvoidingView style={s.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <AppText style={s.emoji}>🔑</AppText>
      <AppText style={s.title}>Forgot password?</AppText>
      <AppText style={s.body}>Enter your email and we'll send you a reset link.</AppText>

      <TextInput
        style={s.input}
        value={email}
        onChangeText={setEmail}
        placeholder="Email address"
        placeholderTextColor={COLORS.bloomMuted}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        autoFocus
        editable={!loading}
      />

      <TouchableOpacity
        style={[s.sendBtn, (!email.trim() || loading) && s.sendBtnDisabled]}
        onPress={handleSend}
        disabled={!email.trim() || loading}
        activeOpacity={0.8}
      >
        {loading
          ? <ActivityIndicator color={COLORS.bloomOnAccent} />
          : <AppText style={s.sendBtnText}>Send reset link</AppText>
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
  emoji:  { fontSize: 56, marginBottom: 4 },
  title:  { fontSize: 26, fontWeight: '900', color: COLORS.bloomText, textAlign: 'center' },
  body:   { fontSize: 16, color: COLORS.bloomMuted, textAlign: 'center', lineHeight: 24 },
  email:  { fontWeight: '700', color: COLORS.bloomText },
  hint:   { fontSize: 14, color: COLORS.bloomMuted, textAlign: 'center', lineHeight: 22 },

  input: {
    width: '100%', borderWidth: 1.5, borderColor: COLORS.bloomBorder,
    borderRadius: 12, padding: 14, fontSize: 16,
    color: COLORS.bloomText, backgroundColor: COLORS.surface,
  },

  sendBtn: {
    width: '100%', backgroundColor: COLORS.bloomAccent,
    borderRadius: 12, paddingVertical: 15, alignItems: 'center',
  },
  sendBtnDisabled: { opacity: 0.4 },
  sendBtnText: { color: COLORS.bloomOnAccent, fontWeight: '700', fontSize: 16 },

  backBtn: { marginTop: 4 },
  backBtnText: { fontSize: 14, color: COLORS.bloomMuted, fontWeight: '600' },
});
