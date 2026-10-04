import React, { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import {
  View, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, Alert,
  Modal, ScrollView, Image, TextInput,
} from 'react-native';
import AppText from '../../components/AppText';
import RainbowDivider from '../../components/RainbowDivider';
import GuardianFloatingTabBar from '../../components/GuardianFloatingTabBar';
import MoreFiltersLink from '../../components/MoreFiltersLink';
import { LinearGradient } from 'expo-linear-gradient';
import useNicoHeader from '../../hooks/useNicoHeader';
import { useFocusEffect, useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/AuthContext';
import { calcAge } from '../../constants';
import { GuardianNavParamList } from '../../navigation';
import { useVisibleCount } from '../../hooks/useVisibleCount';
import {
  NICO, TEXT_STYLE, SPACING, RADIUS, SHADOW, FONT_SIZE, FONT_WEIGHT,
  BTN_SIZE, BTN_VARIANT, INPUT, BUTTERFLY_BORDER, BUTTERFLY_TILES, scale,
} from '../../constants/theme';

type Nav  = NativeStackNavigationProp<GuardianNavParamList>;
type Rsvp = 'going' | 'interested' | 'not_going';

const AVATAR_COLORS = [NICO.teal, NICO.orange, NICO.coral, NICO.pink, NICO.purple, NICO.primary];

interface LearnerInfo { name: string; date_of_birth: string | null; gender: string | null }

interface GuardianProfile {
  id: string; name: string; photoUrl: string | null;
  county: string; situationTags: string[];
  learners: LearnerInfo[];
}

const RSVP_OPTIONS: { value: Rsvp; label: string; activeColor: string; activeBg: string }[] = [
  { value: 'going',      label: '✓ Going',     activeColor: NICO.success,   activeBg: NICO.successLight },
  { value: 'interested', label: '★ Interested', activeColor: NICO.warning,   activeBg: NICO.warningLight },
  { value: 'not_going',  label: "✕ Can't go",  activeColor: NICO.textMuted, activeBg: NICO.background   },
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

function formatFullDate(dateStr: string, timeStr?: string | null): string {
  const d = new Date(dateStr + 'T12:00:00');
  const date = d.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  if (!timeStr) return date;
  const [h, m] = timeStr.split(':');
  const hours = parseInt(h, 10);
  return `${date} at ${hours % 12 || 12}:${m} ${hours >= 12 ? 'PM' : 'AM'}`;
}

type EventsRoute = RouteProp<GuardianNavParamList, 'Events'>;

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
  const [tab, setTab] = useState<'upcoming' | 'mine' | 'attending'>(route.params?.tab ?? 'upcoming');
  const [attendingEvents, setAttendingEvents] = useState<EventItem[]>([]);
  const [selectedEvent, setSelectedEvent]       = useState<EventItem | null>(null);
  const [nudgeRsvp, setNudgeRsvp]               = useState<Rsvp | null>(null);

  // Shared filters (both tabs)
  const [availableCategories, setAvailableCategories] = useState<string[]>([]);
  const [filterName, setFilterName]             = useState('');
  const [filterCategory, setFilterCategory]     = useState('');
  const [filterDateFrom, setFilterDateFrom]     = useState<Date | null>(null);
  const [filterDateTo, setFilterDateTo]         = useState<Date | null>(null);
  const [showDateFromPicker, setShowDateFromPicker] = useState(false);
  const [showDateToPicker, setShowDateToPicker] = useState(false);
  const [tempDateFrom, setTempDateFrom]         = useState(new Date());
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
      venue: e.venue ?? '',
      guardianName: e.guardians?.full_name ?? 'Unknown',
      guardianId: e.guardian_id,
      goingCount: (e.event_participants ?? []).filter((p: any) => p.rsvp === 'going').length,
      createdAt: e.created_at ?? '',
    };
  }

  async function load() {
    setLoading(true);
    const today = new Date().toISOString().slice(0, 10);
    const SELECT = 'id, name, description, category, event_date, event_time, venue, guardian_id, created_at, guardians!events_guardian_id_fkey(full_name), event_participants(guardian_id, rsvp)';

    const { data } = await supabase
      .from('events')
      .select(SELECT)
      .gte('event_date', today)
      .order('event_date', { ascending: true });

    setEvents((data ?? []).map(mapEvent));

    // Attending: events where logged-in guardian RSVPd 'going', not created by them
    if (guardian) {
      const { data: rsvps } = await supabase
        .from('event_participants')
        .select('event_id')
        .eq('guardian_id', guardian.id)
        .eq('rsvp', 'going');

      const attendingIds = (rsvps ?? []).map((r: any) => r.event_id as string);

      if (attendingIds.length > 0) {
        const { data: aData } = await supabase
          .from('events')
          .select(SELECT)
          .in('id', attendingIds)
          .neq('guardian_id', guardian.id)
          .gte('event_date', today)
          .order('event_date', { ascending: false });
        setAttendingEvents((aData ?? []).map(mapEvent));
      } else {
        setAttendingEvents([]);
      }
    }

    setLoading(false);
  }

  const filterResetKey = `${filterName}|${filterCategory}|${filterDateFrom?.toISOString() ?? ''}|${filterDateTo?.toISOString() ?? ''}`;

  const applyFilters = (list: EventItem[]) => {
    if (filterName.trim()) list = list.filter(e => e.name.toLowerCase().includes(filterName.trim().toLowerCase()));
    if (filterCategory) list = list.filter(e => e.category === filterCategory);
    if (filterDateFrom) list = list.filter(e => e.eventDate >= toLocalDateStr(filterDateFrom));
    if (filterDateTo)   list = list.filter(e => e.eventDate <= toLocalDateStr(filterDateTo));
    return list;
  };

  const upcomingFiltered  = applyFilters([...events]);
  const mineFiltered      = applyFilters(events.filter(e => e.guardianId === guardian?.id))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const attendingFiltered = applyFilters([...attendingEvents]);

  const { visible: visibleUpcoming,  showLoadMore: showLoadMoreUpcoming,  loadMore: loadMoreUpcoming,  showCapMessage: showCapUpcoming,  pageSize: pageSizeUpcoming  } = useVisibleCount(upcomingFiltered,  filterResetKey);
  const { visible: visibleMine,      showLoadMore: showLoadMoreMine,      loadMore: loadMoreMine,      showCapMessage: showCapMine,      pageSize: pageSizeMine      } = useVisibleCount(mineFiltered,      filterResetKey);
  const { visible: visibleAttending, showLoadMore: showLoadMoreAttending, loadMore: loadMoreAttending, showCapMessage: showCapAttending, pageSize: pageSizeAttending } = useVisibleCount(attendingFiltered, filterResetKey);

  const filtered = tab === 'mine' ? visibleMine : tab === 'attending' ? visibleAttending : visibleUpcoming;

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
      .select('id, full_name, photo_url, county, situation_tags, user_profiles(name, date_of_birth, gender)')
      .eq('id', guardianId)
      .single();
    if (data) {
      setGuardianSheet({
        id: data.id, name: data.full_name ?? '',
        photoUrl: data.photo_url ?? null,
        county: data.county ?? '',
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
              {t === 'upcoming' ? 'Find' : t === 'mine' ? 'Hosting' : 'Attending'}
            </AppText>
          </TouchableOpacity>
        ))}
      </View>

      {/* Shared filters */}
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
              style={[s.dateBtn, filterDateFrom && s.dateBtnActive]}
              onPress={() => { setTempDateFrom(filterDateFrom ?? new Date()); setShowDateFromPicker(true); }}
              activeOpacity={0.75}
            >
              <AppText style={[s.dateBtnTxt, filterDateFrom && s.dateBtnTxtActive]}>
                {filterDateFrom ? filterDateFrom.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : 'From'}
              </AppText>
              {filterDateFrom && (
                <TouchableOpacity onPress={() => setFilterDateFrom(null)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <AppText style={s.dateClear}>✕</AppText>
                </TouchableOpacity>
              )}
            </TouchableOpacity>
          </LinearGradient>
          <AppText style={s.dateSepTxt}>–</AppText>
          <LinearGradient colors={[...BUTTERFLY_BORDER.colors]} start={BUTTERFLY_BORDER.start} end={BUTTERFLY_BORDER.end} style={s.dateBtnGradient}>
            <TouchableOpacity
              style={[s.dateBtn, filterDateTo && s.dateBtnActive]}
              onPress={() => { setTempDateTo(filterDateTo ?? new Date()); setShowDateToPicker(true); }}
              activeOpacity={0.75}
            >
              <AppText style={[s.dateBtnTxt, filterDateTo && s.dateBtnTxtActive]}>
                {filterDateTo ? filterDateTo.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : 'To'}
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
                </View>

                <View style={s.info}>
                  <AppText style={s.eventName}>{e.name}</AppText>
                  <AppText style={s.eventMeta}>
                    {e.eventTime ? formatTime(e.eventTime) : ''}
                    {e.venue ? (e.eventTime ? '  ·  ' : '') + e.venue : ''}
                  </AppText>
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
              <ActivityIndicator size="large" color={NICO.primary} style={{ marginVertical: 32 }} />
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
                    {!!guardianSheet.county && (
                      <AppText style={s.guardianSheetCity}>
                        📍 {guardianSheet.county}
                      </AppText>
                    )}
                  </View>
                </View>
                {guardianSheet.situationTags.length > 0 && (
                  <View style={s.guardianSheetSection}>
                    <AppText style={s.guardianSheetSectionTitle}>Learner Situation</AppText>
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
    width: scale(46), height: scale(54), borderRadius: RADIUS.lg,
    backgroundColor: NICO.primaryLight, alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  dateTagDay:   { fontSize: FONT_SIZE.xl, fontWeight: FONT_WEIGHT.extraBold, color: NICO.primary, lineHeight: 24 },
  dateTagMonth: { fontSize: FONT_SIZE.xs, fontWeight: FONT_WEIGHT.bold, color: NICO.primary, letterSpacing: 0.5 },

  info:         { flex: 1, gap: 3 },
  eventName:    { ...TEXT_STYLE.bodyMedium, fontSize: FONT_SIZE.lg },
  eventMeta:    { ...TEXT_STYLE.caption },
  eventHost:    { fontSize: FONT_SIZE.xs, color: NICO.primary, fontWeight: FONT_WEIGHT.semiBold },
  eventHostBtn: { fontSize: FONT_SIZE.xs, color: NICO.primary, fontWeight: FONT_WEIGHT.bold, textDecorationLine: 'underline' },

  goingBadge: { flexDirection: 'row', alignItems: 'baseline', gap: SPACING.xs },
  goingNum:   { fontSize: FONT_SIZE.xl, fontWeight: FONT_WEIGHT.extraBold, color: NICO.primary },
  goingLabel: { fontSize: FONT_SIZE.xs, color: NICO.textMuted, fontWeight: FONT_WEIGHT.semiBold },

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
  dateSepTxt:      { fontSize: FONT_SIZE.md, color: NICO.textMuted },
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
  nudgeDateTag: {
    width: scale(52), height: scale(60), borderRadius: RADIUS.lg,
    backgroundColor: NICO.primaryLight, alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  nudgeDateDay:   { fontSize: FONT_SIZE['2xl'], fontWeight: FONT_WEIGHT.extraBold, color: NICO.primary },
  nudgeDateMonth: { fontSize: FONT_SIZE.xs, fontWeight: FONT_WEIGHT.bold, color: NICO.primary, letterSpacing: 0.5 },
  nudgeTitleBlock:   { flex: 1, gap: SPACING.xs },
  nudgeCategoryChip: { alignSelf: 'flex-start', backgroundColor: NICO.primaryLight, borderRadius: RADIUS.full, paddingHorizontal: SPACING.sm, paddingVertical: 3 },
  nudgeCategoryText: { fontSize: FONT_SIZE.xs, color: NICO.primary, fontWeight: FONT_WEIGHT.bold },
  nudgeTitle:    { ...TEXT_STYLE.screenTitle },
  nudgeHost:     { ...TEXT_STYLE.caption, color: NICO.primary },

  nudgeBody: { marginBottom: SPACING.base },

  guardianSheetHeader:     { flexDirection: 'row', gap: SPACING.base, alignItems: 'center', marginBottom: SPACING.base },
  guardianSheetPhoto:      { width: 64, height: 64, borderRadius: 32 },
  guardianSheetAvatar:     { width: 64, height: 64, borderRadius: 32, justifyContent: 'center', alignItems: 'center' },
  guardianSheetAvatarText: { fontSize: scale(26), fontWeight: FONT_WEIGHT.extraBold, color: '#fff' },
  guardianSheetInfo:         { flex: 1, gap: SPACING.xs },
  guardianSheetName:         { ...TEXT_STYLE.screenTitle },
  guardianSheetCity:         { ...TEXT_STYLE.caption },
  guardianSheetSection:      { marginTop: SPACING.base, gap: SPACING.sm },
  guardianSheetSectionTitle: { ...TEXT_STYLE.labelSmall, textTransform: 'uppercase', letterSpacing: 0.8 },
  guardianSheetTags:         { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.xs },
  guardianTag:               { backgroundColor: NICO.primaryLight, borderRadius: RADIUS.full, paddingHorizontal: SPACING.sm, paddingVertical: 4 },
  guardianTagText:           { fontSize: FONT_SIZE.sm, color: NICO.primary, fontWeight: FONT_WEIGHT.semiBold },

  learnerRow:  { backgroundColor: NICO.background, borderRadius: RADIUS.lg, padding: SPACING.md, gap: 3, borderWidth: 1, borderColor: NICO.border },
  learnerName: { ...TEXT_STYLE.bodyMedium, fontWeight: FONT_WEIGHT.extraBold },
  learnerMeta: { ...TEXT_STYLE.caption },

  nudgeRow:         { flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.md, marginBottom: SPACING.md },
  nudgeRowIcon:     { fontSize: FONT_SIZE.lg, marginTop: 1 },
  nudgeRowText:     { flex: 1, fontSize: FONT_SIZE.md, color: NICO.text, lineHeight: 20 },
  nudgeDescription: {
    fontSize: FONT_SIZE.md, color: NICO.text, lineHeight: 21,
    marginTop: SPACING.sm, paddingTop: SPACING.base,
    borderTopWidth: 1, borderTopColor: NICO.border,
  },

  nudgeRsvpRow:    { flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.md },
  nudgeRsvpBtn:    { flex: 1, paddingVertical: SPACING.md, borderRadius: RADIUS.lg, alignItems: 'center', borderWidth: 1.5, borderColor: NICO.border, backgroundColor: NICO.background },
  nudgeRsvpBtnText:{ fontSize: FONT_SIZE.sm, fontWeight: FONT_WEIGHT.semiBold, color: NICO.textMuted },

  nudgeBtn:    { ...BTN_SIZE.lg, ...BTN_VARIANT.primary },
  nudgeBtnText:{ ...TEXT_STYLE.buttonPrimary },
});
