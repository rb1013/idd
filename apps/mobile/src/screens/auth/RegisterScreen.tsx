import React, { useEffect, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, Alert, ActivityIndicator,
  ScrollView, Modal, FlatList,
} from 'react-native';
import { supabase } from '../../lib/supabase';
import { COLORS } from '../../constants';
import { US_STATES } from '../../constants/usStates';

export default function RegisterScreen() {
  const [fullName, setFullName]   = useState('');
  const [email, setEmail]         = useState('');
  const [phone, setPhone]         = useState('');
  const [password, setPassword]   = useState('');
  const [confirm, setConfirm]     = useState('');
  const [city, setCity]           = useState('');
  const [state, setState]         = useState('');
  const [showStatePicker, setShowStatePicker] = useState(false);

  const [tagOptions, setTagOptions]           = useState<string[]>([]);
  const [selectedTags, setSelectedTags]       = useState<string[]>([]);
  const [showTagPicker, setShowTagPicker]     = useState(false);

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.from('situation_tag_options').select('label').order('label').then(({ data }) => {
      setTagOptions((data ?? []).map((r: any) => r.label));
    });
  }, []);

  function toggleTag(tag: string) {
    setSelectedTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  }

  async function handleRegister() {
    if (!fullName || !email || !password) { Alert.alert('Please fill in all required fields'); return; }
    if (password !== confirm)             { Alert.alert('Passwords do not match'); return; }
    if (password.length < 6)             { Alert.alert('Password must be at least 6 characters'); return; }

    setLoading(true);
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) { Alert.alert('Registration failed', error.message); setLoading(false); return; }

    if (data.user) {
      const { error: profileError } = await supabase.from('guardians').insert({
        id: data.user.id,
        email,
        full_name: fullName,
        phone: phone || null,
        city: city.trim() || null,
        state: state || null,
        country: 'USA',
        situation_tags: selectedTags,
      });
      if (profileError) {
        Alert.alert('Profile setup failed', profileError.message);
        setLoading(false);
        return;
      }
      await supabase.auth.refreshSession();
    }
    setLoading(false);
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.inner} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Create Account</Text>
        <Text style={styles.subtitle}>Guardian Registration</Text>

        <Text style={styles.label}>Full Name *</Text>
        <TextInput
          style={styles.input}
          value={fullName}
          onChangeText={setFullName}
          placeholder="Your full name"
          placeholderTextColor={COLORS.textLight}
        />

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

        <Text style={styles.label}>Phone (optional)</Text>
        <TextInput
          style={styles.input}
          value={phone}
          onChangeText={setPhone}
          placeholder="+1 555 000 0000"
          keyboardType="phone-pad"
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

        {/* Location */}
        <Text style={styles.label}>Country</Text>
        <View style={[styles.input, styles.readOnly]}>
          <Text style={styles.readOnlyText}>USA</Text>
        </View>

        <Text style={styles.label}>State</Text>
        <TouchableOpacity style={styles.pickerBtn} onPress={() => setShowStatePicker(true)} activeOpacity={0.7}>
          <Text style={[styles.pickerBtnText, !state && styles.placeholder]}>
            {state || 'Select state...'}
          </Text>
          <Text style={styles.chevron}>▾</Text>
        </TouchableOpacity>

        <Text style={styles.label}>City</Text>
        <TextInput
          style={styles.input}
          value={city}
          onChangeText={setCity}
          placeholder="e.g. Austin"
          placeholderTextColor={COLORS.textLight}
        />

        {/* Situation tags */}
        <Text style={styles.label}>Situation Tags (optional)</Text>
        <Text style={styles.sublabel}>Select the situations that apply to your learner</Text>
        <TouchableOpacity style={styles.pickerBtn} onPress={() => setShowTagPicker(true)} activeOpacity={0.7}>
          <Text style={[styles.pickerBtnText, selectedTags.length === 0 && styles.placeholder]}>
            {selectedTags.length === 0 ? 'Select tags...' : `${selectedTags.length} selected`}
          </Text>
          <Text style={styles.chevron}>▾</Text>
        </TouchableOpacity>
        {selectedTags.length > 0 && (
          <View style={styles.chipRow}>
            {selectedTags.map(tag => (
              <TouchableOpacity key={tag} style={styles.chip} onPress={() => toggleTag(tag)} activeOpacity={0.7}>
                <Text style={styles.chipText}>{tag}</Text>
                <Text style={styles.chipX}>✕</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        <TouchableOpacity style={styles.button} onPress={handleRegister} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Create Account</Text>}
        </TouchableOpacity>
      </ScrollView>

      {/* State picker modal */}
      <Modal visible={showStatePicker} animationType="slide" transparent onRequestClose={() => setShowStatePicker(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select State</Text>
              <TouchableOpacity onPress={() => setShowStatePicker(false)}>
                <Text style={styles.modalClose}>Done</Text>
              </TouchableOpacity>
            </View>
            <FlatList
              data={US_STATES}
              keyExtractor={item => item}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.listItem, state === item && styles.listItemSelected]}
                  onPress={() => { setState(item); setShowStatePicker(false); }}
                >
                  <Text style={[styles.listItemText, state === item && styles.listItemTextSelected]}>
                    {item}
                  </Text>
                  {state === item && <Text style={styles.listCheck}>✓</Text>}
                </TouchableOpacity>
              )}
              ItemSeparatorComponent={() => <View style={styles.listDivider} />}
            />
          </View>
        </View>
      </Modal>

      {/* Situation tag picker modal */}
      <Modal visible={showTagPicker} animationType="slide" transparent onRequestClose={() => setShowTagPicker(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Situation Tags</Text>
              <TouchableOpacity onPress={() => setShowTagPicker(false)}>
                <Text style={styles.modalClose}>Done</Text>
              </TouchableOpacity>
            </View>
            {tagOptions.length === 0 ? (
              <View style={styles.emptyTags}>
                <Text style={styles.emptyTagsText}>No tags available yet.</Text>
              </View>
            ) : (
              <FlatList
                data={tagOptions}
                keyExtractor={item => item}
                renderItem={({ item }) => {
                  const selected = selectedTags.includes(item);
                  return (
                    <TouchableOpacity
                      style={[styles.listItem, selected && styles.listItemSelected]}
                      onPress={() => toggleTag(item)}
                    >
                      <Text style={[styles.listItemText, selected && styles.listItemTextSelected]}>
                        {item}
                      </Text>
                      {selected && <Text style={styles.listCheck}>✓</Text>}
                    </TouchableOpacity>
                  );
                }}
                ItemSeparatorComponent={() => <View style={styles.listDivider} />}
              />
            )}
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  inner:     { padding: 24, paddingBottom: 48 },
  title:     { fontSize: 28, fontWeight: '700', color: COLORS.text, marginBottom: 4, marginTop: 16 },
  subtitle:  { fontSize: 16, color: COLORS.textLight, marginBottom: 24 },
  label:     { fontSize: 14, fontWeight: '600', color: COLORS.text, marginBottom: 6 },
  sublabel:  { fontSize: 12, color: COLORS.textLight, marginBottom: 8, marginTop: -2 },

  input: {
    backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border,
    borderRadius: 12, padding: 16, fontSize: 16, color: COLORS.text, marginBottom: 16,
  },
  readOnly:     { backgroundColor: '#F3F4F6', justifyContent: 'center' },
  readOnlyText: { fontSize: 16, color: COLORS.textLight },

  pickerBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border,
    borderRadius: 12, paddingHorizontal: 16, paddingVertical: 16, marginBottom: 12,
  },
  pickerBtnText: { fontSize: 16, color: COLORS.text },
  placeholder:   { color: COLORS.textLight },
  chevron:       { fontSize: 14, color: COLORS.textLight },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: COLORS.primary + '18', borderWidth: 1.5, borderColor: COLORS.primary,
    borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6,
  },
  chipText: { fontSize: 13, color: COLORS.primary, fontWeight: '600' },
  chipX:    { fontSize: 11, color: COLORS.primary, fontWeight: '700' },

  button: {
    backgroundColor: COLORS.primary, borderRadius: 12,
    padding: 16, alignItems: 'center', marginTop: 8,
  },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalCard: {
    backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    maxHeight: '70%',
  },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 18, borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  modalTitle: { fontSize: 17, fontWeight: '700', color: COLORS.text },
  modalClose: { fontSize: 16, fontWeight: '600', color: COLORS.primary },

  listItem:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14 },
  listItemSelected: { backgroundColor: '#EEF4FF' },
  listItemText:     { fontSize: 16, color: COLORS.text },
  listItemTextSelected: { fontWeight: '700', color: COLORS.primary },
  listCheck:    { fontSize: 16, color: COLORS.primary, fontWeight: '700' },
  listDivider:  { height: 1, backgroundColor: COLORS.border, marginHorizontal: 20 },

  emptyTags:     { padding: 40, alignItems: 'center' },
  emptyTagsText: { fontSize: 15, color: COLORS.textLight },
});
