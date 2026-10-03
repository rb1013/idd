import React, { useEffect, useLayoutEffect, useState } from 'react';
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
import { RouteProp } from '@react-navigation/native';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/AuthContext';
import { COMPREHENSION_LEVELS, GENDERS, LANGUAGES, FIXED_STATE } from '../../constants';
import DropdownPicker from '../../components/DropdownPicker';
import type { Category } from '../../types';
import MultiSelectChips from '../../components/MultiSelectChips';
import MultiSelectDropdown from '../../components/MultiSelectDropdown';
import ContentContainer from '../../components/ContentContainer';
import useNicoHeader from '../../hooks/useNicoHeader';
import { GuardianNavParamList } from '../../navigation';
import {
  NICO, TEXT_STYLE, SPACING, RADIUS, SHADOW, FONT_SIZE, FONT_WEIGHT,
  BTN_SIZE, BTN_VARIANT, scale,
} from '../../constants/theme';

type Props = {
  navigation: NativeStackNavigationProp<GuardianNavParamList, 'EditUser'>;
  route: RouteProp<GuardianNavParamList, 'EditUser'>;
};

type Step = 'social' | 'interests' | 'location' | 'health';
const GUARDIAN_STEPS: Step[] = ['social', 'interests', 'location', 'health'];
const USER_STEPS: Step[] = ['social', 'interests', 'location', 'health'];


export default function EditUserScreen({ navigation, route }: Props) {
  const { userId } = route.params;
  const { guardian } = useAuth();
  const [step, setStep] = useState<Step>('social');
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  const [name, setName] = useState('');
  const [dob, setDob] = useState<Date | null>(null);
  const [showDobPicker, setShowDobPicker] = useState(false);
  const [tempDob, setTempDob] = useState(new Date());
  const [gender, setGender] = useState('');
  const [username, setUsername] = useState('');
  const [languages, setLanguages] = useState<string[]>([]);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [existingPhotoUrl, setExistingPhotoUrl] = useState<string | null>(null);
  const [city, setCity] = useState('');
  const region = FIXED_STATE;
  const [country, setCountry] = useState('USA');
  const [selectedLikes, setSelectedLikes] = useState<string[]>([]);
  const [selectedDislikes, setSelectedDislikes] = useState<string[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedAbilities, setSelectedAbilities] = useState<string[]>([]);
  const [comprehension, setComprehension] = useState('easy');
  const [willingToShare, setWillingToShare] = useState(false);
  const [medicalConditionOptions, setMedicalConditionOptions] = useState<{ id: string; label: string }[]>([]);
  const [selectedMedicalConditions, setSelectedMedicalConditions] = useState<string[]>([]);

  const likeCategories = categories.filter(c => c.type === 'like');
  const dislikeCategories = categories.filter(c => c.type === 'dislike');
  const abilityCategories = categories.filter(c => c.type === 'ability');

  useNicoHeader(navigation);

  useLayoutEffect(() => {
    navigation.setOptions({ headerRight: undefined });
  }, [navigation]);

  useEffect(() => { loadAll(); }, []);


  async function loadAll() {
    const [profileRes, catsRes, likesRes, dislikesRes, abilitiesRes, healthRes, medConditionsRes, userMedCondRes, chatRes] = await Promise.all([
      supabase.from('user_profiles').select('*').eq('id', userId).single(),
      supabase.from('categories').select('*'),
      supabase.from('user_likes').select('categories(name)').eq('user_id', userId),
      supabase.from('user_dislikes').select('categories(name)').eq('user_id', userId),
      supabase.from('user_abilities').select('categories(name)').eq('user_id', userId),
      supabase.from('health_info').select('*').eq('user_id', userId).single(),
      supabase.from('medical_conditions').select('id, label').order('label'),
      supabase.from('user_medical_conditions').select('medical_conditions(label)').eq('user_id', userId),
      supabase.from('chat_preferences').select('comprehension_level').eq('user_id', userId).single(),
    ]);

    const p = profileRes.data;
    if (p) {
      setName(p.name);
      if (p.date_of_birth) setDob(new Date(p.date_of_birth + 'T12:00:00'));
      setGender(p.gender || '');
      setUsername(p.username || '');
      setLanguages(p.languages || []);
      setCity(p.city || '');
      setCountry(p.country || 'USA');
      setExistingPhotoUrl(p.photo_url || null);
      setComprehension(chatRes.data?.comprehension_level || 'easy');
    }

    if (catsRes.data) setCategories(catsRes.data);

    setSelectedLikes((likesRes.data || []).map((r: any) => r.categories?.name).filter(Boolean));
    setSelectedDislikes((dislikesRes.data || []).map((r: any) => r.categories?.name).filter(Boolean));
    setSelectedAbilities((abilitiesRes.data || []).map((r: any) => r.categories?.name).filter(Boolean));

    if (healthRes.data) {
      setWillingToShare(healthRes.data.willing_to_share ?? false);
    }

    setMedicalConditionOptions(medConditionsRes.data || []);
    setSelectedMedicalConditions(
      (userMedCondRes.data || []).map((r: any) => r.medical_conditions?.label).filter(Boolean)
    );

    setInitialLoading(false);
  }

  async function pickPhoto() {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.7 });
    if (!result.canceled) setPhotoUri(result.assets[0].uri);
  }

  async function handleSave() {
    if (!name || !dob || !gender || !city) { Alert.alert('Please fill in all required fields'); return; }
    setLoading(true);

    let photo_url = existingPhotoUrl;
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

    const { error } = await supabase.from('user_profiles').update({
      name, date_of_birth: dob ? formatDobForDb(dob) : null, gender, languages, photo_url, city, region, country,
    }).eq('id', userId);

    if (error) { Alert.alert('Error saving profile', error.message); setLoading(false); return; }

    const likeIds = selectedLikes.map(n => likeCategories.find(c => c.name === n)?.id).filter(Boolean) as string[];
    const dislikeIds = selectedDislikes.map(n => dislikeCategories.find(c => c.name === n)?.id).filter(Boolean) as string[];
    const abilityIds = selectedAbilities.map(n => abilityCategories.find(c => c.name === n)?.id).filter(Boolean) as string[];

    await Promise.all([
      supabase.from('user_likes').delete().eq('user_id', userId),
      supabase.from('user_dislikes').delete().eq('user_id', userId),
      supabase.from('user_abilities').delete().eq('user_id', userId),
      supabase.from('chat_preferences').upsert({ user_id: userId, comprehension_level: comprehension }, { onConflict: 'user_id' }),
    ]);

    const medCondIds = selectedMedicalConditions
      .map(label => medicalConditionOptions.find(c => c.label === label)?.id)
      .filter(Boolean) as string[];

    await Promise.all([
      likeIds.length && supabase.from('user_likes').insert(likeIds.map(id => ({ user_id: userId, category_id: id }))),
      dislikeIds.length && supabase.from('user_dislikes').insert(dislikeIds.map(id => ({ user_id: userId, category_id: id }))),
      abilityIds.length && supabase.from('user_abilities').insert(abilityIds.map(id => ({ user_id: userId, category_id: id }))),
      supabase.from('health_info').upsert({ user_id: userId, willing_to_share: willingToShare, description: null }),
      supabase.from('user_medical_conditions').delete().eq('user_id', userId),
    ]);

    if (medCondIds.length) {
      await supabase.from('user_medical_conditions').insert(
        medCondIds.map(id => ({ user_id: userId, medical_condition_id: id }))
      );
    }

    setLoading(false);
    navigation.goBack();
  }

  async function handleDelete() {
    Alert.alert(
      'Delete Profile',
      `Are you sure you want to permanently delete this profile? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete', style: 'destructive', onPress: async () => {
            setLoading(true);
            const { data: { session } } = await supabase.auth.getSession();
            const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
            const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;
            const res = await fetch(
              `${supabaseUrl}/functions/v1/delete-learner`,
              {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${session?.access_token}`,
                  'apikey': supabaseAnonKey,
                },
                body: JSON.stringify({ learner_id: userId }),
              }
            );
            const json = await res.json();
            setLoading(false);
            if (!res.ok) {
              Alert.alert('Error', json.error ?? 'Could not delete profile');
            } else {
              navigation.navigate('GuardianHome');
            }
          },
        },
      ]
    );
  }

  const steps = guardian ? GUARDIAN_STEPS : USER_STEPS;
  const stepIndex = steps.indexOf(step);
  const photoSource = photoUri || existingPhotoUrl;

  if (initialLoading) {
    return <View style={styles.center}><ActivityIndicator size="large" color={NICO.primary} /></View>;
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.stepRow}>
        <View style={styles.sideSlot}>
          {guardian ? (
            <TouchableOpacity onPress={handleDelete} disabled={loading} activeOpacity={0.6} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <AppText style={styles.deleteLink}>Delete</AppText>
            </TouchableOpacity>
          ) : (
            <AppText style={[styles.deleteLink, styles.hiddenLink]}>Delete</AppText>
          )}
        </View>
        <View style={styles.stepIndicator}>
          {steps.map((s, i) => (
            <TouchableOpacity key={s} onPress={() => i < stepIndex && setStep(steps[i])}>
              <View style={[styles.stepDot, i <= stepIndex && styles.stepDotActive]} />
            </TouchableOpacity>
          ))}
        </View>
        <View style={[styles.sideSlot, styles.sideSlotRight]}>
          <TouchableOpacity onPress={() => navigation.goBack()} activeOpacity={0.6} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <AppText style={styles.cancelLink}>Cancel</AppText>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.inner} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <ContentContainer>
        {step === 'social' && (
          <View>
            <AppText style={styles.sectionTitle}>Social Profile</AppText>
            <TouchableOpacity style={styles.photoPicker} onPress={pickPhoto}>
              {photoSource
                ? <Image source={{ uri: photoSource }} style={styles.photo} />
                : <AppText style={styles.photoText}>Tap to add photo</AppText>
              }
            </TouchableOpacity>
            <Field label="Name *" value={name} onChangeText={setName} placeholder="First name" maxLength={20} />
            <AppText style={styles.label}>Date of Birth *</AppText>
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
            <AppText style={styles.label}>Gender *</AppText>
            <MultiSelectChips options={GENDERS.filter(g => g !== 'Prefer not to say')} selected={gender ? [gender] : []} onToggle={(v) => setGender(v[0] || '')} single />
            <AppText style={styles.label}>Username</AppText>
            <View style={styles.readonlyField}>
              <AppText style={styles.readonlyText}>{username || '—'}</AppText>
            </View>
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
            <DropdownPicker label="Country" value={country} options={['USA']} onSelect={setCountry} disabled />
            <DropdownPicker label="State" value={region} options={[region]} onSelect={() => {}} disabled />
            <Field label="City *" value={city} onChangeText={setCity} placeholder="e.g. Austin" />
          </View>
        )}

        {step === 'health' && (
          <View>
            <AppText style={styles.sectionTitle}>Health Information</AppText>
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
                <AppText style={styles.disclaimerEmail}>nicosupport@gmail.com</AppText>
                . The admin will add it and let you know when it is available in this dropdown.
              </AppText>
            </View>
          </View>
        )}
        </ContentContainer>
      </ScrollView>

      <View style={styles.navRow}>
        <TouchableOpacity
          style={[styles.arrowBtn, stepIndex === 0 && styles.arrowBtnHidden]}
          onPress={() => stepIndex > 0 && setStep(steps[stepIndex - 1])}
          disabled={stepIndex === 0}
        >
          <AppText style={styles.arrowText}>‹</AppText>
        </TouchableOpacity>

        <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={loading}>
          {loading
            ? <ActivityIndicator color={NICO.textOnAccent} />
            : <AppText style={styles.saveBtnText}>Save</AppText>}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.arrowBtn, stepIndex === steps.length - 1 && styles.arrowBtnHidden]}
          onPress={() => stepIndex < steps.length - 1 && setStep(steps[stepIndex + 1])}
          disabled={stepIndex === steps.length - 1}
        >
          <AppText style={styles.arrowText}>›</AppText>
        </TouchableOpacity>
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
  return (
    <>
      <AppText style={styles.label}>{label}</AppText>
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
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: NICO.screenBg },
  stepRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md,
  },
  stepIndicator: { flex: 1, flexDirection: 'row', justifyContent: 'center', gap: SPACING.sm },
  sideSlot: { minWidth: scale(56) },
  sideSlotRight: { alignItems: 'flex-end' },
  hiddenLink: { opacity: 0 },
  stepDot: { width: scale(10), height: scale(10), borderRadius: scale(5), backgroundColor: NICO.border },
  stepDotActive: { backgroundColor: NICO.primary },
  cancelLink: { fontSize: FONT_SIZE.md, lineHeight: FONT_SIZE.md + 4, color: NICO.textMuted, fontWeight: FONT_WEIGHT.medium },
  deleteLink: { fontSize: FONT_SIZE.md, lineHeight: FONT_SIZE.md + 4, color: NICO.error, fontWeight: FONT_WEIGHT.semiBold },
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
  input: {
    backgroundColor: NICO.surface, borderWidth: 1.5, borderColor: NICO.border,
    borderRadius: RADIUS.md, padding: SPACING.md, fontSize: FONT_SIZE.lg, color: NICO.text, marginBottom: 4,
  },
  toggleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: SPACING.md },
  toggleLabel: { ...TEXT_STYLE.body },
  toggle: { width: scale(52), height: scale(30), borderRadius: scale(15), backgroundColor: NICO.border, justifyContent: 'center', padding: 2 },
  toggleOn: { backgroundColor: NICO.primary },
  toggleThumb: { width: scale(26), height: scale(26), borderRadius: scale(13), backgroundColor: '#fff' },
  toggleThumbOn: { alignSelf: 'flex-end' },
  navRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.base,
    padding: SPACING.base, paddingBottom: SPACING['2xl'],
    backgroundColor: NICO.screenBg, borderTopWidth: 1, borderTopColor: NICO.border,
  },
  charCount: { fontSize: FONT_SIZE.xs, color: NICO.textMuted, textAlign: 'right', marginTop: 4 },
  emptyHint: { ...TEXT_STYLE.hint, marginTop: SPACING.base, textAlign: 'center' },
  arrowBtn: {
    width: scale(48), height: scale(48), borderRadius: scale(24),
    borderWidth: 2, borderColor: NICO.primary, alignItems: 'center', justifyContent: 'center',
  },
  arrowBtnHidden: { opacity: 0 },
  arrowText: { fontSize: FONT_SIZE['4xl'], color: NICO.text, lineHeight: 32, fontWeight: FONT_WEIGHT.bold },
  saveBtn: { ...BTN_SIZE.lg, ...BTN_VARIANT.primary, paddingHorizontal: scale(40) },
  saveBtnText: { ...TEXT_STYLE.buttonPrimary },
  readonlyField: {
    backgroundColor: NICO.background,
    borderWidth: 1.5,
    borderColor: NICO.border,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginBottom: 4,
  },
  readonlyText: { ...TEXT_STYLE.body, color: NICO.textMuted },

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
