import React, { useCallback, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/AuthContext';
import { COLORS } from '../../constants';
import { GuardianNavParamList } from '../../navigation';

type Nav = NativeStackNavigationProp<GuardianNavParamList>;

interface EventItem {
  id: string;
  name: string;
  eventDate: string;
  eventTime: string | null;
  venue: string;
  guardianName: string;
  guardianId: string;
  goingCount: number;
}

function formatTime(timeStr: string): string {
  const [h, m] = timeStr.split(':');
  const hours = parseInt(h, 10);
  return `${hours % 12 || 12}:${m} ${hours >= 12 ? 'PM' : 'AM'}`;
}

export default function EventsScreen() {
  const navigation = useNavigation<Nav>();
  const { guardian } = useAuth();

  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'upcoming' | 'mine'>('upcoming');

  useFocusEffect(useCallback(() => { load(); }, []));

  async function load() {
    setLoading(true);
    const today = new Date().toISOString().slice(0, 10);

    const { data } = await supabase
      .from('events')
      .select('id, name, event_date, event_time, venue, guardian_id, guardians(full_name), event_participants(guardian_id, rsvp)')
      .gte('event_date', today)
      .order('event_date', { ascending: true });

    setEvents(
      (data ?? []).map((e: any) => ({
        id: e.id,
        name: e.name,
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

  const filtered = tab === 'mine'
    ? events.filter(e => e.guardianId === guardian?.id)
    : events;

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
            <Text style={[s.tabText, tab === t && s.tabTextActive]}>
              {t === 'upcoming' ? 'Upcoming' : 'My Events'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={filtered}
        keyExtractor={e => e.id}
        contentContainerStyle={s.list}
        renderItem={({ item: e }) => {
          const d = new Date(e.eventDate + 'T12:00:00');
          return (
            <TouchableOpacity
              style={s.card}
              onPress={() => navigation.navigate('EventDetail', { eventId: e.id })}
              activeOpacity={0.82}
            >
              <View style={s.dateTag}>
                <Text style={s.dateTagDay}>{d.getDate()}</Text>
                <Text style={s.dateTagMonth}>
                  {d.toLocaleDateString(undefined, { month: 'short' }).toUpperCase()}
                </Text>
              </View>

              <View style={s.info}>
                <Text style={s.eventName}>{e.name}</Text>
                <Text style={s.eventMeta}>
                  {e.eventTime ? formatTime(e.eventTime) : ''}
                  {e.venue ? (e.eventTime ? '  ·  ' : '') + e.venue : ''}
                </Text>
                <Text style={s.eventHost}>By {e.guardianName}</Text>
              </View>

              <View style={s.goingBadge}>
                <Text style={s.goingNum}>{e.goingCount}</Text>
                <Text style={s.goingLabel}>going</Text>
              </View>
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={
          <View style={s.empty}>
            <Text style={s.emptyEmoji}>🎉</Text>
            <Text style={s.emptyText}>{tab === 'mine' ? "You haven't created any events" : 'No upcoming events'}</Text>
            <Text style={s.emptyHint}>Tap below to create one</Text>
          </View>
        }
      />

      <TouchableOpacity
        style={s.fab}
        onPress={() => navigation.navigate('CreateEvent')}
        activeOpacity={0.85}
      >
        <Text style={s.fabText}>+ Create Event</Text>
      </TouchableOpacity>
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

  card: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: COLORS.bloomCard, borderRadius: 18, padding: 16,
    borderWidth: 1, borderColor: COLORS.bloomBorder,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },
  dateTag: {
    width: 46, height: 54, borderRadius: 12,
    backgroundColor: '#DAEAFF', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  dateTagDay:   { fontSize: 20, fontWeight: '900', color: COLORS.bloomNavy, lineHeight: 24 },
  dateTagMonth: { fontSize: 10, fontWeight: '700', color: COLORS.bloomAccent, letterSpacing: 0.5 },

  info:       { flex: 1, gap: 3 },
  eventName:  { fontSize: 15, fontWeight: '800', color: COLORS.bloomText },
  eventMeta:  { fontSize: 12, color: COLORS.bloomMuted },
  eventHost:  { fontSize: 11, color: COLORS.bloomAccent, fontWeight: '600' },

  goingBadge: { alignItems: 'center' },
  goingNum:   { fontSize: 20, fontWeight: '900', color: COLORS.bloomNavy },
  goingLabel: { fontSize: 10, color: COLORS.bloomMuted, fontWeight: '600' },

  empty:      { alignItems: 'center', paddingTop: 80, gap: 12 },
  emptyEmoji: { fontSize: 56 },
  emptyText:  { fontSize: 18, fontWeight: '800', color: COLORS.bloomText, textAlign: 'center' },
  emptyHint:  { fontSize: 14, color: COLORS.bloomMuted },

  fab: {
    position: 'absolute', bottom: 28, right: 20, left: 20,
    backgroundColor: COLORS.bloomNavy, borderRadius: 16,
    paddingVertical: 16, alignItems: 'center',
    shadowColor: COLORS.bloomNavy, shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4, shadowRadius: 12, elevation: 8,
  },
  fabText: { color: '#fff', fontWeight: '800', fontSize: 15 },
});
