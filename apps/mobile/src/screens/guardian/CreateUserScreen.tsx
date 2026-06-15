import React, { useEffect, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, Alert, ActivityIndicator, Image, KeyboardAvoidingView, Platform,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { decode } from 'base64-arraybuffer';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/AuthContext';
import { COLORS, DAYS_OF_WEEK, COMPREHENSION_LEVELS, GENDERS, LANGUAGES, US_STATES } from '../../constants';
import DropdownPicker from '../../components/DropdownPicker';
import { Category } from '../../types';
import MultiSelectChips from '../../components/MultiSelectChips';
import { RootStackParamList } from '../../navigation';

type Props = { navigation: NativeStackNavigationProp<RootStackParamList, 'CreateUser'> };

type Step = 'social' | 'interests' | 'location' | 'professional' | 'chat' | 'health';

export default function CreateUserScreen({ navigation }: Props) {
  const { guardian } = useAuth();
  const [step, setStep] = useState<Step>('social');
  const [loading, setLoading] = useState(false);

  // Social profile
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState('');
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

  // Chat preferences
  const [openToChat, setOpenToChat] = useState(true);
  const [openToZoom, setOpenToZoom] = useState(false);
  const [openToVoice, setOpenToVoice] = useState(false);
  const [availableDays, setAvailableDays] = useState<string[]>([]);
  const [comprehension, setComprehension] = useState('easy');

  // Health
  const [willingToShare, setWillingToShare] = useState(false);
  const [healthDesc, setHealthDesc] = useState('');

  useEffect(() => {
    supabase.from('categories').select('*').then(({ data }) => setCategories(data || []));
  }, []);

  const likeCategories = categories.filter(c => c.type === 'like');
  const dislikeCategories = categories.filter(c => c.type === 'dislike');
  const abilityCategories = categories.filter(c => c.type === 'ability');

  async function pickPhoto() {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.7 });
    if (!result.canceled) setPhotoUri(result.assets[0].uri);
  }

  async function handleSubmit() {
    if (!name || !age || !gender || !city || !region) { Alert.alert('Please fill in all required fields'); return; }
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

    const { data: userProfile, error } = await supabase.from('user_profiles').insert({
      guardian_id: guardian!.id,
      name, age: parseInt(age), gender, languages, photo_url, city, region, country,
    }).select().single();

    if (error) { Alert.alert('Error creating profile', error.message); setLoading(false); return; }

    const userId = userProfile.id;

    // Map selected names back to category UUIDs
    const likeIds = selectedLikes.map(name => likeCategories.find(c => c.name === name)?.id).filter(Boolean) as string[];
    const dislikeIds = selectedDislikes.map(name => dislikeCategories.find(c => c.name === name)?.id).filter(Boolean) as string[];
    const abilityIds = selectedAbilities.map(name => abilityCategories.find(c => c.name === name)?.id).filter(Boolean) as string[];

    const likesRows = likeIds.map(id => ({ user_id: userId, category_id: id }));
    const dislikesRows = dislikeIds.map(id => ({ user_id: userId, category_id: id }));
    const abilitiesRows = abilityIds.map(id => ({ user_id: userId, category_id: id }));

    const [, , , chatResult, healthResult] = await Promise.all([
      likesRows.length && supabase.from('user_likes').insert(likesRows),
      dislikesRows.length && supabase.from('user_dislikes').insert(dislikesRows),
      abilitiesRows.length && supabase.from('user_abilities').insert(abilitiesRows),
      supabase.from('chat_preferences').insert({
        user_id: userId,
        open_to_online_chat: openToChat,
        open_to_zoom: openToZoom,
        open_to_voice_chat: openToVoice,
        available_days: availableDays,
        comprehension_level: comprehension,
      }),
      supabase.from('health_info').insert({
        user_id: userId,
        willing_to_share: willingToShare,
        description: willingToShare ? healthDesc : null,
      }),
    ]);
    if (chatResult && 'error' in chatResult && chatResult.error) {
      Alert.alert('Chat prefs error', chatResult.error.message);
    }

    setLoading(false);
    navigation.goBack();
  }

  const steps: Step[] = ['social', 'interests', 'location', 'professional', 'chat', 'health'];
  const stepIndex = steps.indexOf(step);

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {/* Step indicator */}
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
              {photoUri
                ? <Image source={{ uri: photoUri }} style={styles.photo} />
                : <Text style={styles.photoText}>Tap to add photo</Text>
              }
            </TouchableOpacity>

            <Field label="Name *" value={name} onChangeText={setName} placeholder="First name" />
            <Field label="Age *" value={age} onChangeText={setAge} placeholder="e.g. 18" keyboardType="numeric" />

            <Text style={styles.label}>Gender *</Text>
            <MultiSelectChips options={GENDERS} selected={gender ? [gender] : []} onToggle={(v) => setGender(v[0] || '')} single />

            <Text style={styles.label}>Languages</Text>
            <MultiSelectChips options={LANGUAGES} selected={languages} onToggle={setLanguages} />

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
                  <MultiSelectChips options={likeCategories.map(c => c.name)} selected={selectedLikes} onToggle={setSelectedLikes} />
                  <Text style={styles.label}>Dislikes</Text>
                  <MultiSelectChips options={dislikeCategories.map(c => c.name)} selected={selectedDislikes} onToggle={setSelectedDislikes} />
                </>
            }
          </View>
        )}

        {step === 'location' && (
          <View>
            <Text style={styles.sectionTitle}>Location</Text>
            <Text style={styles.sectionSubtitle}>Where is this person based?</Text>

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

        {step === 'professional' && (
          <View>
            <Text style={styles.sectionTitle}>What Can I Do?</Text>
            <Text style={styles.sectionSubtitle}>Select all activities this person can do</Text>
            <MultiSelectChips options={abilityCategories.map(c => c.name)} selected={selectedAbilities} onToggle={setSelectedAbilities} />
          </View>
        )}

        {step === 'chat' && (
          <View>
            <Text style={styles.sectionTitle}>Chat Preferences</Text>

            <Toggle label="Open to online chat" value={openToChat} onToggle={() => setOpenToChat(!openToChat)} />
            <Toggle label="Open to Zoom" value={openToZoom} onToggle={() => setOpenToZoom(!openToZoom)} />
            <Toggle label="Open to voice chat" value={openToVoice} onToggle={() => setOpenToVoice(!openToVoice)} />

            <Text style={styles.label}>Available Days</Text>
            <MultiSelectChips options={DAYS_OF_WEEK} selected={availableDays} onToggle={setAvailableDays} />

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
                  placeholderTextColor={COLORS.textLight}
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
          <TouchableOpacity style={styles.nextBtn} onPress={handleSubmit} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.nextBtnText}>Create Profile</Text>}
          </TouchableOpacity>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

function Field({ label, ...props }: { label: string } & React.ComponentProps<typeof TextInput>) {
  return (
    <>
      <Text style={styles.label}>{label}</Text>
      <TextInput style={styles.input} placeholderTextColor={COLORS.textLight} {...props} />
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
  container: { flex: 1, backgroundColor: COLORS.background },
  scroll: { flex: 1 },
  stepIndicator: { flexDirection: 'row', justifyContent: 'center', gap: 8, paddingVertical: 16 },
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
  nextBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
