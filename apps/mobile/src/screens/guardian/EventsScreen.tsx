import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, Alert,
  Modal, ScrollView, Image,
} from 'react-native';
import AppText from '../../components/AppText';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/AuthContext';
import { COLORS, calcAge } from '../../constants';
import { GuardianNavParamList } from '../../navigation';

type Nav  = NativeStackNavigationProp<GuardianNavParamList>;
type Rsvp = 'going' | 'interested' | 'not_going';

const AVATAR_COLORS = [COLORS.statusRed, COLORS.statusPurple, COLORS.statusTeal, COLORS.statusAmber, COLORS.statusBlue, COLORS.statusPink];

interface LearnerInfo { name: string; date_of_birth: string | null; gender: string | null }

interface GuardianProfile {
  id: string; name: string; photoUrl: string | null;
  city: string; state: string; situationTags: string[];
  learners: LearnerInfo[];
}

const RSVP_OPTIONS: { value: Rsvp; label: string; activeColor: string; activeBg: string }[] = [
  { value: 'going',      label: '✓ Going',     activeColor: COLORS.statusGreenDark, activeBg: COLORS.secondaryLight },
  { value: 'interested', label: '★ Interested', activeColor: COLORS.statusAmberDark, activeBg: COLORS.statusAmberLight },
  { value: 'not_going',  label: "✕ Can't go",  activeColor: COLORS.bloomMuted, activeBg: COLORS.bloomBorder },
];

interface EventItem {
  id: string;
  name: string;
  eventDate: string;
  eventTime: string | null;
  venue: string;
  description: string;
  category: string | null;
  guardianName: string;
  guardianId: string;
  goingCount: number;
}

function formatTime(timeStr: string): string {
  const [h, m] = timeStr.split(':');
  const hours = parseInt(h, 10);
  return `${hours % 12 || 12}:${m} ${hours >= 12 ? 'PM' : 'AM'}`;
}

function toLocalDateStr(d: Date): string {
  const y  = d.getFullYear();
  const m  = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

function formatFullDate(dateStr: string, timeStr?: string | null): string {
  const d = new Date(dateStr + 'T12:00:00');
  const date = d.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  if (!timeStr) return date;
  const [h, m] = timeStr.split(':');
  const hours = parseInt(h, 10);
  return `${date} at ${hours % 12 || 12}:${m} ${hours >= 12 ? 'PM' : 'AM'}`;
}

export default function EventsScreen() {
  const navigation = useNavigation<Nav>();
  const { guardian } = useAuth();

  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'upcoming' | 'mine'>('upcoming');
  const [selectedEvent, setSelectedEvent]       = useState<EventItem | null>(null);
  const [nudgeRsvp, setNudgeRsvp]               = useState<Rsvp | null>(null);

  // Upcoming tab filters
  const [availableCategories, setAvailableCategories] = useState<string[]>([]);
  const [filterCategory, setFilterCategory]     = useState('');
  const [filterDateFrom, setFilterDateFrom]     = useState<Date | null>(null);
  const [filterDateTo, setFilterDateTo]         = useState<Date | null>(null);
  const [showDateFromPicker, setShowDateFromPicker] = useState(false);
  const [showDateToPicker, setShowDateToPicker] = useState(false);
  const [tempDateFrom, setTempDateFrom]         = useState(new Date());
  const [tempDateTo, setTempDateTo]             = useState(new Date());
  const [showCategorySheet, setShowCategorySheet] = useState(false);
  const [visibleCount, setVisibleCount]           = useState(10);
  const [nudgeRsvping, setNudgeRsvping]         = useState(false);
  const [guardianSheet, setGuardianSheet]       = useState<GuardianProfile | null>(null);
  const [loadingGuardianSheet, setLoadingGuardianSheet] = useState(false);

  useFocusEffect(useCallback(() => { load(); }, []));

  useEffect(() => {
    supabase.from('event_category_options').select('label').order('label')
      .then(({ data }) => setAvailableCategories((data ?? []).map((c: any) => c.label)));
  }, []);

  async function load() {
    setLoading(true);
    const today = new Date().toISOString().slice(0, 10);

    const { data } = await supabase
      .from('events')
      .select('id, name, description, category, event_date, event_time, venue, guardian_id, guardians!events_guardian_id_fkey(full_name), event_participants(guardian_id, rsvp)')
      .gte('event_date', today)
      .order('event_date', { ascending: true });

    setEvents(
      (data ?? []).map((e: any) => ({
        id: e.id,
        name: e.name,
        description: e.description ?? '',
        category: e.category ?? null,
        eventDate: e.event_date,
        eventTime: e.event_time ?? null,
        venue: e.venue ?? '',
        guardianName: e.guardians?.full_name ?? 'Unknown',
        guardianId: e.guardian_id,
        goingCount: (e.event_participants ?? []).filter((p: any) => p.rsvp === 'going').length,
      }))
    );
    setLoading(false);
  }

  // Reset pagination when tab or filters change
  useEffect(() => { setVisibleCount(10); }, [tab, filterCategory, filterDateFrom, filterDateTo]);

  const allFiltered = (() => {
    if (tab === 'mine') return events.filter(e => e.guardianId === guardian?.id);
    let list = events;
    if (filterCategory) list = list.filter(e => e.category === filterCategory);
    if (filterDateFrom) list = list.filter(e => e.eventDate >= toLocalDateStr(filterDateFrom));
    if (filterDateTo)   list = list.filter(e => e.eventDate <= toLocalDateStr(filterDateTo));
    return list;
  })();

  const filtered = allFiltered.slice(0, visibleCount);
  const hasMore  = allFiltered.length > visibleCount;

  useEffect(() => {
    if (!selectedEvent || !guardian) { setNudgeRsvp(null); return; }
    supabase
      .from('event_participants')
      .select('rsvp')
      .eq('event_id', selectedEvent.id)
      .eq('guardian_id', guardian.id)
      .maybeSingle()
      .then(({ data }) => setNudgeRsvp((data?.rsvp as Rsvp) ?? null));
  }, [selectedEvent?.id]);

  async function openGuardianSheet(guardianId: string) {
    setGuardianSheet(null);
    setLoadingGuardianSheet(true);
    const { data } = await supabase
      .from('guardians')
      .select('id, full_name, photo_url, city, state, situation_tags, user_profiles(name, date_of_birth, gender)')
      .eq('id', guardianId)
      .single();
    if (data) {
      setGuardianSheet({
        id: data.id, name: data.full_name ?? '',
        photoUrl: data.photo_url ?? null,
        city: data.city ?? '', state: data.state ?? '',
        situationTags: data.situation_tags ?? [],
        learners: (data.user_profiles ?? []).map((l: any) => ({
          name: l.name, date_of_birth: l.date_of_birth ?? null, gender: l.gender ?? null,
        })),
      });
    }
    setLoadingGuardianSheet(false);
  }

  function closeGuardianSheet() {
    setGuardianSheet(null);
    setLoadingGuardianSheet(false);
  }

  async function rsvpEvent(status: Rsvp) {
    if (!selectedEvent || !guardian) return;
    setNudgeRsvping(true);
    await supabase
      .from('event_participants')
      .upsert(
        { event_id: selectedEvent.id, guardian_id: guardian.id, rsvp: status },
        { onConflict: 'event_id,guardian_id' },
      );
    setNudgeRsvp(status);
    // Update going count in list
    if (status === 'going' && nudgeRsvp !== 'going') {
      setEvents(prev => prev.map(e => e.id === selectedEvent.id ? { ...e, goingCount: e.goingCount + 1 } : e));
    } else if (status !== 'going' && nudgeRsvp === 'going') {
      setEvents(prev => prev.map(e => e.id === selectedEvent.id ? { ...e, goingCount: Math.max(0, e.goingCount - 1) } : e));
    }
    setNudgeRsvping(false);
  }

  async function deleteEvent(id: string) {
    Alert.alert('Delete event', 'This will permanently delete the event and all RSVPs.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          await supabase.from('events').delete().eq('id', id);
          setEvents(prev => prev.filter(e => e.id !== id));
        },
      },
    ]);
  }

  if (loading) {
    return <View style={s.center}><ActivityIndicator size="large" color={COLORS.bloomAccent} /></View>;
  }

  return (
    <View style={s.container}>
      <View style={s.tabs}>
        {(['upcoming', 'mine'] as const).map(t => (
          <TouchableOpacity
            key={t}
            style={[s.tab, tab === t && s.tabActive]}
            onPress={() => setTab(t)}
          >
            <AppText style={[s.tabText, tab === t && s.tabTextActive]}>
              {t === 'upcoming' ? 'Upcoming' : 'My Events'}
            </AppText>
          </TouchableOpacity>
        ))}
      </View>

      {/* Upcoming tab inline filters */}
      {tab === 'upcoming' && (
        <View style={s.filterPanel}>
          {/* Date from */}
          <TouchableOpacity
            style={s.filterRow}
            onPress={() => { setTempDateFrom(filterDateFrom ?? new Date()); setShowDateFromPicker(true); }}
            activeOpacity={0.7}
          >
            <AppText style={s.filterLabel}>From</AppText>
            <AppText style={[s.filterValue, filterDateFrom && s.filterValueActive]}>
              {filterDateFrom
                ? filterDateFrom.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
                : 'Any date'}
            </AppText>
            {filterDateFrom
              ? <TouchableOpacity onPress={() => setFilterDateFrom(null)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}><AppText style={s.filterClear}>✕</AppText></TouchableOpacity>
              : <AppText style={s.filterArrow}>›</AppText>
            }
          </TouchableOpacity>

          <View style={s.filterDivider} />

          {/* Date to */}
          <TouchableOpacity
            style={s.filterRow}
            onPress={() => { setTempDateTo(filterDateTo ?? new Date()); setShowDateToPicker(true); }}
            activeOpacity={0.7}
          >
            <AppText style={s.filterLabel}>To</AppText>
            <AppText style={[s.filterValue, filterDateTo && s.filterValueActive]}>
              {filterDateTo
                ? filterDateTo.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
                : 'Any date'}
            </AppText>
            {filterDateTo
              ? <TouchableOpacity onPress={() => setFilterDateTo(null)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}><AppText style={s.filterClear}>✕</AppText></TouchableOpacity>
              : <AppText style={s.filterArrow}>›</AppText>
            }
          </TouchableOpacity>

          {availableCategories.length > 0 && (
            <>
              <View style={s.filterDivider} />
              <TouchableOpacity
                style={s.filterRow}
                onPress={() => setShowCategorySheet(true)}
                activeOpacity={0.7}
              >
                <AppText style={s.filterLabel}>Category</AppText>
                <AppText style={[s.filterValue, filterCategory && s.filterValueActive]}>
                  {filterCategory || 'All'}
                </AppText>
                {filterCategory
                  ? <TouchableOpacity onPress={() => setFilterCategory('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}><AppText style={s.filterClear}>✕</AppText></TouchableOpacity>
                  : <AppText style={s.filterArrow}>›</AppText>
                }
              </TouchableOpacity>
            </>
          )}
        </View>
      )}

      <FlatList
        data={filtered}
        keyExtractor={e => e.id}
        contentContainerStyle={s.list}
        renderItem={({ item: e }) => {
          const d = new Date(e.eventDate + 'T12:00:00');
          const isMine = tab === 'mine';
          return (
            <View style={s.cardWrapper}>
              <TouchableOpacity
                style={[s.card, isMine && s.cardTopOnly]}
                onPress={() => setSelectedEvent(e)}
                activeOpacity={0.82}
              >
                <View style={s.dateTag}>
                  <AppText style={s.dateTagDay}>{d.getDate()}</AppText>
                  <AppText style={s.dateTagMonth}>
                    {d.toLocaleDateString(undefined, { month: 'short' }).toUpperCase()}
                  </AppText>
                </View>

                <View style={s.info}>
                  <AppText style={s.eventName}>{e.name}</AppText>
                  <AppText style={s.eventMeta}>
                    {e.eventTime ? formatTime(e.eventTime) : ''}
                    {e.venue ? (e.eventTime ? '  ·  ' : '') + e.venue : ''}
                  </AppText>
                  {!isMine ? (
                    <TouchableOpacity
                      onPress={() => openGuardianSheet(e.guardianId)}
                      activeOpacity={0.7}
                      hitSlop={{ top: 4, bottom: 4, left: 0, right: 8 }}
                    >
                      <AppText style={s.eventHostBtn}>By {e.guardianName}</AppText>
                    </TouchableOpacity>
                  ) : (
                    <AppText style={s.eventHost}>By {e.guardianName}</AppText>
                  )}
                </View>

                <View style={s.goingBadge}>
                  <AppText style={s.goingNum}>{e.goingCount}</AppText>
                  <AppText style={s.goingLabel}>going</AppText>
                </View>
              </TouchableOpacity>

              {isMine && (
                <View style={s.cardActions}>
                <TouchableOpacity
                  style={s.actionBtn}
                  onPress={() => navigation.navigate('EditEvent', { eventId: e.id })}
                  activeOpacity={0.7}
                >
                  <AppText style={s.actionBtnText}>✏️  Edit</AppText>
                </TouchableOpacity>
                <View style={s.actionDivider} />
                <TouchableOpacity
                  style={s.actionBtn}
                  onPress={() => deleteEvent(e.id)}
                  activeOpacity={0.7}
                >
                  <AppText style={[s.actionBtnText, s.actionBtnDelete]}>🗑  Delete</AppText>
                </TouchableOpacity>
              </View>
              )}
            </View>
          );
        }}
        ListFooterComponent={hasMore ? (
          <TouchableOpacity
            style={s.loadMoreBtn}
            onPress={() => setVisibleCount(c => c + 10)}
            activeOpacity={0.75}
          >
            <AppText style={s.loadMoreText}>
              Show more ({allFiltered.length - visibleCount} remaining)
            </AppText>
          </TouchableOpacity>
        ) : null}
        ListEmptyComponent={
          <View style={s.empty}>
            <AppText style={s.emptyEmoji}>🎉</AppText>
            <AppText style={s.emptyText}>{tab === 'mine' ? "You haven't created any events" : 'No upcoming events'}</AppText>
            <AppText style={s.emptyHint}>Tap below to create one</AppText>
          </View>
        }
      />

      <TouchableOpacity
        style={s.fab}
        onPress={() => navigation.navigate('CreateEvent')}
        activeOpacity={0.85}
      >
        <AppText style={s.fabText}>+ Create Event</AppText>
      </TouchableOpacity>

      {/* Filter: Date From picker */}
      <Modal visible={showDateFromPicker} transparent animationType="slide" onRequestClose={() => setShowDateFromPicker(false)}>
        <TouchableOpacity style={s.nudgeBackdrop} activeOpacity={1} onPress={() => setShowDateFromPicker(false)}>
          <View style={s.nudgeSheet} onStartShouldSetResponder={() => true}>
            <View style={s.filterPickerHdr}>
              <TouchableOpacity onPress={() => setShowDateFromPicker(false)}><AppText style={s.filterPickerCancel}>Cancel</AppText></TouchableOpacity>
              <AppText style={s.filterPickerTitle}>From Date</AppText>
              <TouchableOpacity onPress={() => { setFilterDateFrom(tempDateFrom); setShowDateFromPicker(false); }}><AppText style={s.filterPickerDone}>Done</AppText></TouchableOpacity>
            </View>
            <DateTimePicker value={tempDateFrom} mode="date" display="spinner" onChange={(_, d) => { if (d) setTempDateFrom(d); }} style={{ height: 220 }} />
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Filter: Date To picker */}
      <Modal visible={showDateToPicker} transparent animationType="slide" onRequestClose={() => setShowDateToPicker(false)}>
        <TouchableOpacity style={s.nudgeBackdrop} activeOpacity={1} onPress={() => setShowDateToPicker(false)}>
          <View style={s.nudgeSheet} onStartShouldSetResponder={() => true}>
            <View style={s.filterPickerHdr}>
              <TouchableOpacity onPress={() => setShowDateToPicker(false)}><AppText style={s.filterPickerCancel}>Cancel</AppText></TouchableOpacity>
              <AppText style={s.filterPickerTitle}>To Date</AppText>
              <TouchableOpacity onPress={() => { setFilterDateTo(tempDateTo); setShowDateToPicker(false); }}><AppText style={s.filterPickerDone}>Done</AppText></TouchableOpacity>
            </View>
            <DateTimePicker value={tempDateTo} mode="date" display="spinner" onChange={(_, d) => { if (d) setTempDateTo(d); }} style={{ height: 220 }} />
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Filter: Category sheet */}
      <Modal visible={showCategorySheet} transparent animationType="slide" onRequestClose={() => setShowCategorySheet(false)}>
        <TouchableOpacity style={s.nudgeBackdrop} activeOpacity={1} onPress={() => setShowCategorySheet(false)}>
          <View style={s.nudgeSheet} onStartShouldSetResponder={() => true}>
            <View style={s.filterPickerHdr}>
              <TouchableOpacity onPress={() => setShowCategorySheet(false)}><AppText style={s.filterPickerCancel}>Cancel</AppText></TouchableOpacity>
              <AppText style={s.filterPickerTitle}>Category</AppText>
              <View style={{ width: 60 }} />
            </View>
            <ScrollView style={{ maxHeight: 320 }}>
              {['', ...availableCategories].map(cat => (
                <TouchableOpacity
                  key={cat || '__all'}
                  style={[s.catOption, filterCategory === cat && s.catOptionActive]}
                  onPress={() => { setFilterCategory(cat); setShowCategorySheet(false); }}
                  activeOpacity={0.7}
                >
                  <AppText style={[s.catOptionText, filterCategory === cat && s.catOptionTextActive]}>
                    {cat || 'All categories'}
                  </AppText>
                  {filterCategory === cat && <AppText style={s.catCheck}>✓</AppText>}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Event quick-look nudge */}
      <Modal
        visible={!!selectedEvent}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedEvent(null)}
      >
        <TouchableOpacity style={s.nudgeBackdrop} activeOpacity={1} onPress={() => setSelectedEvent(null)}>
          <View style={s.nudgeSheet} onStartShouldSetResponder={() => true}>
            {selectedEvent && (
              <>
                <View style={s.nudgePill} />

                {/* Date tag + title + tappable creator name */}
                <View style={s.nudgeHeader}>
                  {(() => {
                    const d = new Date(selectedEvent.eventDate + 'T12:00:00');
                    return (
                      <View style={s.nudgeDateTag}>
                        <AppText style={s.nudgeDateDay}>{d.getDate()}</AppText>
                        <AppText style={s.nudgeDateMonth}>
                          {d.toLocaleDateString(undefined, { month: 'short' }).toUpperCase()}
                        </AppText>
                      </View>
                    );
                  })()}
                  <View style={s.nudgeTitleBlock}>
                    {selectedEvent.category && (
                      <View style={s.nudgeCategoryChip}>
                        <AppText style={s.nudgeCategoryText}>{selectedEvent.category}</AppText>
                      </View>
                    )}
                    <AppText style={s.nudgeTitle}>{selectedEvent.name}</AppText>
                    <AppText style={s.nudgeHost}>By {selectedEvent.guardianName}</AppText>
                  </View>
                </View>

                <ScrollView style={s.nudgeBody} showsVerticalScrollIndicator={false}>
                  {/* Date & time */}
                  <View style={s.nudgeRow}>
                    <AppText style={s.nudgeRowIcon}>📅</AppText>
                    <AppText style={s.nudgeRowText}>{formatFullDate(selectedEvent.eventDate, selectedEvent.eventTime)}</AppText>
                  </View>

                  {/* Venue */}
                  {!!selectedEvent.venue && (
                    <View style={s.nudgeRow}>
                      <AppText style={s.nudgeRowIcon}>📍</AppText>
                      <AppText style={s.nudgeRowText}>{selectedEvent.venue}</AppText>
                    </View>
                  )}

                  {/* Going count */}
                  <View style={s.nudgeRow}>
                    <AppText style={s.nudgeRowIcon}>👥</AppText>
                    <AppText style={s.nudgeRowText}>
                      {selectedEvent.goingCount === 0
                        ? 'No one has RSVPd yet'
                        : `${selectedEvent.goingCount} ${selectedEvent.goingCount === 1 ? 'person' : 'people'} going`}
                    </AppText>
                  </View>

                  {/* Description */}
                  {!!selectedEvent.description && (
                    <AppText style={s.nudgeDescription}>{selectedEvent.description}</AppText>
                  )}
                </ScrollView>

                {/* RSVP buttons — hidden for the event creator */}
                {selectedEvent.guardianId !== guardian?.id && (
                  <View style={s.nudgeRsvpRow}>
                    {RSVP_OPTIONS.map(opt => {
                      const active = nudgeRsvp === opt.value;
                      return (
                        <TouchableOpacity
                          key={opt.value}
                          style={[s.nudgeRsvpBtn, active && { backgroundColor: opt.activeBg, borderColor: opt.activeBg }]}
                          onPress={() => rsvpEvent(opt.value)}
                          disabled={nudgeRsvping}
                          activeOpacity={0.8}
                        >
                          <AppText style={[s.nudgeRsvpBtnText, active && { color: opt.activeColor, fontWeight: '800' }]}>
                            {opt.label}
                          </AppText>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}

                {/* Action button */}
                <TouchableOpacity
                  style={s.nudgeBtn}
                  onPress={() => {
                    setSelectedEvent(null);
                    navigation.navigate('EventDetail', { eventId: selectedEvent.id });
                  }}
                  activeOpacity={0.85}
                >
                  <AppText style={s.nudgeBtnText}>View who is going</AppText>
                </TouchableOpacity>
              </>
            )}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Guardian profile sheet — opened from Upcoming card rows */}
      <Modal
        visible={!!guardianSheet || loadingGuardianSheet}
        transparent
        animationType="slide"
        onRequestClose={closeGuardianSheet}
      >
        <TouchableOpacity style={s.nudgeBackdrop} activeOpacity={1} onPress={closeGuardianSheet}>
          <View style={s.nudgeSheet} onStartShouldSetResponder={() => true}>
            <View style={s.nudgePill} />
            {loadingGuardianSheet && !guardianSheet ? (
              <ActivityIndicator size="large" color={COLORS.bloomAccent} style={{ marginVertical: 32 }} />
            ) : guardianSheet ? (
              <>
                <View style={s.guardianSheetHeader}>
                  {guardianSheet.photoUrl ? (
                    <Image source={{ uri: guardianSheet.photoUrl }} style={s.guardianSheetPhoto} />
                  ) : (
                    <View style={[s.guardianSheetAvatar, { backgroundColor: AVATAR_COLORS[guardianSheet.name.charCodeAt(0) % AVATAR_COLORS.length] }]}>
                      <AppText style={s.guardianSheetAvatarText}>{guardianSheet.name[0]?.toUpperCase()}</AppText>
                    </View>
                  )}
                  <View style={s.guardianSheetInfo}>
                    <AppText style={s.guardianSheetName}>{guardianSheet.name}</AppText>
                    {!!(guardianSheet.city || guardianSheet.state) && (
                      <AppText style={s.guardianSheetCity}>
                        📍 {[guardianSheet.city, guardianSheet.state].filter(Boolean).join(', ')}
                      </AppText>
                    )}
                  </View>
                </View>
                {guardianSheet.situationTags.length > 0 && (
                  <View style={s.guardianSheetSection}>
                    <AppText style={s.guardianSheetSectionTitle}>Situation</AppText>
                    <View style={s.guardianSheetTags}>
                      {guardianSheet.situationTags.map(t => (
                        <View key={t} style={s.guardianTag}>
                          <AppText style={s.guardianTagText}>{t}</AppText>
                        </View>
                      ))}
                    </View>
                  </View>
                )}

                {guardianSheet.learners.length > 0 && (
                  <View style={s.guardianSheetSection}>
                    <AppText style={s.guardianSheetSectionTitle}>Learner</AppText>
                    {guardianSheet.learners.map((l, i) => (
                      <View key={i} style={s.learnerRow}>
                        <AppText style={s.learnerName}>{l.name}</AppText>
                        <AppText style={s.learnerMeta}>
                          {[
                            l.date_of_birth ? `${calcAge(l.date_of_birth) ?? '—'} yrs` : null,
                            l.gender,
                          ].filter(Boolean).join('  ·  ')}
                        </AppText>
                      </View>
                    ))}
                  </View>
                )}
              </>
            ) : null}
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bloomBody },
  center:    { flex: 1, justifyContent: 'center', alignItems: 'center' },

  tabs: {
    flexDirection: 'row', margin: 14, marginBottom: 4,
    backgroundColor: COLORS.bloomBorder, borderRadius: 14, padding: 3,
  },
  tab:          { flex: 1, paddingVertical: 9, borderRadius: 11, alignItems: 'center' },
  tabActive:    { backgroundColor: COLORS.bloomCard },
  tabText:      { fontSize: 14, fontWeight: '600', color: COLORS.bloomMuted },
  tabTextActive:{ color: COLORS.bloomNavy, fontWeight: '800' },

  list: { padding: 14, paddingBottom: 100, gap: 10 },

  cardWrapper: { gap: 0 },

  card: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: COLORS.bloomCard, borderRadius: 18, padding: 16,
    borderWidth: 1, borderColor: COLORS.bloomBorder,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },
  cardTopOnly: {
    borderBottomLeftRadius: 0, borderBottomRightRadius: 0, borderBottomWidth: 0,
  },
  dateTag: {
    width: 46, height: 54, borderRadius: 12,
    backgroundColor: COLORS.bloomActiveBg, alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  dateTagDay:   { fontSize: 20, fontWeight: '900', color: COLORS.bloomNavy, lineHeight: 24 },
  dateTagMonth: { fontSize: 10, fontWeight: '700', color: COLORS.bloomAccent, letterSpacing: 0.5 },

  info:         { flex: 1, gap: 3 },
  eventName:    { fontSize: 15, fontWeight: '800', color: COLORS.bloomText },
  eventMeta:    { fontSize: 12, color: COLORS.bloomMuted },
  eventHost:    { fontSize: 11, color: COLORS.bloomAccent, fontWeight: '600' },
  eventHostBtn: { fontSize: 11, color: COLORS.bloomNavy, fontWeight: '700', textDecorationLine: 'underline' },

  goingBadge: { alignItems: 'center' },
  goingNum:   { fontSize: 20, fontWeight: '900', color: COLORS.bloomNavy },
  goingLabel: { fontSize: 10, color: COLORS.bloomMuted, fontWeight: '600' },

  cardActions: {
    flexDirection: 'row',
    backgroundColor: COLORS.bloomCard,
    borderBottomLeftRadius: 18, borderBottomRightRadius: 18,
    borderWidth: 1, borderTopWidth: 0, borderColor: COLORS.bloomBorder,
    overflow: 'hidden',
  },
  actionBtn: { flex: 1, paddingVertical: 10, alignItems: 'center' },
  actionBtnText: { fontSize: 13, fontWeight: '700', color: COLORS.bloomNavy },
  actionBtnDelete: { color: COLORS.statusError },
  actionDivider: { width: 1, backgroundColor: COLORS.bloomBorder },

  loadMoreBtn: {
    marginHorizontal: 14, marginBottom: 16, paddingVertical: 14,
    borderRadius: 14, borderWidth: 1.5, borderColor: COLORS.bloomBorder,
    alignItems: 'center', backgroundColor: COLORS.bloomCard,
  },
  loadMoreText: { fontSize: 13, fontWeight: '700', color: COLORS.bloomNavy },

  empty:      { alignItems: 'center', paddingTop: 80, gap: 12 },
  emptyEmoji: { fontSize: 56 },
  emptyText:  { fontSize: 18, fontWeight: '800', color: COLORS.bloomText, textAlign: 'center' },
  emptyHint:  { fontSize: 14, color: COLORS.bloomMuted },

  fab: {
    position: 'absolute', bottom: 28, right: 20, left: 20,
    backgroundColor: COLORS.bloomAccent, borderRadius: 16,
    paddingVertical: 16, alignItems: 'center',
    shadowColor: COLORS.bloomAccent, shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4, shadowRadius: 12, elevation: 8,
  },
  fabText: { color: COLORS.bloomOnAccent, fontWeight: '800', fontSize: 15 },

  filterPanel: {
    marginHorizontal: 14, marginBottom: 10,
    backgroundColor: COLORS.bloomCard, borderRadius: 16,
    borderWidth: 1, borderColor: COLORS.bloomBorder,
    overflow: 'hidden',
  },
  filterRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 13,
  },
  filterLabel:      { fontSize: 13, fontWeight: '700', color: COLORS.bloomText, width: 72 },
  filterValue:      { flex: 1, fontSize: 13, color: COLORS.bloomMuted },
  filterValueActive:{ color: COLORS.bloomNavy, fontWeight: '600' },
  filterArrow:      { fontSize: 18, color: COLORS.bloomMuted, lineHeight: 20 },
  filterClear:      { fontSize: 13, color: COLORS.bloomNavy, fontWeight: '700' },
  filterDivider:    { height: 1, backgroundColor: COLORS.bloomBorder, marginLeft: 16 },

  filterPickerHdr: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 16,
    borderBottomWidth: 1, borderBottomColor: COLORS.bloomBorder,
  },
  filterPickerTitle:  { fontSize: 16, fontWeight: '800', color: COLORS.bloomText },
  filterPickerCancel: { fontSize: 15, color: COLORS.bloomMuted, width: 60 },
  filterPickerDone:   { fontSize: 15, fontWeight: '700', color: COLORS.bloomNavy, width: 60, textAlign: 'right' },

  catOption: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: COLORS.bloomBorder,
  },
  catOptionActive:     { backgroundColor: COLORS.bloomTintBg },
  catOptionText:       { fontSize: 15, color: COLORS.bloomText },
  catOptionTextActive: { color: COLORS.bloomNavy, fontWeight: '700' },
  catCheck:            { fontSize: 16, color: COLORS.bloomNavy, fontWeight: '700' },

  nudgeBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  nudgeSheet: {
    backgroundColor: COLORS.bloomCard,
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    padding: 20, paddingBottom: 36, maxHeight: '80%',
  },
  nudgePill: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: COLORS.bloomBorder, alignSelf: 'center', marginBottom: 18,
  },

  nudgeHeader: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 20 },
  nudgeDateTag: {
    width: 52, height: 60, borderRadius: 14,
    backgroundColor: COLORS.bloomActiveBg, alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  nudgeDateDay:   { fontSize: 22, fontWeight: '900', color: COLORS.bloomNavy },
  nudgeDateMonth: { fontSize: 10, fontWeight: '700', color: COLORS.bloomAccent, letterSpacing: 0.5 },
  nudgeTitleBlock:    { flex: 1, gap: 4 },
  nudgeCategoryChip:  { alignSelf: 'flex-start', backgroundColor: COLORS.bloomActiveBg, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3 },
  nudgeCategoryText:  { fontSize: 11, color: COLORS.bloomNavy, fontWeight: '700' },
  nudgeTitle:     { fontSize: 20, fontWeight: '900', color: COLORS.bloomText },
  nudgeHost:      { fontSize: 12, color: COLORS.bloomAccent, fontWeight: '600' },

  nudgeBody: { marginBottom: 16 },

  guardianSheetHeader: { flexDirection: 'row', gap: 16, alignItems: 'center', marginBottom: 16 },
  guardianSheetPhoto:      { width: 64, height: 64, borderRadius: 32 },
  guardianSheetAvatar:     { width: 64, height: 64, borderRadius: 32, justifyContent: 'center', alignItems: 'center' },
  guardianSheetAvatarText: { fontSize: 26, fontWeight: '800', color: '#fff' },
  guardianSheetInfo:  { flex: 1, gap: 6 },
  guardianSheetName:  { fontSize: 20, fontWeight: '900', color: COLORS.bloomText },
  guardianSheetCity:  { fontSize: 13, color: COLORS.bloomMuted },
  guardianSheetSection:      { marginTop: 16, gap: 8 },
  guardianSheetSectionTitle: { fontSize: 11, fontWeight: '800', color: COLORS.bloomMuted, letterSpacing: 0.8, textTransform: 'uppercase' },
  guardianSheetTags:         { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  guardianTag:               { backgroundColor: COLORS.bloomActiveBg, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  guardianTagText:           { fontSize: 12, color: COLORS.bloomNavy, fontWeight: '600' },

  learnerRow:  { backgroundColor: COLORS.bloomBody, borderRadius: 12, padding: 12, gap: 3, borderWidth: 1, borderColor: COLORS.bloomBorder },
  learnerName: { fontSize: 15, fontWeight: '800', color: COLORS.bloomText },
  learnerMeta: { fontSize: 12, color: COLORS.bloomMuted },
  nudgeRow:  { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 12 },
  nudgeRowIcon: { fontSize: 16, marginTop: 1 },
  nudgeRowText: { flex: 1, fontSize: 14, color: COLORS.bloomText, lineHeight: 20 },
  nudgeDescription: {
    fontSize: 14, color: COLORS.bloomText, lineHeight: 21,
    marginTop: 8, paddingTop: 14,
    borderTopWidth: 1, borderTopColor: COLORS.bloomBorder,
  },

  nudgeRsvpRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  nudgeRsvpBtn: {
    flex: 1, paddingVertical: 10, borderRadius: 12, alignItems: 'center',
    borderWidth: 1.5, borderColor: COLORS.bloomBorder, backgroundColor: COLORS.bloomBody,
  },
  nudgeRsvpBtnText: { fontSize: 12, fontWeight: '600', color: COLORS.bloomMuted },

  nudgeBtn: {
    backgroundColor: COLORS.bloomAccent, borderRadius: 16,
    paddingVertical: 15, alignItems: 'center',
  },
  nudgeBtnText: { color: COLORS.bloomOnAccent, fontWeight: '800', fontSize: 15 },
});
