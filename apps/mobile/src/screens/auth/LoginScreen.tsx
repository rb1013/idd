import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, Alert, ActivityIndicator,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { supabase } from '../../lib/supabase';
import { COLORS } from '../../constants';
import { RootStackParamList } from '../../navigation';

type Props = { navigation: NativeStackNavigationProp<RootStackParamList, 'Login'> };

type Mode = 'guardian' | 'user';

export default function LoginScreen({ navigation }: Props) {
  const [mode, setMode] = useState<Mode>('guardian');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    if (!email || !password) { Alert.alert('Please fill in all fields'); return; }
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) Alert.alert('Login failed', error.message);
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.inner}>
        <Text style={styles.title}>Welcome Back</Text>

        {/* Toggle */}
        <View style={styles.toggle}>
          <TouchableOpacity
            style={[styles.toggleBtn, mode === 'guardian' && styles.toggleBtnActive]}
            onPress={() => setMode('guardian')}
          >
            <Text style={[styles.toggleText, mode === 'guardian' && styles.toggleTextActive]}>Guardian</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleBtn, mode === 'user' && styles.toggleBtnActive]}
            onPress={() => setMode('user')}
          >
            <Text style={[styles.toggleText, mode === 'user' && styles.toggleTextActive]}>User</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.subtitle}>
          {mode === 'guardian' ? 'Sign in to manage profiles' : 'Sign in to connect with friends'}
        </Text>

        <TextInput
          style={styles.input}
          placeholder="Email"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          placeholderTextColor={COLORS.textLight}
        />
        <TextInput
          style={styles.input}
          placeholder="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          placeholderTextColor={COLORS.textLight}
        />

        <TouchableOpacity style={styles.button} onPress={handleLogin} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Sign In</Text>}
        </TouchableOpacity>

        {mode === 'guardian' ? (
          <TouchableOpacity onPress={() => navigation.navigate('GuardianRegister')}>
            <Text style={styles.link}>New guardian? <Text style={styles.linkBold}>Create account</Text></Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity onPress={() => navigation.navigate('UserRegister')}>
            <Text style={styles.link}>First time? <Text style={styles.linkBold}>Set up your account</Text></Text>
          </TouchableOpacity>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  inner: { flex: 1, justifyContent: 'center', padding: 24 },
  title: { fontSize: 32, fontWeight: '700', color: COLORS.text, marginBottom: 20, textAlign: 'center' },
  toggle: {
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 16,
    padding: 4,
  },
  toggleBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 10 },
  toggleBtnActive: { backgroundColor: COLORS.primary },
  toggleText: { fontSize: 15, fontWeight: '600', color: COLORS.textLight },
  toggleTextActive: { color: '#fff' },
  subtitle: { fontSize: 14, color: COLORS.textLight, marginBottom: 24, textAlign: 'center' },
  input: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: COLORS.text,
    marginBottom: 16,
  },
  button: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 16,
  },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  link: { textAlign: 'center', color: COLORS.textLight, fontSize: 14 },
  linkBold: { color: COLORS.primary, fontWeight: '600' },
});
