import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert,
} from 'react-native';
import AppText from '../../components/AppText';
import { useRoute, RouteProp, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/AuthContext';
import { COLORS } from '../../constants';
import { GuardianNavParamList } from '../../navigation';

type Route = RouteProp<GuardianNavParamList, 'EventDetail'>;
type Nav   = NativeStackNavigationProp<GuardianNavParamList>;

const AVATAR_COLORS = [COLORS.statusRed, COLORS.statusPurple, COLORS.statusTeal, COLORS.statusAmber, COLORS.statusBlue, COLORS.statusPink];

type Rsvp = 'going' | 'interested' | 'not_going';

interface EventDetail {
  id: string; name: string; description: string;
  eventDate: string; eventTime: string | null;
  venue: string; guardianName: string; guardianId: string;
}
interface Attendee { guardianId: string; guardianName: string; rsvp: Rsvp }

function formatDate(dateStr: string, timeStr?: string | null): string {
  const d = new Date(dateStr + 'T12:00:00');
  const date = d.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  if (!timeStr) return date;
  const [h, m] = timeStr.split(':');
  const hours = parseInt(h, 10);
  return `${date} at ${hours % 12 || 12}:${m} ${hours >= 12 ? 'PM' : 'AM'}`;
}

const RSVP_OPTIONS: { value: Rsvp; label: string; activeColor: string; activeBg: string }[] = [
  { value: 'going',      label: '✓ Going',      activeColor: COLORS.statusGreenDark, activeBg: COLORS.secondaryLight },
  { value: 'interested', label: '★ Interested',  activeColor: COLORS.statusAmberDark, activeBg: COLORS.statusAmberLight },
  { value: 'not_going',  label: "✕ Can't go",   activeColor: COLORS.bloomMuted, activeBg: COLORS.bloomBorder },
];

export default function EventDetailScreen() {
  const route       = useRoute<Route>();
  const navigation  = useNavigation<Nav>();
  const { guardian } = useAuth();
  const { eventId } = route.params;

  const [event, setEvent]       = useState<EventDetail | null>(null);
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [myRsvp, setMyRsvp]     = useState<Rsvp | null>(null);
  const [loading, setLoading]   = useState(true);
  const [rsvping, setRsvping]   = useState(false);

  useEffect(() => { load(); }, [eventId]);

  async function load() {
    setLoading(true);
    const [{ data: e }, { data: participants }] = await Promise.all([
      supabase
        .from('events')
        .select('id, name, description, event_date, event_time, venue, guardian_id, guardians!events_guardian_id_fkey(full_name)')
        .eq('id', eventId)
        .single(),
      supabase
        .from('event_participants')
        .select('guardian_id, rsvp, guardians!event_participants_guardian_id_fkey(full_name)')
        .eq('event_id', eventId),
    ]);

    if (e) {
      setEvent({
        id: e.id, name: e.name, description: e.description ?? '',
        eventDate: e.event_date, eventTime: e.event_time ?? null,
        venue: e.venue ?? '',
        guardianName: e.guardians?.full_name ?? 'Unknown', guardianId: e.guardian_id,
      });
    }

    const list: Attendee[] = (participants ?? []).map((p: any) => ({
      guardianId: p.guardian_id, guardianName: p.guardians?.full_name ?? 'Unknown', rsvp: p.rsvp,
    }));
    setAttendees(list);
    setMyRsvp(list.find(a => a.guardianId === guardian?.id)?.rsvp ?? null);
    setLoading(false);
  }

  async function rsvp(status: Rsvp) {
    if (!guardian || !event) return;
    setRsvping(true);
    await supabase
      .from('event_participants')
      .upsert({ event_id: event.id, guardian_id: guardian.id, rsvp: status }, { onConflict: 'event_id,guardian_id' });
    setMyRsvp(status);
    setAttendees(prev => [
      ...prev.filter(a => a.guardianId !== guardian.id),
      { guardianId: guardian.id, guardianName: guardian.full_name, rsvp: status },
    ]);
    setRsvping(false);
  }

  async function deleteEvent() {
    if (!event) return;
    Alert.alert('Delete event', 'This will permanently delete the event and all RSVPs.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          await supabase.from('events').delete().eq('id', event.id);
          navigation.goBack();
        },
      },
    ]);
  }

  if (loading) return <View style={s.center}><ActivityIndicator size="large" color={COLORS.bloomAccent} /></View>;
  if (!event)  return <View style={s.center}><AppText style={s.errorText}>Event not found</AppText></View>;

  const going      = attendees.filter(a => a.rsvp === 'going');
  const interested = attendees.filter(a => a.rsvp === 'interested');
  const isOrganiser = event.guardianId === guardian?.id;

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content}>
      {/* Header */}
      <View style={s.header}>
        <View style={s.dateBox}>
          <AppText style={s.dateBoxDay}>{new Date(event.eventDate + 'T12:00:00').getDate()}</AppText>
          <AppText style={s.dateBoxMonth}>
            {new Date(event.eventDate + 'T12:00:00').toLocaleDateString(undefined, { month: 'short' }).toUpperCase()}
          </AppText>
        </View>
        <View style={s.headerInfo}>
          <AppText style={s.eventName}>{event.name}</AppText>
          <AppText style={s.eventOrganiser}>By {event.guardianName}</AppText>
        </View>
        {isOrganiser && (
          <TouchableOpacity onPress={deleteEvent} style={s.deleteBtn} activeOpacity={0.7}>
            <AppText style={s.deleteBtnText}>🗑</AppText>
          </TouchableOpacity>
        )}
      </View>

      {/* Details */}
      <View style={s.card}>
        <DetailRow icon="📅" text={formatDate(event.eventDate, event.eventTime)} />
        {!!event.venue && <DetailRow icon="📍" text={event.venue} />}
        {!!event.description && (
          <>
            <View style={s.divider} />
            <AppText style={s.description}>{event.description}</AppText>
          </>
        )}
      </View>

      {/* RSVP — hidden for the event organiser */}
      {!isOrganiser && (
        <View style={s.card}>
          <AppText style={s.sectionTitle}>Your RSVP</AppText>
          <View style={s.rsvpRow}>
            {RSVP_OPTIONS.map(opt => {
              const active = myRsvp === opt.value;
              return (
                <TouchableOpacity
                  key={opt.value}
                  style={[s.rsvpBtn, active && { backgroundColor: opt.activeBg, borderColor: opt.activeBg }]}
                  onPress={() => rsvp(opt.value)}
                  disabled={rsvping}
                  activeOpacity={0.8}
                >
                  <AppText style={[s.rsvpBtnText, active && { color: opt.activeColor, fontWeight: '800' }]}>
                    {opt.label}
                  </AppText>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      )}

      {/* Attendees */}
      {(going.length > 0 || interested.length > 0) && (
        <View style={s.card}>
          <AppText style={s.sectionTitle}>Who's coming</AppText>
          {going.length > 0 && (
            <>
              <AppText style={s.groupLabel}>Going ({going.length})</AppText>
              {going.map(a => <AttendeeRow key={a.guardianId} name={a.guardianName} />)}
            </>
          )}
          {interested.length > 0 && (
            <>
              <AppText style={[s.groupLabel, { marginTop: 8 }]}>Interested ({interested.length})</AppText>
              {interested.map(a => <AttendeeRow key={a.guardianId} name={a.guardianName} />)}
            </>
          )}
        </View>
      )}
    </ScrollView>
  );
}

function DetailRow({ icon, text }: { icon: string; text: string }) {
  return (
    <View style={s.detailRow}>
      <AppText style={s.detailIcon}>{icon}</AppText>
      <AppText style={s.detailText}>{text}</AppText>
    </View>
  );
}

function AttendeeRow({ name }: { name: string }) {
  const color = AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length];
  return (
    <View style={s.attendeeRow}>
      <View style={[s.attendeeAvatar, { backgroundColor: color }]}>
        <AppText style={s.attendeeInitial}>{name[0]?.toUpperCase()}</AppText>
      </View>
      <AppText style={s.attendeeName}>{name}</AppText>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bloomBody },
  content:   { padding: 16, paddingBottom: 48, gap: 14 },
  center:    { flex: 1, justifyContent: 'center', alignItems: 'center' },
  errorText: { fontSize: 16, color: COLORS.bloomMuted },

  header: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: COLORS.bloomCard, borderRadius: 20, padding: 16,
    borderWidth: 1, borderColor: COLORS.bloomBorder,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },
  dateBox: {
    width: 52, height: 60, borderRadius: 14,
    backgroundColor: COLORS.bloomActiveBg, alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  dateBoxDay:    { fontSize: 22, fontWeight: '900', color: COLORS.bloomNavy },
  dateBoxMonth:  { fontSize: 10, fontWeight: '700', color: COLORS.bloomAccent, letterSpacing: 0.5 },
  headerInfo:    { flex: 1, gap: 4 },
  eventName:     { fontSize: 18, fontWeight: '900', color: COLORS.bloomText },
  eventOrganiser:{ fontSize: 12, color: COLORS.bloomAccent, fontWeight: '600' },
  deleteBtn:     { padding: 8 },
  deleteBtnText: { fontSize: 20 },

  card: {
    backgroundColor: COLORS.bloomCard, borderRadius: 16, padding: 16, gap: 10,
    borderWidth: 1, borderColor: COLORS.bloomBorder,
  },

  detailRow:  { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  detailIcon: { fontSize: 16, marginTop: 1 },
  detailText: { flex: 1, fontSize: 14, color: COLORS.bloomText, lineHeight: 20 },
  divider:    { height: 1, backgroundColor: COLORS.bloomBorder },
  description:{ fontSize: 14, color: COLORS.bloomText, lineHeight: 21 },

  sectionTitle: { fontSize: 13, fontWeight: '900', color: COLORS.bloomText, marginBottom: 4 },

  rsvpRow: { flexDirection: 'row', gap: 8 },
  rsvpBtn: {
    flex: 1, paddingVertical: 10, borderRadius: 12, alignItems: 'center',
    borderWidth: 1.5, borderColor: COLORS.bloomBorder, backgroundColor: COLORS.bloomBody,
  },
  rsvpBtnText: { fontSize: 12, fontWeight: '600', color: COLORS.bloomMuted },

  groupLabel:     { fontSize: 11, fontWeight: '700', color: COLORS.bloomMuted, letterSpacing: 0.5 },
  attendeeRow:    { flexDirection: 'row', alignItems: 'center', gap: 10 },
  attendeeAvatar: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  attendeeInitial:{ fontSize: 12, fontWeight: '800', color: COLORS.bloomOnAccent },
  attendeeName:   { fontSize: 14, fontWeight: '600', color: COLORS.bloomText },
});
