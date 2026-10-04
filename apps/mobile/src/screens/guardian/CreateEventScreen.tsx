import React, { useEffect, useState } from 'react';
import {
  View, ScrollView, TouchableOpacity, StyleSheet,
  TextInput, ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Modal,
} from 'react-native';
import AppText from '../../components/AppText';
import RainbowDivider from '../../components/RainbowDivider';
import useNicoHeader from '../../hooks/useNicoHeader';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/AuthContext';
import { GuardianNavParamList } from '../../navigation';
import {
  NICO, TEXT_STYLE, SPACING, RADIUS, FONT_SIZE, FONT_WEIGHT,
  BTN_SIZE, BTN_VARIANT, INPUT, BUTTERFLY_BORDER, scale,
} from '../../constants/theme';
import { LinearGradient } from 'expo-linear-gradient';

type Nav = NativeStackNavigationProp<GuardianNavParamList>;

function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

function formatTimeDisplay(d: Date): string {
  let h = d.getHours();
  const min = String(d.getMinutes()).padStart(2, '0');
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${min} ${ampm}`;
}

function formatTime24(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export default function CreateEventScreen() {
  const navigation = useNavigation<Nav>();
  const { guardian } = useAuth();

  useNicoHeader(navigation);

  const [name, setName]               = useState('');
  const [description, setDescription] = useState('');
  const [venue, setVenue]             = useState('');
  const [duration, setDuration]       = useState('');
  const [category, setCategory]       = useState('');
  const [categories, setCategories]   = useState<string[]>([]);
  const [submitting, setSubmitting]   = useState(false);

  useEffect(() => {
    supabase.from('event_category_options').select('label').order('label')
      .then(({ data }) => setCategories((data ?? []).map((c: any) => c.label)));
  }, []);

  // Category picker
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);

  // Date
  const [date, setDate]               = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [tempDate, setTempDate]       = useState(new Date());

  // Time
  const [time, setTime]               = useState<Date | null>(null);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [tempTime, setTempTime]       = useState(() => {
    const t = new Date(); t.setMinutes(0, 0, 0); return t;
  });

  async function submit() {
    if (!name.trim())        { Alert.alert('Required', 'Event name is required.'); return; }
    if (categories.length > 0 && !category) { Alert.alert('Required', 'Please select a category.'); return; }
    if (!date)                { Alert.alert('Required', 'Please select a date.'); return; }
    if (!time)                { Alert.alert('Required', 'Please select a time.'); return; }
    if (!duration.trim())     { Alert.alert('Required', 'Event duration is required.'); return; }
    if (!venue.trim())        { Alert.alert('Required', 'Venue is required.'); return; }
    if (!description.trim()) { Alert.alert('Required', 'Description is required.'); return; }
    if (!guardian) return;

    setSubmitting(true);
    const { data, error } = await supabase
      .from('events')
      .insert({
        guardian_id: guardian.id,
        name: name.trim(),
        description: description.trim() || null,
        event_date: formatDate(date),
        event_time: time ? formatTime24(time) : null,
        venue: venue.trim() || null,
        duration: duration.trim() || null,
        category: category || null,
      })
      .select('id')
      .single();

    if (error) {
      Alert.alert('Error', error.message);
    } else {
      await supabase.from('event_participants').insert({
        event_id: data.id,
        guardian_id: guardian.id,
        rsvp: 'going',
      });
      navigation.replace('Events', { tab: 'mine' });
    }
    setSubmitting(false);
  }

  const canSubmit = !!name.trim() && (categories.length === 0 || !!category) && !!date && !!time
    && !!duration.trim() && !!venue.trim() && !!description.trim() && !submitting;

  return (
    <View style={s.root}>
      <RainbowDivider />
      <KeyboardAvoidingView
        style={s.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={s.content}
          keyboardShouldPersistTaps="handled"
        >
          <Field label="Event name" required>
            <LinearGradient colors={[...BUTTERFLY_BORDER.colors]} start={BUTTERFLY_BORDER.start} end={BUTTERFLY_BORDER.end} style={s.inputGradient}>
              <TextInput
                style={s.input}
                value={name}
                onChangeText={setName}
                placeholder="e.g. Saturday Play Date"
                placeholderTextColor={NICO.textMuted}
                maxLength={100}
              />
            </LinearGradient>
          </Field>

          {/* Category picker */}
          {categories.length > 0 && (
            <Field label="Category" required>
              <LinearGradient colors={[...BUTTERFLY_BORDER.colors]} start={BUTTERFLY_BORDER.start} end={BUTTERFLY_BORDER.end} style={s.selectGradient}>
                <TouchableOpacity style={s.pickerBtn} onPress={() => setShowCategoryPicker(true)} activeOpacity={0.75}>
                  <AppText style={[s.pickerBtnTxt, !category && s.pickerPlaceholder]}>
                    {category || 'Select category…'}
                  </AppText>
                  {category ? (
                    <TouchableOpacity onPress={() => setCategory('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                      <AppText style={s.clearTxt}>✕</AppText>
                    </TouchableOpacity>
                  ) : (
                    <AppText style={s.pickerIcon}>🏷️</AppText>
                  )}
                </TouchableOpacity>
              </LinearGradient>
            </Field>
          )}

          {/* Date picker */}
          <Field label="Date" required>
            <LinearGradient colors={[...BUTTERFLY_BORDER.colors]} start={BUTTERFLY_BORDER.start} end={BUTTERFLY_BORDER.end} style={s.selectGradient}>
              <TouchableOpacity style={s.pickerBtn} onPress={() => { setTempDate(date ?? new Date()); setShowDatePicker(true); }} activeOpacity={0.75}>
                <AppText style={[s.pickerBtnTxt, !date && s.pickerPlaceholder]}>
                  {date ? date.toLocaleDateString(undefined, { weekday: 'short', month: 'long', day: 'numeric', year: 'numeric' }) : 'Select date'}
                </AppText>
                <AppText style={s.pickerIcon}>📅</AppText>
              </TouchableOpacity>
            </LinearGradient>
          </Field>

          {/* Time picker */}
          <Field label="Time" required>
            <LinearGradient colors={[...BUTTERFLY_BORDER.colors]} start={BUTTERFLY_BORDER.start} end={BUTTERFLY_BORDER.end} style={s.selectGradient}>
              <TouchableOpacity style={s.pickerBtn} onPress={() => { setTempTime(time ?? (() => { const t = new Date(); t.setMinutes(0,0,0); return t; })()); setShowTimePicker(true); }} activeOpacity={0.75}>
                <AppText style={[s.pickerBtnTxt, !time && s.pickerPlaceholder]}>
                  {time ? formatTimeDisplay(time) : 'Select time'}
                </AppText>
                {time ? (
                  <TouchableOpacity onPress={() => setTime(null)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <AppText style={s.clearTxt}>✕</AppText>
                  </TouchableOpacity>
                ) : (
                  <AppText style={s.pickerIcon}>🕐</AppText>
                )}
              </TouchableOpacity>
            </LinearGradient>
          </Field>

          <Field label="Event duration" required>
            <LinearGradient colors={[...BUTTERFLY_BORDER.colors]} start={BUTTERFLY_BORDER.start} end={BUTTERFLY_BORDER.end} style={s.inputGradient}>
              <TextInput
                style={s.input}
                value={duration}
                onChangeText={setDuration}
                placeholder="e.g. 2 hours"
                placeholderTextColor={NICO.textMuted}
                maxLength={50}
              />
            </LinearGradient>
          </Field>

          <Field label="Venue" required>
            <LinearGradient colors={[...BUTTERFLY_BORDER.colors]} start={BUTTERFLY_BORDER.start} end={BUTTERFLY_BORDER.end} style={s.inputGradient}>
              <TextInput
                style={s.input}
                value={venue}
                onChangeText={setVenue}
                placeholder="Where is it happening?"
                placeholderTextColor={NICO.textMuted}
                maxLength={200}
              />
            </LinearGradient>
          </Field>

          <Field label="Description" required>
            <LinearGradient colors={[...BUTTERFLY_BORDER.colors]} start={BUTTERFLY_BORDER.start} end={BUTTERFLY_BORDER.end} style={s.inputGradient}>
              <TextInput
                style={[s.input, s.textArea]}
                value={description}
                onChangeText={setDescription}
                placeholder="What's happening? What should people bring?"
                placeholderTextColor={NICO.textMuted}
                multiline
                numberOfLines={4}
              />
            </LinearGradient>
          </Field>

          <TouchableOpacity
            style={[s.submitBtn, !canSubmit && s.submitBtnDisabled]}
            onPress={submit}
            disabled={!canSubmit}
          >
            {submitting
              ? <ActivityIndicator color={NICO.textOnAccent} />
              : <AppText style={s.submitBtnText}>Create Event</AppText>
            }
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Category picker modal */}
      <Modal visible={showCategoryPicker} transparent animationType="slide" onRequestClose={() => setShowCategoryPicker(false)}>
        <TouchableOpacity style={s.sheetBackdrop} activeOpacity={1} onPress={() => setShowCategoryPicker(false)}>
          <View style={s.sheet} onStartShouldSetResponder={() => true}>
            <View style={s.sheetHdr}>
              <View style={{ width: 60 }} />
              <AppText style={s.sheetTitle}>Select Category</AppText>
              <View style={{ width: 60 }} />
            </View>
            <ScrollView style={{ maxHeight: 320 }}>
              {categories.map(cat => (
                <TouchableOpacity
                  key={cat}
                  style={[s.sheetOption, category === cat && s.sheetOptionActive]}
                  onPress={() => { setCategory(cat); setShowCategoryPicker(false); }}
                  activeOpacity={0.7}
                >
                  <AppText style={[s.sheetOptionText, category === cat && s.sheetOptionTextActive]}>{cat}</AppText>
                  {category === cat && <AppText style={s.sheetCheck}>✓</AppText>}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Date picker modal (iOS) */}
      <Modal visible={showDatePicker} transparent animationType="slide" onRequestClose={() => setShowDatePicker(false)}>
        <TouchableOpacity style={s.sheetBackdrop} activeOpacity={1} onPress={() => setShowDatePicker(false)}>
          <View style={s.sheet} onStartShouldSetResponder={() => true}>
            <View style={s.sheetHdr}>
              <View style={{ width: 60 }} />
              <AppText style={s.sheetTitle}>Select Date</AppText>
              <TouchableOpacity onPress={() => { setDate(tempDate); setShowDatePicker(false); }}>
                <AppText style={s.sheetDone}>Done</AppText>
              </TouchableOpacity>
            </View>
            <DateTimePicker
              value={tempDate}
              mode="date"
              display="spinner"
              minimumDate={new Date()}
              onChange={(_, d) => { if (d) setTempDate(d); }}
              style={s.picker}
            />
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Time picker modal (iOS) */}
      <Modal visible={showTimePicker} transparent animationType="slide" onRequestClose={() => setShowTimePicker(false)}>
        <TouchableOpacity style={s.sheetBackdrop} activeOpacity={1} onPress={() => setShowTimePicker(false)}>
          <View style={s.sheet} onStartShouldSetResponder={() => true}>
            <View style={s.sheetHdr}>
              <View style={{ width: 60 }} />
              <AppText style={s.sheetTitle}>Select Time</AppText>
              <TouchableOpacity onPress={() => { setTime(tempTime); setShowTimePicker(false); }}>
                <AppText style={s.sheetDone}>Done</AppText>
              </TouchableOpacity>
            </View>
            <DateTimePicker
              value={tempTime}
              mode="time"
              display="spinner"
              onChange={(_, t) => { if (t) setTempTime(t); }}
              style={s.picker}
            />
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <View style={s.field}>
      <View style={s.fieldLabelRow}>
        <AppText style={s.fieldLabel}>{label}{required ? <AppText style={s.required}> *</AppText> : ''}</AppText>
      </View>
      {children}
    </View>
  );
}

const s = StyleSheet.create({
  root:      { flex: 1, backgroundColor: NICO.screenBg },
  container: { flex: 1 },
  content:   { padding: SPACING.base, gap: SPACING.md, paddingBottom: 40 },

  field:         { gap: SPACING.sm },
  fieldLabelRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  fieldLabel:    { fontSize: FONT_SIZE.md, fontWeight: FONT_WEIGHT.bold, color: NICO.text },
  required:      { fontSize: FONT_SIZE['2xl'], fontWeight: FONT_WEIGHT.black, color: NICO.error },

  inputGradient: { padding: BUTTERFLY_BORDER.width, borderRadius: RADIUS.md + BUTTERFLY_BORDER.width },
  input:         { ...INPUT.base, borderWidth: 0 },
  textArea:      { minHeight: scale(100), textAlignVertical: 'top' },

  selectGradient: { padding: BUTTERFLY_BORDER.width, borderRadius: RADIUS.md + BUTTERFLY_BORDER.width },
  pickerBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: NICO.surface, borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.base, paddingVertical: 13,
  },
  pickerBtnTxt:      { fontSize: FONT_SIZE.md, color: NICO.text, flex: 1 },
  pickerPlaceholder: { color: NICO.textMuted },
  pickerIcon:        { fontSize: scale(18) },
  clearTxt:          { fontSize: FONT_SIZE.sm, color: NICO.textMuted, fontWeight: FONT_WEIGHT.bold },

  submitBtn:         { ...BTN_SIZE.lg, ...BTN_VARIANT.primary, marginTop: SPACING.sm },
  submitBtnDisabled: { opacity: 0.5 },
  submitBtnText:     { ...TEXT_STYLE.buttonPrimary },

  // Sheets
  sheetBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: NICO.surface,
    borderTopLeftRadius: RADIUS.xl, borderTopRightRadius: RADIUS.xl,
    paddingBottom: 32,
  },
  sheetHdr: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg, paddingVertical: SPACING.base,
    borderBottomWidth: 1, borderBottomColor: NICO.border,
  },
  sheetTitle:  { fontSize: FONT_SIZE.md, fontWeight: FONT_WEIGHT.extraBold, color: NICO.text },
  sheetDone:   { fontSize: FONT_SIZE.md, color: NICO.primary, fontWeight: FONT_WEIGHT.extraBold, width: 60, textAlign: 'right' },
  picker:      { height: 220 },

  sheetOption: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg, paddingVertical: SPACING.base,
    borderBottomWidth: 1, borderBottomColor: NICO.border,
  },
  sheetOptionActive:     { backgroundColor: NICO.primaryLight },
  sheetOptionText:       { fontSize: FONT_SIZE.md, color: NICO.text },
  sheetOptionTextActive: { color: NICO.primary, fontWeight: FONT_WEIGHT.bold },
  sheetCheck:            { fontSize: FONT_SIZE.md, color: NICO.primary, fontWeight: FONT_WEIGHT.extraBold },
});
