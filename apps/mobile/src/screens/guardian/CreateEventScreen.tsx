import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  TextInput, ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/AuthContext';
import { COLORS } from '../../constants';
import { GuardianNavParamList } from '../../navigation';

type Nav = NativeStackNavigationProp<GuardianNavParamList>;

export default function CreateEventScreen() {
  const navigation = useNavigation<Nav>();
  const { guardian } = useAuth();

  const [name, setName]               = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate]               = useState('');
  const [time, setTime]               = useState('');
  const [venue, setVenue]             = useState('');
  const [submitting, setSubmitting]   = useState(false);

  const isValidDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(new Date(s).getTime());
  const isValidTime = (s: string) => s === '' || /^\d{2}:\d{2}$/.test(s);

  async function submit() {
    if (!name.trim())       { Alert.alert('Required', 'Event name is required.'); return; }
    if (!isValidDate(date)) { Alert.alert('Invalid date', 'Use YYYY-MM-DD e.g. 2026-08-15'); return; }
    if (!isValidTime(time)) { Alert.alert('Invalid time', 'Use HH:MM e.g. 14:30'); return; }
    if (!guardian) return;

    setSubmitting(true);
    const { data, error } = await supabase
      .from('events')
      .insert({
        guardian_id: guardian.id,
        name: name.trim(),
        description: description.trim() || null,
        event_date: date,
        event_time: time || null,
        venue: venue.trim() || null,
      })
      .select('id')
      .single();

    if (error) {
      Alert.alert('Error', error.message);
    } else {
      // Auto-RSVP organiser as going
      await supabase.from('event_participants').insert({
        event_id: data.id,
        guardian_id: guardian.id,
        rsvp: 'going',
      });
      navigation.replace('EventDetail', { eventId: data.id });
    }
    setSubmitting(false);
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
        <Field label="Event name" required hint="required">
          <TextInput
            style={s.input}
            value={name}
            onChangeText={setName}
            placeholder="e.g. Saturday Play Date"
            placeholderTextColor={COLORS.bloomMuted}
            maxLength={100}
          />
        </Field>

        <Field label="Date" hint="YYYY-MM-DD  ·  required">
          <TextInput
            style={s.input}
            value={date}
            onChangeText={setDate}
            placeholder="2026-08-15"
            placeholderTextColor={COLORS.bloomMuted}
            keyboardType="numbers-and-punctuation"
            maxLength={10}
          />
        </Field>

        <Field label="Time" hint="HH:MM  ·  optional">
          <TextInput
            style={s.input}
            value={time}
            onChangeText={setTime}
            placeholder="14:30"
            placeholderTextColor={COLORS.bloomMuted}
            keyboardType="numbers-and-punctuation"
            maxLength={5}
          />
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
            : <Text style={s.submitBtnText}>Create Event</Text>
          }
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <View style={s.field}>
      <View style={s.fieldLabelRow}>
        <Text style={s.fieldLabel}>{label}</Text>
        {hint && <Text style={s.fieldHint}>{hint}</Text>}
      </View>
      {children}
    </View>
  );
}

const s = StyleSheet.create({
  root:      { flex: 1, backgroundColor: COLORS.bloomBody },
  container: { flex: 1 },
  content:   { padding: 20, gap: 16, paddingBottom: 40 },

  field:        { gap: 6 },
  fieldLabelRow:{ flexDirection: 'row', alignItems: 'center', gap: 8 },
  fieldLabel:   { fontSize: 13, fontWeight: '700', color: COLORS.bloomText },
  fieldHint:    { fontSize: 11, color: COLORS.bloomMuted },

  input: {
    backgroundColor: COLORS.bloomCard, borderRadius: 14, borderWidth: 1.5,
    borderColor: COLORS.bloomBorder, paddingHorizontal: 16, paddingVertical: 14,
    fontSize: 15, color: COLORS.bloomText,
  },
  textArea: { minHeight: 100, textAlignVertical: 'top' },

  submitBtn: {
    backgroundColor: COLORS.bloomNavy, borderRadius: 16,
    paddingVertical: 17, alignItems: 'center', marginTop: 8,
  },
  submitBtnText: { color: '#fff', fontWeight: '800', fontSize: 16 },
});
