import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator,
  Image, Alert, TextInput, Modal, FlatList,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { decode } from 'base64-arraybuffer';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/AuthContext';
import { COLORS } from '../../constants';
import { US_STATES } from '../../constants/usStates';

export default function GuardianAccountScreen() {
  const { guardian, signOut, refreshGuardian } = useAuth();
  const [notifSettings, setNotifSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [name, setName] = useState('');
  const [editingName, setEditingName] = useState(false);
  const [savingName, setSavingName] = useState(false);
  const [phone, setPhone] = useState('');
  const [editingPhone, setEditingPhone] = useState(false);
  const [savingPhone, setSavingPhone] = useState(false);
  const [city, setCity]   = useState('');
  const [state, setState] = useState('');
  const [editingLocation, setEditingLocation]   = useState(false);
  const [savingLocation, setSavingLocation]     = useState(false);
  const [showStatePicker, setShowStatePicker]   = useState(false);

  const [tagOptions, setTagOptions]         = useState<string[]>([]);
  const [selectedTags, setSelectedTags]     = useState<string[]>([]);
  const [editingTags, setEditingTags]       = useState(false);
  const [savingTags, setSavingTags]         = useState(false);
  const [showTagPicker, setShowTagPicker]   = useState(false);

  useEffect(() => {
    if (guardian) {
      setName(guardian.full_name ?? '');
      setPhone(guardian.phone ?? '');
      setCity(guardian.city ?? '');
      setState(guardian.state ?? '');
      setSelectedTags(guardian.situation_tags ?? []);
      loadSettings(guardian.id);
    }
  }, [guardian]);

  useEffect(() => {
    supabase.from('situation_tag_options').select('label').order('label').then(({ data }) => {
      setTagOptions((data ?? []).map((r: any) => r.label));
    });
  }, []);

  async function loadSettings(guardianId: string) {
    try {
      const { data } = await supabase
        .from('guardian_notification_settings')
        .select('*')
        .eq('guardian_id', guardianId)
        .single();
      setNotifSettings(data || null);
    } finally {
      setLoading(false);
    }
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
      await refreshGuardian();
    } finally {
      setUploading(false);
    }
  }

  async function saveName() {
    if (!guardian) return;
    if (!name.trim()) { Alert.alert('Name cannot be empty'); return; }
    setSavingName(true);
    const { error } = await supabase.from('guardians').update({ full_name: name.trim() }).eq('id', guardian.id);
    setSavingName(false);
    if (error) { Alert.alert('Failed to save', error.message); return; }
    await refreshGuardian();
    setEditingName(false);
  }

  async function savePhone() {
    if (!guardian) return;
    setSavingPhone(true);
    const { error } = await supabase.from('guardians').update({ phone: phone.trim() || null }).eq('id', guardian.id);
    setSavingPhone(false);
    if (error) { Alert.alert('Failed to save', error.message); return; }
    await refreshGuardian();
    setEditingPhone(false);
  }

  async function saveLocation() {
    if (!guardian) return;
    setSavingLocation(true);
    const { error } = await supabase.from('guardians').update({
      city: city.trim() || null,
      state: state || null,
      country: 'USA',
    }).eq('id', guardian.id);
    setSavingLocation(false);
    if (error) { Alert.alert('Failed to save', error.message); return; }
    await refreshGuardian();
    setEditingLocation(false);
  }

  function toggleTag(tag: string) {
    setSelectedTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);
  }

  async function saveTags() {
    if (!guardian) return;
    setSavingTags(true);
    const { error } = await supabase.from('guardians').update({ situation_tags: selectedTags }).eq('id', guardian.id);
    setSavingTags(false);
    if (error) { Alert.alert('Failed to save', error.message); return; }
    await refreshGuardian();
    setEditingTags(false);
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
    <>
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
        {/* Editable name row */}
        {editingName ? (
          <View style={styles.phoneEditRow}>
            <Text style={styles.infoLabel}>Name</Text>
            <TextInput
              style={styles.phoneInput}
              value={name}
              onChangeText={setName}
              placeholder="Your full name"
              placeholderTextColor={COLORS.textLight}
              autoFocus
            />
            <View style={styles.phoneActions}>
              <TouchableOpacity onPress={() => { setName(guardian?.full_name ?? ''); setEditingName(false); }}>
                <Text style={styles.phoneCancel}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.phoneSaveBtn} onPress={saveName} disabled={savingName}>
                {savingName
                  ? <ActivityIndicator size={14} color="#fff" />
                  : <Text style={styles.phoneSaveText}>Save</Text>
                }
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <TouchableOpacity style={styles.infoRow} onPress={() => setEditingName(true)} activeOpacity={0.7}>
            <Text style={styles.infoLabel}>Name</Text>
            <View style={styles.phoneViewRight}>
              <Text style={styles.infoValue}>{name || '—'}</Text>
              <Text style={styles.editLink}>Edit</Text>
            </View>
          </TouchableOpacity>
        )}
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

      {/* Location */}
      <Text style={[styles.sectionTitle, { marginTop: 28 }]}>Location</Text>
      <View style={styles.card}>
        <InfoRow label="Country" value="USA" />
        <View style={styles.divider} />
        {editingLocation ? (
          <>
            {/* State picker row */}
            <View style={styles.phoneEditRow}>
              <Text style={styles.infoLabel}>State</Text>
              <TouchableOpacity style={styles.pickerBtn} onPress={() => setShowStatePicker(true)} activeOpacity={0.7}>
                <Text style={[styles.pickerBtnText, !state && { color: COLORS.textLight }]}>
                  {state || 'Select state...'}
                </Text>
                <Text style={styles.chevron}>▾</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.divider} />
            {/* City text row */}
            <View style={styles.phoneEditRow}>
              <Text style={styles.infoLabel}>City</Text>
              <TextInput
                style={styles.phoneInput}
                value={city}
                onChangeText={setCity}
                placeholder="e.g. Austin"
                placeholderTextColor={COLORS.textLight}
              />
            </View>
            <View style={styles.phoneActions}>
              <TouchableOpacity onPress={() => { setCity(guardian?.city ?? ''); setState(guardian?.state ?? ''); setEditingLocation(false); }}>
                <Text style={styles.phoneCancel}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.phoneSaveBtn} onPress={saveLocation} disabled={savingLocation}>
                {savingLocation
                  ? <ActivityIndicator size={14} color="#fff" />
                  : <Text style={styles.phoneSaveText}>Save</Text>
                }
              </TouchableOpacity>
            </View>
          </>
        ) : (
          <>
            <TouchableOpacity style={styles.infoRow} onPress={() => setEditingLocation(true)} activeOpacity={0.7}>
              <Text style={styles.infoLabel}>State</Text>
              <View style={styles.phoneViewRight}>
                <Text style={styles.infoValue}>{state || '—'}</Text>
                <Text style={styles.editLink}>Edit</Text>
              </View>
            </TouchableOpacity>
            <View style={styles.divider} />
            <TouchableOpacity style={styles.infoRow} onPress={() => setEditingLocation(true)} activeOpacity={0.7}>
              <Text style={styles.infoLabel}>City</Text>
              <View style={styles.phoneViewRight}>
                <Text style={styles.infoValue}>{city || '—'}</Text>
                <Text style={styles.editLink}>Edit</Text>
              </View>
            </TouchableOpacity>
          </>
        )}
      </View>

      {/* Situation Tags */}
      <Text style={[styles.sectionTitle, { marginTop: 28 }]}>Situation Tags</Text>
      <View style={styles.card}>
        {editingTags ? (
          <>
            <TouchableOpacity style={[styles.infoRow, { paddingBottom: 8 }]} onPress={() => setShowTagPicker(true)} activeOpacity={0.7}>
              <Text style={styles.infoLabel}>Select tags</Text>
              <Text style={[styles.infoValue, { color: COLORS.primary }]}>
                {selectedTags.length === 0 ? 'None' : `${selectedTags.length} selected`} ▾
              </Text>
            </TouchableOpacity>
            {selectedTags.length > 0 && (
              <View style={styles.tagChipRow}>
                {selectedTags.map(tag => (
                  <TouchableOpacity key={tag} style={styles.tagChip} onPress={() => toggleTag(tag)} activeOpacity={0.7}>
                    <Text style={styles.tagChipText}>{tag}</Text>
                    <Text style={styles.tagChipX}>✕</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
            <View style={styles.phoneActions}>
              <TouchableOpacity onPress={() => { setSelectedTags(guardian?.situation_tags ?? []); setEditingTags(false); }}>
                <Text style={styles.phoneCancel}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.phoneSaveBtn} onPress={saveTags} disabled={savingTags}>
                {savingTags
                  ? <ActivityIndicator size={14} color="#fff" />
                  : <Text style={styles.phoneSaveText}>Save</Text>
                }
              </TouchableOpacity>
            </View>
          </>
        ) : (
          <TouchableOpacity style={styles.infoRow} onPress={() => setEditingTags(true)} activeOpacity={0.7}>
            <View style={{ flex: 1 }}>
              {selectedTags.length === 0 ? (
                <Text style={styles.infoValue}>None selected</Text>
              ) : (
                <View style={styles.tagChipRow}>
                  {selectedTags.map(tag => (
                    <View key={tag} style={styles.tagChipReadOnly}>
                      <Text style={styles.tagChipText}>{tag}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
            <Text style={styles.editLink}>Edit</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Notification settings — commented out, re-enable when notifications are wired up
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
      */}

      <TouchableOpacity style={styles.signOutBtn} onPress={signOut}>
        <Text style={styles.signOutText}>Sign Out</Text>
      </TouchableOpacity>
    </ScrollView>

    {/* State picker modal */}
    <Modal visible={showStatePicker} animationType="slide" transparent onRequestClose={() => setShowStatePicker(false)}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Select State</Text>
            <TouchableOpacity onPress={() => setShowStatePicker(false)}>
              <Text style={styles.modalClose}>Done</Text>
            </TouchableOpacity>
          </View>
          <FlatList
            data={US_STATES}
            keyExtractor={item => item}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[styles.stateItem, state === item && styles.stateItemSelected]}
                onPress={() => { setState(item); setShowStatePicker(false); }}
              >
                <Text style={[styles.stateItemText, state === item && styles.stateItemTextSelected]}>{item}</Text>
                {state === item && <Text style={styles.stateCheck}>✓</Text>}
              </TouchableOpacity>
            )}
            ItemSeparatorComponent={() => <View style={styles.stateDivider} />}
          />
        </View>
      </View>
    </Modal>

    {/* Situation tag picker modal */}
    <Modal visible={showTagPicker} animationType="slide" transparent onRequestClose={() => setShowTagPicker(false)}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Situation Tags</Text>
            <TouchableOpacity onPress={() => setShowTagPicker(false)}>
              <Text style={styles.modalClose}>Done</Text>
            </TouchableOpacity>
          </View>
          {tagOptions.length === 0 ? (
            <View style={{ padding: 40, alignItems: 'center' }}>
              <Text style={{ fontSize: 15, color: COLORS.textLight }}>No tags available yet.</Text>
            </View>
          ) : (
            <FlatList
              data={tagOptions}
              keyExtractor={item => item}
              renderItem={({ item }) => {
                const selected = selectedTags.includes(item);
                return (
                  <TouchableOpacity
                    style={[styles.stateItem, selected && styles.stateItemSelected]}
                    onPress={() => toggleTag(item)}
                  >
                    <Text style={[styles.stateItemText, selected && styles.stateItemTextSelected]}>{item}</Text>
                    {selected && <Text style={styles.stateCheck}>✓</Text>}
                  </TouchableOpacity>
                );
              }}
              ItemSeparatorComponent={() => <View style={styles.stateDivider} />}
            />
          )}
        </View>
      </View>
    </Modal>
    </>
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

  pickerBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderWidth: 1, borderColor: COLORS.primary, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 12,
    backgroundColor: COLORS.background,
  },
  pickerBtnText: { fontSize: 15, color: COLORS.text },
  chevron: { fontSize: 13, color: COLORS.textLight },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '70%' },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 18, borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  modalTitle: { fontSize: 17, fontWeight: '700', color: COLORS.text },
  modalClose: { fontSize: 16, fontWeight: '600', color: COLORS.primary },
  tagChipRow:     { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 16, paddingBottom: 12 },
  tagChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: COLORS.primary + '18', borderWidth: 1.5, borderColor: COLORS.primary,
    borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6,
  },
  tagChipReadOnly: {
    backgroundColor: COLORS.primary + '12', borderWidth: 1, borderColor: COLORS.primary + '60',
    borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5,
  },
  tagChipText: { fontSize: 13, color: COLORS.primary, fontWeight: '600' },
  tagChipX:    { fontSize: 11, color: COLORS.primary, fontWeight: '700' },

  stateItem:             { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14 },
  stateItemSelected:     { backgroundColor: '#EEF4FF' },
  stateItemText:         { fontSize: 16, color: COLORS.text },
  stateItemTextSelected: { fontWeight: '700', color: COLORS.primary },
  stateCheck:    { fontSize: 16, color: COLORS.primary, fontWeight: '700' },
  stateDivider:  { height: 1, backgroundColor: COLORS.border, marginHorizontal: 20 },
});
