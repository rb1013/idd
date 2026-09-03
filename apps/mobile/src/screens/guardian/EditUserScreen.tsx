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
import { COLORS, COMPREHENSION_LEVELS, GENDERS, LANGUAGES, US_STATES } from '../../constants';
import DropdownPicker from '../../components/DropdownPicker';
import type { Category } from '../../types';
import MultiSelectChips from '../../components/MultiSelectChips';
import MultiSelectDropdown from '../../components/MultiSelectDropdown';
import { GuardianNavParamList } from '../../navigation';

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
  const [region, setRegion] = useState('');
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
      setRegion(p.region || '');
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
    if (!name || !dob || !gender || !city || !region) { Alert.alert('Please fill in all required fields'); return; }
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
    return <View style={styles.center}><ActivityIndicator size="large" color={COLORS.bloomAccent} /></View>;
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
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
              {photoSource
                ? <Image source={{ uri: photoSource }} style={styles.photo} />
                : <AppText style={styles.photoText}>Tap to add photo</AppText>
              }
            </TouchableOpacity>
            <Field label="Name *" value={name} onChangeText={setName} placeholder="First name" />
            <AppText style={styles.label}>Date of Birth *</AppText>
            <TouchableOpacity
              style={styles.pickerBtn}
              onPress={() => { setTempDob(dob ?? new Date(2005, 0, 1)); setShowDobPicker(true); }}
              activeOpacity={0.75}
            >
              <AppText style={[styles.pickerBtnTxt, !dob && { color: COLORS.bloomMuted }]}>
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
            <AppText style={styles.sectionSubtitle}>Where is this person based?</AppText>
            <DropdownPicker label="Country" value={country} options={['USA']} onSelect={setCountry} disabled />
            <DropdownPicker label="State *" value={region} options={US_STATES} onSelect={setRegion} placeholder="Select state..." />
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
          <TouchableOpacity style={styles.nextBtn} onPress={handleSave} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : <AppText style={styles.nextBtnText}>Save Changes</AppText>}
          </TouchableOpacity>
        )}
      </View>

      {guardian && step === 'social' && (
        <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete} disabled={loading}>
          <AppText style={styles.deleteBtnText}>🗑 Delete Profile</AppText>
        </TouchableOpacity>
      )}

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
      <TextInput style={styles.input} placeholderTextColor={COLORS.bloomMuted} {...props} />
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
  container: { flex: 1, backgroundColor: COLORS.bloomBody },
  scroll: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.bloomBody },
  stepRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 14,
  },
  stepIndicator: { flex: 1, flexDirection: 'row', justifyContent: 'center', gap: 8 },
  stepDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: COLORS.bloomBorder },
  stepDotActive: { backgroundColor: COLORS.bloomAccent },
  cancelLink: { fontSize: 14, color: COLORS.bloomMuted, fontWeight: '500' },
  inner: { padding: 24, paddingBottom: 48 },
  sectionTitle: { fontSize: 24, fontWeight: '700', color: COLORS.bloomText, marginBottom: 4 },
  sectionSubtitle: { fontSize: 14, color: COLORS.bloomMuted, marginBottom: 20 },
  photoPicker: {
    width: 100, height: 100, borderRadius: 50,
    backgroundColor: COLORS.bloomActiveBg,
    justifyContent: 'center', alignItems: 'center',
    alignSelf: 'center', marginBottom: 24,
  },
  photo: { width: 100, height: 100, borderRadius: 50 },
  photoText: { color: COLORS.bloomAccent, fontSize: 13, textAlign: 'center' },
  label: { fontSize: 14, fontWeight: '600', color: COLORS.bloomText, marginBottom: 8, marginTop: 16 },
  input: {
    backgroundColor: COLORS.bloomCard, borderWidth: 1, borderColor: COLORS.bloomBorder,
    borderRadius: 12, padding: 14, fontSize: 16, color: COLORS.bloomText, marginBottom: 4,
  },
  toggleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12 },
  toggleLabel: { fontSize: 16, color: COLORS.bloomText },
  toggle: { width: 52, height: 30, borderRadius: 15, backgroundColor: COLORS.bloomBorder, justifyContent: 'center', padding: 2 },
  toggleOn: { backgroundColor: COLORS.bloomAccent },
  toggleThumb: { width: 26, height: 26, borderRadius: 13, backgroundColor: '#fff' },
  toggleThumbOn: { alignSelf: 'flex-end' },
  navRow: { flexDirection: 'row', gap: 12, padding: 16, paddingBottom: 32, backgroundColor: COLORS.bloomBody, borderTopWidth: 1, borderTopColor: COLORS.bloomBorder },
  charCount: { fontSize: 12, color: COLORS.bloomMuted, textAlign: 'right', marginTop: 4 },
  emptyHint: { color: COLORS.bloomMuted, fontSize: 14, marginTop: 16, textAlign: 'center' },
  backBtn: { flex: 1, padding: 16, borderRadius: 12, borderWidth: 1, borderColor: COLORS.bloomBorder, alignItems: 'center' },
  backBtnText: { color: COLORS.bloomText, fontSize: 16, fontWeight: '600' },
  nextBtn: { flex: 2, backgroundColor: COLORS.bloomAccent, borderRadius: 12, padding: 16, alignItems: 'center' },
  nextBtnText: { color: COLORS.bloomOnAccent, fontSize: 16, fontWeight: '600' },
  readonlyField: {
    backgroundColor: COLORS.bloomBorder + '60',
    borderWidth: 1,
    borderColor: COLORS.bloomBorder,
    borderRadius: 12,
    padding: 14,
    marginBottom: 4,
  },
  readonlyText: { fontSize: 16, color: COLORS.bloomMuted },

  deleteBtn: {
    alignSelf: 'center', marginBottom: 32, paddingVertical: 10,
    paddingHorizontal: 24, borderRadius: 12,
    borderWidth: 1.5, borderColor: '#FCA5A5',
  },
  deleteBtnText: { color: COLORS.statusRedDark, fontSize: 15, fontWeight: '600' },

  disclaimer: {
    marginTop: 20, backgroundColor: '#FFF8E1', borderRadius: 12,
    borderWidth: 1.5, borderColor: '#F6C90E', padding: 16,
  },
  disclaimerText: { fontSize: 13, color: '#6D5700', lineHeight: 20 },
  disclaimerBold: { fontWeight: '800' },
  disclaimerEmail: { fontWeight: '700', color: COLORS.bloomAccent },

  pickerBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: COLORS.bloomCard, borderWidth: 1, borderColor: COLORS.bloomBorder,
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 14, marginBottom: 4,
  },
  pickerBtnTxt: { fontSize: 16, color: COLORS.bloomText, flex: 1 },
  sheetBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: COLORS.bloomCard, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingBottom: 32 },
  sheetHdr: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: COLORS.bloomBorder,
  },
  sheetTitle:  { fontSize: 16, fontWeight: '800', color: COLORS.bloomText },
  sheetCancel: { fontSize: 15, color: COLORS.bloomMuted },
  sheetDone:   { fontSize: 15, fontWeight: '700', color: COLORS.bloomAccent },
});
