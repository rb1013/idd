import React, { useEffect, useState } from 'react';
import {
  View, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator,
  TextInput, Alert, Modal, FlatList,
} from 'react-native';
import AppText from '../../components/AppText';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/AuthContext';
import { COLORS } from '../../constants';
import { US_STATES } from '../../constants/usStates';
import { useNavigation } from '@react-navigation/native';

export default function GuardianEditAccountScreen() {
  const { guardian, refreshGuardian } = useAuth();
  const navigation = useNavigation();

  const [name, setName]   = useState(guardian?.full_name ?? '');
  const [phone, setPhone] = useState(guardian?.phone ?? '');
  const [state, setState] = useState(guardian?.state ?? '');
  const [city, setCity]   = useState(guardian?.city ?? '');
  const [selectedTags, setSelectedTags] = useState<string[]>(guardian?.situation_tags ?? []);

  const [tagOptions, setTagOptions]       = useState<string[]>([]);
  const [showStatePicker, setShowStatePicker] = useState(false);
  const [showTagPicker, setShowTagPicker]     = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.from('situation_tag_options').select('label').order('label').then(({ data }) => {
      setTagOptions((data ?? []).map((r: any) => r.label));
    });
  }, []);

  function toggleTag(tag: string) {
    setSelectedTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);
  }

  async function handleSave() {
    if (!guardian) return;
    if (!name.trim()) { Alert.alert('Name cannot be empty'); return; }
    setSaving(true);
    const { error } = await supabase.from('guardians').update({
      full_name:      name.trim(),
      phone:          phone.trim() || null,
      state:          state || null,
      city:           city.trim() || null,
      country:        'USA',
      situation_tags: selectedTags,
    }).eq('id', guardian.id);
    setSaving(false);
    if (error) { Alert.alert('Failed to save', error.message); return; }
    await refreshGuardian();
    navigation.goBack();
  }

  return (
    <>
    <ScrollView style={styles.container} contentContainerStyle={styles.inner} keyboardShouldPersistTaps="handled">
      <View style={styles.field}>
        <AppText style={styles.label}>Name</AppText>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="Your full name"
          placeholderTextColor={COLORS.textLight}
          maxLength={20}
        />
      </View>

      <View style={styles.field}>
        <AppText style={styles.label}>Phone</AppText>
        <TextInput
          style={styles.input}
          value={phone}
          onChangeText={setPhone}
          placeholder="e.g. +1 555 000 0000"
          placeholderTextColor={COLORS.textLight}
          keyboardType="phone-pad"
        />
      </View>

      <View style={styles.field}>
        <AppText style={styles.label}>Email</AppText>
        <View style={styles.readonlyInput}>
          <AppText style={styles.readonlyText}>{guardian?.email ?? '—'}</AppText>
        </View>
      </View>

      <View style={styles.field}>
        <AppText style={styles.label}>Country</AppText>
        <View style={styles.readonlyInput}>
          <AppText style={styles.readonlyText}>USA</AppText>
        </View>
      </View>

      <View style={styles.field}>
        <AppText style={styles.label}>State</AppText>
        <TouchableOpacity style={styles.pickerBtn} onPress={() => setShowStatePicker(true)} activeOpacity={0.7}>
          <AppText style={[styles.pickerBtnText, !state && { color: COLORS.textLight }]}>
            {state || 'Select state...'}
          </AppText>
          <AppText style={styles.chevron}>▾</AppText>
        </TouchableOpacity>
      </View>

      <View style={styles.field}>
        <AppText style={styles.label}>City</AppText>
        <TextInput
          style={styles.input}
          value={city}
          onChangeText={setCity}
          placeholder="e.g. Austin"
          placeholderTextColor={COLORS.textLight}
          maxLength={20}
        />
      </View>

      <View style={styles.field}>
        <AppText style={styles.label}>Situation Tags</AppText>
        <TouchableOpacity style={styles.pickerBtn} onPress={() => setShowTagPicker(true)} activeOpacity={0.7}>
          <AppText style={[styles.pickerBtnText, selectedTags.length === 0 && { color: COLORS.textLight }]}>
            {selectedTags.length === 0 ? 'Select tags...' : `${selectedTags.length} selected`}
          </AppText>
          <AppText style={styles.chevron}>▾</AppText>
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
      </View>

      <TouchableOpacity
        style={[styles.saveBtn, saving && { opacity: 0.7 }]}
        onPress={handleSave}
        disabled={saving}
        activeOpacity={0.85}
      >
        {saving
          ? <ActivityIndicator color={COLORS.bloomOnAccent} />
          : <AppText style={styles.saveBtnText}>Save Changes</AppText>
        }
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

    {/* Tag picker modal */}
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  inner: { padding: 20, paddingBottom: 48, gap: 20 },

  field: { gap: 8 },
  label: { fontSize: 15, fontWeight: '600', color: COLORS.text },
  readonlyInput: {
    backgroundColor: COLORS.border + '40', borderWidth: 1, borderColor: COLORS.border,
    borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14,
  },
  readonlyText: { fontSize: 15, color: COLORS.textLight },
  input: {
    backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border,
    borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14,
    fontSize: 15, color: COLORS.text,
  },
  pickerBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border,
    borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14,
  },
  pickerBtnText: { fontSize: 15, color: COLORS.text },
  chevron: { fontSize: 13, color: COLORS.textLight },

  tagChipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  tagChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: COLORS.primary + '18', borderWidth: 1.5, borderColor: COLORS.primary,
    borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6,
  },
  tagChipText: { fontSize: 13, color: COLORS.primary, fontWeight: '600' },
  tagChipX:    { fontSize: 11, color: COLORS.primary, fontWeight: '700' },

  saveBtn: {
    marginTop: 8, backgroundColor: COLORS.primary, borderRadius: 14,
    paddingVertical: 16, alignItems: 'center',
  },
  saveBtnText: { color: COLORS.bloomOnAccent, fontSize: 16, fontWeight: '800' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '70%' },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 18, borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  modalTitle: { fontSize: 17, fontWeight: '700', color: COLORS.text },
  modalClose: { fontSize: 16, fontWeight: '600', color: COLORS.primary },

  stateItem:             { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14 },
  stateItemSelected:     { backgroundColor: '#EEF4FF' },
  stateItemText:         { fontSize: 16, color: COLORS.text },
  stateItemTextSelected: { fontWeight: '700', color: COLORS.primary },
  stateCheck:    { fontSize: 16, color: COLORS.primary, fontWeight: '700' },
  stateDivider:  { height: 1, backgroundColor: COLORS.border, marginHorizontal: 20 },
});
