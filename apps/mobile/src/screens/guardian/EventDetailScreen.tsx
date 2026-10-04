import React, { useEffect, useState } from 'react';
import {
  View, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, Modal, Image,
} from 'react-native';
import AppText from '../../components/AppText';
import RainbowDivider from '../../components/RainbowDivider';
import useNicoHeader from '../../hooks/useNicoHeader';
import { useRoute, RouteProp, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/AuthContext';
import { GuardianNavParamList } from '../../navigation';
import { calcAge } from '../../constants';
import {
  NICO, TEXT_STYLE, SPACING, RADIUS, SHADOW, FONT_SIZE, FONT_WEIGHT,
  BTN_SIZE, BTN_VARIANT, scale,
} from '../../constants/theme';

type Route = RouteProp<GuardianNavParamList, 'EventDetail'>;
type Nav   = NativeStackNavigationProp<GuardianNavParamList>;

const AVATAR_COLORS = [NICO.teal, NICO.orange, NICO.coral, NICO.pink, NICO.purple, NICO.primary];

type Rsvp = 'going' | 'interested';

interface EventDetail {
  id: string; name: string; description: string;
  eventDate: string; eventTime: string | null;
  venue: string; guardianName: string; guardianId: string;
}
interface Attendee { guardianId: string; guardianName: string; rsvp: Rsvp }

interface GuardianProfile {
  id: string; name: string; photoUrl: string | null;
  county: string; situationTags: string[];
  learners: { name: string; date_of_birth: string | null; gender: string | null }[];
}

function formatDate(dateStr: string, timeStr?: string | null): string {
  const d = new Date(dateStr + 'T12:00:00');
  const date = d.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  if (!timeStr) return date;
  const [h, m] = timeStr.split(':');
  const hours = parseInt(h, 10);
  return `${date} at ${hours % 12 || 12}:${m} ${hours >= 12 ? 'PM' : 'AM'}`;
}

const RSVP_OPTIONS: { value: Rsvp; label: string; activeColor: string; activeBg: string }[] = [
  { value: 'going',      label: '✓ Going',      activeColor: NICO.success, activeBg: NICO.successLight },
  { value: 'interested', label: '★ Interested',  activeColor: NICO.warning, activeBg: NICO.warningLight },
];

export default function EventDetailScreen() {
  const route       = useRoute<Route>();
  const navigation  = useNavigation<Nav>();
  const { guardian } = useAuth();
  const { eventId } = route.params;

  useNicoHeader(navigation);

  const [event, setEvent]         = useState<EventDetail | null>(null);
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [myRsvp, setMyRsvp]       = useState<Rsvp | null>(null);
  const [loading, setLoading]     = useState(true);
  const [rsvping, setRsvping]     = useState(false);
  const [guardianSheet, setGuardianSheet]           = useState<GuardianProfile | null>(null);
  const [loadingGuardianSheet, setLoadingGuardianSheet] = useState(false);

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
        guardianName: (e.guardians as any)?.full_name ?? 'Unknown', guardianId: e.guardian_id,
      });
    }

    const list: Attendee[] = (participants ?? []).map((p: any) => ({
      guardianId: p.guardian_id, guardianName: p.guardians?.full_name ?? 'Unknown', rsvp: p.rsvp,
    }));
    setAttendees(list);
    setMyRsvp(list.find(a => a.guardianId === guardian?.id)?.rsvp ?? null);

    // Mark any event_rsvp notifications for this event as read
    if (guardian) {
      supabase
        .from('notifications')
        .update({ read: true })
        .eq('guardian_id', guardian.id)
        .eq('ref_id', eventId)
        .eq('type', 'event_rsvp')
        .eq('read', false)
        .then(() => {});
    }

    setLoading(false);
  }

  async function rsvp(status: Rsvp) {
    if (!guardian || !event) return;
    setRsvping(true);
    if (myRsvp === status) {
      // Tapping the active pill → unselect (delete RSVP)
      await supabase
        .from('event_participants')
        .delete()
        .eq('event_id', event.id)
        .eq('guardian_id', guardian.id);
      setMyRsvp(null);
      setAttendees(prev => prev.filter(a => a.guardianId !== guardian.id));
    } else {
      await supabase
        .from('event_participants')
        .upsert({ event_id: event.id, guardian_id: guardian.id, rsvp: status }, { onConflict: 'event_id,guardian_id' });
      setMyRsvp(status);
      setAttendees(prev => [
        ...prev.filter(a => a.guardianId !== guardian.id),
        { guardianId: guardian.id, guardianName: guardian.full_name, rsvp: status },
      ]);
    }
    setRsvping(false);
  }

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

  if (loading) return <View style={s.center}><ActivityIndicator size="large" color={NICO.primary} /></View>;
  if (!event)  return <View style={s.center}><AppText style={s.errorText}>Event not found</AppText></View>;

  const going       = attendees.filter(a => a.rsvp === 'going');
  const interested  = attendees.filter(a => a.rsvp === 'interested');
  const isOrganiser = event.guardianId === guardian?.id;

  return (
    <View style={s.container}>
      <RainbowDivider />
      <ScrollView contentContainerStyle={s.content}>

        {/* Header card */}
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

        {/* Details card */}
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
                    <AppText style={[s.rsvpBtnText, active && { color: opt.activeColor, fontWeight: FONT_WEIGHT.extraBold }]}>
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
            <AppText style={s.sectionTitle}>Who's coming ({going.length + interested.length})</AppText>
            {going.length > 0 && (
              <>
                {interested.length > 0 && <AppText style={s.groupLabel}>Going ({going.length})</AppText>}
                {going.map(a => <AttendeeRow key={a.guardianId} name={a.guardianName} onPress={() => openGuardianSheet(a.guardianId)} />)}
              </>
            )}
            {interested.length > 0 && going.length > 0 && <View style={s.divider} />}
            {interested.length > 0 && (
              <>
                <AppText style={s.groupLabel}>Interested ({interested.length})</AppText>
                {interested.map(a => <AttendeeRow key={a.guardianId} name={a.guardianName} onPress={() => openGuardianSheet(a.guardianId)} />)}
              </>
            )}
          </View>
        )}

      </ScrollView>

      <Modal
        visible={!!guardianSheet || loadingGuardianSheet}
        transparent
        animationType="slide"
        onRequestClose={closeGuardianSheet}
      >
        <TouchableOpacity style={s.sheetBackdrop} activeOpacity={1} onPress={closeGuardianSheet}>
          <View style={s.sheet} onStartShouldSetResponder={() => true}>
            <View style={s.sheetPill} />
            {loadingGuardianSheet && !guardianSheet ? (
              <ActivityIndicator size="large" color={NICO.primary} style={{ marginVertical: 32 }} />
            ) : guardianSheet ? (
              <>
                <View style={s.sheetHeader}>
                  {guardianSheet.photoUrl ? (
                    <Image source={{ uri: guardianSheet.photoUrl }} style={s.sheetPhoto} />
                  ) : (
                    <View style={[s.sheetAvatar, { backgroundColor: AVATAR_COLORS[guardianSheet.name.charCodeAt(0) % AVATAR_COLORS.length] }]}>
                      <AppText style={s.sheetAvatarText}>{guardianSheet.name[0]?.toUpperCase()}</AppText>
                    </View>
                  )}
                  <View style={s.sheetInfo}>
                    <AppText style={s.sheetName}>{guardianSheet.name}</AppText>
                    {!!guardianSheet.county && (
                      <AppText style={s.sheetCity}>
                        📍 {guardianSheet.county}
                      </AppText>
                    )}
                  </View>
                </View>
                {guardianSheet.situationTags.length > 0 && (
                  <View style={s.sheetSection}>
                    <AppText style={s.sheetSectionTitle}>Regional Support Category</AppText>
                    <View style={s.sheetTags}>
                      {guardianSheet.situationTags.map(t => (
                        <View key={t} style={s.sheetTag}>
                          <AppText style={s.sheetTagText}>{t}</AppText>
                        </View>
                      ))}
                    </View>
                  </View>
                )}
                {guardianSheet.learners.length > 0 && (
                  <View style={s.sheetSection}>
                    <AppText style={s.sheetSectionTitle}>Learner</AppText>
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

function DetailRow({ icon, text }: { icon: string; text: string }) {
  return (
    <View style={s.detailRow}>
      <AppText style={s.detailIcon}>{icon}</AppText>
      <AppText style={s.detailText}>{text}</AppText>
    </View>
  );
}

function AttendeeRow({ name, onPress }: { name: string; onPress: () => void }) {
  const color = AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length];
  return (
    <TouchableOpacity style={s.attendeeRow} onPress={onPress} activeOpacity={0.7}>
      <View style={[s.attendeeAvatar, { backgroundColor: color }]}>
        <AppText style={s.attendeeInitial}>{name[0]?.toUpperCase()}</AppText>
      </View>
      <AppText style={[s.attendeeName, s.attendeeNameLink]}>{name}</AppText>
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: NICO.screenBg },
  content:   { padding: SPACING.base, paddingBottom: 48, gap: SPACING.md },
  center:    { flex: 1, justifyContent: 'center', alignItems: 'center' },
  errorText: { ...TEXT_STYLE.body, color: NICO.textMuted },

  header: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.base,
    backgroundColor: NICO.surface, borderRadius: RADIUS.xl, padding: SPACING.base,
    borderWidth: 1, borderColor: NICO.border,
    ...SHADOW.md,
  },
  dateBox: {
    width: scale(52), height: scale(60), borderRadius: RADIUS.lg,
    backgroundColor: NICO.primaryLight, alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  dateBoxDay:     { fontSize: FONT_SIZE['4xl'], fontWeight: FONT_WEIGHT.black, color: NICO.primary, lineHeight: scale(26) },
  dateBoxMonth:   { fontSize: FONT_SIZE.xs, fontWeight: FONT_WEIGHT.bold, color: NICO.primary, letterSpacing: 0.5 },
  headerInfo:     { flex: 1, gap: SPACING.xs },
  eventName:      { fontSize: FONT_SIZE['2xl'], fontWeight: FONT_WEIGHT.black, color: NICO.text },
  eventOrganiser: { fontSize: FONT_SIZE.md, color: NICO.primary, fontWeight: FONT_WEIGHT.bold },
  deleteBtn:      { padding: SPACING.sm },
  deleteBtnText:  { fontSize: FONT_SIZE.xl },

  card: {
    backgroundColor: NICO.surface, borderRadius: RADIUS.xl, padding: SPACING.base, gap: SPACING.md,
    borderWidth: 1, borderColor: NICO.border,
    ...SHADOW.sm,
  },

  detailRow:   { flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.md },
  detailIcon:  { fontSize: FONT_SIZE.xl, marginTop: 1 },
  detailText:  { flex: 1, fontSize: FONT_SIZE.lg, fontWeight: FONT_WEIGHT.semiBold, color: NICO.text, lineHeight: 23 },
  divider:     { height: 1, backgroundColor: NICO.border },
  description: { fontSize: FONT_SIZE.lg, fontWeight: FONT_WEIGHT.semiBold, color: NICO.text, lineHeight: 24 },

  sectionTitle: { fontSize: FONT_SIZE.sm, fontWeight: FONT_WEIGHT.black, color: NICO.text, marginBottom: SPACING.xs },

  rsvpRow: { flexDirection: 'row', gap: SPACING.sm },
  rsvpBtn: {
    flex: 1, paddingVertical: SPACING.md, borderRadius: RADIUS.lg, alignItems: 'center',
    borderWidth: 1.5, borderColor: NICO.border, backgroundColor: NICO.background,
  },
  rsvpBtnText: { fontSize: FONT_SIZE.sm, fontWeight: FONT_WEIGHT.semiBold, color: NICO.textMuted },

  groupLabel:      { fontSize: FONT_SIZE.sm, fontWeight: FONT_WEIGHT.black, color: NICO.text, marginBottom: SPACING.xs },
  attendeeRow:     { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  attendeeAvatar:  { width: scale(32), height: scale(32), borderRadius: scale(16), justifyContent: 'center', alignItems: 'center' },
  attendeeInitial: { fontSize: FONT_SIZE.sm, fontWeight: FONT_WEIGHT.extraBold, color: '#fff' },
  attendeeName:     { fontSize: FONT_SIZE.md, fontWeight: FONT_WEIGHT.semiBold, color: NICO.text },
  attendeeNameLink: { color: NICO.primary, textDecorationLine: 'underline' },

  // Guardian profile sheet
  sheetBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: NICO.screenBg,
    borderTopLeftRadius: RADIUS['3xl'], borderTopRightRadius: RADIUS['3xl'],
    padding: SPACING.lg, paddingBottom: scale(36), maxHeight: '80%',
  },
  sheetPill:    { width: 40, height: 4, borderRadius: 2, backgroundColor: NICO.border, alignSelf: 'center', marginBottom: SPACING.lg },
  sheetHeader:  { flexDirection: 'row', gap: SPACING.base, alignItems: 'center', marginBottom: SPACING.base },
  sheetPhoto:   { width: 64, height: 64, borderRadius: 32 },
  sheetAvatar:  { width: 64, height: 64, borderRadius: 32, justifyContent: 'center', alignItems: 'center' },
  sheetAvatarText: { fontSize: scale(26), fontWeight: FONT_WEIGHT.extraBold, color: '#fff' },
  sheetInfo:    { flex: 1, gap: SPACING.xs },
  sheetName:    { fontSize: FONT_SIZE['2xl'], fontWeight: FONT_WEIGHT.black, color: NICO.text },
  sheetCity:    { fontSize: FONT_SIZE.sm, color: NICO.textMuted },
  sheetSection: { marginTop: SPACING.base, gap: SPACING.sm },
  sheetSectionTitle: { fontSize: FONT_SIZE.xs, fontWeight: FONT_WEIGHT.bold, color: NICO.textMuted, textTransform: 'uppercase', letterSpacing: 0.8 },
  sheetTags:    { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.xs },
  sheetTag:     { backgroundColor: NICO.primaryLight, borderRadius: RADIUS.full, paddingHorizontal: SPACING.sm, paddingVertical: 4 },
  sheetTagText: { fontSize: FONT_SIZE.sm, color: NICO.primary, fontWeight: FONT_WEIGHT.semiBold },
  learnerRow:   { backgroundColor: NICO.background, borderRadius: RADIUS.lg, padding: SPACING.md, gap: 3, borderWidth: 1, borderColor: NICO.border },
  learnerName:  { fontSize: FONT_SIZE.md, fontWeight: FONT_WEIGHT.extraBold, color: NICO.text },
  learnerMeta:  { fontSize: FONT_SIZE.xs, color: NICO.textMuted },
});
