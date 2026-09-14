import React, { useState } from 'react';
import {
  View, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import AppText from '../../components/AppText';
import { supabase } from '../../lib/supabase';
import { COLORS } from '../../constants';

export default function ResetPasswordScreen() {
  const [password, setPassword]   = useState('');
  const [confirm, setConfirm]     = useState('');
  const [loading, setLoading]     = useState(false);

  async function handleReset() {
    if (password.length < 6) { Alert.alert('Password must be at least 6 characters'); return; }
    if (password !== confirm)  { Alert.alert('Passwords do not match'); return; }

    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setLoading(false);
      Alert.alert('Error', error.message);
      return;
    }
    // Sign out so the user logs in fresh with the new password
    await supabase.auth.signOut();
    // Navigation will automatically return to Login screen via AuthContext
    Alert.alert('Password updated', 'You can now sign in with your new password.');
  }

  return (
    <KeyboardAvoidingView style={s.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <AppText style={s.emoji}>🔐</AppText>
      <AppText style={s.title}>Set new password</AppText>
      <AppText style={s.body}>Choose a strong password for your NICO account.</AppText>

      <TextInput
        style={s.input}
        value={password}
        onChangeText={setPassword}
        placeholder="New password"
        placeholderTextColor={COLORS.bloomMuted}
        secureTextEntry
        autoFocus
        editable={!loading}
      />
      <TextInput
        style={s.input}
        value={confirm}
        onChangeText={setConfirm}
        placeholder="Confirm new password"
        placeholderTextColor={COLORS.bloomMuted}
        secureTextEntry
        editable={!loading}
      />

      <TouchableOpacity
        style={[s.btn, (!password || !confirm || loading) && s.btnDisabled]}
        onPress={handleReset}
        disabled={!password || !confirm || loading}
        activeOpacity={0.8}
      >
        {loading
          ? <ActivityIndicator color={COLORS.bloomOnAccent} />
          : <AppText style={s.btnText}>Update password</AppText>
        }
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

  input: {
    width: '100%', borderWidth: 1.5, borderColor: COLORS.bloomBorder,
    borderRadius: 12, padding: 14, fontSize: 16,
    color: COLORS.bloomText, backgroundColor: COLORS.surface,
  },

  btn: {
    width: '100%', backgroundColor: COLORS.bloomAccent,
    borderRadius: 12, paddingVertical: 15, alignItems: 'center',
  },
  btnDisabled: { opacity: 0.4 },
  btnText: { color: COLORS.bloomOnAccent, fontWeight: '700', fontSize: 16 },
});
