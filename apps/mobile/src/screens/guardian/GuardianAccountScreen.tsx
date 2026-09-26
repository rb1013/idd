import React, { useLayoutEffect, useState } from 'react';
import {
  View, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator,
  Image, Alert,
} from 'react-native';
import AppText from '../../components/AppText';
import ContentContainer from '../../components/ContentContainer';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { decode } from 'base64-arraybuffer';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/AuthContext';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { GuardianNavParamList } from '../../navigation';
import {
  NICO, TEXT_STYLE, SPACING, RADIUS, SHADOW, BTN_SIZE, BTN_VARIANT, FONT_SIZE, FONT_WEIGHT,
} from '../../constants/theme';

type Nav = NativeStackNavigationProp<GuardianNavParamList>;

export default function GuardianAccountScreen() {
  const { guardian, refreshGuardian } = useAuth();
  const navigation = useNavigation<Nav>();
  const [photoUri, setPhotoUri]   = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerStyle:       { backgroundColor: NICO.background },
      headerTitleStyle:  { color: NICO.text },
      headerTintColor:   NICO.text,
      headerShadowVisible: false,
    });
  }, [navigation]);

  async function pickPhoto() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (result.canceled) return;
    const uri = result.assets[0].uri;
    setPhotoUri(uri);
    await uploadPhoto(uri);
  }

  async function uploadPhoto(uri: string) {
    if (!guardian) return;
    setUploading(true);
    try {
      const ext = (uri.split('.').pop() || 'jpg').toLowerCase();
      const fileName = `guardian-${guardian.id}-${Date.now()}.${ext}`;
      const base64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
      const arrayBuffer = decode(base64);
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, arrayBuffer, { contentType: `image/${ext}`, upsert: true });
      if (uploadError) { Alert.alert('Upload failed', uploadError.message); return; }
      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(uploadData.path);
      const { error } = await supabase.from('guardians').update({ photo_url: publicUrl }).eq('id', guardian.id);
      if (error) { Alert.alert('Save failed', error.message); return; }
      await refreshGuardian();
    } finally {
      setUploading(false);
    }
  }

  function handleDeleteAccount() {
    Alert.alert(
      'Delete account',
      'This will permanently delete your account and all learner profiles. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete', style: 'destructive',
          onPress: () => Alert.alert(
            'Are you sure?',
            'All your data will be lost forever.',
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Yes, delete', style: 'destructive', onPress: confirmDeleteAccount },
            ],
          ),
        },
      ],
    );
  }

  async function confirmDeleteAccount() {
    const { error } = await supabase.functions.invoke('delete-guardian');
    if (error) { Alert.alert('Failed to delete account', error.message); return; }
    await supabase.auth.signOut();
  }

  const photoSource = photoUri || guardian?.photo_url;
  const tags = guardian?.situation_tags ?? [];

  return (
    <ScrollView style={s.root} contentContainerStyle={s.inner} showsVerticalScrollIndicator={false}>
      <ContentContainer>

        {/* Avatar */}
        <TouchableOpacity style={s.avatarWrap} onPress={pickPhoto} activeOpacity={0.8} disabled={uploading}>
          {photoSource ? (
            <Image source={{ uri: photoSource }} style={s.avatar} />
          ) : (
            <View style={[s.avatar, s.avatarFallback]}>
              <AppText style={s.avatarInitial}>{guardian?.full_name[0]?.toUpperCase()}</AppText>
            </View>
          )}
          <View style={s.avatarBadge}>
            {uploading
              ? <ActivityIndicator size={14} color={NICO.textOnAccent} />
              : <AppText style={s.avatarBadgeIcon}>✏️</AppText>
            }
          </View>
        </TouchableOpacity>
        <AppText style={s.avatarHint}>Tap to change photo</AppText>

        {/* Info card */}
        <View style={s.card}>
          <InfoRow label="Name"    value={guardian?.full_name ?? '—'} />
          <View style={s.divider} />
          <InfoRow label="Email"   value={guardian?.email ?? '—'} />
          <View style={s.divider} />
          <InfoRow label="Phone"   value={guardian?.phone || '—'} />
          <View style={s.divider} />
          <InfoRow label="Country" value="USA" />
          <View style={s.divider} />
          <InfoRow label="State"   value={guardian?.state || '—'} />
          <View style={s.divider} />
          <InfoRow label="City"    value={guardian?.city || '—'} />
        </View>

        {/* Learner Situation */}
        <View style={[s.card, { marginTop: SPACING.md }]}>
          <View style={s.infoRow}>
            <AppText style={s.infoLabel}>Learner Situation</AppText>
          </View>
          {tags.length === 0 ? (
            <View style={s.tagsEmpty}>
              <AppText style={s.infoValue}>None selected</AppText>
            </View>
          ) : (
            <View style={s.tagRow}>
              {tags.map(tag => (
                <View key={tag} style={s.tag}>
                  <AppText style={s.tagText}>{tag}</AppText>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Edit Profile */}
        <TouchableOpacity
          style={s.editBtn}
          onPress={() => navigation.navigate('EditAccount')}
          activeOpacity={0.85}
        >
          <AppText style={s.editBtnText}>Edit Profile</AppText>
        </TouchableOpacity>

        {/* Delete Account */}
        <TouchableOpacity style={s.deleteBtn} onPress={handleDeleteAccount} activeOpacity={0.7}>
          <AppText style={s.deleteBtnText}>Delete Account</AppText>
        </TouchableOpacity>

      </ContentContainer>
    </ScrollView>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.infoRow}>
      <AppText style={s.infoLabel}>{label}</AppText>
      <AppText style={s.infoValue} numberOfLines={1}>{value}</AppText>
    </View>
  );
}

const s = StyleSheet.create({
  root:  { flex: 1, backgroundColor: NICO.screenBg },
  inner: { padding: SPACING.base, paddingBottom: SPACING['3xl'], alignItems: 'stretch' },

  avatarWrap: { alignSelf: 'center', position: 'relative', marginTop: SPACING.md, marginBottom: SPACING.xs },
  avatar:     { width: 96, height: 96, borderRadius: 48 },
  avatarFallback: {
    backgroundColor: NICO.primaryLight,
    justifyContent: 'center', alignItems: 'center',
  },
  avatarInitial: { fontSize: FONT_SIZE['3xl'], fontWeight: FONT_WEIGHT.black, color: NICO.primary },
  avatarBadge: {
    position: 'absolute', bottom: 0, right: 0,
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: NICO.primary,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 2, borderColor: NICO.screenBg,
  },
  avatarBadgeIcon: { fontSize: 13 },
  avatarHint: { ...TEXT_STYLE.hint, textAlign: 'center', marginBottom: SPACING.xl },

  card:    { backgroundColor: NICO.surface, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: NICO.border, ...SHADOW.sm },
  divider: { height: 1, backgroundColor: NICO.border },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: SPACING.base },
  infoLabel: { ...TEXT_STYLE.bodyMedium },
  infoValue: { ...TEXT_STYLE.body, color: NICO.text, flexShrink: 1, textAlign: 'right', marginLeft: SPACING.md },

  tagsEmpty: { paddingHorizontal: SPACING.base, paddingBottom: SPACING.base },
  tagRow:    { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm, paddingHorizontal: SPACING.base, paddingBottom: SPACING.base },
  tag: {
    backgroundColor: NICO.primaryLight,
    borderWidth: 1, borderColor: NICO.borderStrong,
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.xs,
  },
  tagText: { ...TEXT_STYLE.caption, color: NICO.text, fontWeight: FONT_WEIGHT.bold },

  editBtn:     { ...BTN_SIZE.lg, ...BTN_VARIANT.primary, marginTop: SPACING.xl },
  editBtnText: { ...TEXT_STYLE.buttonPrimary },

  deleteBtn:     { marginTop: SPACING.md, padding: SPACING.base, alignItems: 'center' },
  deleteBtnText: { ...TEXT_STYLE.labelSmall, color: NICO.error },
});
