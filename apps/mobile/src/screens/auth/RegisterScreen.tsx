import React, { useEffect, useState } from 'react';
import {
  View, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, Alert, ActivityIndicator,
  ScrollView, Modal, FlatList, Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import * as SecureStore from 'expo-secure-store';
import AppText from '../../components/AppText';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../../lib/supabase';
import { COLORS } from '../../constants';
import { US_STATES } from '../../constants/usStates';

export default function RegisterScreen() {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
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

  const [pin, setPin]           = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
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

  async function pickPhoto() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (!result.canceled) setPhotoUri(result.assets[0].uri);
  }

  async function handleRegister() {
    if (!fullName || !email || !password) { Alert.alert('Please fill in all required fields'); return; }
    if (password !== confirm)             { Alert.alert('Passwords do not match'); return; }
    if (password.length < 6)             { Alert.alert('Password must be at least 6 characters'); return; }
    if (pin.length !== 6)                { Alert.alert('Please create a 6-digit PIN'); return; }
    if (pin !== confirmPin)              { Alert.alert('PINs do not match'); return; }

    setLoading(true);

    // Check for existing account before signUp — Supabase silently fake-succeeds on duplicate emails
    try {
      const { data: checkData, error: checkError } = await supabase.functions.invoke('check-email', {
        body: { email: email.trim().toLowerCase() },
      });
      if (!checkError && checkData?.exists) {
        Alert.alert('Account already exists', 'An account with this email already exists. Please sign in instead.');
        setLoading(false);
        return;
      }
    } catch {
      // If the check fails for any reason, proceed with signUp and let Supabase handle it
    }

    const { data, error } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(),
      password,
      options: { emailRedirectTo: 'nicoidd://auth/callback' },
    });
    if (error) { Alert.alert('Registration failed', error.message); setLoading(false); return; }

    await SecureStore.setItemAsync('pending_guardian_registration', JSON.stringify({
      email: email.toLowerCase().trim(),
      fullName,
      phone: phone || null,
      city: city.trim() || null,
      state: state || null,
      selectedTags,
      pin,
      photoUri: photoUri || null,
    }));

    setLoading(false);
    navigation.navigate('OTPVerification', { email: email.toLowerCase().trim() });
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={[styles.inner, { paddingBottom: Math.max(insets.bottom + 24, 48) }]} keyboardShouldPersistTaps="handled">
        <AppText style={styles.title}>Create Account</AppText>
        <AppText style={styles.subtitle}>Set up your NICO account</AppText>

        {/* Profile photo */}
        <TouchableOpacity style={styles.photoPicker} onPress={pickPhoto} activeOpacity={0.8}>
          {photoUri ? (
            <Image source={{ uri: photoUri }} style={styles.photoPreview} />
          ) : (
            <View style={styles.photoPlaceholder}>
              <AppText style={styles.photoPlaceholderEmoji}>📷</AppText>
              <AppText style={styles.photoPlaceholderText}>Add photo</AppText>
            </View>
          )}
          {photoUri && (
            <View style={styles.photoEditBadge}>
              <AppText style={styles.photoEditEmoji}>✏️</AppText>
            </View>
          )}
        </TouchableOpacity>

        <AppText style={styles.label}>Full Name *</AppText>
        <TextInput
          style={styles.input}
          value={fullName}
          onChangeText={setFullName}
          placeholder="Your full name"
          placeholderTextColor={COLORS.bloomMuted}
        />

        <AppText style={styles.label}>Email *</AppText>
        <TextInput
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          placeholder="your@email.com"
          keyboardType="email-address"
          autoCapitalize="none"
          placeholderTextColor={COLORS.bloomMuted}
        />

        <AppText style={styles.label}>Phone (optional)</AppText>
        <TextInput
          style={styles.input}
          value={phone}
          onChangeText={setPhone}
          placeholder="+1 555 000 0000"
          keyboardType="phone-pad"
          placeholderTextColor={COLORS.bloomMuted}
        />

        <AppText style={styles.label}>Password *</AppText>
        <TextInput
          style={styles.input}
          value={password}
          onChangeText={setPassword}
          placeholder="Min. 6 characters"
          secureTextEntry
          placeholderTextColor={COLORS.bloomMuted}
        />

        <AppText style={styles.label}>Confirm Password *</AppText>
        <TextInput
          style={styles.input}
          value={confirm}
          onChangeText={setConfirm}
          placeholder="Repeat password"
          secureTextEntry
          placeholderTextColor={COLORS.bloomMuted}
        />

        {/* Location */}
        <AppText style={styles.label}>Country</AppText>
        <View style={[styles.input, styles.readOnly]}>
          <AppText style={styles.readOnlyText}>USA</AppText>
        </View>

        <AppText style={styles.label}>State</AppText>
        <TouchableOpacity style={styles.pickerBtn} onPress={() => setShowStatePicker(true)} activeOpacity={0.7}>
          <AppText style={[styles.pickerBtnText, !state && styles.placeholder]}>
            {state || 'Select state...'}
          </AppText>
          <AppText style={styles.chevron}>▾</AppText>
        </TouchableOpacity>

        <AppText style={styles.label}>City</AppText>
        <TextInput
          style={styles.input}
          value={city}
          onChangeText={setCity}
          placeholder="e.g. Austin"
          placeholderTextColor={COLORS.bloomMuted}
        />

        {/* Situation tags */}
        <AppText style={styles.label}>Situation Tags (optional)</AppText>
        <View style={styles.helperBox}>
          <AppText style={styles.helperTitle}>ℹ️  What are Situation Tags?</AppText>
          <AppText style={styles.helperText}>
            Situation tags describe your learner's specific needs or medical conditions. It helps you connect with parents in similar situations.
          </AppText>
        </View>
        <TouchableOpacity style={styles.pickerBtn} onPress={() => setShowTagPicker(true)} activeOpacity={0.7}>
          <AppText style={[styles.pickerBtnText, selectedTags.length === 0 && styles.placeholder]}>
            {selectedTags.length === 0 ? 'Select tags...' : `${selectedTags.length} selected`}
          </AppText>
          <AppText style={styles.chevron}>▾</AppText>
        </TouchableOpacity>
        {selectedTags.length > 0 && (
          <View style={styles.chipRow}>
            {selectedTags.map(tag => (
              <TouchableOpacity key={tag} style={styles.chip} onPress={() => toggleTag(tag)} activeOpacity={0.7}>
                <AppText style={styles.chipText}>{tag}</AppText>
                <AppText style={styles.chipX}>✕</AppText>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* PIN setup */}
        <View style={styles.pinSection}>
          <AppText style={styles.pinSectionTitle}>🔐  Guardian PIN</AppText>
          <AppText style={styles.pinSectionHint}>
            You'll use this 6-digit PIN to access Guardian mode from the NICO home screen.
          </AppText>
          <AppText style={styles.label}>PIN *</AppText>
          <TextInput
            style={styles.input}
            value={pin}
            onChangeText={(v) => setPin(v.replace(/[^0-9]/g, '').slice(0, 6))}
            placeholder="6 digits"
            keyboardType="number-pad"
            maxLength={6}
            secureTextEntry
            placeholderTextColor={COLORS.bloomMuted}
          />
          <AppText style={styles.label}>Confirm PIN *</AppText>
          <TextInput
            style={styles.input}
            value={confirmPin}
            onChangeText={(v) => setConfirmPin(v.replace(/[^0-9]/g, '').slice(0, 6))}
            placeholder="Repeat PIN"
            keyboardType="number-pad"
            maxLength={6}
            secureTextEntry
            placeholderTextColor={COLORS.bloomMuted}
          />
        </View>

        <TouchableOpacity style={styles.button} onPress={handleRegister} disabled={loading}>
          {loading
            ? <ActivityIndicator color={COLORS.bloomOnAccent} />
            : <AppText style={styles.buttonText}>Create Account</AppText>
          }
        </TouchableOpacity>
      </ScrollView>

      {/* State picker modal */}
      <Modal visible={showStatePicker} animationType="slide" transparent onRequestClose={() => setShowStatePicker(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <AppText style={styles.modalTitle}>Select State</AppText>
              <TouchableOpacity onPress={() => setShowStatePicker(false)}>
                <AppText style={styles.modalClose}>Done</AppText>
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
                  <AppText style={[styles.listItemText, state === item && styles.listItemTextSelected]}>
                    {item}
                  </AppText>
                  {state === item && <AppText style={styles.listCheck}>✓</AppText>}
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
              <AppText style={styles.modalTitle}>Situation Tags</AppText>
              <TouchableOpacity onPress={() => setShowTagPicker(false)}>
                <AppText style={styles.modalClose}>Done</AppText>
              </TouchableOpacity>
            </View>
            {tagOptions.length === 0 ? (
              <View style={styles.emptyTags}>
                <AppText style={styles.emptyTagsText}>No tags available yet.</AppText>
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
                      <AppText style={[styles.listItemText, selected && styles.listItemTextSelected]}>
                        {item}
                      </AppText>
                      {selected && <AppText style={styles.listCheck}>✓</AppText>}
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
  container: { flex: 1, backgroundColor: COLORS.bloomBody },
  inner:     { padding: 24 },
  title:     { fontSize: 28, fontWeight: '700', color: COLORS.bloomText, marginBottom: 4, marginTop: 16 },
  subtitle:  { fontSize: 16, color: COLORS.bloomMuted, marginBottom: 24 },
  label:     { fontSize: 14, fontWeight: '600', color: COLORS.bloomText, marginBottom: 6 },
  sublabel:  { fontSize: 12, color: COLORS.bloomMuted, marginBottom: 8, marginTop: -2 },

  photoPicker: {
    alignSelf: 'center', marginBottom: 28, position: 'relative',
  },
  photoPreview: {
    width: 100, height: 100, borderRadius: 50,
    borderWidth: 3, borderColor: COLORS.bloomAccent,
  },
  photoPlaceholder: {
    width: 100, height: 100, borderRadius: 50,
    backgroundColor: COLORS.bloomCard, borderWidth: 2,
    borderColor: COLORS.bloomBorder, borderStyle: 'dashed',
    justifyContent: 'center', alignItems: 'center', gap: 4,
  },
  photoPlaceholderEmoji: { fontSize: 28 },
  photoPlaceholderText:  { fontSize: 12, color: COLORS.bloomMuted, fontWeight: '600' },
  photoEditBadge: {
    position: 'absolute', bottom: 2, right: 2,
    backgroundColor: COLORS.bloomAccent,
    width: 28, height: 28, borderRadius: 14,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 2, borderColor: '#fff',
  },
  photoEditEmoji: { fontSize: 13 },

  input: {
    backgroundColor: COLORS.bloomCard, borderWidth: 1.5, borderColor: COLORS.bloomBorder,
    borderRadius: 12, padding: 16, fontSize: 16, color: COLORS.bloomText, marginBottom: 16,
  },
  readOnly:     { backgroundColor: COLORS.bloomActiveBg, justifyContent: 'center' },
  readOnlyText: { fontSize: 16, color: COLORS.bloomMuted },

  pickerBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: COLORS.bloomCard, borderWidth: 1.5, borderColor: COLORS.bloomBorder,
    borderRadius: 12, paddingHorizontal: 16, paddingVertical: 16, marginBottom: 12,
  },
  pickerBtnText: { fontSize: 16, color: COLORS.bloomText },
  placeholder:   { color: COLORS.bloomMuted },
  chevron:       { fontSize: 14, color: COLORS.bloomMuted },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: COLORS.bloomActiveBg, borderWidth: 1.5, borderColor: COLORS.bloomSageMid,
    borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6,
  },
  chipText: { fontSize: 13, color: COLORS.bloomActiveText, fontWeight: '600' },
  chipX:    { fontSize: 11, color: COLORS.bloomActiveText, fontWeight: '700' },

  pinSection: {
    backgroundColor: COLORS.bloomActiveBg, borderRadius: 16,
    padding: 18, marginTop: 8, marginBottom: 8,
    borderWidth: 1.5, borderColor: COLORS.bloomSageMid,
  },
  pinSectionTitle: { fontSize: 15, fontWeight: '800', color: COLORS.bloomText, marginBottom: 6 },
  pinSectionHint:  { fontSize: 13, color: COLORS.bloomMuted, lineHeight: 18, marginBottom: 12 },

  button: {
    backgroundColor: COLORS.bloomAccent, borderRadius: 12,
    padding: 16, alignItems: 'center', marginTop: 8,
  },
  buttonText: { color: COLORS.bloomOnAccent, fontSize: 16, fontWeight: '700' },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalCard: {
    backgroundColor: COLORS.bloomCard, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    maxHeight: '70%', paddingBottom: 32,
  },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 18, borderBottomWidth: 1, borderBottomColor: COLORS.bloomBorder,
  },
  modalTitle: { fontSize: 17, fontWeight: '700', color: COLORS.bloomText },
  modalClose: { fontSize: 16, fontWeight: '600', color: COLORS.bloomAccent },

  listItem:             { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14 },
  listItemSelected:     { backgroundColor: COLORS.bloomActiveBg },
  listItemText:         { fontSize: 16, color: COLORS.bloomText },
  listItemTextSelected: { fontWeight: '700', color: COLORS.bloomActiveText },
  listCheck:    { fontSize: 16, color: COLORS.bloomActiveText, fontWeight: '700' },
  listDivider:  { height: 1, backgroundColor: COLORS.bloomBorder, marginHorizontal: 20 },

  emptyTags:     { padding: 40, alignItems: 'center' },
  emptyTagsText: { fontSize: 15, color: COLORS.bloomMuted },

  helperBox: {
    backgroundColor: COLORS.bloomActiveBg, borderRadius: 12,
    padding: 14, marginBottom: 12,
    borderLeftWidth: 3, borderLeftColor: COLORS.bloomAccent,
  },
  helperTitle: { fontSize: 13, fontWeight: '700', color: COLORS.bloomText, marginBottom: 5 },
  helperText:  { fontSize: 12, color: COLORS.bloomText, lineHeight: 18 },
});
