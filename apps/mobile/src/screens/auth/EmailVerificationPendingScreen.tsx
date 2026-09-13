import React, { useState } from 'react';
import {
  View, TouchableOpacity, StyleSheet, ActivityIndicator, Alert,
} from 'react-native';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import AppText from '../../components/AppText';
import { supabase } from '../../lib/supabase';
import { COLORS } from '../../constants';

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
            ? <ActivityIndicator color={COLORS.bloomOnAccent} />
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
    flex: 1, backgroundColor: COLORS.bloomBody,
    alignItems: 'center', justifyContent: 'center',
    padding: 32, gap: 16,
  },
  emoji:  { fontSize: 64, marginBottom: 8 },
  title:  { fontSize: 26, fontWeight: '900', color: COLORS.bloomText, textAlign: 'center' },
  body:   { fontSize: 16, color: COLORS.bloomMuted, textAlign: 'center', lineHeight: 24 },
  email:  { fontWeight: '700', color: COLORS.bloomText },
  hint:   { fontSize: 14, color: COLORS.bloomMuted, textAlign: 'center', lineHeight: 22, marginTop: 4 },

  resendBtn: {
    marginTop: 8, backgroundColor: COLORS.bloomAccent,
    borderRadius: 12, paddingVertical: 14, paddingHorizontal: 28,
  },
  resendBtnText: { color: COLORS.bloomOnAccent, fontWeight: '700', fontSize: 15 },

  resentBadge: {
    marginTop: 8, backgroundColor: COLORS.bloomActiveBg,
    borderRadius: 12, paddingVertical: 12, paddingHorizontal: 24,
    borderWidth: 1.5, borderColor: COLORS.bloomSageMid,
  },
  resentText: { color: COLORS.bloomActiveText, fontWeight: '700', fontSize: 15 },

  backBtn: { marginTop: 8 },
  backBtnText: { fontSize: 14, color: COLORS.bloomMuted, fontWeight: '600' },
});
