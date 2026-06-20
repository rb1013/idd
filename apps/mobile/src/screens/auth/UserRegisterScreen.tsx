import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, Alert, ActivityIndicator,
} from 'react-native';
import { supabase } from '../../lib/supabase';
import { COLORS } from '../../constants';

export default function UserRegisterScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleRegister() {
    if (!email || !password) { Alert.alert('Please fill in all fields'); return; }
    if (password !== confirm) { Alert.alert('Passwords do not match'); return; }
    if (password.length < 6) { Alert.alert('Password must be at least 6 characters'); return; }

    setLoading(true);

    // Check that this email was set up by a guardian first
    const { data: profile, error: lookupError } = await supabase
      .from('user_profiles')
      .select('id, auth_user_id')
      .eq('email', email.toLowerCase().trim())
      .single();

    if (lookupError || !profile) {
      Alert.alert('Email not found', 'This email has not been set up by a guardian yet. Please ask your guardian to add your email to your profile first.');
      setLoading(false);
      return;
    }

    if (profile.auth_user_id) {
      Alert.alert('Already registered', 'This profile already has an account. Please sign in instead.');
      setLoading(false);
      return;
    }

    // Create the auth account
    const { data, error } = await supabase.auth.signUp({ email: email.toLowerCase().trim(), password });
    if (error) { Alert.alert('Registration failed', error.message); setLoading(false); return; }

    if (data.user) {
      // Link the auth account to the user profile
      const { error: linkError } = await supabase
        .from('user_profiles')
        .update({ auth_user_id: data.user.id })
        .eq('id', profile.id);

      if (linkError) {
        Alert.alert('Setup error', 'Account created but could not link to your profile. Please contact your guardian.');
      }
    }

    setLoading(false);
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.inner}>
        <Text style={styles.title}>Set Up Your Account</Text>
        <Text style={styles.subtitle}>Use the email your guardian registered for you</Text>

        <Text style={styles.label}>Email *</Text>
        <TextInput
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          placeholder="your@email.com"
          keyboardType="email-address"
          autoCapitalize="none"
          placeholderTextColor={COLORS.textLight}
        />

        <Text style={styles.label}>Password *</Text>
        <TextInput
          style={styles.input}
          value={password}
          onChangeText={setPassword}
          placeholder="Min. 6 characters"
          secureTextEntry
          placeholderTextColor={COLORS.textLight}
        />

        <Text style={styles.label}>Confirm Password *</Text>
        <TextInput
          style={styles.input}
          value={confirm}
          onChangeText={setConfirm}
          placeholder="Repeat password"
          secureTextEntry
          placeholderTextColor={COLORS.textLight}
        />

        <TouchableOpacity style={styles.button} onPress={handleRegister} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Create Account</Text>}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  inner: { flex: 1, justifyContent: 'center', padding: 24 },
  title: { fontSize: 28, fontWeight: '700', color: COLORS.text, marginBottom: 6 },
  subtitle: { fontSize: 14, color: COLORS.textLight, marginBottom: 28, lineHeight: 20 },
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
