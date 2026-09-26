import React, { useEffect, useLayoutEffect, useState } from 'react';
import {
  View, TouchableOpacity, StyleSheet, ScrollView,
  TextInput, Alert, ActivityIndicator, Modal, FlatList,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import AppText from '../../components/AppText';
import RainbowDivider from '../../components/RainbowDivider';
import GuardianTabBar from '../../components/GuardianTabBar';
import useNicoHeader from '../../hooks/useNicoHeader';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/AuthContext';
import { GuardianNavParamList } from '../../navigation';
import { ScheduleTemplate, ScheduleEvent } from '../../types';
import {
  NICO, TEXT_STYLE, SPACING, RADIUS, SHADOW, FONT_SIZE, FONT_WEIGHT,
  BTN_SIZE, BTN_VARIANT, BUTTERFLY_TILES, scale,
} from '../../constants/theme';

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
      <TouchableOpacity style={s.fbox} onPress={() => setVisible(true)}>
        <AppText style={s.fboxText}>{value}</AppText>
      </TouchableOpacity>
      <Modal visible={visible} transparent animationType="fade" onRequestClose={() => setVisible(false)}>
        <TouchableOpacity style={s.pickerOverlay} activeOpacity={1} onPress={() => setVisible(false)}>
          <View style={s.pickerCard}>
            <AppText style={s.pickerTitle}>Select time</AppText>
            <FlatList
              data={TIMES}
              keyExtractor={t => t}
              style={{ maxHeight: 260 }}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[s.pickerItem, value === item && s.pickerItemSel]}
                  onPress={() => { onChange(item); setVisible(false); }}
                >
                  <AppText style={[s.pickerItemTxt, value === item && s.pickerItemTxtSel]}>{item}</AppText>
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
      <TouchableOpacity style={s.fbox} onPress={() => setVisible(true)}>
        <AppText style={s.fboxText}>{formatDate(value)}</AppText>
      </TouchableOpacity>
      <Modal visible={visible} transparent animationType="fade" onRequestClose={() => setVisible(false)}>
        <TouchableOpacity style={s.pickerOverlay} activeOpacity={1} onPress={() => setVisible(false)}>
          <View style={s.pickerCard}>
            <AppText style={s.pickerTitle}>Select date</AppText>
            <FlatList
              data={options}
              keyExtractor={d => d}
              style={{ maxHeight: 260 }}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[s.pickerItem, value === item && s.pickerItemSel]}
                  onPress={() => { onChange(item); setVisible(false); }}
                >
                  <AppText style={[s.pickerItemTxt, value === item && s.pickerItemTxtSel]}>
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
    <View style={s.emojiRow}>
      {emojis.map(e => (
        <TouchableOpacity
          key={e}
          style={[s.emojiChip, selected === e && s.emojiChipSel]}
          onPress={() => onSelect(e)}
        >
          <AppText style={s.emojiChipTxt}>{e}</AppText>
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

  useNicoHeader(navigation);
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
      <ScrollView contentContainerStyle={s.tabContent}>
        {DAYS.map((day, dow) => {
          const dayTemplates = templates.filter(t => t.day_of_week === dow);
          const tileBg = BUTTERFLY_TILES[dow % BUTTERFLY_TILES.length].bg;
          return (
            <View key={dow} style={s.dayBlock}>
              {dayTemplates.length === 0 ? (
                <AppText style={s.dayLabel}>{day.toUpperCase()} - No Classes</AppText>
              ) : (
                <>
                  <AppText style={s.dayLabel}>{day.toUpperCase()}</AppText>
                  {dayTemplates.map(t => (
                    <View key={t.id} style={[s.classCard, { backgroundColor: tileBg, borderColor: 'transparent' }]}>
                      <AppText style={s.classEmoji}>{t.emoji}</AppText>
                      <View style={s.classInfo}>
                        <AppText style={s.classTitle}>{t.title}</AppText>
                        <AppText style={s.classTime}>
                          {formatTime(t.start_time)} – {formatTime(t.end_time)}
                          {' · '}Until {formatDate(t.valid_until)}
                        </AppText>
                      </View>
                      <TouchableOpacity style={s.delBtn} onPress={() => deleteTemplate(t.id)}>
                        <AppText style={s.delBtnTxt}>✕</AppText>
                      </TouchableOpacity>
                    </View>
                  ))}
                </>
              )}
              <TouchableOpacity style={s.addDayBtn} onPress={() => openWeeklySheet(dow)}>
                <AppText style={s.addDayBtnTxt}>+ Add {DAYS_SHORT[dow]} class</AppText>
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
        <View style={[s.center, { flex: 1 }]}>
          <AppText style={s.emptyEmoji}>✨</AppText>
          <AppText style={s.emptyTitle}>No one-off events</AppText>
          <AppText style={s.emptyHint}>Add a special class or cancel a recurring one</AppText>
        </View>
      );
    }
    return (
      <ScrollView contentContainerStyle={s.tabContent}>
        {events.map((ev, index) => {
          const tileBg = BUTTERFLY_TILES[index % BUTTERFLY_TILES.length].bg;
          return (
            <View key={ev.id}>
              <AppText style={s.ooDateLabel}>
                {formatDateLong(ev.event_date)}
                {ev.is_cancellation ? ' — cancellation' : ''}
              </AppText>
              <View style={[s.classCard, ev.is_cancellation ? s.cancelCard : { backgroundColor: tileBg, borderColor: 'transparent' }]}>
                <AppText style={s.classEmoji}>{ev.is_cancellation ? '🚫' : ev.emoji}</AppText>
                <View style={s.classInfo}>
                  <AppText style={[s.classTitle, ev.is_cancellation && { color: NICO.error }]}>{ev.title}</AppText>
                  <AppText style={[s.classTime, ev.is_cancellation && { color: NICO.error }]}>
                    {formatTime(ev.start_time)} – {formatTime(ev.end_time)}
                    {ev.is_cancellation ? '' : ' · One-off'}
                  </AppText>
                </View>
                {ev.is_cancellation && (
                  <View style={s.cancelBadge}><AppText style={s.cancelBadgeTxt}>CANCELLED</AppText></View>
                )}
                <TouchableOpacity style={s.delBtn} onPress={() => deleteEvent(ev.id)}>
                  <AppText style={s.delBtnTxt}>✕</AppText>
                </TouchableOpacity>
              </View>
            </View>
          );
        })}
        <View style={{ height: 32 }} />
      </ScrollView>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────

  if (loading) return <View style={s.center}><ActivityIndicator size="large" color={NICO.primary} /></View>;

  const wSuggestions = suggestEmojis(wTitle);
  const ooSuggestions = suggestEmojis(ooTitle);
  const cancellable = cancellableTemplatesForDate(ooDate);

  return (
    <View style={s.container}>
      <RainbowDivider />

      {/* Tab bar */}
      <View style={s.tabBar}>
        <TouchableOpacity style={[s.tab, tab === 'weekly' && s.tabActive]} onPress={() => setTab('weekly')} activeOpacity={0.75}>
          <AppText style={[s.tabTxt, tab === 'weekly' && s.tabTxtActive]}>📅  Weekly</AppText>
        </TouchableOpacity>
        <TouchableOpacity style={[s.tab, tab === 'oneoff' && s.tabActive]} onPress={() => setTab('oneoff')} activeOpacity={0.75}>
          <AppText style={[s.tabTxt, tab === 'oneoff' && s.tabTxtActive]}>✨  One-off</AppText>
        </TouchableOpacity>
      </View>

      <View style={s.tabPane}>
        {/* Add button for one-off tab */}
        {tab === 'oneoff' && (
          <View style={s.ooTopRow}>
            <TouchableOpacity style={s.addPill} onPress={openOneoffSheet} activeOpacity={0.8}>
              <AppText style={s.addPillTxt}>+ Add</AppText>
            </TouchableOpacity>
          </View>
        )}

        {tab === 'weekly' ? renderWeekly() : renderOneoff()}
      </View>

      {/* ── Add Weekly Class sheet ── */}
      <Modal visible={weeklySheet} transparent animationType="slide" onRequestClose={() => setWeeklySheet(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <TouchableOpacity style={s.sheetOverlay} activeOpacity={1} onPress={() => setWeeklySheet(false)}>
            <TouchableOpacity style={s.sheet} activeOpacity={1} onPress={() => {}}>
              <View style={s.sheetHandle} />
              <AppText style={s.sheetTitle}>Add {DAYS[addDay]} Class</AppText>

              <AppText style={s.fieldLabel}>Class name</AppText>
              <TextInput
                style={s.fieldInput}
                value={wTitle}
                onChangeText={setWTitle}
                placeholder="e.g. Piano Lesson"
                placeholderTextColor={NICO.textMuted}
              />

              <AppText style={s.fieldLabel}>Emoji</AppText>
              <EmojiRow
                emojis={wSuggestions}
                selected={wEmoji}
                onSelect={setWEmoji}
              />

              <View style={s.fieldRow}>
                <View style={{ flex: 1 }}>
                  <AppText style={s.fieldLabel}>Start time</AppText>
                  <TimePicker value={wStart} onChange={setWStart} />
                </View>
                <View style={{ flex: 1 }}>
                  <AppText style={s.fieldLabel}>End time</AppText>
                  <TimePicker value={wEnd} onChange={setWEnd} />
                </View>
              </View>

              <View style={s.fieldRow}>
                <View style={{ flex: 1 }}>
                  <AppText style={s.fieldLabel}>Valid from</AppText>
                  <DatePicker value={wFrom} onChange={setWFrom} />
                </View>
                <View style={{ flex: 1 }}>
                  <AppText style={s.fieldLabel}>Until</AppText>
                  <DatePicker value={wUntil} onChange={v => setWUntil(v)} minDate={wFrom} />
                </View>
              </View>
              <AppText style={s.fieldHint}>Repeats every {DAYS[addDay]} · Max 3 months</AppText>

              <TouchableOpacity
                style={[s.saveBtn, wSaving && s.btnDisabled]}
                onPress={saveWeeklyClass}
                disabled={wSaving}
              >
                <AppText style={s.saveBtnTxt}>{wSaving ? 'Saving…' : 'Save Class'}</AppText>
              </TouchableOpacity>
            </TouchableOpacity>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Add One-off Event sheet ── */}
      <Modal visible={oneoffSheet} transparent animationType="slide" onRequestClose={() => setOneoffSheet(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <TouchableOpacity style={s.sheetOverlay} activeOpacity={1} onPress={() => setOneoffSheet(false)}>
            <TouchableOpacity style={s.sheet} activeOpacity={1} onPress={() => {}}>
              <View style={s.sheetHandle} />
              <AppText style={s.sheetTitle}>Add One-off Event</AppText>

              {/* Radio */}
              <TouchableOpacity style={[s.radio, ooMode === 'new' && s.radioSel]} onPress={() => setOoMode('new')}>
                <View style={[s.radioDot, ooMode === 'new' && s.radioDotSel]} />
                <View>
                  <AppText style={s.radioTitle}>New class on a specific date</AppText>
                  <AppText style={s.radioSub}>Add a class that doesn't repeat</AppText>
                </View>
              </TouchableOpacity>
              <TouchableOpacity style={[s.radio, ooMode === 'cancel' && s.radioSel]} onPress={() => setOoMode('cancel')}>
                <View style={[s.radioDot, ooMode === 'cancel' && s.radioDotSel]} />
                <View>
                  <AppText style={s.radioTitle}>Cancel a recurring class</AppText>
                  <AppText style={s.radioSub}>Mark one occurrence as cancelled</AppText>
                </View>
              </TouchableOpacity>

              <AppText style={s.fieldLabel}>{ooMode === 'cancel' ? 'Date to cancel' : 'Date'}</AppText>
              <DatePicker value={ooDate} onChange={v => { setOoDate(v); setCancelTemplateId(null); }} />

              {ooMode === 'new' ? (
                <>
                  <AppText style={s.fieldLabel}>Class name</AppText>
                  <TextInput
                    style={s.fieldInput}
                    value={ooTitle}
                    onChangeText={setOoTitle}
                    placeholder="e.g. Theatre Trip"
                    placeholderTextColor={NICO.textMuted}
                  />

                  <AppText style={s.fieldLabel}>Emoji</AppText>
                  <EmojiRow emojis={ooSuggestions} selected={ooEmoji} onSelect={setOoEmoji} />

                  <View style={s.fieldRow}>
                    <View style={{ flex: 1 }}>
                      <AppText style={s.fieldLabel}>Start time</AppText>
                      <TimePicker value={ooStart} onChange={setOoStart} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <AppText style={s.fieldLabel}>End time</AppText>
                      <TimePicker value={ooEnd} onChange={setOoEnd} />
                    </View>
                  </View>

                  <TouchableOpacity
                    style={[s.saveBtn, ooSaving && s.btnDisabled]}
                    onPress={saveOneoffEvent}
                    disabled={ooSaving}
                  >
                    <AppText style={s.saveBtnTxt}>{ooSaving ? 'Saving…' : 'Save Event'}</AppText>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <AppText style={s.fieldLabel}>Which class to cancel?</AppText>
                  {cancellable.length === 0
                    ? <AppText style={s.fieldHint}>No recurring classes on {formatDateLong(ooDate)}</AppText>
                    : cancellable.map(t => (
                      <TouchableOpacity
                        key={t.id}
                        style={[s.cancelOption, cancelTemplateId === t.id && s.cancelOptionSel]}
                        onPress={() => setCancelTemplateId(t.id)}
                      >
                        <AppText style={s.cancelOptionEmoji}>{t.emoji}</AppText>
                        <AppText style={s.cancelOptionTxt}>
                          {t.title}  {formatTime(t.start_time)}
                        </AppText>
                      </TouchableOpacity>
                    ))
                  }
                  <TouchableOpacity
                    style={[s.cancelSubmitBtn, ooSaving && s.btnDisabled]}
                    onPress={saveOneoffEvent}
                    disabled={ooSaving}
                  >
                    <AppText style={s.cancelSubmitBtnTxt}>{ooSaving ? 'Saving…' : 'Mark as Cancelled'}</AppText>
                  </TouchableOpacity>
                </>
              )}
            </TouchableOpacity>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </Modal>

      <GuardianTabBar />
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: NICO.screenBg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: SPACING.sm, padding: SPACING.xl, backgroundColor: NICO.screenBg },
  emptyEmoji: { fontSize: scale(44), marginBottom: SPACING.xs },
  emptyTitle: { fontSize: FONT_SIZE.lg, fontWeight: FONT_WEIGHT.extraBold, color: NICO.text },
  emptyHint: { ...TEXT_STYLE.screenHint, textAlign: 'center' },

  tabBar: {
    flexDirection: 'row', backgroundColor: NICO.surface,
    borderBottomWidth: 1, borderBottomColor: NICO.border,
  },
  tab: {
    flex: 1, alignItems: 'center', paddingVertical: SPACING.md,
    borderBottomWidth: 2.5, borderBottomColor: 'transparent',
  },
  tabActive:    { borderBottomColor: NICO.primary },
  tabTxt:       { fontSize: FONT_SIZE.md, fontWeight: FONT_WEIGHT.bold, color: NICO.textMuted },
  tabTxtActive: { color: NICO.primary, fontWeight: FONT_WEIGHT.extraBold },
  tabPane:      { flex: 1, backgroundColor: NICO.screenBg },

  ooTopRow: { alignItems: 'flex-end', paddingHorizontal: SPACING.base, paddingTop: SPACING.sm, paddingBottom: SPACING.xs },
  addPill: { ...BTN_SIZE.sm, ...BTN_VARIANT.primary, justifyContent: 'center' },
  addPillTxt: { color: NICO.textOnAccent, fontSize: FONT_SIZE.sm, fontWeight: FONT_WEIGHT.bold },

  tabContent: { padding: SPACING.base, paddingBottom: 40 },

  dayBlock: { marginBottom: SPACING.base },
  dayLabel: { fontSize: FONT_SIZE.xs, fontWeight: FONT_WEIGHT.bold, color: NICO.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: SPACING.sm },

  classCard: {
    borderRadius: RADIUS.lg,
    padding: SPACING.md, flexDirection: 'row', alignItems: 'center', gap: SPACING.md,
    borderWidth: 1,
    ...SHADOW.sm,
    marginBottom: SPACING.xs,
  },
  cancelCard: { backgroundColor: NICO.errorLight, borderWidth: 1, borderColor: NICO.error },
  classEmoji: { fontSize: scale(24), flexShrink: 0 },
  classInfo: { flex: 1 },
  classTitle: { fontSize: FONT_SIZE.md, fontWeight: FONT_WEIGHT.bold, color: NICO.text },
  classTime: { fontSize: FONT_SIZE.sm, fontWeight: FONT_WEIGHT.bold, color: NICO.text, marginTop: 2 },
  delBtn: {
    width: scale(28), height: scale(28), borderRadius: scale(14),
    backgroundColor: 'white', borderWidth: 1.5, borderColor: NICO.error,
    justifyContent: 'center', alignItems: 'center',
  },
  delBtnTxt: { fontSize: FONT_SIZE.sm, color: NICO.error, fontWeight: FONT_WEIGHT.bold },

  addDayBtn: {
    paddingVertical: SPACING.sm, paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.md, borderWidth: 2, borderStyle: 'dashed', borderColor: NICO.border,
    backgroundColor: 'transparent', alignSelf: 'flex-start',
  },
  addDayBtnTxt: { fontSize: FONT_SIZE.sm, fontWeight: FONT_WEIGHT.bold, color: NICO.primary },

  ooDateLabel: { fontSize: FONT_SIZE.xs, fontWeight: FONT_WEIGHT.bold, color: NICO.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: SPACING.xs, marginTop: SPACING.xs },
  cancelBadge: { backgroundColor: NICO.errorLight, borderRadius: RADIUS.sm, paddingHorizontal: SPACING.sm, paddingVertical: 3 },
  cancelBadgeTxt: { fontSize: FONT_SIZE.xs, fontWeight: FONT_WEIGHT.extraBold, color: NICO.error, letterSpacing: 0.3 },

  // Sheet
  sheetOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: NICO.surface, borderTopLeftRadius: RADIUS['2xl'], borderTopRightRadius: RADIUS['2xl'],
    padding: SPACING.lg, paddingBottom: 36,
    maxHeight: '90%',
  },
  sheetHandle: { width: 40, height: 4, backgroundColor: NICO.border, borderRadius: 2, alignSelf: 'center', marginBottom: SPACING.base },
  sheetTitle: { fontSize: FONT_SIZE.xl, fontWeight: FONT_WEIGHT.extraBold, color: NICO.text, textAlign: 'center', marginBottom: SPACING.lg },

  fieldLabel: { fontSize: FONT_SIZE.sm, fontWeight: FONT_WEIGHT.bold, color: NICO.text, marginBottom: SPACING.xs },
  fieldInput: {
    borderWidth: 1.5, borderColor: NICO.border, borderRadius: RADIUS.md,
    padding: SPACING.md, fontSize: FONT_SIZE.md, color: NICO.text,
    marginBottom: SPACING.md,
  },
  fieldRow: { flexDirection: 'row', gap: SPACING.sm, marginBottom: 0 },
  fieldHint: { fontSize: FONT_SIZE.xs, color: NICO.textMuted, marginTop: 2, marginBottom: SPACING.md },

  fbox: {
    borderWidth: 1.5, borderColor: NICO.border, borderRadius: RADIUS.md,
    padding: SPACING.md, backgroundColor: NICO.background, marginBottom: SPACING.md,
  },
  fboxText: { fontSize: FONT_SIZE.md, color: NICO.text },

  emojiRow: { flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.md },
  emojiChip: {
    width: scale(46), height: scale(46), borderRadius: RADIUS.md,
    backgroundColor: NICO.background,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 2, borderColor: 'transparent',
  },
  emojiChipSel: { backgroundColor: NICO.primaryLight, borderColor: NICO.primary },
  emojiChipTxt: { fontSize: scale(24) },

  saveBtn:    { ...BTN_SIZE.lg, ...BTN_VARIANT.primary, marginTop: SPACING.sm },
  btnDisabled:{ opacity: 0.6 },
  saveBtnTxt: { color: NICO.textOnAccent, fontSize: FONT_SIZE.md, fontWeight: FONT_WEIGHT.extraBold },

  cancelSubmitBtn:    { ...BTN_SIZE.lg, ...BTN_VARIANT.danger, marginTop: SPACING.sm },
  cancelSubmitBtnTxt: { color: '#fff', fontSize: FONT_SIZE.md, fontWeight: FONT_WEIGHT.extraBold },

  radio: {
    flexDirection: 'row', gap: SPACING.md, alignItems: 'flex-start',
    padding: SPACING.md, borderRadius: RADIUS.lg, borderWidth: 2, borderColor: NICO.border,
    marginBottom: SPACING.sm,
  },
  radioSel: { borderColor: NICO.primary, backgroundColor: NICO.primaryLight },
  radioDot: {
    width: scale(18), height: scale(18), borderRadius: scale(9),
    borderWidth: 2.5, borderColor: NICO.border, marginTop: 2, flexShrink: 0,
  },
  radioDotSel: { borderColor: NICO.primary, backgroundColor: NICO.primary },
  radioTitle: { fontSize: FONT_SIZE.sm, fontWeight: FONT_WEIGHT.bold, color: NICO.text },
  radioSub: { fontSize: FONT_SIZE.xs, color: NICO.textMuted, marginTop: 2 },

  cancelOption: {
    flexDirection: 'row', gap: SPACING.sm, alignItems: 'center',
    padding: SPACING.md, borderRadius: RADIUS.md, borderWidth: 1.5, borderColor: NICO.border,
    marginBottom: SPACING.sm, backgroundColor: NICO.background,
  },
  cancelOptionSel: { borderColor: NICO.primary, backgroundColor: NICO.primaryLight },
  cancelOptionEmoji: { fontSize: scale(20) },
  cancelOptionTxt: { fontSize: FONT_SIZE.sm, fontWeight: FONT_WEIGHT.bold, color: NICO.text },

  // Pickers
  pickerOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' },
  pickerCard: {
    backgroundColor: NICO.surface, borderRadius: RADIUS.xl, padding: SPACING.base,
    width: scale(240),
    ...SHADOW.lg,
  },
  pickerTitle: { fontSize: FONT_SIZE.md, fontWeight: FONT_WEIGHT.extraBold, color: NICO.text, textAlign: 'center', marginBottom: SPACING.sm },
  pickerItem: { paddingVertical: SPACING.sm, paddingHorizontal: SPACING.base, borderRadius: RADIUS.md },
  pickerItemSel: { backgroundColor: NICO.primaryLight },
  pickerItemTxt: { fontSize: FONT_SIZE.md, color: NICO.text, textAlign: 'center' },
  pickerItemTxtSel: { color: NICO.primary, fontWeight: FONT_WEIGHT.bold },
});
