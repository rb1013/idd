import React, { useEffect, useLayoutEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  TextInput, Alert, ActivityIndicator, Modal, FlatList,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import AppText from '../../components/AppText';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/AuthContext';
import { COLORS } from '../../constants';
import { GuardianNavParamList } from '../../navigation';
import { ScheduleTemplate, ScheduleEvent } from '../../types';

type Route = RouteProp<GuardianNavParamList, 'UserSchedule'>;
type Nav   = NativeStackNavigationProp<GuardianNavParamList>;

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Preset times every 30 min from 6 AM to 9 PM
const TIMES: string[] = [];
for (let h = 6; h <= 21; h++) {
  TIMES.push(`${h > 12 ? h - 12 : h === 0 ? 12 : h}:00 ${h < 12 ? 'AM' : 'PM'}`);
  if (h < 21) TIMES.push(`${h > 12 ? h - 12 : h === 0 ? 12 : h}:30 ${h < 12 ? 'AM' : 'PM'}`);
}

// Smart emoji suggestions by keyword
const EMOJI_MAP: [string[], string[]][] = [
  [['piano', 'keyboard'],       ['🎹', '🎵', '🎼', '🎶']],
  [['music', 'singing', 'choir'], ['🎵', '🎤', '🎼', '🎸']],
  [['swim', 'pool', 'water'],   ['🏊', '🌊', '💦', '🏅']],
  [['art', 'draw', 'paint'],    ['🎨', '🖌️', '✏️', '🖍️']],
  [['dance', 'ballet'],         ['💃', '🕺', '🎭', '🩰']],
  [['yoga', 'meditation'],      ['🧘', '🌿', '💆', '☮️']],
  [['gym', 'sport', 'fitness'], ['💪', '🏋️', '🤸', '🏅']],
  [['read', 'book', 'library'], ['📚', '📖', '📝', '🔤']],
  [['cook', 'bak', 'kitchen'],  ['🍳', '👨‍🍳', '🥘', '🧁']],
  [['theatre', 'theater', 'play'], ['🎭', '🎬', '🎪', '🌟']],
  [['soccer', 'football'],      ['⚽', '🏃', '🥅', '🏆']],
  [['basketball'],              ['🏀', '🏃', '🤸', '🏆']],
  [['horse', 'riding'],         ['🐴', '🤠', '🎠', '🏇']],
  [['game', 'gaming'],          ['🎮', '🕹️', '🧩', '🎯']],
  [['speech', 'therapy'],       ['🗣️', '💬', '🧠', '💙']],
];

function suggestEmojis(title: string): string[] {
  const v = title.toLowerCase();
  for (const [keys, emojis] of EMOJI_MAP) {
    if (keys.some(k => v.includes(k))) return emojis;
  }
  return ['📅', '⭐', '🎯', '✨'];
}

function formatTime(t: string): string {
  const [h, m] = t.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 || 12;
  return `${hour}:${m.toString().padStart(2, '0')} ${period}`;
}

function parseTimeToDb(display: string): string {
  const [time, period] = display.split(' ');
  let [h, m] = time.split(':').map(Number);
  if (period === 'PM' && h !== 12) h += 12;
  if (period === 'AM' && h === 12) h = 0;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:00`;
}

function formatDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatDateLong(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function todayIso(): string { return new Date().toISOString().slice(0, 10); }

function addMonths(iso: string, n: number): string {
  const d = new Date(iso + 'T00:00:00');
  d.setMonth(d.getMonth() + n);
  return d.toISOString().slice(0, 10);
}

// Build array of ISO dates from today to +90 days
function buildDateOptions(): string[] {
  const dates: string[] = [];
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  for (let i = 0; i < 91; i++) {
    dates.push(d.toISOString().slice(0, 10));
    d.setDate(d.getDate() + 1);
  }
  return dates;
}
const DATE_OPTIONS = buildDateOptions();

// ── Sub-components ────────────────────────────────────────────────────────

function TimePicker({
  value, onChange,
}: { value: string; onChange: (v: string) => void }) {
  const [visible, setVisible] = useState(false);
  return (
    <>
      <TouchableOpacity style={styles.fbox} onPress={() => setVisible(true)}>
        <AppText style={styles.fboxText}>{value}</AppText>
      </TouchableOpacity>
      <Modal visible={visible} transparent animationType="fade" onRequestClose={() => setVisible(false)}>
        <TouchableOpacity style={styles.pickerOverlay} activeOpacity={1} onPress={() => setVisible(false)}>
          <View style={styles.pickerCard}>
            <AppText style={styles.pickerTitle}>Select time</AppText>
            <FlatList
              data={TIMES}
              keyExtractor={t => t}
              style={{ maxHeight: 260 }}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.pickerItem, value === item && styles.pickerItemSel]}
                  onPress={() => { onChange(item); setVisible(false); }}
                >
                  <AppText style={[styles.pickerItemTxt, value === item && styles.pickerItemTxtSel]}>{item}</AppText>
                </TouchableOpacity>
              )}
            />
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

function DatePicker({
  value, onChange, minDate,
}: { value: string; onChange: (v: string) => void; minDate?: string }) {
  const [visible, setVisible] = useState(false);
  const options = minDate ? DATE_OPTIONS.filter(d => d >= minDate) : DATE_OPTIONS;
  return (
    <>
      <TouchableOpacity style={styles.fbox} onPress={() => setVisible(true)}>
        <AppText style={styles.fboxText}>{formatDate(value)}</AppText>
      </TouchableOpacity>
      <Modal visible={visible} transparent animationType="fade" onRequestClose={() => setVisible(false)}>
        <TouchableOpacity style={styles.pickerOverlay} activeOpacity={1} onPress={() => setVisible(false)}>
          <View style={styles.pickerCard}>
            <AppText style={styles.pickerTitle}>Select date</AppText>
            <FlatList
              data={options}
              keyExtractor={d => d}
              style={{ maxHeight: 260 }}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.pickerItem, value === item && styles.pickerItemSel]}
                  onPress={() => { onChange(item); setVisible(false); }}
                >
                  <AppText style={[styles.pickerItemTxt, value === item && styles.pickerItemTxtSel]}>
                    {formatDateLong(item)}
                  </AppText>
                </TouchableOpacity>
              )}
            />
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

function EmojiRow({ emojis, selected, onSelect }: { emojis: string[]; selected: string; onSelect: (e: string) => void }) {
  return (
    <View style={styles.emojiRow}>
      {emojis.map(e => (
        <TouchableOpacity
          key={e}
          style={[styles.emojiChip, selected === e && styles.emojiChipSel]}
          onPress={() => onSelect(e)}
        >
          <AppText style={styles.emojiChipTxt}>{e}</AppText>
        </TouchableOpacity>
      ))}
    </View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────

export default function UserScheduleScreen() {
  const route      = useRoute<Route>();
  const navigation = useNavigation<Nav>();
  const { userId, userName } = route.params;
  const { guardian } = useAuth();

  useLayoutEffect(() => {
    navigation.setOptions({ title: `${userName}'s Schedule` });
  }, [userName]);

  const [tab, setTab] = useState<'weekly' | 'oneoff'>('weekly');
  const [templates, setTemplates] = useState<ScheduleTemplate[]>([]);
  const [events, setEvents] = useState<ScheduleEvent[]>([]);
  const [loading, setLoading] = useState(true);

  // Weekly sheet state
  const [weeklySheet, setWeeklySheet] = useState(false);
  const [addDay, setAddDay] = useState(1);
  const [wTitle, setWTitle] = useState('');
  const [wEmoji, setWEmoji] = useState('📅');
  const [wStart, setWStart] = useState('9:00 AM');
  const [wEnd, setWEnd] = useState('10:00 AM');
  const [wFrom, setWFrom] = useState(todayIso);
  const [wUntil, setWUntil] = useState(() => addMonths(todayIso(), 3));
  const [wSaving, setWSaving] = useState(false);

  // One-off sheet state
  const [oneoffSheet, setOneoffSheet] = useState(false);
  const [ooMode, setOoMode] = useState<'new' | 'cancel'>('new');
  const [ooDate, setOoDate] = useState(todayIso);
  const [ooTitle, setOoTitle] = useState('');
  const [ooEmoji, setOoEmoji] = useState('📅');
  const [ooStart, setOoStart] = useState('9:00 AM');
  const [ooEnd, setOoEnd] = useState('10:00 AM');
  const [cancelTemplateId, setCancelTemplateId] = useState<string | null>(null);
  const [ooSaving, setOoSaving] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    if (!guardian) return;
    const [{ data: tmpl }, { data: evts }] = await Promise.all([
      supabase.rpc('get_guardian_templates', { p_guardian_id: guardian.id, p_user_id: userId }),
      supabase.rpc('get_schedule_events',    { p_guardian_id: guardian.id, p_user_id: userId }),
    ]);
    setTemplates((tmpl || []) as ScheduleTemplate[]);
    setEvents((evts || []) as ScheduleEvent[]);
    setLoading(false);
  }

  function openWeeklySheet(dow: number) {
    setAddDay(dow);
    setWTitle(''); setWEmoji('📅');
    setWStart('9:00 AM'); setWEnd('10:00 AM');
    setWFrom(todayIso()); setWUntil(addMonths(todayIso(), 3));
    setWeeklySheet(true);
  }

  function openOneoffSheet() {
    setOoMode('new'); setOoDate(todayIso());
    setOoTitle(''); setOoEmoji('📅');
    setOoStart('9:00 AM'); setOoEnd('10:00 AM');
    setCancelTemplateId(null);
    setOneoffSheet(true);
  }

  async function saveWeeklyClass() {
    if (!guardian) return;
    if (!wTitle.trim()) { Alert.alert('', 'Please enter a class name'); return; }
    setWSaving(true);
    const { error } = await supabase.rpc('upsert_schedule_template', {
      p_guardian_id: guardian.id,
      p_user_id:     userId,
      p_day_of_week: addDay,
      p_start_time:  parseTimeToDb(wStart),
      p_end_time:    parseTimeToDb(wEnd),
      p_title:       wTitle.trim(),
      p_emoji:       wEmoji,
      p_valid_from:  wFrom,
      p_valid_until: wUntil,
    });
    setWSaving(false);
    if (error) { Alert.alert('Error', error.message); return; }
    setWeeklySheet(false);
    load();
  }

  async function deleteTemplate(id: string) {
    if (!guardian) return;
    Alert.alert('Remove class', 'Remove this recurring class?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove', style: 'destructive',
        onPress: async () => {
          await supabase.rpc('delete_schedule_template', { p_guardian_id: guardian.id, p_template_id: id });
          load();
        },
      },
    ]);
  }

  async function saveOneoffEvent() {
    if (!guardian) return;
    const isCancellation = ooMode === 'cancel';
    if (!isCancellation && !ooTitle.trim()) { Alert.alert('', 'Please enter a class name'); return; }
    if (isCancellation && !cancelTemplateId) { Alert.alert('', 'Please select a class to cancel'); return; }

    // For cancellation, populate title/time from the template
    let title = ooTitle.trim();
    let emoji = ooEmoji;
    let start = parseTimeToDb(ooStart);
    let end = parseTimeToDb(ooEnd);

    if (isCancellation && cancelTemplateId) {
      const tmpl = templates.find(t => t.id === cancelTemplateId);
      if (tmpl) { title = tmpl.title; emoji = tmpl.emoji; start = tmpl.start_time; end = tmpl.end_time; }
    }

    setOoSaving(true);
    const { error } = await supabase.rpc('add_schedule_event', {
      p_guardian_id:     guardian.id,
      p_user_id:         userId,
      p_event_date:      ooDate,
      p_start_time:      start,
      p_end_time:        end,
      p_title:           title,
      p_emoji:           emoji,
      p_is_cancellation: isCancellation,
      p_template_id:     cancelTemplateId,
    });
    setOoSaving(false);
    if (error) { Alert.alert('Error', error.message); return; }
    setOneoffSheet(false);
    load();
  }

  async function deleteEvent(id: string) {
    if (!guardian) return;
    Alert.alert('Remove', 'Remove this event?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove', style: 'destructive',
        onPress: async () => {
          await supabase.rpc('delete_schedule_event', { p_guardian_id: guardian.id, p_event_id: id });
          load();
        },
      },
    ]);
  }

  // Templates for a given day that are within the valid cancel date window
  function cancellableTemplatesForDate(date: string): ScheduleTemplate[] {
    const dow = new Date(date + 'T00:00:00').getDay();
    return templates.filter(
      t => t.day_of_week === dow && t.valid_from <= date && t.valid_until >= date,
    );
  }

  // ── Weekly tab ─────────────────────────────────────────────────────────

  function renderWeekly() {
    return (
      <ScrollView contentContainerStyle={styles.tabContent}>
        {DAYS.map((day, dow) => {
          const dayTemplates = templates.filter(t => t.day_of_week === dow);
          return (
            <View key={dow} style={styles.dayBlock}>
              <AppText style={styles.dayLabel}>{day.toUpperCase()}</AppText>
              {dayTemplates.length === 0
                ? <AppText style={styles.emptyDay}>No classes</AppText>
                : dayTemplates.map(t => (
                  <View key={t.id} style={styles.classCard}>
                    <AppText style={styles.classEmoji}>{t.emoji}</AppText>
                    <View style={styles.classInfo}>
                      <AppText style={styles.classTitle}>{t.title}</AppText>
                      <AppText style={styles.classTime}>
                        {formatTime(t.start_time)} – {formatTime(t.end_time)}
                        {' · '}Until {formatDate(t.valid_until)}
                      </AppText>
                    </View>
                    <TouchableOpacity style={styles.delBtn} onPress={() => deleteTemplate(t.id)}>
                      <AppText style={styles.delBtnTxt}>✕</AppText>
                    </TouchableOpacity>
                  </View>
                ))
              }
              <TouchableOpacity style={styles.addDayBtn} onPress={() => openWeeklySheet(dow)}>
                <AppText style={styles.addDayBtnTxt}>+ Add {DAYS_SHORT[dow]} class</AppText>
              </TouchableOpacity>
            </View>
          );
        })}
        <View style={{ height: 32 }} />
      </ScrollView>
    );
  }

  // ── One-off tab ────────────────────────────────────────────────────────

  function renderOneoff() {
    if (events.length === 0) {
      return (
        <View style={[styles.center, { flex: 1 }]}>
          <AppText style={{ fontSize: 44, marginBottom: 8 }}>✨</AppText>
          <AppText style={styles.emptyTitle}>No one-off events</AppText>
          <AppText style={styles.emptyHint}>Add a special class or cancel a recurring one</AppText>
        </View>
      );
    }
    return (
      <ScrollView contentContainerStyle={styles.tabContent}>
        {events.map(ev => (
          <View key={ev.id}>
            <AppText style={styles.ooDateLabel}>
              {formatDateLong(ev.event_date)}
              {ev.is_cancellation ? ' — cancellation' : ''}
            </AppText>
            <View style={[styles.classCard, ev.is_cancellation && styles.cancelCard]}>
              <AppText style={styles.classEmoji}>{ev.is_cancellation ? '🚫' : ev.emoji}</AppText>
              <View style={styles.classInfo}>
                <AppText style={[styles.classTitle, ev.is_cancellation && { color: COLORS.statusRedDark }]}>{ev.title}</AppText>
                <AppText style={[styles.classTime, ev.is_cancellation && { color: COLORS.statusError }]}>
                  {formatTime(ev.start_time)} – {formatTime(ev.end_time)}
                  {ev.is_cancellation ? '' : ' · One-off'}
                </AppText>
              </View>
              {ev.is_cancellation && (
                <View style={styles.cancelBadge}><AppText style={styles.cancelBadgeTxt}>CANCELLED</AppText></View>
              )}
              <TouchableOpacity style={styles.delBtn} onPress={() => deleteEvent(ev.id)}>
                <AppText style={styles.delBtnTxt}>✕</AppText>
              </TouchableOpacity>
            </View>
          </View>
        ))}
        <View style={{ height: 32 }} />
      </ScrollView>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color={COLORS.primary} /></View>;

  const wSuggestions = suggestEmojis(wTitle);
  const ooSuggestions = suggestEmojis(ooTitle);
  const cancellable = cancellableTemplatesForDate(ooDate);

  return (
    <View style={styles.container}>

      {/* Segmented control */}
      <View style={styles.seg}>
        <TouchableOpacity style={[styles.segBtn, tab === 'weekly' && styles.segBtnOn]} onPress={() => setTab('weekly')}>
          <AppText style={[styles.segTxt, tab === 'weekly' && styles.segTxtOn]}>📅  Weekly</AppText>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.segBtn, tab === 'oneoff' && styles.segBtnOn]} onPress={() => setTab('oneoff')}>
          <AppText style={[styles.segTxt, tab === 'oneoff' && styles.segTxtOn]}>✨  One-off</AppText>
        </TouchableOpacity>
      </View>

      {/* Add button for one-off tab */}
      {tab === 'oneoff' && (
        <View style={styles.ooTopRow}>
          <TouchableOpacity style={styles.addPill} onPress={openOneoffSheet}>
            <AppText style={styles.addPillTxt}>+ Add</AppText>
          </TouchableOpacity>
        </View>
      )}

      {tab === 'weekly' ? renderWeekly() : renderOneoff()}

      {/* ── Add Weekly Class sheet ── */}
      <Modal visible={weeklySheet} transparent animationType="slide" onRequestClose={() => setWeeklySheet(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <TouchableOpacity style={styles.sheetOverlay} activeOpacity={1} onPress={() => setWeeklySheet(false)}>
            <TouchableOpacity style={styles.sheet} activeOpacity={1} onPress={() => {}}>
              <View style={styles.sheetHandle} />
              <AppText style={styles.sheetTitle}>Add {DAYS[addDay]} Class</AppText>

              <AppText style={styles.fieldLabel}>Class name</AppText>
              <TextInput
                style={styles.fieldInput}
                value={wTitle}
                onChangeText={setWTitle}
                placeholder="e.g. Piano Lesson"
                placeholderTextColor={COLORS.textLight}
              />

              <AppText style={styles.fieldLabel}>Emoji</AppText>
              <EmojiRow
                emojis={wSuggestions}
                selected={wEmoji}
                onSelect={setWEmoji}
              />

              <View style={styles.fieldRow}>
                <View style={{ flex: 1 }}>
                  <AppText style={styles.fieldLabel}>Start time</AppText>
                  <TimePicker value={wStart} onChange={setWStart} />
                </View>
                <View style={{ flex: 1 }}>
                  <AppText style={styles.fieldLabel}>End time</AppText>
                  <TimePicker value={wEnd} onChange={setWEnd} />
                </View>
              </View>

              <View style={styles.fieldRow}>
                <View style={{ flex: 1 }}>
                  <AppText style={styles.fieldLabel}>Valid from</AppText>
                  <DatePicker value={wFrom} onChange={setWFrom} />
                </View>
                <View style={{ flex: 1 }}>
                  <AppText style={styles.fieldLabel}>Until</AppText>
                  <DatePicker value={wUntil} onChange={v => setWUntil(v)} minDate={wFrom} />
                </View>
              </View>
              <AppText style={styles.fieldHint}>Repeats every {DAYS[addDay]} · Max 3 months</AppText>

              <TouchableOpacity
                style={[styles.saveBtn, wSaving && { opacity: 0.6 }]}
                onPress={saveWeeklyClass}
                disabled={wSaving}
              >
                <AppText style={styles.saveBtnTxt}>{wSaving ? 'Saving…' : 'Save Class'}</AppText>
              </TouchableOpacity>
            </TouchableOpacity>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Add One-off Event sheet ── */}
      <Modal visible={oneoffSheet} transparent animationType="slide" onRequestClose={() => setOneoffSheet(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <TouchableOpacity style={styles.sheetOverlay} activeOpacity={1} onPress={() => setOneoffSheet(false)}>
            <TouchableOpacity style={styles.sheet} activeOpacity={1} onPress={() => {}}>
              <View style={styles.sheetHandle} />
              <AppText style={styles.sheetTitle}>Add One-off Event</AppText>

              {/* Radio */}
              <TouchableOpacity style={[styles.radio, ooMode === 'new' && styles.radioSel]} onPress={() => setOoMode('new')}>
                <View style={[styles.radioDot, ooMode === 'new' && styles.radioDotSel]} />
                <View>
                  <AppText style={styles.radioTitle}>New class on a specific date</AppText>
                  <AppText style={styles.radioSub}>Add a class that doesn't repeat</AppText>
                </View>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.radio, ooMode === 'cancel' && styles.radioSel]} onPress={() => setOoMode('cancel')}>
                <View style={[styles.radioDot, ooMode === 'cancel' && styles.radioDotSel]} />
                <View>
                  <AppText style={styles.radioTitle}>Cancel a recurring class</AppText>
                  <AppText style={styles.radioSub}>Mark one occurrence as cancelled</AppText>
                </View>
              </TouchableOpacity>

              <AppText style={styles.fieldLabel}>{ooMode === 'cancel' ? 'Date to cancel' : 'Date'}</AppText>
              <DatePicker value={ooDate} onChange={v => { setOoDate(v); setCancelTemplateId(null); }} />

              {ooMode === 'new' ? (
                <>
                  <AppText style={styles.fieldLabel}>Class name</AppText>
                  <TextInput
                    style={styles.fieldInput}
                    value={ooTitle}
                    onChangeText={setOoTitle}
                    placeholder="e.g. Theatre Trip"
                    placeholderTextColor={COLORS.textLight}
                  />

                  <AppText style={styles.fieldLabel}>Emoji</AppText>
                  <EmojiRow emojis={ooSuggestions} selected={ooEmoji} onSelect={setOoEmoji} />

                  <View style={styles.fieldRow}>
                    <View style={{ flex: 1 }}>
                      <AppText style={styles.fieldLabel}>Start time</AppText>
                      <TimePicker value={ooStart} onChange={setOoStart} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <AppText style={styles.fieldLabel}>End time</AppText>
                      <TimePicker value={ooEnd} onChange={setOoEnd} />
                    </View>
                  </View>

                  <TouchableOpacity
                    style={[styles.saveBtn, ooSaving && { opacity: 0.6 }]}
                    onPress={saveOneoffEvent}
                    disabled={ooSaving}
                  >
                    <AppText style={styles.saveBtnTxt}>{ooSaving ? 'Saving…' : 'Save Event'}</AppText>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <AppText style={styles.fieldLabel}>Which class to cancel?</AppText>
                  {cancellable.length === 0
                    ? <AppText style={styles.fieldHint}>No recurring classes on {formatDateLong(ooDate)}</AppText>
                    : cancellable.map(t => (
                      <TouchableOpacity
                        key={t.id}
                        style={[styles.cancelOption, cancelTemplateId === t.id && styles.cancelOptionSel]}
                        onPress={() => setCancelTemplateId(t.id)}
                      >
                        <AppText style={styles.cancelOptionEmoji}>{t.emoji}</AppText>
                        <AppText style={styles.cancelOptionTxt}>
                          {t.title}  {formatTime(t.start_time)}
                        </AppText>
                      </TouchableOpacity>
                    ))
                  }
                  <TouchableOpacity
                    style={[styles.cancelBtn, ooSaving && { opacity: 0.6 }]}
                    onPress={saveOneoffEvent}
                    disabled={ooSaving}
                  >
                    <AppText style={styles.cancelBtnTxt}>{ooSaving ? 'Saving…' : 'Mark as Cancelled'}</AppText>
                  </TouchableOpacity>
                </>
              )}
            </TouchableOpacity>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 8, padding: 32, backgroundColor: '#F9FAFB' },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: COLORS.text },
  emptyHint: { fontSize: 13, color: COLORS.textLight, textAlign: 'center' },

  seg: {
    flexDirection: 'row', backgroundColor: '#F3F4F6',
    margin: 12, borderRadius: 12, padding: 3,
  },
  segBtn: { flex: 1, padding: 10, alignItems: 'center', borderRadius: 10 },
  segBtnOn: { backgroundColor: '#fff', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 2 },
  segTxt: { fontSize: 14, fontWeight: '700', color: COLORS.statusMidGrey },
  segTxtOn: { color: COLORS.statusDark },

  ooTopRow: { alignItems: 'flex-end', paddingHorizontal: 16, paddingBottom: 8 },
  addPill: { backgroundColor: COLORS.statusViolet, borderRadius: 12, paddingVertical: 9, paddingHorizontal: 18 },
  addPillTxt: { color: COLORS.bloomOnAccent, fontSize: 13, fontWeight: '700' },

  tabContent: { padding: 16, paddingBottom: 40 },

  dayBlock: { marginBottom: 16 },
  dayLabel: { fontSize: 12, fontWeight: '700', color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  emptyDay: { fontSize: 13, color: '#C4C9D4', fontStyle: 'italic', marginBottom: 6 },

  classCard: {
    backgroundColor: '#fff', borderRadius: 14,
    padding: 13, flexDirection: 'row', alignItems: 'center', gap: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2,
    marginBottom: 6,
  },
  cancelCard: { backgroundColor: '#FFF1F2', borderWidth: 1, borderColor: '#FECDD3' },
  classEmoji: { fontSize: 24, flexShrink: 0 },
  classInfo: { flex: 1 },
  classTitle: { fontSize: 15, fontWeight: '700', color: COLORS.statusDark },
  classTime: { fontSize: 12, color: COLORS.statusMidGrey, marginTop: 2 },
  delBtn: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: '#FEF2F2', justifyContent: 'center', alignItems: 'center',
  },
  delBtnTxt: { fontSize: 13, color: COLORS.statusError },

  addDayBtn: {
    paddingVertical: 10, paddingHorizontal: 14,
    borderRadius: 12, borderWidth: 2, borderStyle: 'dashed', borderColor: COLORS.statusGrey,
    backgroundColor: 'transparent',
  },
  addDayBtnTxt: { fontSize: 13, fontWeight: '700', color: COLORS.statusViolet },

  ooDateLabel: { fontSize: 11, fontWeight: '700', color: COLORS.statusMidGrey, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 5, marginTop: 4 },
  cancelBadge: { backgroundColor: COLORS.statusRedLight, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  cancelBadgeTxt: { fontSize: 10, fontWeight: '800', color: COLORS.statusError, letterSpacing: 0.3 },

  // Sheet
  sheetOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,.45)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#fff', borderRadius: 24, padding: 20, paddingBottom: 36,
    maxHeight: '90%',
  },
  sheetHandle: { width: 40, height: 4, backgroundColor: COLORS.statusGrey, borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  sheetTitle: { fontSize: 18, fontWeight: '800', color: COLORS.statusDark, textAlign: 'center', marginBottom: 20 },

  fieldLabel: { fontSize: 13, fontWeight: '700', color: '#374151', marginBottom: 6 },
  fieldInput: {
    borderWidth: 1.5, borderColor: COLORS.statusGrey, borderRadius: 12,
    padding: 12, fontSize: 15, color: COLORS.statusDark,
    marginBottom: 14, fontFamily: undefined,
  },
  fieldRow: { flexDirection: 'row', gap: 10, marginBottom: 0 },
  fieldHint: { fontSize: 12, color: COLORS.statusMidGrey, marginTop: 2, marginBottom: 14 },

  fbox: {
    borderWidth: 1.5, borderColor: COLORS.statusGrey, borderRadius: 12,
    padding: 12, backgroundColor: '#F9FAFB', marginBottom: 14,
  },
  fboxText: { fontSize: 15, color: COLORS.statusDark },

  emojiRow: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  emojiChip: {
    width: 46, height: 46, borderRadius: 12,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 2, borderColor: 'transparent',
  },
  emojiChipSel: { backgroundColor: '#EDE9FE', borderColor: COLORS.statusViolet },
  emojiChipTxt: { fontSize: 24 },

  saveBtn: {
    backgroundColor: COLORS.statusViolet, borderRadius: 16, padding: 16,
    alignItems: 'center', marginTop: 8,
  },
  saveBtnTxt: { color: COLORS.bloomOnAccent, fontSize: 16, fontWeight: '800' },

  cancelBtn: {
    backgroundColor: COLORS.statusRedLight, borderRadius: 16, padding: 16,
    alignItems: 'center', marginTop: 8,
  },
  cancelBtnTxt: { color: COLORS.statusError, fontSize: 16, fontWeight: '800' },

  radio: {
    flexDirection: 'row', gap: 12, alignItems: 'flex-start',
    padding: 12, borderRadius: 14, borderWidth: 2, borderColor: COLORS.statusGrey,
    marginBottom: 10,
  },
  radioSel: { borderColor: COLORS.statusViolet, backgroundColor: '#F5F3FF' },
  radioDot: {
    width: 18, height: 18, borderRadius: 9,
    borderWidth: 2.5, borderColor: '#D1D5DB', marginTop: 2, flexShrink: 0,
  },
  radioDotSel: { borderColor: COLORS.statusViolet, backgroundColor: COLORS.statusViolet },
  radioTitle: { fontSize: 14, fontWeight: '700', color: '#374151' },
  radioSub: { fontSize: 12, color: COLORS.statusMidGrey, marginTop: 2 },

  cancelOption: {
    flexDirection: 'row', gap: 10, alignItems: 'center',
    padding: 12, borderRadius: 12, borderWidth: 1.5, borderColor: COLORS.statusGrey,
    marginBottom: 8, backgroundColor: '#F9FAFB',
  },
  cancelOptionSel: { borderColor: COLORS.statusViolet, backgroundColor: '#F5F3FF' },
  cancelOptionEmoji: { fontSize: 20 },
  cancelOptionTxt: { fontSize: 14, fontWeight: '700', color: '#374151' },

  // Pickers
  pickerOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,.4)', justifyContent: 'center', alignItems: 'center' },
  pickerCard: {
    backgroundColor: '#fff', borderRadius: 20, padding: 16,
    width: 240,
    shadowColor: '#000', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.2, shadowRadius: 24, elevation: 12,
  },
  pickerTitle: { fontSize: 16, fontWeight: '800', color: COLORS.statusDark, textAlign: 'center', marginBottom: 10 },
  pickerItem: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 10 },
  pickerItemSel: { backgroundColor: '#EDE9FE' },
  pickerItemTxt: { fontSize: 15, color: '#374151', textAlign: 'center' },
  pickerItemTxtSel: { color: COLORS.statusViolet, fontWeight: '700' },
});
