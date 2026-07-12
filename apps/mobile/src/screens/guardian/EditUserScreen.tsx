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
import { saveBiometricUser, removeBiometricUser, isBiometricEnabledForUser, isBiometricSupported, isBiometricAvailable, promptBiometric } from '../../lib/biometricStore';
import { COLORS, DAYS_OF_WEEK, COMPREHENSION_LEVELS, GENDERS, LANGUAGES, US_STATES } from '../../constants';
import DropdownPicker from '../../components/DropdownPicker';
import type { Category } from '../../types';
import MultiSelectChips from '../../components/MultiSelectChips';
import { GuardianNavParamList } from '../../navigation';

type Props = {
  navigation: NativeStackNavigationProp<GuardianNavParamList, 'EditUser'>;
  route: RouteProp<GuardianNavParamList, 'EditUser'>;
};

type Step = 'social' | 'interests' | 'location' | 'professional' | 'chat' | 'health' | 'friends' | 'account';
const GUARDIAN_STEPS: Step[] = ['social', 'interests', 'location', 'professional', 'chat', 'health', 'friends', 'account'];
const USER_STEPS: Step[] = ['social', 'interests', 'location', 'professional', 'chat', 'health'];

interface FriendForPin {
  friendshipId: string;
  friendName: string;
  friendPhotoUrl: string | null;
  isPinned: boolean;
  isRequester: boolean;
}

export default function EditUserScreen({ navigation, route }: Props) {
  const { userId } = route.params;
  const { guardian } = useAuth();
  const [step, setStep] = useState<Step>('social');
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState('');
  const [languages, setLanguages] = useState<string[]>([]);
  const [email, setEmail] = useState('');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [existingPhotoUrl, setExistingPhotoUrl] = useState<string | null>(null);
  const [city, setCity] = useState('');
  const [region, setRegion] = useState('');
  const [country, setCountry] = useState('USA');
  const [selectedLikes, setSelectedLikes] = useState<string[]>([]);
  const [selectedDislikes, setSelectedDislikes] = useState<string[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedAbilities, setSelectedAbilities] = useState<string[]>([]);
  const [openToChat, setOpenToChat] = useState(true);
  const [openToZoom, setOpenToZoom] = useState(false);
  const [openToVoice, setOpenToVoice] = useState(false);
  const [availableDays, setAvailableDays] = useState<string[]>([]);
  const [comprehension, setComprehension] = useState('easy');
  const [willingToShare, setWillingToShare] = useState(false);
  const [healthDesc, setHealthDesc] = useState('');
  const [existingAuthUserId, setExistingAuthUserId] = useState<string | null>(null);
  const [accountPassword, setAccountPassword] = useState('');
  const [accountConfirmPassword, setAccountConfirmPassword] = useState('');
  const [enableBiometric, setEnableBiometric] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricPassword, setBiometricPassword] = useState('');
  const [friendsForPin, setFriendsForPin] = useState<FriendForPin[]>([]);
  const [friendsLoading, setFriendsLoading] = useState(false);

  const likeCategories = categories.filter(c => c.type === 'like');
  const dislikeCategories = categories.filter(c => c.type === 'dislike');
  const abilityCategories = categories.filter(c => c.type === 'ability');

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ paddingHorizontal: 4 }}>
          <Text style={{ color: COLORS.primary, fontSize: 16 }}>Cancel</Text>
        </TouchableOpacity>
      ),
    });
  }, [navigation]);

  useEffect(() => { loadAll(); }, []);

  useEffect(() => {
    if (step === 'friends' && friendsForPin.length === 0) loadFriendsForPin();
  }, [step]);

  async function loadFriendsForPin() {
    setFriendsLoading(true);
    const { data, error } = await supabase
      .from('friendships')
      .select(`
        id, requester_id, addressee_id, requester_pinned, addressee_pinned,
        requester:user_profiles!friendships_requester_id_fkey(id, name, photo_url),
        addressee:user_profiles!friendships_addressee_id_fkey(id, name, photo_url)
      `)
      .eq('status', 'accepted')
      .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`);

    if (!error && data) {
      const list: FriendForPin[] = data.map((f: any) => {
        const isRequester = f.requester_id === userId;
        const friend = isRequester ? f.addressee : f.requester;
        return {
          friendshipId: f.id,
          friendName: friend.name,
          friendPhotoUrl: friend.photo_url,
          isPinned: isRequester ? f.requester_pinned : f.addressee_pinned,
          isRequester,
        };
      });
      setFriendsForPin(list.sort((a, b) => a.friendName.localeCompare(b.friendName)));
    }
    setFriendsLoading(false);
  }

  async function togglePin(item: FriendForPin) {
    const pinnedCount = friendsForPin.filter(f => f.isPinned).length;
    if (!item.isPinned && pinnedCount >= 3) {
      Alert.alert('Max 3 favourites', 'Unpin a friend first before adding another.');
      return;
    }
    const column = item.isRequester ? 'requester_pinned' : 'addressee_pinned';
    const { error } = await supabase
      .from('friendships')
      .update({ [column]: !item.isPinned })
      .eq('id', item.friendshipId);
    if (!error) {
      setFriendsForPin(prev =>
        prev.map(f => f.friendshipId === item.friendshipId ? { ...f, isPinned: !f.isPinned } : f)
      );
    }
  }

  async function loadAll() {
    const [profileRes, catsRes, likesRes, dislikesRes, abilitiesRes, chatRes, healthRes] = await Promise.all([
      supabase.from('user_profiles').select('*').eq('id', userId).single(),
      supabase.from('categories').select('*'),
      supabase.from('user_likes').select('categories(name)').eq('user_id', userId),
      supabase.from('user_dislikes').select('categories(name)').eq('user_id', userId),
      supabase.from('user_abilities').select('categories(name)').eq('user_id', userId),
      supabase.from('chat_preferences').select('*').eq('user_id', userId).single(),
      supabase.from('health_info').select('*').eq('user_id', userId).single(),
    ]);

    const p = profileRes.data;
    if (p) {
      setName(p.name);
      setAge(String(p.age));
      setGender(p.gender || '');
      setLanguages(p.languages || []);
      setCity(p.city || '');
      setRegion(p.region || '');
      setCountry(p.country || 'USA');
      setExistingPhotoUrl(p.photo_url || null);
      setEmail(p.email || '');
      setExistingAuthUserId(p.auth_user_id || null);
    }

    if (catsRes.data) setCategories(catsRes.data);

    setSelectedLikes((likesRes.data || []).map((r: any) => r.categories?.name).filter(Boolean));
    setSelectedDislikes((dislikesRes.data || []).map((r: any) => r.categories?.name).filter(Boolean));
    setSelectedAbilities((abilitiesRes.data || []).map((r: any) => r.categories?.name).filter(Boolean));

    const chat = chatRes.data;
    if (chat) {
      setOpenToChat(chat.open_to_online_chat ?? true);
      setOpenToZoom(chat.open_to_zoom ?? false);
      setOpenToVoice(chat.open_to_voice_chat ?? false);
      setAvailableDays(chat.available_days || []);
      setComprehension(chat.comprehension_level || 'easy');
    }

    const health = healthRes.data;
    if (health) {
      setWillingToShare(health.willing_to_share ?? false);
      setHealthDesc(health.description || '');
    }

    // Load biometric state for this user
    const [bioEnabled, bioAvail] = await Promise.all([
      isBiometricEnabledForUser(userId),
      isBiometricSupported(),
    ]);
    setEnableBiometric(bioEnabled);
    setBiometricAvailable(bioAvail);

    setInitialLoading(false);
  }

  async function handleBiometricToggle() {
    if (enableBiometric) {
      setEnableBiometric(false);
      return;
    }
    const available = await isBiometricAvailable();
    if (!available) {
      Alert.alert('Biometrics not set up', 'Please set up Face ID or fingerprint on this device first, then try again.');
      return;
    }
    const passed = await promptBiometric('Confirm to enable biometric login');
    if (passed) setEnableBiometric(true);
  }

  async function pickPhoto() {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.7 });
    if (!result.canceled) setPhotoUri(result.assets[0].uri);
  }

  async function handleSave() {
    if (!name || !age || !gender || !city || !region) { Alert.alert('Please fill in all required fields'); return; }
    if (!existingAuthUserId && email && accountPassword && accountPassword !== accountConfirmPassword) {
      Alert.alert('Passwords do not match'); return;
    }
    if (!existingAuthUserId && email && accountPassword && accountPassword.length < 6) {
      Alert.alert('Password must be at least 6 characters'); return;
    }
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
      name, age: parseInt(age), gender, languages, photo_url, city, region, country,
      email: email.toLowerCase().trim() || null,
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
      supabase.from('chat_preferences').upsert({
        user_id: userId,
        open_to_online_chat: openToChat,
        open_to_zoom: openToZoom,
        open_to_voice_chat: openToVoice,
        available_days: availableDays,
        comprehension_level: comprehension,
      }),
      supabase.from('health_info').upsert({
        user_id: userId,
        willing_to_share: willingToShare,
        description: willingToShare ? healthDesc : null,
      }),
    ]);

    // Create login account if not already set and credentials provided
    if (!existingAuthUserId && email && accountPassword) {
      const { data: { session } } = await supabase.auth.getSession();
      const { error: fnError } = await supabase.functions.invoke('create-user-account', {
        body: { email: email.toLowerCase().trim(), password: accountPassword, profile_id: userId },
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      if (fnError) {
        let detail = fnError.message;
        try { detail = (fnError as any).context ? await (fnError as any).context.json().then((b: any) => b.error) : fnError.message; } catch {}
        Alert.alert('Account setup failed', detail);
        setLoading(false);
        return;
      }
    }

    // Sync biometric store
    const passwordToStore = existingAuthUserId ? biometricPassword : accountPassword;
    const hasAccount = existingAuthUserId || (email && accountPassword);
    if (hasAccount && enableBiometric && email) {
      if (!passwordToStore) {
        Alert.alert('Password required', 'Please enter this user\'s current password to enable biometric login.');
        setLoading(false);
        return;
      }
      const profileData = await supabase.from('user_profiles').select('name, photo_url').eq('id', userId).single();
      await saveBiometricUser({
        id: userId,
        name: profileData.data?.name ?? name,
        photo_url: profileData.data?.photo_url ?? existingPhotoUrl ?? null,
        email: email.toLowerCase().trim(),
        password: passwordToStore,
      });
    } else if (!enableBiometric) {
      await removeBiometricUser(userId);
    }

    setLoading(false);
    navigation.goBack();
  }

  const steps = guardian ? GUARDIAN_STEPS : USER_STEPS;
  const stepIndex = steps.indexOf(step);
  const photoSource = photoUri || existingPhotoUrl;

  if (initialLoading) {
    return <View style={styles.center}><ActivityIndicator size="large" color={COLORS.primary} /></View>;
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

        {step === 'friends' && (
          <View>
            <Text style={styles.sectionTitle}>Favourite Friends</Text>
            <Text style={styles.sectionSubtitle}>
              Pin up to 3 friends — they will appear at the top of the Friends list.
            </Text>
            {friendsLoading
              ? <ActivityIndicator color={COLORS.primary} style={{ marginTop: 32 }} />
              : friendsForPin.length === 0
                ? <Text style={styles.emptyHint}>No friends yet</Text>
                : friendsForPin.map(item => (
                    <TouchableOpacity
                      key={item.friendshipId}
                      style={styles.friendPinRow}
                      onPress={() => togglePin(item)}
                      activeOpacity={0.8}
                    >
                      {item.friendPhotoUrl
                        ? <Image source={{ uri: item.friendPhotoUrl }} style={styles.friendPinAvatar} />
                        : (
                          <View style={[styles.friendPinAvatar, styles.friendPinAvatarPlaceholder]}>
                            <Text style={styles.friendPinInitial}>{item.friendName[0]}</Text>
                          </View>
                        )
                      }
                      <Text style={styles.friendPinName}>{item.friendName}</Text>
                      <View style={[styles.pinToggle, item.isPinned && styles.pinToggleActive]}>
                        <Text style={styles.pinToggleIcon}>{item.isPinned ? '⭐' : '☆'}</Text>
                      </View>
                    </TouchableOpacity>
                  ))
            }
            <Text style={styles.skipHint}>
              {friendsForPin.filter(f => f.isPinned).length}/3 pinned
            </Text>
          </View>
        )}

        {step === 'account' && (
          <View>
            <Text style={styles.sectionTitle}>Login Account</Text>

            {existingAuthUserId ? (
              <>
                <View style={styles.infoCard}>
                  <Text style={styles.infoText}>✓ Login account is set up for this person.</Text>
                  {email ? <Text style={[styles.infoText, { marginTop: 6, fontWeight: '600' }]}>{email}</Text> : null}
                </View>
                <Text style={styles.skipHint}>
                  To change the password, the user can use "Forgot Password" on the login screen.
                </Text>
                {biometricAvailable && (
                  <View style={styles.biometricCard}>
                    <Toggle
                      label="Biometric login on this device"
                      value={enableBiometric}
                      onToggle={handleBiometricToggle}
                    />
                    <Text style={styles.biometricHint}>
                      {enableBiometric
                        ? 'This user will appear as a tile on the login screen and can be unlocked with face or fingerprint recognition.'
                        : 'Enable to let this user log in via face or fingerprint recognition on this device.'}
                    </Text>
                    {enableBiometric && (
                      <>
                        <TextInput
                          style={[styles.input, { marginTop: 12, marginBottom: 0 }]}
                          placeholder="Enter this user's current password"
                          value={biometricPassword}
                          onChangeText={setBiometricPassword}
                          secureTextEntry
                          autoCapitalize="none"
                          autoCorrect={false}
                          placeholderTextColor={COLORS.textLight}
                        />
                        <Text style={[styles.biometricHint, { marginTop: 6 }]}>
                          Required so the app can sign in automatically after biometric verification.
                        </Text>
                      </>
                    )}
                  </View>
                )}
              </>
            ) : (
              <>
                <Text style={styles.sectionSubtitle}>Set up login credentials so this person can sign in to the app</Text>
                <View style={styles.infoCard}>
                  <Text style={styles.infoText}>
                    Once created, this person can log in with these credentials on the User login screen.
                  </Text>
                </View>
                <Field
                  label="Login Email"
                  value={email}
                  onChangeText={setEmail}
                  placeholder="e.g. alex@example.com"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <Field
                  label="Password"
                  value={accountPassword}
                  onChangeText={setAccountPassword}
                  placeholder="At least 6 characters"
                  secureTextEntry
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <Field
                  label="Confirm Password"
                  value={accountConfirmPassword}
                  onChangeText={setAccountConfirmPassword}
                  placeholder="Re-enter password"
                  secureTextEntry
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                {email && accountPassword && biometricAvailable && (
                  <View style={styles.biometricCard}>
                    <Toggle
                      label="Enable biometric login on this device"
                      value={enableBiometric}
                      onToggle={handleBiometricToggle}
                    />
                    <Text style={styles.biometricHint}>
                      When enabled, this user will appear as a tile on the login screen and can be unlocked with face or fingerprint recognition.
                    </Text>
                  </View>
                )}
                <Text style={styles.skipHint}>Leave blank to skip — save the profile without creating a login.</Text>
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
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
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
    backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border,
    borderRadius: 12, padding: 14, fontSize: 16, color: COLORS.text, marginBottom: 4,
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
  infoCard: {
    backgroundColor: COLORS.primaryLight,
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: COLORS.primary + '40',
  },
  infoText: { fontSize: 14, color: COLORS.text, lineHeight: 20 },
  skipHint: { fontSize: 13, color: COLORS.textLight, marginTop: 24, textAlign: 'center', lineHeight: 18 },
  biometricCard: {
    marginTop: 20, backgroundColor: COLORS.primaryLight, borderRadius: 14,
    padding: 16, borderWidth: 1, borderColor: COLORS.primary + '40',
  },
  biometricHint: { fontSize: 13, color: COLORS.text, lineHeight: 18, marginTop: 6 },
  backBtn: { flex: 1, padding: 16, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border, alignItems: 'center' },
  backBtnText: { color: COLORS.text, fontSize: 16, fontWeight: '600' },
  nextBtn: { flex: 2, backgroundColor: COLORS.primary, borderRadius: 12, padding: 16, alignItems: 'center' },
  nextBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },

  friendPinRow: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  friendPinAvatar: { width: 48, height: 48, borderRadius: 24 },
  friendPinAvatarPlaceholder: {
    backgroundColor: COLORS.primaryLight, justifyContent: 'center', alignItems: 'center',
  },
  friendPinInitial: { fontSize: 18, fontWeight: '700', color: COLORS.primary },
  friendPinName: { flex: 1, fontSize: 16, fontWeight: '600', color: COLORS.text },
  pinToggle: {
    width: 44, height: 44, borderRadius: 12,
    backgroundColor: COLORS.border,
    justifyContent: 'center', alignItems: 'center',
  },
  pinToggleActive: { backgroundColor: '#FDE8C0' },
  pinToggleIcon: { fontSize: 22 },
});
