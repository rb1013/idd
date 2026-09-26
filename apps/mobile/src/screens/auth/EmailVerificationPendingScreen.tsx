import React, { useState } from 'react';
import {
  View, TouchableOpacity, StyleSheet, ActivityIndicator, Alert,
} from 'react-native';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import AppText from '../../components/AppText';
import { supabase } from '../../lib/supabase';
import {
  NICO, TEXT_STYLE, SPACING, RADIUS, SHADOW, FONT_SIZE, FONT_WEIGHT,
  BTN_SIZE, BTN_VARIANT, scale,
} from '../../constants/theme';

type RouteParams = { email: string };

export default function EmailVerificationPendingScreen() {
  const route = useRoute<RouteProp<{ params: RouteParams }, 'params'>>();
  const navigation = useNavigation<any>();
  const { email } = route.params;
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);

  async function resend() {
    setResending(true);
    const { error } = await supabase.auth.resend({ type: 'signup', email });
    setResending(false);
    if (error) {
      Alert.alert('Could not resend', error.message);
    } else {
      setResent(true);
    }
  }

  return (
    <View style={s.container}>
      <AppText style={s.emoji}>📬</AppText>
      <AppText style={s.title}>Check your inbox</AppText>
      <AppText style={s.body}>
        We sent a verification link to{'\n'}
        <AppText style={s.email}>{email}</AppText>
      </AppText>
      <AppText style={s.hint}>
        Tap the link in the email to activate your account. Once confirmed, open the app and sign in.
      </AppText>

      {resent ? (
        <View style={s.resentBadge}>
          <AppText style={s.resentText}>✓ Email resent</AppText>
        </View>
      ) : (
        <TouchableOpacity style={s.resendBtn} onPress={resend} disabled={resending} activeOpacity={0.75}>
          {resending
            ? <ActivityIndicator color={NICO.textOnAccent} />
            : <AppText style={s.resendBtnText}>Resend verification email</AppText>
          }
        </TouchableOpacity>
      )}

      <TouchableOpacity onPress={() => navigation.navigate('Login')} style={s.backBtn} activeOpacity={0.7}>
        <AppText style={s.backBtnText}>← Back to sign in</AppText>
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1, backgroundColor: NICO.screenBg,
    alignItems: 'center', justifyContent: 'center',
    padding: SPACING.xl, gap: SPACING.base,
  },
  emoji:  { fontSize: scale(64), marginBottom: SPACING.sm },
  title:  { ...TEXT_STYLE.screenTitle, textAlign: 'center' },
  body:   { ...TEXT_STYLE.body, color: NICO.textMuted, textAlign: 'center', lineHeight: 24 },
  email:  { fontWeight: FONT_WEIGHT.bold, color: NICO.text },
  hint:   { ...TEXT_STYLE.hint, textAlign: 'center', lineHeight: 22, marginTop: 4 },

  resendBtn: { ...BTN_SIZE.lg, ...BTN_VARIANT.primary, marginTop: SPACING.sm },
  resendBtnText: { ...TEXT_STYLE.buttonPrimary },

  resentBadge: {
    marginTop: SPACING.sm, backgroundColor: NICO.successLight,
    borderRadius: RADIUS.md, paddingVertical: SPACING.md, paddingHorizontal: SPACING.xl,
    borderWidth: 1.5, borderColor: NICO.success,
  },
  resentText: { color: NICO.success, fontWeight: FONT_WEIGHT.bold, fontSize: FONT_SIZE.lg },

  backBtn: { marginTop: SPACING.sm },
  backBtnText: { ...TEXT_STYLE.hint, fontWeight: FONT_WEIGHT.semiBold },
});
