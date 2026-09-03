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
import { saveBiometricUser } from '../../lib/biometricStore';
import { COLORS, COMPREHENSION_LEVELS, GENDERS, LANGUAGES, US_STATES } from '../../constants';
import DropdownPicker from '../../components/DropdownPicker';
import { Category } from '../../types';
import MultiSelectChips from '../../components/MultiSelectChips';
import MultiSelectDropdown from '../../components/MultiSelectDropdown';
import { GuardianNavParamList } from '../../navigation';

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
    const fabricatedEmail = `${trimmedUsername}@bloom.app`;
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

    // Auto-save credentials so learner tile is biometric-ready immediately
    await saveBiometricUser({
      id: userId,
      name,
      photo_url: photo_url ?? null,
      email: fabricatedEmail,
      password: generatedPassword,
    });

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
        {step === 'social' && (
          <View>
            <AppText style={styles.sectionTitle}>Social Profile</AppText>

            <TouchableOpacity style={styles.photoPicker} onPress={pickPhoto}>
              {photoUri
                ? <Image source={{ uri: photoUri }} style={styles.photo} />
                : <AppText style={styles.photoText}>Tap to add photo</AppText>
              }
            </TouchableOpacity>

            <Field label="Name *" value={name} onChangeText={setName} placeholder="First name" />
            <AppText style={styles.label}>Date of Birth<AppText style={styles.required}> *</AppText></AppText>
            <TouchableOpacity
              style={styles.pickerBtn}
              onPress={() => { setTempDob(dob ?? new Date(2005, 0, 1)); setShowDobPicker(true); }}
              activeOpacity={0.75}
            >
              <AppText style={[styles.pickerBtnTxt, !dob && { color: COLORS.textLight }]}>
                {dob ? dob.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' }) : 'Select date of birth…'}
              </AppText>
              <AppText style={{ fontSize: 18 }}>📅</AppText>
            </TouchableOpacity>

            <AppText style={styles.label}>Gender<AppText style={styles.required}> *</AppText></AppText>
            <MultiSelectChips options={GENDERS.filter(g => g !== 'Prefer not to say')} selected={gender ? [gender] : []} onToggle={(v) => setGender(v[0] || '')} single />

            <AppText style={styles.label}>Username<AppText style={styles.required}> *</AppText></AppText>
            <AppText style={styles.usernameHint}>Select a username. Learner will set up biometrics when they first sign in on their device.</AppText>
            <TextInput
              style={[styles.input, usernameError ? styles.inputError : null]}
              value={username}
              onChangeText={handleUsernameChange}
              onBlur={() => { if (usernameTimer.current) clearTimeout(usernameTimer.current); checkUsernameAvailable(username); }}
              placeholder="e.g. alex123"
              autoCapitalize="none"
              autoCorrect={false}
              placeholderTextColor={COLORS.textLight}
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
            <AppText style={styles.sectionSubtitle}>Where is this person based?</AppText>

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
                ⚠️  This information will <AppText style={styles.disclaimerBold}>not</AppText> be displayed on the learner's profile. It will only be used for finding compatible friends.{'\n\n'}
                If you do not find your learner's medical condition in the list, please contact the admin at{' '}
                <AppText style={styles.disclaimerEmail}>reyaansh.bansal@gmail.com</AppText>
                . The admin will add it and let you know when it is available in this dropdown.
              </AppText>
            </View>
          </View>
        )}

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
            {loading ? <ActivityIndicator color="#fff" /> : <AppText style={styles.nextBtnText}>Create Profile</AppText>}
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
      <TextInput style={styles.input} placeholderTextColor={COLORS.textLight} {...props} />
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
  container: { flex: 1, backgroundColor: COLORS.background },
  scroll: { flex: 1 },
  stepRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14 },
  stepIndicator: { flex: 1, flexDirection: 'row', justifyContent: 'center', gap: 8 },
  cancelLink: { fontSize: 14, color: COLORS.textLight, fontWeight: '500' },
  stepDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: COLORS.border },
  stepDotActive: { backgroundColor: COLORS.primary },
  inner: { padding: 24, paddingBottom: 48 },
  sectionTitle: { fontSize: 24, fontWeight: '700', color: COLORS.text, marginBottom: 4 },
  sectionSubtitle: { fontSize: 14, color: COLORS.textLight, marginBottom: 20 },
  photoPicker: {
    width: 100, height: 100, borderRadius: 50,
    backgroundColor: COLORS.primaryLight,
    justifyContent: 'center', alignItems: 'center',
    alignSelf: 'center', marginBottom: 24,
  },
  photo: { width: 100, height: 100, borderRadius: 50 },
  photoText: { color: COLORS.primary, fontSize: 13, textAlign: 'center' },
  label: { fontSize: 14, fontWeight: '600', color: COLORS.text, marginBottom: 8, marginTop: 16 },
  required: { color: COLORS.error, fontWeight: '700' },
  usernameHint: { fontSize: 13, color: COLORS.textLight, lineHeight: 18, marginBottom: 8 },
  input: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    color: COLORS.text,
    marginBottom: 4,
  },
  inputError: { borderColor: COLORS.error },
  errorText: { fontSize: 13, color: COLORS.error, marginTop: 2, marginBottom: 4 },
  checkingText: { fontSize: 13, color: COLORS.textLight, marginTop: 2, marginBottom: 4 },
  availableText: { fontSize: 13, color: COLORS.success, marginTop: 2, marginBottom: 4 },
  toggleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12 },
  toggleLabel: { fontSize: 16, color: COLORS.text },
  toggle: { width: 52, height: 30, borderRadius: 15, backgroundColor: COLORS.border, justifyContent: 'center', padding: 2 },
  toggleOn: { backgroundColor: COLORS.primary },
  toggleThumb: { width: 26, height: 26, borderRadius: 13, backgroundColor: '#fff' },
  toggleThumbOn: { alignSelf: 'flex-end' },
  navRow: { flexDirection: 'row', gap: 12, padding: 16, paddingBottom: 32, backgroundColor: COLORS.background, borderTopWidth: 1, borderTopColor: COLORS.border },
  charCount: { fontSize: 12, color: COLORS.textLight, textAlign: 'right', marginTop: 4 },
  emptyHint: { color: COLORS.textLight, fontSize: 14, marginTop: 16, textAlign: 'center' },
  backBtn: { flex: 1, padding: 16, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border, alignItems: 'center' },
  backBtnText: { color: COLORS.text, fontSize: 16, fontWeight: '600' },
  nextBtn: { flex: 2, backgroundColor: COLORS.primary, borderRadius: 12, padding: 16, alignItems: 'center' },
  nextBtnText: { color: COLORS.bloomOnAccent, fontSize: 16, fontWeight: '600' },

  disclaimer: {
    marginTop: 20, backgroundColor: '#FFF8E1', borderRadius: 12,
    borderWidth: 1.5, borderColor: '#F6C90E', padding: 16,
  },
  disclaimerText: { fontSize: 13, color: '#6D5700', lineHeight: 20 },
  disclaimerBold: { fontWeight: '800' },
  disclaimerEmail: { fontWeight: '700', color: COLORS.primary },

  pickerBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border,
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 14, marginBottom: 4,
  },
  pickerBtnTxt: { fontSize: 16, color: COLORS.text, flex: 1 },
  sheetBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingBottom: 32 },
  sheetHdr: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  sheetTitle:  { fontSize: 16, fontWeight: '800', color: COLORS.text },
  sheetCancel: { fontSize: 15, color: COLORS.textLight },
  sheetDone:   { fontSize: 15, fontWeight: '700', color: COLORS.primary },
});
