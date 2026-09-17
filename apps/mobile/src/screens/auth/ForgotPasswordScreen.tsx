import React, { useState } from 'react';
import {
  View, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import AppText from '../../components/AppText';
import { supabase } from '../../lib/supabase';
import {
  NICO, TEXT_STYLE, SPACING, RADIUS, INPUT, BTN_SIZE, BTN_VARIANT, BUTTERFLY_BORDER,
} from '../../constants/theme';

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
    <KeyboardAvoidingView style={s.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={s.container}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={s.content}>
          <AppText style={s.title}>Forgot Password?</AppText>
          <AppText style={s.subtitle}>
            Enter your email and we'll send you a reset link.
          </AppText>

          <LinearGradient
            colors={[...BUTTERFLY_BORDER.colors]}
            start={BUTTERFLY_BORDER.start}
            end={BUTTERFLY_BORDER.end}
            style={s.inputBorder}
          >
            <TextInput
              style={s.input}
              value={email}
              onChangeText={setEmail}
              placeholder="Email address"
              placeholderTextColor={NICO.textMuted}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoFocus
              editable={!loading}
            />
          </LinearGradient>

          <TouchableOpacity
            style={[s.btn, (!email.trim() || loading) && s.btnDisabled]}
            onPress={handleSend}
            disabled={!email.trim() || loading}
            activeOpacity={0.85}
          >
            {loading
              ? <ActivityIndicator color={NICO.textOnAccent} />
              : <AppText style={s.btnText}>Send Reset Link</AppText>
            }
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => navigation.navigate('Login')}
            style={s.backBtn}
            activeOpacity={0.7}
          >
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

  backBtn:     { marginTop: SPACING.sm },
  backBtnText: { ...TEXT_STYLE.link },
});
