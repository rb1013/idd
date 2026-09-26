import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, Alert, ActivityIndicator, Image, KeyboardAvoidingView, Platform, Modal,
} from 'react-native';
import AppText from '../../components/AppText';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { decode } from 'base64-arraybuffer';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/AuthContext';
import { saveBiometricUser, saveCredentialSnapshot } from '../../lib/biometricStore';
import { COMPREHENSION_LEVELS, GENDERS, LANGUAGES, US_STATES } from '../../constants';
import DropdownPicker from '../../components/DropdownPicker';
import { Category } from '../../types';
import MultiSelectChips from '../../components/MultiSelectChips';
import MultiSelectDropdown from '../../components/MultiSelectDropdown';
import ContentContainer from '../../components/ContentContainer';
import useNicoHeader from '../../hooks/useNicoHeader';
import { GuardianNavParamList } from '../../navigation';
import {
  NICO, TEXT_STYLE, SPACING, RADIUS, SHADOW, FONT_SIZE, FONT_WEIGHT,
  BTN_VARIANT, scale,
} from '../../constants/theme';

type Props = { navigation: NativeStackNavigationProp<GuardianNavParamList, 'CreateUser'> };

type Step = 'social' | 'interests' | 'location' | 'health';

function generatePassword(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  return Array.from({ length: 20 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

export default function CreateUserScreen({ navigation }: Props) {
  const { guardian } = useAuth();
  const [step, setStep] = useState<Step>('social');
  const [loading, setLoading] = useState(false);

  useNicoHeader(navigation);

  useLayoutEffect(() => {
    navigation.setOptions({ headerRight: undefined });
  }, [navigation]);

  // Social profile
  const [name, setName] = useState('');
  const [dob, setDob] = useState<Date | null>(null);
  const [showDobPicker, setShowDobPicker] = useState(false);
  const [tempDob, setTempDob] = useState(new Date());
  const [gender, setGender] = useState('');
  const [username, setUsername] = useState('');
  const [usernameError, setUsernameError] = useState('');
  const [checkingUsername, setCheckingUsername] = useState(false);
  const usernameTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [languages, setLanguages] = useState<string[]>([]);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [city, setCity] = useState('');
  const [region, setRegion] = useState('');
  const [country, setCountry] = useState('USA');
  const [selectedLikes, setSelectedLikes] = useState<string[]>([]);
  const [selectedDislikes, setSelectedDislikes] = useState<string[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);

  // Professional
  const [selectedAbilities, setSelectedAbilities] = useState<string[]>([]);
  const [comprehension, setComprehension] = useState('easy');

  // Medical conditions
  const [medicalConditionOptions, setMedicalConditionOptions] = useState<{ id: string; label: string }[]>([]);
  const [selectedMedicalConditions, setSelectedMedicalConditions] = useState<string[]>([]);

  useEffect(() => {
    Promise.all([
      supabase.from('categories').select('*'),
      supabase.from('medical_conditions').select('id, label').order('label'),
    ]).then(([catsRes, medRes]) => {
      setCategories(catsRes.data || []);
      setMedicalConditionOptions(medRes.data || []);
    });
  }, []);

  const likeCategories = categories.filter(c => c.type === 'like');
  const dislikeCategories = categories.filter(c => c.type === 'dislike');
  const abilityCategories = categories.filter(c => c.type === 'ability');

  async function checkUsernameAvailable(val: string): Promise<boolean> {
    const trimmed = val.trim().toLowerCase();
    if (!trimmed) { setUsernameError(''); setCheckingUsername(false); return false; }
    setCheckingUsername(true);
    const { data } = await supabase.from('user_profiles').select('id').eq('username', trimmed).limit(1);
    setCheckingUsername(false);
    const taken = !!(data && data.length > 0);
    if (taken) setUsernameError('Username already taken');
    else setUsernameError('');
    return !taken;
  }

  function handleUsernameChange(val: string) {
    setUsername(val);
    setUsernameError('');
    if (usernameTimer.current) clearTimeout(usernameTimer.current);
    if (val.trim()) {
      usernameTimer.current = setTimeout(() => checkUsernameAvailable(val), 600);
    } else {
      setCheckingUsername(false);
    }
  }

  async function pickPhoto() {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.7 });
    if (!result.canceled) setPhotoUri(result.assets[0].uri);
  }

  async function handleSubmit() {
    if (!name || !dob || !gender || !city || !region) { Alert.alert('Please fill in all required fields'); return; }
    if (!username.trim()) { Alert.alert('Please enter a username'); return; }

    // Always do a fresh check at submit time in case the debounce hasn't fired yet
    const available = await checkUsernameAvailable(username);
    if (!available) { Alert.alert('Username not available', 'Please choose a different username.'); return; }

    setLoading(true);

    let photo_url: string | null = null;
    if (photoUri) {
      const ext = (photoUri.split('.').pop() || 'jpg').toLowerCase();
      const fileName = `${guardian!.id}-${Date.now()}.${ext}`;
      const base64 = await FileSystem.readAsStringAsync(photoUri, { encoding: FileSystem.EncodingType.Base64 });
      const arrayBuffer = decode(base64);
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, arrayBuffer, { contentType: `image/${ext}`, upsert: true });
      if (uploadError) Alert.alert('Photo upload failed', uploadError.message);
      else if (uploadData) {
        const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(fileName);
        photo_url = publicUrl;
      }
    }

    const trimmedUsername = username.trim().toLowerCase();
    const fabricatedEmail = `${trimmedUsername}@nico.app`;
    const generatedPassword = generatePassword();

    const { data: userProfile, error } = await supabase.from('user_profiles').insert({
      guardian_id: guardian!.id,
      name, date_of_birth: formatDobForDb(dob!), gender, languages, photo_url, city, region, country,
      username: trimmedUsername,
    }).select().single();

    if (error) { Alert.alert('Error creating profile', error.message); setLoading(false); return; }

    const userId = userProfile.id;

    const likeIds = selectedLikes.map(n => likeCategories.find(c => c.name === n)?.id).filter(Boolean) as string[];
    const dislikeIds = selectedDislikes.map(n => dislikeCategories.find(c => c.name === n)?.id).filter(Boolean) as string[];
    const abilityIds = selectedAbilities.map(n => abilityCategories.find(c => c.name === n)?.id).filter(Boolean) as string[];

    const likesRows = likeIds.map(id => ({ user_id: userId, category_id: id }));
    const dislikesRows = dislikeIds.map(id => ({ user_id: userId, category_id: id }));
    const abilitiesRows = abilityIds.map(id => ({ user_id: userId, category_id: id }));

    const medCondIds = selectedMedicalConditions
      .map(label => medicalConditionOptions.find(c => c.label === label)?.id)
      .filter(Boolean) as string[];

    const [, , , chatResult] = await Promise.all([
      likesRows.length && supabase.from('user_likes').insert(likesRows),
      dislikesRows.length && supabase.from('user_dislikes').insert(dislikesRows),
      abilitiesRows.length && supabase.from('user_abilities').insert(abilitiesRows),
      supabase.from('chat_preferences').insert({
        user_id: userId,
        open_to_online_chat: true,
        open_to_zoom: false,
        open_to_voice_chat: false,
        available_days: [],
        comprehension_level: comprehension,
      }),
      supabase.from('health_info').insert({ user_id: userId, willing_to_share: false, description: null }),
    ]);

    if (medCondIds.length) {
      await supabase.from('user_medical_conditions').insert(
        medCondIds.map(id => ({ user_id: userId, medical_condition_id: id }))
      );
    }

    if (chatResult && 'error' in chatResult && chatResult.error) {
      Alert.alert('Chat prefs error', chatResult.error.message);
    }

    const { data: { session } } = await supabase.auth.getSession();
    const { error: fnError } = await supabase.functions.invoke('create-user-account', {
      body: { email: fabricatedEmail, password: generatedPassword, profile_id: userId },
      headers: { Authorization: `Bearer ${session?.access_token}` },
    });
    if (fnError) {
      let detail = fnError.message;
      try { detail = (fnError as any).context ? await (fnError as any).context.json().then((b: any) => b.error) : fnError.message; } catch {}
      Alert.alert('Account setup failed', detail);
      setLoading(false);
      return;
    }

    // Auto-save credentials locally and to Supabase for cross-device sync
    await saveBiometricUser({
      id: userId,
      name,
      photo_url: photo_url ?? null,
      email: fabricatedEmail,
      password: generatedPassword,
    });
    await saveCredentialSnapshot(userId, fabricatedEmail, generatedPassword);

    setLoading(false);
    navigation.goBack();
  }

  const steps: Step[] = ['social', 'interests', 'location', 'health'];
  const stepIndex = steps.indexOf(step);

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {/* Step indicator + Cancel */}
      <View style={styles.stepRow}>
        <View style={styles.stepIndicator}>
          {steps.map((s, i) => (
            <TouchableOpacity key={s} onPress={() => i < stepIndex && setStep(steps[i])}>
              <View style={[styles.stepDot, i <= stepIndex && styles.stepDotActive]} />
            </TouchableOpacity>
          ))}
        </View>
        <TouchableOpacity onPress={() => navigation.goBack()} activeOpacity={0.6} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <AppText style={styles.cancelLink}>Cancel</AppText>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.inner} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <ContentContainer>
        {step === 'social' && (
          <View>
            <AppText style={styles.sectionTitle}>Social Profile</AppText>

            <TouchableOpacity style={styles.photoPicker} onPress={pickPhoto}>
              {photoUri
                ? <Image source={{ uri: photoUri }} style={styles.photo} />
                : <AppText style={styles.photoText}>Tap to add photo</AppText>
              }
            </TouchableOpacity>

            <Field label="Name *" value={name} onChangeText={setName} placeholder="First name" maxLength={20} />
            <AppText style={styles.label}>Date of Birth<AppText style={styles.required}> *</AppText></AppText>
            <TouchableOpacity
              style={styles.pickerBtn}
              onPress={() => { setTempDob(dob ?? new Date(2005, 0, 1)); setShowDobPicker(true); }}
              activeOpacity={0.75}
            >
              <AppText style={[styles.pickerBtnTxt, !dob && { color: NICO.textMuted }]}>
                {dob ? dob.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' }) : 'Select date of birth…'}
              </AppText>
              <AppText style={{ fontSize: 18 }}>📅</AppText>
            </TouchableOpacity>

            <AppText style={styles.label}>Gender<AppText style={styles.required}> *</AppText></AppText>
            <MultiSelectChips options={GENDERS.filter(g => g !== 'Prefer not to say')} selected={gender ? [gender] : []} onToggle={(v) => setGender(v[0] || '')} single />

            <AppText style={styles.label}>Username<AppText style={styles.required}> *</AppText></AppText>
            <TextInput
              style={[styles.input, usernameError ? styles.inputError : null]}
              value={username}
              onChangeText={handleUsernameChange}
              onBlur={() => { if (usernameTimer.current) clearTimeout(usernameTimer.current); checkUsernameAvailable(username); }}
              placeholder="e.g. alex123"
              autoCapitalize="none"
              autoCorrect={false}
              placeholderTextColor={NICO.textMuted}
            />
            {checkingUsername && <AppText style={styles.checkingText}>Checking availability...</AppText>}
            {!checkingUsername && usernameError ? <AppText style={styles.errorText}>{usernameError}</AppText> : null}
            {!checkingUsername && !usernameError && username.trim() ? <AppText style={styles.availableText}>Username available</AppText> : null}
          </View>
        )}

        {step === 'interests' && (
          <View>
            <AppText style={styles.sectionTitle}>More about Learner</AppText>
            <AppText style={styles.sectionSubtitle}>Tell us more about this person</AppText>

            {likeCategories.length === 0
              ? <AppText style={styles.emptyHint}>Loading categories...</AppText>
              : <>
                  <MultiSelectDropdown
                    label="Likes"
                    options={likeCategories.map(c => c.name)}
                    selected={selectedLikes}
                    onToggle={setSelectedLikes}
                    placeholder="Tap to select likes..."
                  />
                  <MultiSelectDropdown
                    label="Dislikes"
                    options={dislikeCategories.map(c => c.name)}
                    selected={selectedDislikes}
                    onToggle={setSelectedDislikes}
                    placeholder="Tap to select dislikes..."
                  />
                  <MultiSelectDropdown
                    label="What Can I Do?"
                    options={abilityCategories.map(c => c.name)}
                    selected={selectedAbilities}
                    onToggle={setSelectedAbilities}
                    placeholder="Tap to select abilities..."
                  />
                </>
            }

            <MultiSelectDropdown
              label="Languages"
              options={LANGUAGES}
              selected={languages}
              onToggle={setLanguages}
              placeholder="Tap to select languages..."
            />

            <DropdownPicker
              label="Comprehension Level"
              value={COMPREHENSION_LEVELS.find(c => c.value === comprehension)?.label ?? 'Easy'}
              options={COMPREHENSION_LEVELS.map(c => c.label)}
              onSelect={(v) => setComprehension(COMPREHENSION_LEVELS.find(c => c.label === v)?.value ?? 'easy')}
            />
          </View>
        )}

        {step === 'location' && (
          <View>
            <AppText style={styles.sectionTitle}>Location</AppText>

            <DropdownPicker
              label="Country"
              value={country}
              options={['USA']}
              onSelect={setCountry}
              disabled
            />

            <DropdownPicker
              label="State *"
              value={region}
              options={US_STATES}
              onSelect={setRegion}
              placeholder="Select state..."
            />

            <Field label="City *" value={city} onChangeText={setCity} placeholder="e.g. Austin" />
          </View>
        )}

        {step === 'health' && (
          <View>
            <AppText style={styles.sectionTitle}>Medical Condition</AppText>
            <AppText style={styles.sectionSubtitle}>Select all that apply to this learner</AppText>

            {medicalConditionOptions.length === 0 ? (
              <AppText style={styles.emptyHint}>No medical conditions have been added by the admin yet.</AppText>
            ) : (
              <MultiSelectDropdown
                label="Select conditions"
                options={medicalConditionOptions.map(c => c.label)}
                selected={selectedMedicalConditions}
                onToggle={setSelectedMedicalConditions}
                placeholder="Tap to select..."
              />
            )}

            <View style={styles.disclaimer}>
              <AppText style={styles.disclaimerText}>
                ⚠️  This information will <AppText style={styles.disclaimerBold}>not</AppText> be displayed on the learner's profile. It will only be used by guardians to find compatible friends.{'\n\n'}
                If you do not find your learner's medical condition in the list, please contact the admin at{' '}
                <AppText style={styles.disclaimerEmail}>nicosupport@gmail.com</AppText>
                . The admin will add it and let you know when it is available in this dropdown.
              </AppText>
            </View>
          </View>
        )}
        </ContentContainer>
      </ScrollView>

      <View style={styles.navRow}>
        {stepIndex > 0 && (
          <TouchableOpacity style={styles.backBtn} onPress={() => setStep(steps[stepIndex - 1])}>
            <AppText style={styles.backBtnText}>Back</AppText>
          </TouchableOpacity>
        )}
        {stepIndex < steps.length - 1 ? (
          <TouchableOpacity style={styles.nextBtn} onPress={() => setStep(steps[stepIndex + 1])}>
            <AppText style={styles.nextBtnText}>Next</AppText>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.nextBtn} onPress={handleSubmit} disabled={loading}>
            {loading ? <ActivityIndicator color={NICO.textOnAccent} /> : <AppText style={styles.nextBtnText}>Create Profile</AppText>}
          </TouchableOpacity>
        )}
      </View>

      <Modal visible={showDobPicker} transparent animationType="slide" onRequestClose={() => setShowDobPicker(false)}>
        <TouchableOpacity style={styles.sheetBackdrop} activeOpacity={1} onPress={() => setShowDobPicker(false)}>
          <View style={styles.sheet} onStartShouldSetResponder={() => true}>
            <View style={styles.sheetHdr}>
              <TouchableOpacity onPress={() => setShowDobPicker(false)}>
                <AppText style={styles.sheetCancel}>Cancel</AppText>
              </TouchableOpacity>
              <AppText style={styles.sheetTitle}>Date of Birth</AppText>
              <TouchableOpacity onPress={() => { setDob(tempDob); setShowDobPicker(false); }}>
                <AppText style={styles.sheetDone}>Done</AppText>
              </TouchableOpacity>
            </View>
            <DateTimePicker
              value={tempDob}
              mode="date"
              display="spinner"
              maximumDate={new Date()}
              onChange={(_, d) => { if (d) setTempDob(d); }}
              style={{ height: 220 }}
            />
          </View>
        </TouchableOpacity>
      </Modal>
    </KeyboardAvoidingView>
  );
}

function formatDobForDb(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

function Field({ label, ...props }: { label: string } & React.ComponentProps<typeof TextInput>) {
  const isRequired = label.endsWith(' *');
  const baseLabel = isRequired ? label.slice(0, -2) : label;
  return (
    <>
      <AppText style={styles.label}>
        {baseLabel}{isRequired && <AppText style={styles.required}> *</AppText>}
      </AppText>
      <TextInput style={styles.input} placeholderTextColor={NICO.textMuted} {...props} />
    </>
  );
}

function Toggle({ label, value, onToggle }: { label: string; value: boolean; onToggle: () => void }) {
  return (
    <TouchableOpacity style={styles.toggleRow} onPress={onToggle}>
      <AppText style={styles.toggleLabel}>{label}</AppText>
      <View style={[styles.toggle, value && styles.toggleOn]}>
        <View style={[styles.toggleThumb, value && styles.toggleThumbOn]} />
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: NICO.screenBg },
  scroll: { flex: 1 },
  stepRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md },
  stepIndicator: { flex: 1, flexDirection: 'row', justifyContent: 'center', gap: SPACING.sm },
  cancelLink: { fontSize: FONT_SIZE.md, color: NICO.textMuted, fontWeight: FONT_WEIGHT.medium },
  stepDot: { width: scale(10), height: scale(10), borderRadius: scale(5), backgroundColor: NICO.border },
  stepDotActive: { backgroundColor: NICO.primary },
  inner: { padding: SPACING.xl, paddingBottom: SPACING['3xl'] },
  sectionTitle: { ...TEXT_STYLE.sectionTitle, marginBottom: SPACING.xs },
  sectionSubtitle: { ...TEXT_STYLE.hint, marginBottom: SPACING.lg },
  photoPicker: {
    width: scale(100), height: scale(100), borderRadius: scale(50),
    backgroundColor: NICO.primaryLight,
    justifyContent: 'center', alignItems: 'center',
    alignSelf: 'center', marginBottom: SPACING.xl,
  },
  photo: { width: scale(100), height: scale(100), borderRadius: scale(50) },
  photoText: { color: NICO.primary, fontSize: FONT_SIZE.base, textAlign: 'center' },
  label: { ...TEXT_STYLE.fieldLabel, marginBottom: SPACING.sm, marginTop: SPACING.base },
  required: { color: NICO.error, fontWeight: FONT_WEIGHT.bold },
  usernameHint: { fontSize: FONT_SIZE.base, color: NICO.textMuted, lineHeight: 18, marginBottom: SPACING.sm },
  input: {
    backgroundColor: NICO.surface,
    borderWidth: 1.5,
    borderColor: NICO.border,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    fontSize: FONT_SIZE.lg,
    color: NICO.text,
    marginBottom: 4,
  },
  inputError: { borderColor: NICO.error },
  errorText: { fontSize: FONT_SIZE.base, color: NICO.error, marginTop: 2, marginBottom: 4 },
  checkingText: { fontSize: FONT_SIZE.base, color: NICO.textMuted, marginTop: 2, marginBottom: 4 },
  availableText: { fontSize: FONT_SIZE.base, color: NICO.success, marginTop: 2, marginBottom: 4 },
  toggleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: SPACING.md },
  toggleLabel: { ...TEXT_STYLE.body },
  toggle: { width: scale(52), height: scale(30), borderRadius: scale(15), backgroundColor: NICO.border, justifyContent: 'center', padding: 2 },
  toggleOn: { backgroundColor: NICO.primary },
  toggleThumb: { width: scale(26), height: scale(26), borderRadius: scale(13), backgroundColor: '#fff' },
  toggleThumbOn: { alignSelf: 'flex-end' },
  navRow: {
    flexDirection: 'row', gap: SPACING.md, padding: SPACING.base, paddingBottom: SPACING['2xl'],
    backgroundColor: NICO.screenBg, borderTopWidth: 1, borderTopColor: NICO.border,
  },
  charCount: { fontSize: FONT_SIZE.xs, color: NICO.textMuted, textAlign: 'right', marginTop: 4 },
  emptyHint: { ...TEXT_STYLE.hint, marginTop: SPACING.base, textAlign: 'center' },
  backBtn: {
    flex: 1, padding: SPACING.base, borderRadius: RADIUS.md,
    borderWidth: 1.5, borderColor: NICO.border, alignItems: 'center',
  },
  backBtnText: { ...TEXT_STYLE.bodyMedium },
  nextBtn: { flex: 2, ...BTN_VARIANT.primary, borderRadius: RADIUS.md, padding: SPACING.base, alignItems: 'center' },
  nextBtnText: { ...TEXT_STYLE.buttonPrimary },

  disclaimer: {
    marginTop: SPACING.lg, backgroundColor: NICO.warningLight, borderRadius: RADIUS.md,
    borderWidth: 1.5, borderColor: NICO.warning, padding: SPACING.base,
  },
  disclaimerText: { fontSize: FONT_SIZE.base, color: NICO.text, lineHeight: 20 },
  disclaimerBold: { fontWeight: FONT_WEIGHT.extraBold },
  disclaimerEmail: { fontWeight: FONT_WEIGHT.bold, color: NICO.primary },

  pickerBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: NICO.surface, borderWidth: 1.5, borderColor: NICO.border,
    borderRadius: RADIUS.md, paddingHorizontal: SPACING.md, paddingVertical: SPACING.md, marginBottom: 4,
  },
  pickerBtnTxt: { fontSize: FONT_SIZE.lg, color: NICO.text, flex: 1 },
  sheetBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: NICO.surface, borderTopLeftRadius: RADIUS['3xl'], borderTopRightRadius: RADIUS['3xl'], paddingBottom: SPACING.xl },
  sheetHdr: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg, paddingVertical: SPACING.base, borderBottomWidth: 1, borderBottomColor: NICO.border,
  },
  sheetTitle:  { fontSize: FONT_SIZE.xl, fontWeight: FONT_WEIGHT.extraBold, color: NICO.text },
  sheetCancel: { fontSize: FONT_SIZE.lg, color: NICO.textMuted },
  sheetDone:   { fontSize: FONT_SIZE.lg, fontWeight: FONT_WEIGHT.bold, color: NICO.primary },
});
