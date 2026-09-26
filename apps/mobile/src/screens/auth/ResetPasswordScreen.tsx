import React, { useState } from 'react';
import {
  View, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import AppText from '../../components/AppText';
import { supabase } from '../../lib/supabase';
import ContentContainer from '../../components/ContentContainer';
import {
  NICO, TEXT_STYLE, SPACING, RADIUS, INPUT, BTN_SIZE, BTN_VARIANT, BUTTERFLY_BORDER,
} from '../../constants/theme';

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
    <KeyboardAvoidingView style={s.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={s.container}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <ContentContainer>
        <View style={s.content}>
          <AppText style={s.emoji}>🔐</AppText>
          <AppText style={s.title}>Set new password</AppText>
          <AppText style={s.subtitle}>Choose a strong password for your NICO account.</AppText>

          <LinearGradient
            colors={[...BUTTERFLY_BORDER.colors]}
            start={BUTTERFLY_BORDER.start}
            end={BUTTERFLY_BORDER.end}
            style={s.inputBorder}
          >
            <TextInput
              style={s.input}
              value={password}
              onChangeText={setPassword}
              placeholder="New password"
              placeholderTextColor={NICO.textMuted}
              secureTextEntry
              autoFocus
              editable={!loading}
            />
          </LinearGradient>

          <LinearGradient
            colors={[...BUTTERFLY_BORDER.colors]}
            start={BUTTERFLY_BORDER.start}
            end={BUTTERFLY_BORDER.end}
            style={s.inputBorder}
          >
            <TextInput
              style={s.input}
              value={confirm}
              onChangeText={setConfirm}
              placeholder="Confirm new password"
              placeholderTextColor={NICO.textMuted}
              secureTextEntry
              editable={!loading}
            />
          </LinearGradient>

          <TouchableOpacity
            style={[s.btn, (!password || !confirm || loading) && s.btnDisabled]}
            onPress={handleReset}
            disabled={!password || !confirm || loading}
            activeOpacity={0.85}
          >
            {loading
              ? <ActivityIndicator color={NICO.textOnAccent} />
              : <AppText style={s.btnText}>Update password</AppText>
            }
          </TouchableOpacity>
        </View>
        </ContentContainer>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  root:      { flex: 1, backgroundColor: NICO.screenBg },
  container: { flexGrow: 1, justifyContent: 'center', paddingBottom: '30%' },

  content: {
    paddingHorizontal: SPACING.base,
    paddingVertical:   SPACING['3xl'],
    alignItems:        'center',
    gap:               SPACING.md,
  },

  emoji:    { fontSize: 56, marginBottom: SPACING.xs },
  title:    { ...TEXT_STYLE.screenTitle, textAlign: 'center', marginBottom: SPACING.xs },
  subtitle: { ...TEXT_STYLE.hint, textAlign: 'center', marginBottom: SPACING.md },

  inputBorder: {
    borderRadius: RADIUS.md + BUTTERFLY_BORDER.width,
    padding:      BUTTERFLY_BORDER.width,
    alignSelf:    'stretch',
    marginBottom: SPACING.sm,
  },
  input: {
    ...INPUT.base,
    borderWidth: 0,
  },

  btn:         { ...BTN_SIZE.lg, ...BTN_VARIANT.primary },
  btnDisabled: { opacity: 0.4 },
  btnText:     { ...TEXT_STYLE.buttonPrimary },
});
