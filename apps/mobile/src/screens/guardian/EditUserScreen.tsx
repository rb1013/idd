import React, { useEffect, useLayoutEffect, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, Alert, ActivityIndicator, Image, KeyboardAvoidingView, Platform,
} from 'react-native';
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
import { GuardianNavParamList } from '../../navigation';

type Props = {
  navigation: NativeStackNavigationProp<GuardianNavParamList, 'EditUser'>;
  route: RouteProp<GuardianNavParamList, 'EditUser'>;
};

type Step = 'social' | 'interests' | 'location' | 'professional' | 'health';
const GUARDIAN_STEPS: Step[] = ['social', 'interests', 'location', 'professional', 'health'];
const USER_STEPS: Step[] = ['social', 'interests', 'location', 'professional', 'health'];


export default function EditUserScreen({ navigation, route }: Props) {
  const { userId } = route.params;
  const { guardian } = useAuth();
  const [step, setStep] = useState<Step>('social');
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  const [name, setName] = useState('');
  const [age, setAge] = useState('');
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
  const [healthDesc, setHealthDesc] = useState('');

  const likeCategories = categories.filter(c => c.type === 'like');
  const dislikeCategories = categories.filter(c => c.type === 'dislike');
  const abilityCategories = categories.filter(c => c.type === 'ability');

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ paddingHorizontal: 4 }}>
          <Text style={{ color: '#fff', fontSize: 16 }}>Cancel</Text>
        </TouchableOpacity>
      ),
    });
  }, [navigation]);

  useEffect(() => { loadAll(); }, []);


  async function loadAll() {
    const [profileRes, catsRes, likesRes, dislikesRes, abilitiesRes, healthRes] = await Promise.all([
      supabase.from('user_profiles').select('*').eq('id', userId).single(),
      supabase.from('categories').select('*'),
      supabase.from('user_likes').select('categories(name)').eq('user_id', userId),
      supabase.from('user_dislikes').select('categories(name)').eq('user_id', userId),
      supabase.from('user_abilities').select('categories(name)').eq('user_id', userId),
      supabase.from('health_info').select('*').eq('user_id', userId).single(),
    ]);

    const p = profileRes.data;
    if (p) {
      setName(p.name);
      setAge(String(p.age));
      setGender(p.gender || '');
      setUsername(p.username || '');
      setLanguages(p.languages || []);
      setCity(p.city || '');
      setRegion(p.region || '');
      setCountry(p.country || 'USA');
      setExistingPhotoUrl(p.photo_url || null);
      setComprehension(p.comprehension_level || 'easy');
    }

    if (catsRes.data) setCategories(catsRes.data);

    setSelectedLikes((likesRes.data || []).map((r: any) => r.categories?.name).filter(Boolean));
    setSelectedDislikes((dislikesRes.data || []).map((r: any) => r.categories?.name).filter(Boolean));
    setSelectedAbilities((abilitiesRes.data || []).map((r: any) => r.categories?.name).filter(Boolean));

    const health = healthRes.data;
    if (health) {
      setWillingToShare(health.willing_to_share ?? false);
      setHealthDesc(health.description || '');
    }

    setInitialLoading(false);
  }

  async function pickPhoto() {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.7 });
    if (!result.canceled) setPhotoUri(result.assets[0].uri);
  }

  async function handleSave() {
    if (!name || !age || !gender || !city || !region) { Alert.alert('Please fill in all required fields'); return; }
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
      name, age: parseInt(age), gender, languages, photo_url, city, region, country, comprehension_level: comprehension,
    }).eq('id', userId);

    if (error) { Alert.alert('Error saving profile', error.message); setLoading(false); return; }

    const likeIds = selectedLikes.map(n => likeCategories.find(c => c.name === n)?.id).filter(Boolean) as string[];
    const dislikeIds = selectedDislikes.map(n => dislikeCategories.find(c => c.name === n)?.id).filter(Boolean) as string[];
    const abilityIds = selectedAbilities.map(n => abilityCategories.find(c => c.name === n)?.id).filter(Boolean) as string[];

    await Promise.all([
      supabase.from('user_likes').delete().eq('user_id', userId),
      supabase.from('user_dislikes').delete().eq('user_id', userId),
      supabase.from('user_abilities').delete().eq('user_id', userId),
    ]);

    await Promise.all([
      likeIds.length && supabase.from('user_likes').insert(likeIds.map(id => ({ user_id: userId, category_id: id }))),
      dislikeIds.length && supabase.from('user_dislikes').insert(dislikeIds.map(id => ({ user_id: userId, category_id: id }))),
      abilityIds.length && supabase.from('user_abilities').insert(abilityIds.map(id => ({ user_id: userId, category_id: id }))),
      supabase.from('health_info').upsert({
        user_id: userId,
        willing_to_share: willingToShare,
        description: willingToShare ? healthDesc : null,
      }),
    ]);

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
      <View style={styles.stepIndicator}>
        {steps.map((s, i) => (
          <TouchableOpacity key={s} onPress={() => i < stepIndex && setStep(steps[i])}>
            <View style={[styles.stepDot, i <= stepIndex && styles.stepDotActive]} />
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.inner} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {step === 'social' && (
          <View>
            <Text style={styles.sectionTitle}>Social Profile</Text>
            <TouchableOpacity style={styles.photoPicker} onPress={pickPhoto}>
              {photoSource
                ? <Image source={{ uri: photoSource }} style={styles.photo} />
                : <Text style={styles.photoText}>Tap to add photo</Text>
              }
            </TouchableOpacity>
            <Field label="Name *" value={name} onChangeText={setName} placeholder="First name" />
            <Field label="Age *" value={age} onChangeText={setAge} placeholder="e.g. 18" keyboardType="numeric" />
            <Text style={styles.label}>Gender *</Text>
            <MultiSelectChips options={GENDERS} selected={gender ? [gender] : []} onToggle={(v) => setGender(v[0] || '')} single />
            <Text style={styles.label}>Username</Text>
            <View style={styles.readonlyField}>
              <Text style={styles.readonlyText}>{username || '—'}</Text>
            </View>
          </View>
        )}

        {step === 'interests' && (
          <View>
            <Text style={styles.sectionTitle}>Interests</Text>
            <Text style={styles.sectionSubtitle}>What does this person like and dislike?</Text>
            {likeCategories.length === 0
              ? <Text style={styles.emptyHint}>Loading categories...</Text>
              : <>
                  <Text style={styles.label}>Likes</Text>
                  <MultiSelectChips options={likeCategories.map(c => c.name)} selected={selectedLikes} onToggle={setSelectedLikes} max={4} />
                  <Text style={styles.label}>Dislikes</Text>
                  <MultiSelectChips options={dislikeCategories.map(c => c.name)} selected={selectedDislikes} onToggle={setSelectedDislikes} max={4} />
                </>
            }
          </View>
        )}

        {step === 'location' && (
          <View>
            <Text style={styles.sectionTitle}>Location</Text>
            <Text style={styles.sectionSubtitle}>Where is this person based?</Text>
            <DropdownPicker label="Country" value={country} options={['USA']} onSelect={setCountry} disabled />
            <DropdownPicker label="State *" value={region} options={US_STATES} onSelect={setRegion} placeholder="Select state..." />
            <Field label="City *" value={city} onChangeText={setCity} placeholder="e.g. Austin" />
          </View>
        )}

        {step === 'professional' && (
          <View>
            <Text style={styles.sectionTitle}>What Can I Do?</Text>
            <Text style={styles.sectionSubtitle}>Select all activities this person can do</Text>
            <MultiSelectChips options={abilityCategories.map(c => c.name)} selected={selectedAbilities} onToggle={setSelectedAbilities} />

            <Text style={styles.label}>Languages</Text>
            <MultiSelectChips options={LANGUAGES} selected={languages} onToggle={setLanguages} />

            <Text style={styles.label}>Comprehension Level</Text>
            <MultiSelectChips
              options={COMPREHENSION_LEVELS.map(c => c.label)}
              selected={[COMPREHENSION_LEVELS.find(c => c.value === comprehension)?.label ?? 'Easy']}
              onToggle={(v) => setComprehension(COMPREHENSION_LEVELS.find(c => c.label === v[0])?.value ?? 'easy')}
              single
            />
          </View>
        )}

        {step === 'health' && (
          <View>
            <Text style={styles.sectionTitle}>Health Information</Text>
            <Toggle label="Willing to share health info" value={willingToShare} onToggle={() => setWillingToShare(!willingToShare)} />
            {willingToShare && (
              <>
                <TextInput
                  style={[styles.input, { height: 120, textAlignVertical: 'top' }]}
                  placeholder="Brief description of health situation..."
                  value={healthDesc}
                  onChangeText={setHealthDesc}
                  multiline
                  maxLength={500}
                  placeholderTextColor={COLORS.bloomMuted}
                />
                <Text style={styles.charCount}>{healthDesc.length}/500</Text>
              </>
            )}
          </View>
        )}


      </ScrollView>

      <View style={styles.navRow}>
        {stepIndex > 0 && (
          <TouchableOpacity style={styles.backBtn} onPress={() => setStep(steps[stepIndex - 1])}>
            <Text style={styles.backBtnText}>Back</Text>
          </TouchableOpacity>
        )}
        {stepIndex < steps.length - 1 ? (
          <TouchableOpacity style={styles.nextBtn} onPress={() => setStep(steps[stepIndex + 1])}>
            <Text style={styles.nextBtnText}>Next</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.nextBtn} onPress={handleSave} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.nextBtnText}>Save Changes</Text>}
          </TouchableOpacity>
        )}
      </View>

      {guardian && step === 'social' && (
        <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete} disabled={loading}>
          <Text style={styles.deleteBtnText}>🗑 Delete Profile</Text>
        </TouchableOpacity>
      )}
    </KeyboardAvoidingView>
  );
}

function Field({ label, ...props }: { label: string } & React.ComponentProps<typeof TextInput>) {
  return (
    <>
      <Text style={styles.label}>{label}</Text>
      <TextInput style={styles.input} placeholderTextColor={COLORS.bloomMuted} {...props} />
    </>
  );
}

function Toggle({ label, value, onToggle }: { label: string; value: boolean; onToggle: () => void }) {
  return (
    <TouchableOpacity style={styles.toggleRow} onPress={onToggle}>
      <Text style={styles.toggleLabel}>{label}</Text>
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
  stepIndicator: { flexDirection: 'row', justifyContent: 'center', gap: 8, paddingVertical: 16 },
  stepDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: COLORS.bloomBorder },
  stepDotActive: { backgroundColor: COLORS.bloomAccent },
  inner: { padding: 24, paddingBottom: 48 },
  sectionTitle: { fontSize: 24, fontWeight: '700', color: COLORS.bloomText, marginBottom: 4 },
  sectionSubtitle: { fontSize: 14, color: COLORS.bloomMuted, marginBottom: 20 },
  photoPicker: {
    width: 100, height: 100, borderRadius: 50,
    backgroundColor: '#DAEAFF',
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
  nextBtn: { flex: 2, backgroundColor: COLORS.bloomNavy, borderRadius: 12, padding: 16, alignItems: 'center' },
  nextBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
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
  deleteBtnText: { color: '#DC2626', fontSize: 15, fontWeight: '600' },
});
