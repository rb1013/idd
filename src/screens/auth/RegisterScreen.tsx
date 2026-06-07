import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, Alert, ActivityIndicator, ScrollView,
} from 'react-native';
import { supabase } from '../../lib/supabase';
import { COLORS } from '../../constants';

export default function RegisterScreen() {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleRegister() {
    if (!fullName || !email || !password) { Alert.alert('Please fill in all required fields'); return; }
    if (password !== confirm) { Alert.alert('Passwords do not match'); return; }
    if (password.length < 6) { Alert.alert('Password must be at least 6 characters'); return; }

    setLoading(true);
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) { Alert.alert('Registration failed', error.message); setLoading(false); return; }

    if (data.user) {
      const { error: profileError } = await supabase.from('guardians').insert({
        id: data.user.id,
        email,
        full_name: fullName,
        phone: phone || null,
      });
      if (profileError) Alert.alert('Profile setup failed', profileError.message);
    }
    setLoading(false);
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.inner} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Create Account</Text>
        <Text style={styles.subtitle}>Guardian Registration</Text>

        <Text style={styles.label}>Full Name *</Text>
        <TextInput style={styles.input} value={fullName} onChangeText={setFullName} placeholder="Your full name" placeholderTextColor={COLORS.textLight} />

        <Text style={styles.label}>Email *</Text>
        <TextInput style={styles.input} value={email} onChangeText={setEmail} placeholder="your@email.com" keyboardType="email-address" autoCapitalize="none" placeholderTextColor={COLORS.textLight} />

        <Text style={styles.label}>Phone (optional)</Text>
        <TextInput style={styles.input} value={phone} onChangeText={setPhone} placeholder="+1 555 000 0000" keyboardType="phone-pad" placeholderTextColor={COLORS.textLight} />

        <Text style={styles.label}>Password *</Text>
        <TextInput style={styles.input} value={password} onChangeText={setPassword} placeholder="Min. 6 characters" secureTextEntry placeholderTextColor={COLORS.textLight} />

        <Text style={styles.label}>Confirm Password *</Text>
        <TextInput style={styles.input} value={confirm} onChangeText={setConfirm} placeholder="Repeat password" secureTextEntry placeholderTextColor={COLORS.textLight} />

        <TouchableOpacity style={styles.button} onPress={handleRegister} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Create Account</Text>}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  inner: { padding: 24, paddingBottom: 48 },
  title: { fontSize: 28, fontWeight: '700', color: COLORS.text, marginBottom: 4, marginTop: 16 },
  subtitle: { fontSize: 16, color: COLORS.textLight, marginBottom: 24 },
  label: { fontSize: 14, fontWeight: '600', color: COLORS.text, marginBottom: 6 },
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
    marginTop: 8,
  },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
