import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator,
  Image, Alert, TextInput, Modal, FlatList,
} from 'react-native';
import AppText from '../../components/AppText';
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

      {/* Account details */}
      <AppText style={styles.sectionTitle}>Account Details</AppText>
      <View style={styles.card}>
        {/* Editable name row */}
        {editingName ? (
          <View style={styles.phoneEditRow}>
            <AppText style={styles.infoLabel}>Name</AppText>
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
                <AppText style={styles.phoneCancel}>Cancel</AppText>
              </TouchableOpacity>
              <TouchableOpacity style={styles.phoneSaveBtn} onPress={saveName} disabled={savingName}>
                {savingName
                  ? <ActivityIndicator size={14} color="#fff" />
                  : <AppText style={styles.phoneSaveText}>Save</AppText>
                }
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <TouchableOpacity style={styles.infoRow} onPress={() => setEditingName(true)} activeOpacity={0.7}>
            <AppText style={styles.infoLabel}>Name</AppText>
            <View style={styles.phoneViewRight}>
              <AppText style={styles.infoValue}>{name || '—'}</AppText>
              <AppText style={styles.editLink}>✏️</AppText>
            </View>
          </TouchableOpacity>
        )}
        <View style={styles.divider} />
        <InfoRow label="Email" value={guardian?.email ?? '—'} />
        <View style={styles.divider} />

        {/* Editable phone row */}
        {editingPhone ? (
          <View style={styles.phoneEditRow}>
            <AppText style={styles.infoLabel}>Phone</AppText>
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
                <AppText style={styles.phoneCancel}>Cancel</AppText>
              </TouchableOpacity>
              <TouchableOpacity style={styles.phoneSaveBtn} onPress={savePhone} disabled={savingPhone}>
                {savingPhone
                  ? <ActivityIndicator size={14} color="#fff" />
                  : <AppText style={styles.phoneSaveText}>Save</AppText>
                }
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <TouchableOpacity style={styles.infoRow} onPress={() => setEditingPhone(true)} activeOpacity={0.7}>
            <AppText style={styles.infoLabel}>Phone</AppText>
            <View style={styles.phoneViewRight}>
              <AppText style={styles.infoValue}>{phone || '—'}</AppText>
              <AppText style={styles.editLink}>✏️</AppText>
            </View>
          </TouchableOpacity>
        )}
      </View>

      {/* Location */}
      <AppText style={[styles.sectionTitle, { marginTop: 28 }]}>Location</AppText>
      <View style={styles.card}>
        <InfoRow label="Country" value="USA" />
        <View style={styles.divider} />
        {editingLocation ? (
          <>
            {/* State picker row */}
            <View style={styles.phoneEditRow}>
              <AppText style={styles.infoLabel}>State</AppText>
              <TouchableOpacity style={styles.pickerBtn} onPress={() => setShowStatePicker(true)} activeOpacity={0.7}>
                <AppText style={[styles.pickerBtnText, !state && { color: COLORS.textLight }]}>
                  {state || 'Select state...'}
                </AppText>
                <AppText style={styles.chevron}>▾</AppText>
              </TouchableOpacity>
            </View>
            <View style={styles.divider} />
            {/* City text row */}
            <View style={styles.phoneEditRow}>
              <AppText style={styles.infoLabel}>City</AppText>
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
                <AppText style={styles.phoneCancel}>Cancel</AppText>
              </TouchableOpacity>
              <TouchableOpacity style={styles.phoneSaveBtn} onPress={saveLocation} disabled={savingLocation}>
                {savingLocation
                  ? <ActivityIndicator size={14} color="#fff" />
                  : <AppText style={styles.phoneSaveText}>Save</AppText>
                }
              </TouchableOpacity>
            </View>
          </>
        ) : (
          <>
            <TouchableOpacity style={styles.infoRow} onPress={() => setEditingLocation(true)} activeOpacity={0.7}>
              <AppText style={styles.infoLabel}>State</AppText>
              <View style={styles.phoneViewRight}>
                <AppText style={styles.infoValue}>{state || '—'}</AppText>
                <AppText style={styles.editLink}>✏️</AppText>
              </View>
            </TouchableOpacity>
            <View style={styles.divider} />
            <TouchableOpacity style={styles.infoRow} onPress={() => setEditingLocation(true)} activeOpacity={0.7}>
              <AppText style={styles.infoLabel}>City</AppText>
              <View style={styles.phoneViewRight}>
                <AppText style={styles.infoValue}>{city || '—'}</AppText>
                <AppText style={styles.editLink}>✏️</AppText>
              </View>
            </TouchableOpacity>
          </>
        )}
      </View>

      {/* Situation Tags */}
      <AppText style={[styles.sectionTitle, { marginTop: 28 }]}>Situation Tags</AppText>
      <View style={styles.card}>
        {editingTags ? (
          <>
            <TouchableOpacity style={styles.updateTagsLink} onPress={() => setShowTagPicker(true)} activeOpacity={0.7}>
              <AppText style={styles.updateTagsLinkText}>Select more</AppText>
            </TouchableOpacity>
            {selectedTags.length > 0 && (
              <View style={styles.tagChipRow}>
                {selectedTags.map(tag => (
                  <TouchableOpacity key={tag} style={styles.tagChip} onPress={() => toggleTag(tag)} activeOpacity={0.7}>
                    <AppText style={styles.tagChipText}>{tag}</AppText>
                    <AppText style={styles.tagChipX}>✕</AppText>
                  </TouchableOpacity>
                ))}
              </View>
            )}
            <View style={styles.phoneActions}>
              <TouchableOpacity onPress={() => { setSelectedTags(guardian?.situation_tags ?? []); setEditingTags(false); }}>
                <AppText style={styles.phoneCancel}>Cancel</AppText>
              </TouchableOpacity>
              <TouchableOpacity style={styles.phoneSaveBtn} onPress={saveTags} disabled={savingTags}>
                {savingTags
                  ? <ActivityIndicator size={14} color="#fff" />
                  : <AppText style={styles.phoneSaveText}>Save</AppText>
                }
              </TouchableOpacity>
            </View>
          </>
        ) : (
          <TouchableOpacity style={styles.infoRow} onPress={() => setEditingTags(true)} activeOpacity={0.7}>
            <View style={{ flex: 1 }}>
              {selectedTags.length === 0 ? (
                <AppText style={styles.infoValue}>None selected</AppText>
              ) : (
                <View style={styles.tagChipRow}>
                  {selectedTags.map(tag => (
                    <View key={tag} style={styles.tagChipReadOnly}>
                      <AppText style={styles.tagChipText}>{tag}</AppText>
                    </View>
                  ))}
                </View>
              )}
            </View>
            <AppText style={styles.editLink}>✏️</AppText>
          </TouchableOpacity>
        )}
      </View>

      {/* Notification settings — commented out, re-enable when notifications are wired up
      <AppText style={[styles.sectionTitle, { marginTop: 28 }]}>Notification Settings</AppText>
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
        <AppText style={styles.signOutText}>Sign Out</AppText>
      </TouchableOpacity>
    </ScrollView>

    {/* State picker modal */}
    <Modal visible={showStatePicker} animationType="slide" transparent onRequestClose={() => setShowStatePicker(false)}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          <View style={styles.modalHeader}>
            <AppText style={styles.modalTitle}>Select State</AppText>
            <TouchableOpacity onPress={() => setShowStatePicker(false)}>
              <AppText style={styles.modalClose}>Done</AppText>
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
                <AppText style={[styles.stateItemText, state === item && styles.stateItemTextSelected]}>{item}</AppText>
                {state === item && <AppText style={styles.stateCheck}>✓</AppText>}
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
            <AppText style={styles.modalTitle}>Situation Tags</AppText>
            <TouchableOpacity onPress={() => setShowTagPicker(false)}>
              <AppText style={styles.modalClose}>Done</AppText>
            </TouchableOpacity>
          </View>
          {tagOptions.length === 0 ? (
            <View style={{ padding: 40, alignItems: 'center' }}>
              <AppText style={{ fontSize: 15, color: COLORS.textLight }}>No tags available yet.</AppText>
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
                    <AppText style={[styles.stateItemText, selected && styles.stateItemTextSelected]}>{item}</AppText>
                    {selected && <AppText style={styles.stateCheck}>✓</AppText>}
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
      <AppText style={styles.infoLabel}>{label}</AppText>
      <AppText style={styles.infoValue}>{value}</AppText>
    </View>
  );
}

function Toggle({ label, value, onToggle }: { label: string; value: boolean; onToggle: () => void }) {
  return (
    <TouchableOpacity style={styles.toggleRow} onPress={onToggle} delayPressIn={50}>
      <AppText style={styles.toggleLabel}>{label}</AppText>
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
  editLink: { fontSize: 16 },

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
  phoneSaveText: { color: COLORS.bloomOnAccent, fontSize: 14, fontWeight: '700' },

  toggleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16 },
  toggleLabel: { fontSize: 15, color: COLORS.text },
  toggle: { width: 46, height: 26, borderRadius: 13, backgroundColor: COLORS.border, justifyContent: 'center', padding: 2 },
  toggleOn: { backgroundColor: COLORS.primary },
  toggleThumb: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#fff' },
  toggleThumbOn: { alignSelf: 'flex-end' },
  signOutBtn: { marginTop: 32, padding: 16, alignItems: 'center' },
  signOutText: { color: COLORS.textLight, fontSize: 15 },

  updateTagsLink: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-end', gap: 2, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4 },
  updateTagsLinkText: { fontSize: 14, fontWeight: '600', color: COLORS.primary },
  updateTagsChevron: { fontSize: 22, fontWeight: '700', color: COLORS.primary, lineHeight: 22 },

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
