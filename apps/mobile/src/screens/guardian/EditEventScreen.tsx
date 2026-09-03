import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  TextInput, ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Modal,
} from 'react-native';
import AppText from '../../components/AppText';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { supabase } from '../../lib/supabase';
import { COLORS } from '../../constants';
import { GuardianNavParamList } from '../../navigation';

type Route = RouteProp<GuardianNavParamList, 'EditEvent'>;
type Nav   = NativeStackNavigationProp<GuardianNavParamList>;

function formatDate(d: Date): string {
  const y  = d.getFullYear();
  const m  = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

function formatTimeDisplay(d: Date): string {
  let h = d.getHours();
  const min  = String(d.getMinutes()).padStart(2, '0');
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${min} ${ampm}`;
}

function formatTime24(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function parseDateStr(s: string): Date {
  return new Date(s + 'T12:00:00');
}

function parseTimeStr(s: string): Date {
  const [h, m] = s.split(':').map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d;
}

export default function EditEventScreen() {
  const route      = useRoute<Route>();
  const navigation = useNavigation<Nav>();
  const { eventId } = route.params;

  const [loading, setLoading]           = useState(true);
  const [submitting, setSubmitting]     = useState(false);
  const [name, setName]                 = useState('');
  const [description, setDescription]   = useState('');
  const [venue, setVenue]               = useState('');
  const [category, setCategory]         = useState('');
  const [categories, setCategories]     = useState<string[]>([]);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);

  const [date, setDate]                 = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [tempDate, setTempDate]         = useState(new Date());

  const [time, setTime]                 = useState<Date | null>(null);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [tempTime, setTempTime]         = useState(() => {
    const t = new Date(); t.setMinutes(0, 0, 0); return t;
  });

  useEffect(() => {
    supabase.from('event_category_options').select('label').order('label')
      .then(({ data }) => setCategories((data ?? []).map((c: any) => c.label)));
  }, []);

  useEffect(() => { load(); }, [eventId]);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from('events')
      .select('name, description, event_date, event_time, venue, category')
      .eq('id', eventId)
      .single();

    if (error || !data) {
      Alert.alert('Error', 'Could not load event.');
      navigation.goBack();
      return;
    }

    setName(data.name ?? '');
    setDescription(data.description ?? '');
    setVenue(data.venue ?? '');
    setCategory(data.category ?? '');
    setDate(parseDateStr(data.event_date));
    if (data.event_time) setTime(parseTimeStr(data.event_time));
    setLoading(false);
  }

  async function submit() {
    if (!name.trim()) { Alert.alert('Required', 'Event name is required.'); return; }
    if (!date)        { Alert.alert('Required', 'Please select a date.'); return; }

    setSubmitting(true);
    const { error } = await supabase
      .from('events')
      .update({
        name:        name.trim(),
        description: description.trim() || null,
        event_date:  formatDate(date),
        event_time:  time ? formatTime24(time) : null,
        venue:       venue.trim() || null,
        category:    category || null,
      })
      .eq('id', eventId);

    if (error) {
      Alert.alert('Error', error.message);
    } else {
      navigation.goBack();
    }
    setSubmitting(false);
  }

  if (loading) {
    return <View style={s.center}><ActivityIndicator size="large" color={COLORS.bloomAccent} /></View>;
  }

  const canSubmit = !!name.trim() && !!date && !submitting;

  return (
    <KeyboardAvoidingView
      style={s.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={s.container}
        contentContainerStyle={s.content}
        keyboardShouldPersistTaps="handled"
      >
        <Field label="Event name" required>
          <TextInput
            style={s.input}
            value={name}
            onChangeText={setName}
            placeholder="e.g. Saturday Play Date"
            placeholderTextColor={COLORS.bloomMuted}
            maxLength={100}
          />
        </Field>

        {categories.length > 0 && (
          <Field label="Category" hint="optional">
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
          </Field>
        )}

        <Field label="Date" required>
          <TouchableOpacity
            style={s.pickerBtn}
            onPress={() => { setTempDate(date ?? new Date()); setShowDatePicker(true); }}
            activeOpacity={0.75}
          >
            <AppText style={[s.pickerBtnTxt, !date && s.pickerPlaceholder]}>
              {date
                ? date.toLocaleDateString(undefined, { weekday: 'short', month: 'long', day: 'numeric', year: 'numeric' })
                : 'Select date…'}
            </AppText>
            <AppText style={s.pickerIcon}>📅</AppText>
          </TouchableOpacity>
        </Field>

        <Field label="Time" hint="optional">
          <TouchableOpacity
            style={s.pickerBtn}
            onPress={() => {
              setTempTime(time ?? (() => { const t = new Date(); t.setMinutes(0,0,0); return t; })());
              setShowTimePicker(true);
            }}
            activeOpacity={0.75}
          >
            <AppText style={[s.pickerBtnTxt, !time && s.pickerPlaceholder]}>
              {time ? formatTimeDisplay(time) : 'Select time…'}
            </AppText>
            {time ? (
              <TouchableOpacity onPress={() => setTime(null)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <AppText style={s.clearTxt}>✕</AppText>
              </TouchableOpacity>
            ) : (
              <AppText style={s.pickerIcon}>🕐</AppText>
            )}
          </TouchableOpacity>
        </Field>

        <Field label="Venue" hint="optional">
          <TextInput
            style={s.input}
            value={venue}
            onChangeText={setVenue}
            placeholder="Central Park, New York"
            placeholderTextColor={COLORS.bloomMuted}
            maxLength={200}
          />
        </Field>

        <Field label="Description" hint="optional">
          <TextInput
            style={[s.input, s.textArea]}
            value={description}
            onChangeText={setDescription}
            placeholder="What's happening? What should people bring?"
            placeholderTextColor={COLORS.bloomMuted}
            multiline
            numberOfLines={4}
          />
        </Field>

        <TouchableOpacity
          style={[s.submitBtn, !canSubmit && { opacity: 0.5 }]}
          onPress={submit}
          disabled={!canSubmit}
        >
          {submitting
            ? <ActivityIndicator color="#fff" />
            : <AppText style={s.submitBtnText}>Save Changes</AppText>
          }
        </TouchableOpacity>
      </ScrollView>

      <Modal visible={showCategoryPicker} transparent animationType="slide" onRequestClose={() => setShowCategoryPicker(false)}>
        <TouchableOpacity style={s.sheetBackdrop} activeOpacity={1} onPress={() => setShowCategoryPicker(false)}>
          <View style={s.sheet} onStartShouldSetResponder={() => true}>
            <View style={s.sheetHdr}>
              <TouchableOpacity onPress={() => setShowCategoryPicker(false)}>
                <AppText style={s.sheetCancel}>Cancel</AppText>
              </TouchableOpacity>
              <AppText style={s.sheetTitle}>Select Category</AppText>
              <View style={{ width: 60 }} />
            </View>
            <ScrollView style={{ maxHeight: 320 }}>
              {categories.map(cat => (
                <TouchableOpacity
                  key={cat}
                  style={[s.categoryOption, category === cat && s.categoryOptionActive]}
                  onPress={() => { setCategory(cat); setShowCategoryPicker(false); }}
                  activeOpacity={0.7}
                >
                  <AppText style={[s.categoryOptionText, category === cat && s.categoryOptionTextActive]}>{cat}</AppText>
                  {category === cat && <AppText style={s.categoryCheck}>✓</AppText>}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      <Modal visible={showDatePicker} transparent animationType="slide" onRequestClose={() => setShowDatePicker(false)}>
        <TouchableOpacity style={s.sheetBackdrop} activeOpacity={1} onPress={() => setShowDatePicker(false)}>
          <View style={s.sheet} onStartShouldSetResponder={() => true}>
            <View style={s.sheetHdr}>
              <TouchableOpacity onPress={() => setShowDatePicker(false)}>
                <AppText style={s.sheetCancel}>Cancel</AppText>
              </TouchableOpacity>
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

      <Modal visible={showTimePicker} transparent animationType="slide" onRequestClose={() => setShowTimePicker(false)}>
        <TouchableOpacity style={s.sheetBackdrop} activeOpacity={1} onPress={() => setShowTimePicker(false)}>
          <View style={s.sheet} onStartShouldSetResponder={() => true}>
            <View style={s.sheetHdr}>
              <TouchableOpacity onPress={() => setShowTimePicker(false)}>
                <AppText style={s.sheetCancel}>Cancel</AppText>
              </TouchableOpacity>
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
    </KeyboardAvoidingView>
  );
}

function Field({ label, hint, required, children }: { label: string; hint?: string; required?: boolean; children: React.ReactNode }) {
  return (
    <View style={s.field}>
      <View style={s.fieldLabelRow}>
        <AppText style={s.fieldLabel}>{label}{required ? <AppText style={{ color: COLORS.statusError }}> *</AppText> : ''}</AppText>
        {hint && <AppText style={s.fieldHint}>{hint}</AppText>}
      </View>
      {children}
    </View>
  );
}

const s = StyleSheet.create({
  root:      { flex: 1, backgroundColor: COLORS.bloomBody },
  container: { flex: 1 },
  content:   { padding: 20, gap: 16, paddingBottom: 40 },
  center:    { flex: 1, justifyContent: 'center', alignItems: 'center' },

  field:         { gap: 6 },
  fieldLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  fieldLabel:    { fontSize: 13, fontWeight: '700', color: COLORS.bloomText },
  fieldHint:     { fontSize: 11, color: COLORS.bloomMuted },

  input: {
    backgroundColor: COLORS.bloomCard, borderRadius: 14, borderWidth: 1.5,
    borderColor: COLORS.bloomBorder, paddingHorizontal: 16, paddingVertical: 14,
    fontSize: 15, color: COLORS.bloomText,
  },
  textArea: { minHeight: 100, textAlignVertical: 'top' },

  pickerBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: COLORS.bloomCard, borderRadius: 14, borderWidth: 1.5,
    borderColor: COLORS.bloomBorder, paddingHorizontal: 16, paddingVertical: 14,
  },
  pickerBtnTxt:     { fontSize: 15, color: COLORS.bloomText, flex: 1 },
  pickerPlaceholder:{ color: COLORS.bloomMuted },
  pickerIcon:       { fontSize: 18 },
  clearTxt:         { fontSize: 14, color: COLORS.bloomMuted, fontWeight: '700' },

  submitBtn: {
    backgroundColor: COLORS.bloomAccent, borderRadius: 16,
    paddingVertical: 17, alignItems: 'center', marginTop: 8,
  },
  submitBtnText: { color: COLORS.bloomOnAccent, fontWeight: '800', fontSize: 16 },

  categoryOption: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: COLORS.bloomBorder,
  },
  categoryOptionActive:     { backgroundColor: COLORS.bloomTintBg },
  categoryOptionText:       { fontSize: 15, color: COLORS.bloomText },
  categoryOptionTextActive: { color: COLORS.bloomNavy, fontWeight: '700' },
  categoryCheck:            { fontSize: 16, color: COLORS.bloomNavy, fontWeight: '700' },

  sheetBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: COLORS.bloomCard,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingBottom: 32,
  },
  sheetHdr: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 16,
    borderBottomWidth: 1, borderBottomColor: COLORS.bloomBorder,
  },
  sheetTitle:  { fontSize: 16, fontWeight: '800', color: COLORS.bloomText },
  sheetCancel: { fontSize: 15, color: COLORS.bloomMuted },
  sheetDone:   { fontSize: 15, fontWeight: '700', color: COLORS.bloomNavy },
  picker:      { height: 220 },
});
