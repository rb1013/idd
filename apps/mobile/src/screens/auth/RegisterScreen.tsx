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
import ContentContainer from '../../components/ContentContainer';
import DropdownPicker from '../../components/DropdownPicker';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../../lib/supabase';
import { FIXED_STATE } from '../../constants/usStates';
import { CA_COUNTIES } from '../../constants/caCounties';
import { validatePhone, buildE164 } from '../../constants/countryCodes';
import { emailError, passwordError, passwordMatchError } from '../../lib/validators';
import {
  NICO, TEXT_STYLE, SPACING, RADIUS, SHADOW, FONT_SIZE, FONT_WEIGHT,
  BTN_SIZE, BTN_VARIANT, scale,
} from '../../constants/theme';

export default function RegisterScreen() {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const [fullName, setFullName]   = useState('');
  const [email, setEmail]         = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword]   = useState('');
  const [confirm, setConfirm]     = useState('');
  const [county, setCounty]       = useState('');

  const [tagOptions, setTagOptions]           = useState<string[]>([]);
  const [selectedTags, setSelectedTags]       = useState<string[]>([]);
  const [showTagPicker, setShowTagPicker]     = useState(false);

  const [pin, setPin]           = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.from('medical_conditions').select('label').order('label').then(({ data }) => {
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
    if (!fullName || !email || !password || !county) { Alert.alert('Please fill in all required fields'); return; }
    const emailErr = emailError(email);
    if (emailErr) { Alert.alert('Invalid email', emailErr); return; }
    const pwdErr = passwordError(password);
    if (pwdErr) { Alert.alert('Invalid password', pwdErr); return; }
    const matchErr = passwordMatchError(password, confirm);
    if (matchErr) { Alert.alert('Password mismatch', matchErr); return; }
    if (pin.length !== 6)                { Alert.alert('Please create a 6-digit PIN'); return; }
    if (pin !== confirmPin)              { Alert.alert('PINs do not match'); return; }

    const phoneError = validatePhone('+1', phone);
    if (phoneError) { Alert.alert('Invalid phone number', phoneError); return; }

    setLoading(true);

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
      // proceed if check fails
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
      phone: buildE164('+1', phone),
      county,
      state: FIXED_STATE,
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
        <ContentContainer>
        <AppText style={styles.title}>Create Account</AppText>

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
          placeholderTextColor={NICO.textMuted}
          maxLength={20}
        />

        <AppText style={styles.label}>Email *</AppText>
        <TextInput
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          placeholder="your@email.com"
          keyboardType="email-address"
          autoCapitalize="none"
          placeholderTextColor={NICO.textMuted}
        />

        <AppText style={styles.label}>Phone *</AppText>
        <View style={styles.phoneRow}>
          <View style={styles.countryCodeBtn}>
            <AppText style={styles.countryFlag}>🇺🇸</AppText>
            <AppText style={styles.countryCodeText}>+1</AppText>
          </View>
          <TextInput
            style={styles.phoneInput}
            value={phone}
            onChangeText={v => setPhone(v.replace(/[^\d\s\-]/g, ''))}
            placeholder="555 000 0000"
            keyboardType="phone-pad"
            placeholderTextColor={NICO.textMuted}
          />
        </View>

        <AppText style={styles.label}>Password *</AppText>
        <TextInput
          style={styles.input}
          value={password}
          onChangeText={setPassword}
          placeholder="Min. 6 characters"
          secureTextEntry
          placeholderTextColor={NICO.textMuted}
        />

        <AppText style={styles.label}>Confirm Password *</AppText>
        <TextInput
          style={styles.input}
          value={confirm}
          onChangeText={setConfirm}
          placeholder="Repeat password"
          secureTextEntry
          placeholderTextColor={NICO.textMuted}
        />

        {/* Location */}
        <AppText style={styles.label}>Country</AppText>
        <View style={[styles.input, styles.readOnly]}>
          <AppText style={styles.readOnlyText}>USA</AppText>
        </View>

        <AppText style={styles.label}>State</AppText>
        <View style={[styles.input, styles.readOnly]}>
          <AppText style={styles.readOnlyText}>{FIXED_STATE}</AppText>
        </View>

        <View style={{ marginBottom: SPACING.lg }}>
          <DropdownPicker label="County *" value={county} options={CA_COUNTIES} onSelect={setCounty} placeholder="Select county..." />
        </View>

        {/* Learner situation */}
        <AppText style={styles.label}>Regional Support Category (optional)</AppText>
        <View style={styles.helperBox}>
          <AppText style={styles.helperText}>
            ℹ️  Select the category that matches your learner's school support plan or California Regional Center services. This helps you find local families with similar needs while keeping your private medical details secure.
          </AppText>
        </View>
        <TouchableOpacity style={styles.pickerBtn} onPress={() => setShowTagPicker(true)} activeOpacity={0.7}>
          <AppText style={[styles.pickerBtnText, selectedTags.length === 0 && styles.placeholder]}>
            {selectedTags.length === 0 ? 'Select Category' : `${selectedTags.length} selected`}
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
            placeholderTextColor={NICO.textMuted}
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
            placeholderTextColor={NICO.textMuted}
          />
        </View>

        <TouchableOpacity style={styles.button} onPress={handleRegister} disabled={loading}>
          {loading
            ? <ActivityIndicator color={NICO.textOnAccent} />
            : <AppText style={styles.buttonText}>Create Account</AppText>
          }
        </TouchableOpacity>
        </ContentContainer>
      </ScrollView>

      {/* Learner situation picker modal */}
      <Modal visible={showTagPicker} animationType="slide" transparent onRequestClose={() => setShowTagPicker(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <AppText style={styles.modalTitle}>Regional Support Category</AppText>
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
  container: { flex: 1, backgroundColor: NICO.screenBg },
  inner:     { padding: SPACING.xl },
  title:     { ...TEXT_STYLE.sectionTitle, marginBottom: SPACING.xs, marginTop: SPACING.base },
  subtitle:  { ...TEXT_STYLE.hint, marginBottom: SPACING.xl },
  label:     { ...TEXT_STYLE.fieldLabel, marginBottom: SPACING.sm },
  sublabel:  { fontSize: FONT_SIZE.sm, color: NICO.textMuted, marginBottom: SPACING.sm, marginTop: -2 },

  photoPicker: {
    alignSelf: 'center', marginBottom: SPACING['2xl'], position: 'relative',
  },
  photoPreview: {
    width: scale(100), height: scale(100), borderRadius: scale(50),
    borderWidth: 3, borderColor: NICO.primary,
  },
  photoPlaceholder: {
    width: scale(100), height: scale(100), borderRadius: scale(50),
    backgroundColor: NICO.surface, borderWidth: 2,
    borderColor: NICO.border, borderStyle: 'dashed',
    justifyContent: 'center', alignItems: 'center', gap: 4,
  },
  photoPlaceholderEmoji: { fontSize: scale(28) },
  photoPlaceholderText:  { fontSize: FONT_SIZE.sm, color: NICO.textMuted, fontWeight: FONT_WEIGHT.semiBold },
  photoEditBadge: {
    position: 'absolute', bottom: 2, right: 2,
    backgroundColor: NICO.primary,
    width: scale(28), height: scale(28), borderRadius: scale(14),
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 2, borderColor: '#fff',
  },
  photoEditEmoji: { fontSize: FONT_SIZE.base },

  input: {
    backgroundColor: NICO.surface, borderWidth: 1.5, borderColor: NICO.border,
    borderRadius: RADIUS.md, padding: SPACING.base, fontSize: FONT_SIZE.lg, color: NICO.text, marginBottom: SPACING.base,
  },
  readOnly:     { backgroundColor: NICO.background, justifyContent: 'center' },
  readOnlyText: { fontSize: FONT_SIZE.lg, color: NICO.textMuted },

  phoneRow: {
    flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.base,
  },
  countryCodeBtn: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.xs,
    backgroundColor: NICO.surface, borderWidth: 1.5, borderColor: NICO.border,
    borderRadius: RADIUS.md, paddingHorizontal: SPACING.md, paddingVertical: SPACING.base,
  },
  countryFlag:     { fontSize: FONT_SIZE['2xl'] },
  countryCodeText: { fontSize: FONT_SIZE.lg, fontWeight: FONT_WEIGHT.bold, color: NICO.text },
  countryChevron:  { fontSize: FONT_SIZE.sm, color: NICO.textMuted },
  phoneInput: {
    flex: 1, backgroundColor: NICO.surface, borderWidth: 1.5, borderColor: NICO.border,
    borderRadius: RADIUS.md, paddingHorizontal: SPACING.base, paddingVertical: SPACING.base,
    fontSize: FONT_SIZE.lg, color: NICO.text,
  },

  pickerBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: NICO.surface, borderWidth: 1.5, borderColor: NICO.border,
    borderRadius: RADIUS.md, paddingHorizontal: SPACING.base, paddingVertical: SPACING.base, marginBottom: SPACING.md,
  },
  pickerBtnText: { fontSize: FONT_SIZE.lg, color: NICO.text },
  placeholder:   { color: NICO.textMuted },
  chevron:       { fontSize: FONT_SIZE.md, color: NICO.textMuted },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm, marginBottom: SPACING.base },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.xs,
    backgroundColor: NICO.primaryLight, borderWidth: 1.5, borderColor: NICO.primary,
    borderRadius: RADIUS.full, paddingHorizontal: SPACING.md, paddingVertical: SPACING.xs,
  },
  chipText: { fontSize: FONT_SIZE.base, color: NICO.primary, fontWeight: FONT_WEIGHT.semiBold },
  chipX:    { fontSize: FONT_SIZE.sm, color: NICO.primary, fontWeight: FONT_WEIGHT.bold },

  pinSection: {
    backgroundColor: NICO.primaryLight, borderRadius: RADIUS.lg,
    padding: SPACING.lg, marginTop: SPACING.sm, marginBottom: SPACING.sm,
    borderWidth: 1.5, borderColor: NICO.primary,
  },
  pinSectionTitle: { fontSize: FONT_SIZE.lg, fontWeight: FONT_WEIGHT.extraBold, color: NICO.text, marginBottom: SPACING.xs },
  pinSectionHint:  { fontSize: FONT_SIZE.md, color: NICO.text, fontWeight: FONT_WEIGHT.semiBold, lineHeight: 20, marginBottom: SPACING.md },

  button: {
    ...BTN_SIZE.lg, ...BTN_VARIANT.primary, marginTop: SPACING.sm,
  },
  buttonText: { ...TEXT_STYLE.buttonPrimary },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalCard: {
    backgroundColor: NICO.surface, borderTopLeftRadius: RADIUS['3xl'], borderTopRightRadius: RADIUS['3xl'],
    maxHeight: '70%', paddingBottom: SPACING.xl,
  },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: SPACING.lg, borderBottomWidth: 1, borderBottomColor: NICO.border,
  },
  modalTitle: { fontSize: FONT_SIZE.xl, fontWeight: FONT_WEIGHT.bold, color: NICO.text },
  modalClose: { fontSize: FONT_SIZE.lg, fontWeight: FONT_WEIGHT.semiBold, color: NICO.primary },

  listItem:             { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md, gap: SPACING.sm },
  listItemSelected:     { backgroundColor: NICO.primaryLight },
  listItemFlag:         { fontSize: FONT_SIZE['2xl'] },
  listItemText:         { flex: 1, fontSize: FONT_SIZE.lg, color: NICO.text },
  listItemTextSelected: { fontWeight: FONT_WEIGHT.bold, color: NICO.primary },
  listItemCode:         { fontSize: FONT_SIZE.md, color: NICO.textMuted, fontWeight: FONT_WEIGHT.semiBold },
  listItemCodeSelected: { color: NICO.primary },
  listCheck:            { fontSize: FONT_SIZE.lg, color: NICO.primary, fontWeight: FONT_WEIGHT.bold },
  listDivider:          { height: 1, backgroundColor: NICO.border, marginHorizontal: SPACING.lg },

  emptyTags:     { padding: SPACING['3xl'], alignItems: 'center' },
  emptyTagsText: { fontSize: FONT_SIZE.lg, color: NICO.textMuted },

  helperBox: {
    backgroundColor: NICO.primaryLight, borderRadius: RADIUS.md,
    padding: SPACING.md, marginBottom: SPACING.md,
    borderLeftWidth: 3, borderLeftColor: NICO.primary,
  },
  helperTitle: { fontSize: FONT_SIZE.base, fontWeight: FONT_WEIGHT.bold, color: NICO.text, marginBottom: 5 },
  helperText:  { fontSize: FONT_SIZE.md, color: NICO.text, fontWeight: FONT_WEIGHT.semiBold, lineHeight: 20 },
});
