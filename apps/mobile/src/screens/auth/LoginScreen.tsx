import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, Alert, ActivityIndicator, ScrollView,
} from 'react-native';
import AppText from '../../components/AppText';
import AppLogo from '../../components/AppLogo';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { supabase } from '../../lib/supabase';
import { saveGuardianCredentials } from '../../lib/biometricStore';
import { COLORS } from '../../constants';
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
        {/* Branded header */}
        <View style={s.header}>
          <AppLogo />
        </View>

        {/* Form */}
        <View style={s.form}>
          <Text style={s.title}>Welcome back</Text>
          <Text style={s.subtitle}>Sign in to your NICO account</Text>

          <TextInput
            style={s.input}
            placeholder="Email address"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            placeholderTextColor={COLORS.bloomMuted}
          />
          <TextInput
            style={s.input}
            placeholder="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            placeholderTextColor={COLORS.bloomMuted}
          />

          <TouchableOpacity
            style={[s.btn, loading && { opacity: 0.7 }]}
            onPress={handleLogin}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading
              ? <ActivityIndicator color={COLORS.bloomOnAccent} />
              : <Text style={s.btnText}>Sign In</Text>
            }
          </TouchableOpacity>

          <TouchableOpacity onPress={() => navigation.navigate('ForgotPassword')} activeOpacity={0.7} style={s.forgotBtn}>
            <Text style={s.forgotText}>Forgot password?</Text>
          </TouchableOpacity>

          <View style={s.dividerRow}>
            <View style={s.dividerLine} />
            <Text style={s.dividerText}>NEW TO NICO?</Text>
            <View style={s.dividerLine} />
          </View>

          <TouchableOpacity
            style={s.registerBox}
            onPress={() => navigation.navigate('GuardianRegister')}
            activeOpacity={0.85}
          >
            <Text style={s.registerHint}>Create your free account to get started</Text>
            <Text style={s.registerBtn}>Create Account →</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  root:      { flex: 1, backgroundColor: COLORS.bloomBody },
  container: { flexGrow: 1 },

  header: {
    backgroundColor: COLORS.bloomAccent,
    paddingTop: 54, paddingBottom: 30,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 260,
    borderBottomLeftRadius: 36, borderBottomRightRadius: 36,
  },

  form:     { padding: 24, paddingTop: 32 },
  title:    { fontSize: 22, fontWeight: '900', color: COLORS.bloomText, marginBottom: 4 },
  subtitle: { fontSize: 13, color: COLORS.bloomMuted, marginBottom: 28 },

  input: {
    backgroundColor: COLORS.bloomCard, borderWidth: 1.5, borderColor: COLORS.bloomBorder,
    borderRadius: 14, paddingHorizontal: 16, paddingVertical: 15,
    fontSize: 15, color: COLORS.bloomText, marginBottom: 12,
  },

  btn: {
    backgroundColor: COLORS.bloomAccent, borderRadius: 14,
    paddingVertical: 16, alignItems: 'center', marginTop: 4,
    alignSelf: 'center', width: '70%',
  },
  btnText: { color: COLORS.bloomOnAccent, fontSize: 16, fontWeight: '800' },

  forgotBtn:  { alignSelf: 'center', marginTop: 12, marginBottom: 20 },
  forgotText: { fontSize: 14, color: COLORS.bloomText, fontWeight: '700', textDecorationLine: 'underline' },
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20 },
  dividerLine:{ flex: 1, height: 1, backgroundColor: COLORS.bloomBorder },
  dividerText:{ fontSize: 11, fontWeight: '700', color: COLORS.bloomMuted, letterSpacing: 0.5 },

  registerBox: {
    backgroundColor: COLORS.bloomActiveBg, borderWidth: 1.5, borderColor: COLORS.bloomSageMid,
    borderRadius: 16, padding: 18, alignItems: 'center', gap: 10,
  },
  registerHint: { fontSize: 13, color: COLORS.bloomMuted, textAlign: 'center' },
  registerBtn:  { fontSize: 14, fontWeight: '900', color: COLORS.bloomActiveText },
});
