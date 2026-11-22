import React, { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import {
  View, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, Alert,
  Modal, ScrollView, TextInput,
} from 'react-native';
import AppText from '../../components/AppText';
import ReportFlag from '../../components/ReportFlag';
import RainbowDivider from '../../components/RainbowDivider';
import GuardianFloatingTabBar from '../../components/GuardianFloatingTabBar';
import GuardianPeekSheet from '../../components/GuardianPeekSheet';
import MoreFiltersLink from '../../components/MoreFiltersLink';
import { LinearGradient } from 'expo-linear-gradient';
import useNicoHeader from '../../hooks/useNicoHeader';
import { useFocusEffect, useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/AuthContext';
import { GuardianNavParamList } from '../../navigation';
import { useVisibleCount } from '../../hooks/useVisibleCount';
import {
  NICO, TEXT_STYLE, SPACING, RADIUS, SHADOW, FONT_SIZE, FONT_WEIGHT,
  BTN_SIZE, BTN_VARIANT, INPUT, BUTTERFLY_BORDER, BUTTERFLY_TILES, scale,
} from '../../constants/theme';

type Nav  = NativeStackNavigationProp<GuardianNavParamList>;
// Only "Going" is offered: tap to RSVP, tap again to cancel (deletes the row). Older 'interested'
// rows (dummy data) are ignored everywhere; the DB check still allows them.
type Rsvp = 'going';

interface GuardianProfile {
  id: string; name: string; photoUrl: string | null;
  county: string; situationTags: string[];
}

const RSVP_OPTIONS: { value: Rsvp; label: string; activeColor: string; activeBg: string }[] = [
  { value: 'going',      label: '✓ I will attend',     activeColor: NICO.success,   activeBg: NICO.successLight },
];

interface EventItem {
  id: string;
  name: string;
  eventDate: string;
  eventTime: string | null;
  duration: string | null;
  venue: string;
  description: string;
  category: string | null;
  guardianName: string;
  guardianId: string;
  goingCount: number;
  // Guardians who RSVP'd "going" (blocked guardians are already hidden by RLS) — shown in the sheet
  goingAttendees: { guardianId: string; name: string }[];
  createdAt: string;
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


type EventsRoute = RouteProp<GuardianNavParamList, 'Events'>;

type EventsTab = 'upcoming' | 'mine' | 'attending';

// No "from" date: every tab only lists events from today onward, so only an end date ("Until") is useful
interface EventFilters {
  name: string;
  category: string;
  dateTo: Date | null;
}

const EMPTY_FILTERS: EventFilters = { name: '', category: '', dateTo: null };

function filtersKey(f: EventFilters): string {
  return `${f.name}|${f.category}|${f.dateTo?.toISOString() ?? ''}`;
}

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export default function EventsScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<EventsRoute>();
  const { guardian } = useAuth();
  useNicoHeader(navigation);

  useLayoutEffect(() => {
    const addBtn = (
      <TouchableOpacity
        onPress={() => navigation.navigate('CreateEvent')}
        activeOpacity={0.6}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        style={{ marginRight: SPACING.xs }}
      >
        <AppText style={{ fontSize: scale(24) }}>➕</AppText>
      </TouchableOpacity>
    );
    navigation.setOptions({
      headerRight: () => addBtn,
      // iOS 26 wraps custom headerRight elements in a native "Liquid Glass" pill by default —
      // hidesSharedBackground turns that off so only our own element renders.
      unstable_headerRightItems: () => [
        { type: 'custom', element: addBtn, hidesSharedBackground: true },
      ],
    });
  }, [navigation]);


  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<EventsTab>(route.params?.tab ?? 'upcoming');
  const [attendingEvents, setAttendingEvents] = useState<EventItem[]>([]);
  const [selectedEvent, setSelectedEvent]       = useState<EventItem | null>(null);

  const [availableCategories, setAvailableCategories] = useState<string[]>([]);

  // Each tab keeps its own filters (same controls on every tab, but values don't carry across)
  const [filtersByTab, setFiltersByTab] = useState<Record<EventsTab, EventFilters>>({
    upcoming: EMPTY_FILTERS, mine: EMPTY_FILTERS, attending: EMPTY_FILTERS,
  });
  const { name: filterName, category: filterCategory, dateTo: filterDateTo } = filtersByTab[tab];
  const updateFilters     = (patch: Partial<EventFilters>) => setFiltersByTab(prev => ({ ...prev, [tab]: { ...prev[tab], ...patch } }));
  const setFilterName     = (name: string) => updateFilters({ name });
  const setFilterCategory = (category: string) => updateFilters({ category });
  const setFilterDateTo   = (dateTo: Date | null) => updateFilters({ dateTo });

  const [showDateToPicker, setShowDateToPicker] = useState(false);
  const [tempDateTo, setTempDateTo]             = useState(new Date());
  const [showCategorySheet, setShowCategorySheet] = useState(false);
  const [nudgeRsvping, setNudgeRsvping]         = useState(false);
  const [guardianSheet, setGuardianSheet]       = useState<GuardianProfile | null>(null);
  const [loadingGuardianSheet, setLoadingGuardianSheet] = useState(false);

  useFocusEffect(useCallback(() => { load(); }, []));

  useEffect(() => {
    supabase.from('event_category_options').select('label').order('label')
      .then(({ data }) => setAvailableCategories((data ?? []).map((c: any) => c.label)));
  }, []);

  function mapEvent(e: any): EventItem {
    return {
      id: e.id,
      name: e.name,
      description: e.description ?? '',
      category: e.category ?? null,
      eventDate: e.event_date,
      eventTime: e.event_time ?? null,
      duration: e.duration ?? null,
      venue: e.venue ?? '',
      guardianName: e.guardians?.full_name ?? 'Unknown',
      guardianId: e.guardian_id,
      goingCount: (e.event_participants ?? []).filter((p: any) => p.rsvp === 'going').length,
      goingAttendees: (e.event_participants ?? [])
        .filter((p: any) => p.rsvp === 'going')
        .map((p: any) => ({ guardianId: p.guardian_id, name: p.guardians?.full_name ?? 'Unknown' })),
      createdAt: e.created_at ?? '',
    };
  }

  async function load() {
    setLoading(true);
    // Local date, not UTC: toISOString() would roll over to tomorrow in the California evening
    const today = toLocalDateStr(new Date());
    const SELECT = 'id, name, description, category, event_date, event_time, duration, venue, guardian_id, created_at, guardians!events_guardian_id_fkey(full_name), event_participants(guardian_id, rsvp, guardians!event_participants_guardian_id_fkey(full_name))';

    const { data } = await supabase
      .from('events')
      .select(SELECT)
      .gte('event_date', today)
      .order('event_date', { ascending: true });

    const rows = data ?? [];
    setEvents(rows.map(mapEvent));

    // Attending: events the logged-in guardian RSVPd 'going' to, not created by them.
    // Worked out from the RSVPs already in this one query (no extra calls); soonest first, like Upcoming.
    setAttendingEvents(
      guardian
        ? rows
            .filter((e: any) =>
              e.guardian_id !== guardian.id &&
              (e.event_participants ?? []).some((p: any) => p.guardian_id === guardian.id && p.rsvp === 'going'))
            .map(mapEvent)
        : [],
    );

    setLoading(false);
  }

  const applyFilters = (list: EventItem[], f: EventFilters) => {
    if (f.name.trim()) list = list.filter(e => e.name.toLowerCase().includes(f.name.trim().toLowerCase()));
    if (f.category)    list = list.filter(e => e.category === f.category);
    if (f.dateTo)      list = list.filter(e => e.eventDate <= toLocalDateStr(f.dateTo!));
    return list;
  };

  const upcomingFiltered  = applyFilters([...events], filtersByTab.upcoming);
  const mineFiltered      = applyFilters(events.filter(e => e.guardianId === guardian?.id), filtersByTab.mine)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const attendingFiltered = applyFilters([...attendingEvents], filtersByTab.attending);

  const { visible: visibleUpcoming,  showLoadMore: showLoadMoreUpcoming,  loadMore: loadMoreUpcoming,  showCapMessage: showCapUpcoming,  pageSize: pageSizeUpcoming  } = useVisibleCount(upcomingFiltered,  filtersKey(filtersByTab.upcoming));
  const { visible: visibleMine,      showLoadMore: showLoadMoreMine,      loadMore: loadMoreMine,      showCapMessage: showCapMine,      pageSize: pageSizeMine      } = useVisibleCount(mineFiltered,      filtersKey(filtersByTab.mine));
  const { visible: visibleAttending, showLoadMore: showLoadMoreAttending, loadMore: loadMoreAttending, showCapMessage: showCapAttending, pageSize: pageSizeAttending } = useVisibleCount(attendingFiltered, filtersKey(filtersByTab.attending));

  const filtered = tab === 'mine' ? visibleMine : tab === 'attending' ? visibleAttending : visibleUpcoming;

  // My RSVP for the open event comes from the already-loaded attendee list (no extra request);
  // rsvpEvent() updates selectedEvent.goingAttendees, so this stays in sync.
  const nudgeRsvp: Rsvp | null =
    selectedEvent && guardian && selectedEvent.goingAttendees.some(a => a.guardianId === guardian.id)
      ? 'going' : null;

  async function openGuardianSheet(guardianId: string) {
    setGuardianSheet(null);
    setLoadingGuardianSheet(true);
    const { data } = await supabase
      .from('guardians')
      .select('id, full_name, photo_url, county, situation_tags')
      .eq('id', guardianId)
      .single();
    if (data) {
      setGuardianSheet({
        id: data.id, name: data.full_name ?? '',
        photoUrl: data.photo_url ?? null,
        county: data.county ?? '',
        situationTags: data.situation_tags ?? [],
      });
    }
    setLoadingGuardianSheet(false);
  }

  function closeGuardianSheet() {
    setGuardianSheet(null);
    setLoadingGuardianSheet(false);
  }

  // "Going" toggle: tap to RSVP, tap again to cancel (same as EventDetailScreen)
  async function rsvpEvent(_status: Rsvp) {
    if (!selectedEvent || !guardian) return;
    const event = selectedEvent;
    const wasGoing = nudgeRsvp === 'going';
    setNudgeRsvping(true);
    const { error } = wasGoing
      ? await supabase.from('event_participants').delete()
          .eq('event_id', event.id).eq('guardian_id', guardian.id)
      : await supabase.from('event_participants').upsert(
          { event_id: event.id, guardian_id: guardian.id, rsvp: 'going' },
          { onConflict: 'event_id,guardian_id' },
        );
    setNudgeRsvping(false);
    if (error) { Alert.alert("Couldn't save your RSVP", 'Please try again.'); return; }

    // Count and the "Who's coming" list both update with my RSVP
    const me = { guardianId: guardian.id, name: guardian.full_name };
    const bump = (e: EventItem): EventItem => e.id !== event.id ? e : {
      ...e,
      goingCount: Math.max(0, e.goingCount + (wasGoing ? -1 : 1)),
      goingAttendees: wasGoing
        ? e.goingAttendees.filter(a => a.guardianId !== me.guardianId)
        : [...e.goingAttendees.filter(a => a.guardianId !== me.guardianId), me],
    };
    setEvents(prev => prev.map(bump));
    setSelectedEvent(prev => (prev ? bump(prev) : prev));
    // Attending updates right away (it's otherwise only rebuilt when the screen loads)
    setAttendingEvents(prev => wasGoing
      ? prev.filter(e => e.id !== event.id)
      : [...prev.filter(e => e.id !== event.id), bump(event)]
          .sort((a, b) => a.eventDate.localeCompare(b.eventDate)));
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
    return <View style={s.center}><ActivityIndicator size="large" color={NICO.primary} /></View>;
  }

  return (
    <View style={s.container}>
      <RainbowDivider />
      <View style={s.tabBar}>
        {(['upcoming', 'mine', 'attending'] as const).map(t => (
          <TouchableOpacity
            key={t}
            style={[s.tab, tab === t && s.tabActive]}
            onPress={() => setTab(t)}
            activeOpacity={0.8}
          >
            <AppText style={[s.tabTxt, tab === t && s.tabTxtActive]}>
              {t === 'upcoming' ? 'Upcoming' : t === 'mine' ? 'Hosting' : 'Attending'}
            </AppText>
          </TouchableOpacity>
        ))}
      </View>

      {/* Filters (values are per tab) */}
      <View style={s.filterOuter}>
        <LinearGradient colors={[...BUTTERFLY_BORDER.colors]} start={BUTTERFLY_BORDER.start} end={BUTTERFLY_BORDER.end} style={s.searchGradient}>
          <TextInput
            style={s.searchInput}
            placeholder="Search by name…"
            placeholderTextColor={NICO.textMuted}
            value={filterName}
            onChangeText={setFilterName}
            clearButtonMode="while-editing"
          />
        </LinearGradient>

        <View style={s.dateRow}>
          <LinearGradient colors={[...BUTTERFLY_BORDER.colors]} start={BUTTERFLY_BORDER.start} end={BUTTERFLY_BORDER.end} style={s.dateBtnGradient}>
            <TouchableOpacity
              style={[s.dateBtn, filterDateTo && s.dateBtnActive]}
              onPress={() => { setTempDateTo(filterDateTo ?? startOfToday()); setShowDateToPicker(true); }}
              activeOpacity={0.75}
            >
              <AppText style={[s.dateBtnTxt, filterDateTo && s.dateBtnTxtActive]}>
                {filterDateTo ? `Until ${filterDateTo.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}` : 'Until'}
              </AppText>
              {filterDateTo && (
                <TouchableOpacity onPress={() => setFilterDateTo(null)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <AppText style={s.dateClear}>✕</AppText>
                </TouchableOpacity>
              )}
            </TouchableOpacity>
          </LinearGradient>
        </View>

        <View style={s.filterBar}>
          <AppText style={s.resultCount}>
            {(tab === 'mine' ? mineFiltered : tab === 'attending' ? attendingFiltered : upcomingFiltered).length} result{(tab === 'mine' ? mineFiltered : tab === 'attending' ? attendingFiltered : upcomingFiltered).length !== 1 ? 's' : ''}
          </AppText>
          {availableCategories.length > 0 && (
            <MoreFiltersLink onPress={() => setShowCategorySheet(true)} isActive={!!filterCategory} />
          )}
        </View>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={e => e.id}
        contentContainerStyle={s.list}
        renderItem={({ item: e, index }) => {
          const d = new Date(e.eventDate + 'T12:00:00');
          const isMine = tab === 'mine';
          const showHost = tab !== 'mine';
          const tileBg = BUTTERFLY_TILES[index % BUTTERFLY_TILES.length].bg;
          return (
            <View style={s.cardWrapper}>
              <TouchableOpacity
                style={[s.card, { backgroundColor: tileBg }]}
                onPress={() => setSelectedEvent(e)}
                activeOpacity={0.82}
              >
                <View style={s.dateTag}>
                  <AppText style={s.dateTagDay}>{d.getDate()}</AppText>
                  <AppText style={s.dateTagMonth}>
                    {d.toLocaleDateString(undefined, { month: 'short' }).toUpperCase()}
                  </AppText>
                  <AppText style={s.dateTagYear}>{d.getFullYear()}</AppText>
                </View>

                <View style={s.info}>
                  <AppText style={s.eventName}>{e.name}</AppText>
                  {/* Time · duration on one row, address on the next */}
                  {(!!e.eventTime || !!e.duration) && (
                    <AppText style={s.eventMeta}>
                      {[e.eventTime ? formatTime(e.eventTime) : null, e.duration].filter(Boolean).join('  ·  ')}
                    </AppText>
                  )}
                  {!!e.venue && <AppText style={s.eventMeta}>{e.venue}</AppText>}
                  {showHost ? (
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

                {isMine ? (
                  <View style={s.mineRightCol}>
                    <View style={s.cardIconRow}>
                      <TouchableOpacity
                        style={s.cardIconBtn}
                        onPress={() => navigation.navigate('EditEvent', { eventId: e.id })}
                        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                        activeOpacity={0.7}
                      >
                        <AppText style={s.cardIconBtnTxt}>✏️</AppText>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[s.cardIconBtn, s.cardIconBtnDelete]}
                        onPress={() => deleteEvent(e.id)}
                        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                        activeOpacity={0.7}
                      >
                        <AppText style={s.cardIconBtnTxt}>🗑️</AppText>
                      </TouchableOpacity>
                    </View>
                    <View style={s.goingBadge}>
                      <AppText style={s.goingNum}>{e.goingCount}</AppText>
                      <AppText style={s.goingLabel}>going</AppText>
                    </View>
                  </View>
                ) : (
                  <View style={s.goingBadge}>
                    <AppText style={s.goingNum}>{e.goingCount}</AppText>
                    <AppText style={s.goingLabel}>going</AppText>
                  </View>
                )}
              </TouchableOpacity>
            </View>
          );
        }}
        ListFooterComponent={(() => {
          const showMore    = tab === 'mine' ? showLoadMoreMine : tab === 'attending' ? showLoadMoreAttending : showLoadMoreUpcoming;
          const doPaginate  = tab === 'mine' ? loadMoreMine     : tab === 'attending' ? loadMoreAttending     : loadMoreUpcoming;
          const ps          = tab === 'mine' ? pageSizeMine     : tab === 'attending' ? pageSizeAttending     : pageSizeUpcoming;
          const showCap     = tab === 'mine' ? showCapMine      : tab === 'attending' ? showCapAttending      : showCapUpcoming;
          if (showMore) return (
            <TouchableOpacity style={s.loadMoreBtn} onPress={doPaginate} activeOpacity={0.75}>
              <AppText style={s.loadMoreText}>Load {ps} more</AppText>
            </TouchableOpacity>
          );
          if (showCap) return (
            <View style={s.capMessage}>
              <AppText style={s.capMessageText}>Use filters to search records</AppText>
            </View>
          );
          return null;
        })()}
        ListEmptyComponent={
          <View style={s.empty}>
            <AppText style={s.emptyEmoji}>🎉</AppText>
            <AppText style={s.emptyText}>
              {tab === 'mine' ? "You haven't created any events" : tab === 'attending' ? "No upcoming events you're attending" : 'No upcoming events'}
            </AppText>
            <AppText style={s.emptyHint}>
              {tab === 'attending' ? 'RSVP Going on an event to see it here' : 'Tap below to create one'}
            </AppText>
          </View>
        }
      />


      {/* Filter: "Until" date picker (today onward) */}
      <Modal visible={showDateToPicker} transparent animationType="slide" onRequestClose={() => setShowDateToPicker(false)}>
        <TouchableOpacity style={s.nudgeBackdrop} activeOpacity={1} onPress={() => setShowDateToPicker(false)}>
          <View style={s.nudgeSheet} onStartShouldSetResponder={() => true}>
            <View style={s.filterPickerHdr}>
              <TouchableOpacity onPress={() => setShowDateToPicker(false)}><AppText style={s.filterPickerCancel}>Cancel</AppText></TouchableOpacity>
              <AppText style={s.filterPickerTitle}>Until</AppText>
              <TouchableOpacity onPress={() => { setFilterDateTo(tempDateTo); setShowDateToPicker(false); }}><AppText style={s.filterPickerDone}>Done</AppText></TouchableOpacity>
            </View>
            <DateTimePicker value={tempDateTo} minimumDate={startOfToday()} mode="date" display="spinner" onChange={(_, d) => { if (d) setTempDateTo(d); }} style={{ height: 220 }} />
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

                {/* Title + host, with 🚩 (non-hosts) and ✕. Date / time / venue are on the card. */}
                <View style={s.nudgeHeader}>
                  <View style={s.nudgeTitleBlock}>
                    {selectedEvent.category && (
                      <View style={s.nudgeCategoryChip}>
                        <AppText style={s.nudgeCategoryText}>{selectedEvent.category}</AppText>
                      </View>
                    )}
                    <AppText style={s.nudgeTitle}>{selectedEvent.name}</AppText>
                    <AppText style={s.nudgeHost}>By {selectedEvent.guardianName}</AppText>
                  </View>
                  {selectedEvent.guardianId !== guardian?.id && (
                    <ReportFlag target={{ area: 'event', eventId: selectedEvent.id }} />
                  )}
                  {/* Always reachable — a long attendee list can leave no backdrop to tap */}
                  <TouchableOpacity
                    style={s.nudgeCloseBtn}
                    onPress={() => setSelectedEvent(null)}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel="Close"
                  >
                    <AppText style={s.nudgeCloseIcon}>✕</AppText>
                  </TouchableOpacity>
                </View>

                {!!selectedEvent.description && (
                  <AppText style={s.nudgeDescription}>{selectedEvent.description}</AppText>
                )}

                {/* Count + RSVP on one row (host sees the count only) */}
                <View style={s.nudgeCountRow}>
                  <AppText style={s.nudgeCountText}>👥 {selectedEvent.goingCount} going</AppText>
                  {selectedEvent.guardianId !== guardian?.id && RSVP_OPTIONS.map(opt => {
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

                {/* Who's coming — plain names; only this part scrolls */}
                <AppText style={s.nudgeListTitle}>Who's coming</AppText>
                <ScrollView style={s.nudgeList} showsVerticalScrollIndicator>
                  {selectedEvent.goingAttendees.length === 0 ? (
                    <AppText style={s.nudgeListEmpty}>No one has RSVP'd yet</AppText>
                  ) : (
                    // Two columns side by side
                    <View style={s.nudgeListGrid}>
                      {selectedEvent.goingAttendees.map((a, i) => (
                        // Left column left-aligned, right column right-aligned
                        <AppText
                          key={a.guardianId}
                          style={[s.nudgeListName, i % 2 === 1 && s.nudgeListNameRight]}
                          numberOfLines={1}
                        >
                          • {a.name}
                        </AppText>
                      ))}
                    </View>
                  )}
                </ScrollView>
              </>
            )}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Guardian profile sheet — opened from Upcoming card rows */}
      <GuardianPeekSheet
        visible={!!guardianSheet || loadingGuardianSheet}
        guardian={guardianSheet}
        loading={loadingGuardianSheet}
        onClose={closeGuardianSheet}
        onBlocked={() => { setSelectedEvent(null); load(); }}   // their events disappear
      />
      <GuardianFloatingTabBar />
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: NICO.screenBg },
  center:    { flex: 1, justifyContent: 'center', alignItems: 'center' },

  tabBar: {
    flexDirection: 'row', backgroundColor: NICO.surface,
    borderBottomWidth: 1, borderBottomColor: NICO.border,
  },
  tab: {
    flex: 1, alignItems: 'center', paddingVertical: SPACING.md,
    borderBottomWidth: 2.5, borderBottomColor: 'transparent',
  },
  tabActive:    { borderBottomColor: NICO.primary },
  tabTxt:       { ...TEXT_STYLE.tabLabel },
  tabTxtActive: { ...TEXT_STYLE.tabLabel, color: NICO.primary, fontWeight: FONT_WEIGHT.extraBold },

  list: { padding: SPACING.base, paddingBottom: 48, gap: SPACING.sm },

  cardWrapper: { gap: 0 },

  card: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.base,
    borderRadius: RADIUS.xl, padding: SPACING.base,
    borderWidth: 1, borderColor: 'transparent',
    ...SHADOW.md,
  },
  cardTopOnly: {
    borderBottomLeftRadius: 0, borderBottomRightRadius: 0, borderBottomWidth: 0,
  },
  dateTag: {
    width: scale(46), height: scale(66), borderRadius: RADIUS.lg,
    backgroundColor: NICO.primaryLight, alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  dateTagDay:   { fontSize: FONT_SIZE.xl, fontWeight: FONT_WEIGHT.extraBold, color: NICO.primary, lineHeight: 24 },
  dateTagMonth: { fontSize: FONT_SIZE.xs, fontWeight: FONT_WEIGHT.bold, color: NICO.primary, letterSpacing: 0.5 },
  dateTagYear:  { fontSize: FONT_SIZE.xs, fontWeight: FONT_WEIGHT.bold, color: NICO.text },

  info:         { flex: 1, gap: 3 },
  eventName:    { ...TEXT_STYLE.bodyMedium, fontSize: FONT_SIZE.xl, fontWeight: FONT_WEIGHT.extraBold },
  eventMeta:    { fontSize: FONT_SIZE.md, color: NICO.text, fontWeight: FONT_WEIGHT.semiBold },
  eventHost:    { fontSize: FONT_SIZE.sm, color: NICO.primary, fontWeight: FONT_WEIGHT.bold },
  eventHostBtn: { fontSize: FONT_SIZE.lg, color: '#2563EB', fontWeight: FONT_WEIGHT.bold, textDecorationLine: 'underline' },

  goingBadge: { flexDirection: 'row', alignItems: 'baseline', gap: SPACING.xs },
  goingNum:   { fontSize: FONT_SIZE.xl, fontWeight: FONT_WEIGHT.extraBold, color: NICO.primary },
  goingLabel: { fontSize: FONT_SIZE.sm, color: NICO.text, fontWeight: FONT_WEIGHT.semiBold },

  cardActions: {
    flexDirection: 'row',
    borderBottomLeftRadius: RADIUS.xl, borderBottomRightRadius: RADIUS.xl,
    borderWidth: 1, borderTopWidth: 0, borderColor: 'transparent',
    overflow: 'hidden',
  },
  actionBtn:       { flex: 1, paddingVertical: SPACING.md, alignItems: 'center' },
  actionBtnText:   { ...TEXT_STYLE.bodyMedium },
  actionBtnDelete: { color: NICO.error },
  actionDivider:   { width: 1, backgroundColor: NICO.border },

  loadMoreBtn:    { ...BTN_SIZE.sm, ...BTN_VARIANT.outline, alignSelf: 'center', marginTop: SPACING.base },
  loadMoreText:   { fontSize: FONT_SIZE.lg, fontWeight: FONT_WEIGHT.extraBold, color: NICO.primary },
  capMessage:     { alignItems: 'center', paddingVertical: SPACING.base },
  capMessageText: { ...TEXT_STYLE.hint, fontStyle: 'italic' },

  empty:      { alignItems: 'center', paddingTop: 80, gap: SPACING.md },
  emptyEmoji: { fontSize: scale(56) },
  emptyText:  { ...TEXT_STYLE.cardTitle, textAlign: 'center' },
  emptyHint:  { ...TEXT_STYLE.screenHint },


  // Filter area — butterfly border inputs
  filterOuter:     { padding: SPACING.base, paddingBottom: SPACING.sm, gap: SPACING.sm },
  searchGradient:  { padding: BUTTERFLY_BORDER.width, borderRadius: RADIUS.md + BUTTERFLY_BORDER.width },
  searchInput:     { ...INPUT.base, borderWidth: 0 },
  filterBar:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  resultCount:     { ...TEXT_STYLE.caption, color: NICO.textMuted },
  dateRow:         { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  dateBtnGradient: { flex: 1, padding: BUTTERFLY_BORDER.width, borderRadius: RADIUS.lg + BUTTERFLY_BORDER.width },
  dateBtn:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: RADIUS.lg, paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, backgroundColor: NICO.surface },
  dateBtnActive:   { backgroundColor: NICO.primaryLight },
  dateBtnTxt:      { fontSize: FONT_SIZE.md, color: NICO.textMuted, flex: 1 },
  dateBtnTxtActive:{ fontSize: FONT_SIZE.md, color: NICO.primary, fontWeight: FONT_WEIGHT.semiBold, flex: 1 },
  dateClear:       { fontSize: FONT_SIZE.sm, color: NICO.primary, fontWeight: FONT_WEIGHT.bold },

  // My Events: right column — icons row on top, going count below
  mineRightCol: { alignItems: 'center', gap: SPACING.xs },
  cardIconRow:  { flexDirection: 'row', gap: SPACING.xs },
  cardIconBtn: {
    width: scale(30), height: scale(30), borderRadius: RADIUS.full,
    backgroundColor: 'rgba(255,255,255,0.75)',
    justifyContent: 'center', alignItems: 'center',
  },
  cardIconBtnDelete: { backgroundColor: 'rgba(255,220,220,0.85)' },
  cardIconBtnTxt:    { fontSize: scale(14) },

  filterPickerHdr: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg, paddingVertical: SPACING.base,
    borderBottomWidth: 1, borderBottomColor: NICO.border,
  },
  filterPickerTitle:  { ...TEXT_STYLE.cardTitle },
  filterPickerCancel: { fontSize: FONT_SIZE.lg, color: NICO.textMuted, width: 60 },
  filterPickerDone:   { fontSize: FONT_SIZE.lg, fontWeight: FONT_WEIGHT.bold, color: NICO.primary, width: 60, textAlign: 'right' },

  catOption: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg, paddingVertical: SPACING.base,
    borderBottomWidth: 1, borderBottomColor: NICO.border,
  },
  catOptionActive:     { backgroundColor: NICO.primaryLight },
  catOptionText:       { fontSize: FONT_SIZE.lg, color: NICO.text },
  catOptionTextActive: { color: NICO.primary, fontWeight: FONT_WEIGHT.bold },
  catCheck:            { fontSize: FONT_SIZE.lg, color: NICO.primary, fontWeight: FONT_WEIGHT.bold },

  nudgeBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  nudgeSheet: {
    backgroundColor: NICO.screenBg,
    borderTopLeftRadius: RADIUS['3xl'], borderTopRightRadius: RADIUS['3xl'],
    padding: SPACING.lg, paddingBottom: scale(36), maxHeight: '80%',
  },
  nudgePill: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: NICO.border, alignSelf: 'center', marginBottom: SPACING.lg,
  },

  nudgeHeader: { flexDirection: 'row', alignItems: 'center', gap: SPACING.base, marginBottom: SPACING.lg },
  nudgeTitleBlock:   { flex: 1, gap: SPACING.xs },
  nudgeCategoryChip: { alignSelf: 'flex-start', backgroundColor: NICO.primaryLight, borderRadius: RADIUS.full, paddingHorizontal: SPACING.sm, paddingVertical: 3 },
  nudgeCategoryText: { fontSize: FONT_SIZE.sm, color: NICO.primary, fontWeight: FONT_WEIGHT.bold },
  nudgeTitle:    { ...TEXT_STYLE.screenTitle },
  nudgeHost:     { fontSize: FONT_SIZE.md, fontWeight: FONT_WEIGHT.bold, color: NICO.primary },

  nudgeCloseBtn:  { width: 44, height: 44, justifyContent: 'center', alignItems: 'center', marginRight: -SPACING.sm },
  nudgeCloseIcon: { fontSize: FONT_SIZE.xl, fontWeight: FONT_WEIGHT.bold, color: NICO.text },

  nudgeDescription: {
    fontSize: FONT_SIZE.lg, fontWeight: FONT_WEIGHT.semiBold, color: NICO.text, lineHeight: 24,
    marginBottom: SPACING.base,
  },

  // Fixed row: count on the left, compact RSVP button on the right
  nudgeCountRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: SPACING.md,
    paddingVertical: SPACING.md, borderTopWidth: 1, borderBottomWidth: 1, borderColor: NICO.border,
    marginBottom: SPACING.md,
  },
  nudgeCountText: { fontSize: FONT_SIZE.lg, fontWeight: FONT_WEIGHT.bold, color: NICO.text },

  nudgeListTitle: { fontSize: FONT_SIZE.md, fontWeight: FONT_WEIGHT.extraBold, color: NICO.text, marginBottom: SPACING.sm },
  nudgeList:      { flexShrink: 1 },   // takes the remaining sheet height (maxHeight 80%), then scrolls
  nudgeListGrid:  { flexDirection: 'row', flexWrap: 'wrap' },
  nudgeListName:  { width: '50%', paddingRight: SPACING.sm, fontSize: FONT_SIZE.lg, fontWeight: FONT_WEIGHT.semiBold, color: NICO.text, paddingVertical: SPACING.xs },
  nudgeListNameRight: { textAlign: 'right', paddingRight: 0, paddingLeft: SPACING.sm },
  nudgeListEmpty: { fontSize: FONT_SIZE.md, color: NICO.text, fontStyle: 'italic' },

  // paddingVertical 8.5 (was 12) → button ~15% shorter
  nudgeRsvpBtn:    { minWidth: scale(110), paddingHorizontal: SPACING.lg, paddingVertical: scale(8.5), borderRadius: RADIUS.lg, alignItems: 'center', borderWidth: 1.5, borderColor: NICO.border, backgroundColor: NICO.background },
  nudgeRsvpBtnText:{ fontSize: FONT_SIZE.lg, fontWeight: FONT_WEIGHT.bold, color: NICO.text },
});
