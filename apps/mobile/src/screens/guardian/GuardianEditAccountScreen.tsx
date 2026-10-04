import React, { useEffect, useLayoutEffect, useState } from 'react';
import {
  View, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator,
  TextInput, Alert, Modal, FlatList,
} from 'react-native';
import AppText from '../../components/AppText';
import ContentContainer from '../../components/ContentContainer';
import DropdownPicker from '../../components/DropdownPicker';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/AuthContext';
import { FIXED_STATE } from '../../constants/usStates';
import { CA_COUNTIES } from '../../constants/caCounties';
import { validatePhone, buildE164 } from '../../constants/countryCodes';
import { useNavigation } from '@react-navigation/native';
import {
  NICO, TEXT_STYLE, SPACING, RADIUS, SHADOW, INPUT, BTN_SIZE, BTN_VARIANT, FONT_SIZE, FONT_WEIGHT,
} from '../../constants/theme';

export default function GuardianEditAccountScreen() {
  const { guardian, refreshGuardian } = useAuth();
  const navigation = useNavigation();

  const [name, setName]   = useState(guardian?.full_name ?? '');
  const [phone, setPhone] = useState(() => {
    const raw = guardian?.phone ?? '';
    return raw.startsWith('+1') ? raw.slice(2) : raw.replace(/\D/g, '');
  });
  const [county, setCounty]             = useState(guardian?.county ?? '');
  const [selectedTags, setSelectedTags] = useState<string[]>(guardian?.situation_tags ?? []);

  const [tagOptions, setTagOptions]           = useState<string[]>([]);
  const [showTagPicker, setShowTagPicker]     = useState(false);
  const [saving, setSaving]                   = useState(false);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerStyle:        { backgroundColor: NICO.background },
      headerTitleStyle:   { color: NICO.text },
      headerTintColor:    NICO.text,
      headerShadowVisible: false,
    });
  }, [navigation]);

  useEffect(() => {
    supabase.from('medical_conditions').select('label').order('label').then(({ data }) => {
      setTagOptions((data ?? []).map((r: any) => r.label));
    });
  }, []);

  function toggleTag(tag: string) {
    setSelectedTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);
  }

  async function handleSave() {
    if (!guardian) return;
    if (!name.trim()) { Alert.alert('Name cannot be empty'); return; }
    if (!county) { Alert.alert('Please select a county'); return; }

    const phoneError = validatePhone('+1', phone);
    if (phoneError) { Alert.alert('Invalid phone number', phoneError); return; }

    setSaving(true);
    const { error } = await supabase.from('guardians').update({
      full_name:      name.trim(),
      phone:          buildE164('+1', phone),
      state:          FIXED_STATE,
      county,
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
      <ScrollView
        style={s.root}
        contentContainerStyle={s.inner}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <ContentContainer style={s.fields}>

          <View style={s.field}>
            <AppText style={s.label}>Name<AppText style={s.required}> *</AppText></AppText>
            <TextInput
              style={s.input}
              value={name}
              onChangeText={setName}
              placeholder="Your full name"
              placeholderTextColor={NICO.textMuted}
              maxLength={20}
            />
          </View>

          <View style={s.field}>
            <AppText style={s.label}>Phone<AppText style={s.required}> *</AppText></AppText>
            <View style={s.phoneRow}>
              <View style={s.countryCodeBtn}>
                <AppText style={s.countryFlag}>🇺🇸</AppText>
                <AppText style={s.countryCodeText}>+1</AppText>
              </View>
              <TextInput
                style={s.phoneInput}
                value={phone}
                onChangeText={v => setPhone(v.replace(/[^\d\s\-]/g, ''))}
                placeholder="555 000 0000"
                keyboardType="phone-pad"
                placeholderTextColor={NICO.textMuted}
              />
            </View>
          </View>

          <View style={s.field}>
            <AppText style={s.label}>Email</AppText>
            <View style={s.readonlyInput}>
              <AppText style={s.readonlyText}>{guardian?.email ?? '—'}</AppText>
            </View>
          </View>

          <View style={s.field}>
            <AppText style={s.label}>Country</AppText>
            <View style={s.readonlyInput}>
              <AppText style={s.readonlyText}>USA</AppText>
            </View>
          </View>

          <View style={s.field}>
            <AppText style={s.label}>State</AppText>
            <View style={s.readonlyInput}>
              <AppText style={s.readonlyText}>{FIXED_STATE}</AppText>
            </View>
          </View>

          <View style={s.field}>
            <DropdownPicker label="County" required value={county} options={CA_COUNTIES} onSelect={setCounty} placeholder="Select county..." />
          </View>

          <View style={s.field}>
            <AppText style={s.label}>Regional Support Category (optional)</AppText>
            <TouchableOpacity style={s.pickerBtn} onPress={() => setShowTagPicker(true)} activeOpacity={0.7}>
              <AppText style={[s.pickerBtnText, selectedTags.length === 0 && { color: NICO.textMuted }]}>
                {selectedTags.length === 0 ? 'Select Situation' : `${selectedTags.length} selected`}
              </AppText>
              <AppText style={s.chevron}>▾</AppText>
            </TouchableOpacity>
            {selectedTags.length > 0 && (
              <View style={s.tagRow}>
                {selectedTags.map(tag => (
                  <TouchableOpacity key={tag} style={s.tag} onPress={() => toggleTag(tag)} activeOpacity={0.7}>
                    <AppText style={s.tagText}>{tag}</AppText>
                    <AppText style={s.tagX}>✕</AppText>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          <TouchableOpacity
            style={[s.saveBtn, saving && s.saveBtnDisabled]}
            onPress={handleSave}
            disabled={saving}
            activeOpacity={0.85}
          >
            {saving
              ? <ActivityIndicator color={NICO.textOnAccent} />
              : <AppText style={s.saveBtnText}>Save Changes</AppText>
            }
          </TouchableOpacity>

          <TouchableOpacity style={s.cancelBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
            <AppText style={s.cancelBtnText}>Cancel</AppText>
          </TouchableOpacity>

        </ContentContainer>
      </ScrollView>

      {/* Tag picker */}
      <Modal visible={showTagPicker} animationType="slide" transparent onRequestClose={() => setShowTagPicker(false)}>
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            <View style={s.modalHeader}>
              <AppText style={s.modalTitle}>Regional Support Category</AppText>
              <TouchableOpacity onPress={() => setShowTagPicker(false)}>
                <AppText style={s.modalClose}>Done</AppText>
              </TouchableOpacity>
            </View>
            {tagOptions.length === 0 ? (
              <View style={s.modalEmpty}>
                <AppText style={s.modalEmptyText}>No tags available yet.</AppText>
              </View>
            ) : (
              <FlatList
                data={tagOptions}
                keyExtractor={item => item}
                renderItem={({ item }) => {
                  const selected = selectedTags.includes(item);
                  return (
                    <TouchableOpacity
                      style={[s.listItem, selected && s.listItemSelected]}
                      onPress={() => toggleTag(item)}
                    >
                      <AppText style={[s.listItemText, selected && s.listItemTextSelected]}>{item}</AppText>
                      {selected && <AppText style={s.listCheck}>✓</AppText>}
                    </TouchableOpacity>
                  );
                }}
                ItemSeparatorComponent={() => <View style={s.listDivider} />}
              />
            )}
          </View>
        </View>
      </Modal>
    </>
  );
}

const s = StyleSheet.create({
  root:  { flex: 1, backgroundColor: NICO.screenBg },
  inner: { padding: SPACING.base, paddingBottom: SPACING['3xl'] },
  fields: { gap: SPACING.xl },

  field: { gap: SPACING.xs },
  label: { ...TEXT_STYLE.fieldLabel },
  required: { fontSize: FONT_SIZE['2xl'], fontWeight: FONT_WEIGHT.black, color: NICO.error },

  input: { ...INPUT.base },
  readonlyInput: {
    ...INPUT.base,
    backgroundColor: NICO.background,
    borderColor:     NICO.border,
  },
  readonlyText: { ...TEXT_STYLE.body, color: NICO.textMuted },

  phoneRow: { flexDirection: 'row', gap: SPACING.sm },
  countryCodeBtn: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.xs,
    ...INPUT.base,
    paddingHorizontal: SPACING.md,
  },
  countryFlag:     { fontSize: FONT_SIZE.xl },
  countryCodeText: { ...TEXT_STYLE.bodyMedium },

  phoneInput: { ...INPUT.base, flex: 1 },

  pickerBtn: {
    ...INPUT.base,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  pickerBtnText: { ...TEXT_STYLE.body },
  chevron:       { ...TEXT_STYLE.hint },

  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm, marginTop: SPACING.xs },
  tag: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.xs,
    backgroundColor: NICO.primaryLight,
    borderWidth: 1.5, borderColor: NICO.primary,
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.xs,
  },
  tagText: { ...TEXT_STYLE.caption, color: NICO.primary },
  tagX:    { fontSize: FONT_SIZE.xs, color: NICO.primary, fontWeight: FONT_WEIGHT.bold },

  saveBtn:         { ...BTN_SIZE.lg, ...BTN_VARIANT.primary, marginTop: SPACING.xl },
  saveBtnDisabled: { opacity: 0.7 },
  saveBtnText:     { ...TEXT_STYLE.buttonPrimary },

  cancelBtn:     { marginTop: SPACING.md, padding: SPACING.sm, alignItems: 'center' },
  cancelBtnText: { ...TEXT_STYLE.link },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalCard: {
    backgroundColor: NICO.surface,
    borderTopLeftRadius:  RADIUS['3xl'],
    borderTopRightRadius: RADIUS['3xl'],
    maxHeight: '70%',
    ...SHADOW.xl,
  },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: SPACING.base,
    borderBottomWidth: 1, borderBottomColor: NICO.border,
  },
  modalTitle: { ...TEXT_STYLE.modalTitle },
  modalClose: { ...TEXT_STYLE.link },
  modalEmpty: { padding: SPACING['3xl'], alignItems: 'center' },
  modalEmptyText: { ...TEXT_STYLE.hint },

  listItem:             { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.base, paddingVertical: SPACING.base, gap: SPACING.md },
  listItemSelected:     { backgroundColor: NICO.primaryLight },
  listItemText:         { flex: 1, ...TEXT_STYLE.body },
  listItemTextSelected: { fontWeight: FONT_WEIGHT.bold, color: NICO.primary },
  listCheck:            { ...TEXT_STYLE.bodyMedium, color: NICO.primary },
  listDivider:          { height: 1, backgroundColor: NICO.border, marginHorizontal: SPACING.base },
});
