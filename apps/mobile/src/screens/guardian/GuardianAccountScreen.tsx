import React, { useState } from 'react';
import {
  View, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator,
  Image, Alert,
} from 'react-native';
import AppText from '../../components/AppText';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { decode } from 'base64-arraybuffer';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/AuthContext';
import { COLORS } from '../../constants';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { GuardianNavParamList } from '../../navigation';

type Nav = NativeStackNavigationProp<GuardianNavParamList>;

export default function GuardianAccountScreen() {
  const { guardian, signOut, refreshGuardian } = useAuth();
  const navigation = useNavigation<Nav>();
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

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
    if (error) {
      Alert.alert('Failed to delete account', error.message);
      return;
    }
    await supabase.auth.signOut();
  }

  const photoSource = photoUri || guardian?.photo_url;
  const tags = guardian?.situation_tags ?? [];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.inner}>
      {/* Profile photo */}
      <TouchableOpacity style={styles.avatarWrap} onPress={pickPhoto} activeOpacity={0.8} disabled={uploading}>
        {photoSource
          ? <Image source={{ uri: photoSource }} style={styles.avatar} />
          : (
            <View style={[styles.avatar, styles.avatarPlaceholder]}>
              <AppText style={styles.avatarInitial}>{guardian?.full_name[0]?.toUpperCase()}</AppText>
            </View>
          )
        }
        <View style={styles.avatarEditBadge}>
          {uploading
            ? <ActivityIndicator size={14} color="#fff" />
            : <AppText style={styles.avatarEditIcon}>✏️</AppText>
          }
        </View>
      </TouchableOpacity>
      <AppText style={styles.avatarHint}>Tap to change photo</AppText>

      {/* Info card */}
      <View style={styles.card}>
        <InfoRow label="Name"    value={guardian?.full_name ?? '—'} />
        <View style={styles.divider} />
        <InfoRow label="Email"   value={guardian?.email ?? '—'} />
        <View style={styles.divider} />
        <InfoRow label="Phone"   value={guardian?.phone || '—'} />
        <View style={styles.divider} />
        <InfoRow label="Country" value="USA" />
        <View style={styles.divider} />
        <InfoRow label="State"   value={guardian?.state || '—'} />
        <View style={styles.divider} />
        <InfoRow label="City"    value={guardian?.city || '—'} />
      </View>

      {/* Situation Tags */}
      <View style={[styles.card, { marginTop: 12 }]}>
        <View style={styles.infoRow}>
          <AppText style={styles.infoLabel}>Situation Tags</AppText>
        </View>
        {tags.length === 0 ? (
          <View style={styles.tagsEmpty}>
            <AppText style={styles.infoValue}>None selected</AppText>
          </View>
        ) : (
          <View style={styles.tagChipRow}>
            {tags.map(tag => (
              <View key={tag} style={styles.tagChip}>
                <AppText style={styles.tagChipText}>{tag}</AppText>
              </View>
            ))}
          </View>
        )}
      </View>

      {/* Edit button */}
      <TouchableOpacity
        style={styles.editBtn}
        onPress={() => navigation.navigate('EditAccount')}
        activeOpacity={0.85}
      >
        <AppText style={styles.editBtnText}>Edit Profile</AppText>
      </TouchableOpacity>

      <TouchableOpacity style={styles.signOutBtn} onPress={signOut}>
        <AppText style={styles.signOutText}>Sign Out</AppText>
      </TouchableOpacity>

      <TouchableOpacity style={styles.deleteBtn} onPress={handleDeleteAccount} activeOpacity={0.7}>
        <AppText style={styles.deleteBtnText}>Delete Account</AppText>
      </TouchableOpacity>
    </ScrollView>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <AppText style={styles.infoLabel}>{label}</AppText>
      <AppText style={styles.infoValue}>{value}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  inner: { padding: 20, paddingBottom: 48, alignItems: 'stretch' },

  deleteBtn: { marginTop: 8, padding: 16, alignItems: 'center' },
  deleteBtnText: { color: '#DC2626', fontSize: 15, fontWeight: '600' },

  avatarWrap: { alignSelf: 'center', position: 'relative', marginTop: 8, marginBottom: 8 },
  avatar: { width: 96, height: 96, borderRadius: 48 },
  avatarPlaceholder: { backgroundColor: COLORS.primaryLight, justifyContent: 'center', alignItems: 'center' },
  avatarInitial: { fontSize: 38, fontWeight: '800', color: COLORS.primary },
  avatarEditBadge: {
    position: 'absolute', bottom: 0, right: 0,
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: COLORS.primary,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 2, borderColor: COLORS.background,
  },
  avatarEditIcon: { fontSize: 14 },
  avatarHint: { textAlign: 'center', fontSize: 12, color: COLORS.textLight, marginBottom: 24 },

  card: { backgroundColor: COLORS.surface, borderRadius: 14, borderWidth: 1, borderColor: COLORS.border },
  divider: { height: 1, backgroundColor: COLORS.border },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16 },
  infoLabel: { fontSize: 15, color: COLORS.text, fontWeight: '600' },
  infoValue: { fontSize: 15, color: COLORS.text, fontWeight: '400', flexShrink: 1, textAlign: 'right', marginLeft: 12 },

  tagsEmpty: { paddingHorizontal: 16, paddingBottom: 16 },
  tagChipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 16, paddingBottom: 16 },
  tagChip: {
    backgroundColor: COLORS.primary + '12', borderWidth: 1, borderColor: COLORS.primary + '60',
    borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5,
  },
  tagChipText: { fontSize: 13, color: COLORS.primary, fontWeight: '600' },

  editBtn: {
    marginTop: 24,
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  editBtnText: { color: COLORS.bloomOnAccent, fontSize: 16, fontWeight: '800' },

  signOutBtn: { marginTop: 16, padding: 16, alignItems: 'center' },
  signOutText: { color: COLORS.textLight, fontSize: 15 },
});
