import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator,
  Image, Alert, TextInput,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { decode } from 'base64-arraybuffer';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/AuthContext';
import { saveGuardianProfile } from '../../lib/biometricStore';
import { COLORS } from '../../constants';

export default function GuardianAccountScreen() {
  const { guardian, signOut } = useAuth();
  const [notifSettings, setNotifSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [phone, setPhone] = useState('');
  const [editingPhone, setEditingPhone] = useState(false);
  const [savingPhone, setSavingPhone] = useState(false);

  useEffect(() => {
    if (guardian) {
      setPhone(guardian.phone ?? '');
      loadSettings(guardian.id);
    }
  }, [guardian]);

  async function loadSettings(guardianId: string) {
    const { data } = await supabase
      .from('guardian_notification_settings')
      .select('*')
      .eq('guardian_id', guardianId)
      .single();
    setNotifSettings(data || null);
    setLoading(false);
  }

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
      await saveGuardianProfile({ name: guardian.full_name, photo_url: publicUrl });
    } finally {
      setUploading(false);
    }
  }

  async function savePhone() {
    if (!guardian) return;
    setSavingPhone(true);
    const { error } = await supabase.from('guardians').update({ phone: phone.trim() || null }).eq('id', guardian.id);
    setSavingPhone(false);
    if (error) { Alert.alert('Failed to save', error.message); return; }
    setEditingPhone(false);
  }

  async function toggleSetting(key: string) {
    const current = notifSettings?.[key] ?? false;
    const updated = { ...notifSettings, [key]: !current, guardian_id: guardian!.id };
    if (!notifSettings) {
      await supabase.from('guardian_notification_settings').insert(updated);
    } else {
      await supabase.from('guardian_notification_settings').update({ [key]: !current }).eq('guardian_id', guardian!.id);
    }
    setNotifSettings(updated);
  }

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color={COLORS.primary} /></View>;

  const photoSource = photoUri || guardian?.photo_url;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.inner}>
      {/* Profile photo */}
      <TouchableOpacity style={styles.avatarWrap} onPress={pickPhoto} activeOpacity={0.8} disabled={uploading}>
        {photoSource
          ? <Image source={{ uri: photoSource }} style={styles.avatar} />
          : (
            <View style={[styles.avatar, styles.avatarPlaceholder]}>
              <Text style={styles.avatarInitial}>{guardian?.full_name[0]?.toUpperCase()}</Text>
            </View>
          )
        }
        <View style={styles.avatarEditBadge}>
          {uploading
            ? <ActivityIndicator size={14} color="#fff" />
            : <Text style={styles.avatarEditIcon}>✏️</Text>
          }
        </View>
      </TouchableOpacity>
      <Text style={styles.avatarHint}>Tap to change photo</Text>

      {/* Account details */}
      <Text style={styles.sectionTitle}>Account Details</Text>
      <View style={styles.card}>
        <InfoRow label="Name" value={guardian?.full_name ?? '—'} />
        <View style={styles.divider} />
        <InfoRow label="Email" value={guardian?.email ?? '—'} />
        <View style={styles.divider} />

        {/* Editable phone row */}
        {editingPhone ? (
          <View style={styles.phoneEditRow}>
            <Text style={styles.infoLabel}>Phone</Text>
            <TextInput
              style={styles.phoneInput}
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              placeholder="e.g. +1 555 000 0000"
              placeholderTextColor={COLORS.textLight}
              autoFocus
            />
            <View style={styles.phoneActions}>
              <TouchableOpacity onPress={() => { setPhone(guardian?.phone ?? ''); setEditingPhone(false); }}>
                <Text style={styles.phoneCancel}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.phoneSaveBtn} onPress={savePhone} disabled={savingPhone}>
                {savingPhone
                  ? <ActivityIndicator size={14} color="#fff" />
                  : <Text style={styles.phoneSaveText}>Save</Text>
                }
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <TouchableOpacity style={styles.infoRow} onPress={() => setEditingPhone(true)} activeOpacity={0.7}>
            <Text style={styles.infoLabel}>Phone</Text>
            <View style={styles.phoneViewRight}>
              <Text style={styles.infoValue}>{phone || '—'}</Text>
              <Text style={styles.editLink}>Edit</Text>
            </View>
          </TouchableOpacity>
        )}
      </View>

      {/* Notification settings */}
      <Text style={[styles.sectionTitle, { marginTop: 28 }]}>Notification Settings</Text>
      <View style={styles.card}>
        <Toggle
          label="Friend requests"
          value={notifSettings?.notify_on_friend_request ?? false}
          onToggle={() => toggleSetting('notify_on_friend_request')}
        />
        <View style={styles.divider} />
        <Toggle
          label="Messages"
          value={notifSettings?.notify_on_message ?? false}
          onToggle={() => toggleSetting('notify_on_message')}
        />
      </View>

      <TouchableOpacity style={styles.signOutBtn} onPress={signOut}>
        <Text style={styles.signOutText}>Sign Out</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

function Toggle({ label, value, onToggle }: { label: string; value: boolean; onToggle: () => void }) {
  return (
    <TouchableOpacity style={styles.toggleRow} onPress={onToggle} delayPressIn={50}>
      <Text style={styles.toggleLabel}>{label}</Text>
      <View style={[styles.toggle, value && styles.toggleOn]}>
        <View style={[styles.toggleThumb, value && styles.toggleThumbOn]} />
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  inner: { padding: 20, paddingBottom: 48, alignItems: 'stretch' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

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

  sectionTitle: { fontSize: 17, fontWeight: '700', color: COLORS.text, marginBottom: 12 },
  card: { backgroundColor: COLORS.surface, borderRadius: 14, borderWidth: 1, borderColor: COLORS.border },
  divider: { height: 1, backgroundColor: COLORS.border },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16 },
  infoLabel: { fontSize: 15, color: COLORS.textLight },
  infoValue: { fontSize: 15, color: COLORS.text, fontWeight: '500' },

  phoneViewRight: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  editLink: { fontSize: 14, color: COLORS.primary, fontWeight: '600' },

  phoneEditRow: { padding: 16, gap: 10 },
  phoneInput: {
    borderWidth: 1, borderColor: COLORS.primary, borderRadius: 10,
    padding: 12, fontSize: 15, color: COLORS.text,
    backgroundColor: COLORS.background,
  },
  phoneActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 4 },
  phoneCancel: { fontSize: 14, color: COLORS.textLight, fontWeight: '600', paddingVertical: 8, paddingHorizontal: 4 },
  phoneSaveBtn: {
    backgroundColor: COLORS.primary, borderRadius: 8,
    paddingVertical: 8, paddingHorizontal: 18,
    justifyContent: 'center', alignItems: 'center', minWidth: 60,
  },
  phoneSaveText: { color: '#fff', fontSize: 14, fontWeight: '700' },

  toggleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16 },
  toggleLabel: { fontSize: 15, color: COLORS.text },
  toggle: { width: 46, height: 26, borderRadius: 13, backgroundColor: COLORS.border, justifyContent: 'center', padding: 2 },
  toggleOn: { backgroundColor: COLORS.primary },
  toggleThumb: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#fff' },
  toggleThumbOn: { alignSelf: 'flex-end' },
  signOutBtn: { marginTop: 32, padding: 16, alignItems: 'center' },
  signOutText: { color: COLORS.textLight, fontSize: 15 },
});
