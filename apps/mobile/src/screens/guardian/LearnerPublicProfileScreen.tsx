import React, { useEffect, useState } from 'react';
import {
  View, ScrollView, TouchableOpacity, StyleSheet,
  Image, ActivityIndicator, Alert,
} from 'react-native';
import AppText from '../../components/AppText';
import RainbowDivider from '../../components/RainbowDivider';
import useNicoHeader from '../../hooks/useNicoHeader';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/AuthContext';
import { calcAge } from '../../constants';
import { GuardianNavParamList } from '../../navigation';
import {
  NICO, SPACING, RADIUS, SHADOW, FONT_SIZE, FONT_WEIGHT,
  BTN_SIZE, BTN_VARIANT, scale, IS_TABLET,
} from '../../constants/theme';

type Nav   = NativeStackNavigationProp<GuardianNavParamList>;
type Route = RouteProp<GuardianNavParamList, 'LearnerPublicProfile'>;

const AVATAR_COLORS = [NICO.teal, NICO.orange, NICO.coral, NICO.pink, NICO.purple, NICO.primary];

type ConnectionStatus = 'none' | 'pending_sent' | 'pending_received' | 'accepted';

interface LearnerProfile {
  id: string;
  name: string;
  date_of_birth: string | null;
  photo_url: string | null;
  city: string;
  region: string;
  country: string;
  likes: string[];
  dislikes: string[];
  abilities: string[];
  languages: string[];
  comprehension_level: string | null;
  open_to_online_chat: boolean;
  medicalConditions: string[];
  connectionStatus: ConnectionStatus;
}

export default function LearnerPublicProfileScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const { learnerId } = route.params;
  const { guardian } = useAuth();

  useNicoHeader(navigation);

  const [profile, setProfile] = useState<LearnerProfile | null>(null);
  const [myLearnerIds, setMyLearnerIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  useEffect(() => { if (guardian) load(guardian.id); }, [learnerId, guardian]);

  async function load(guardianId: string) {
    const [
      { data: p },
      { data: mine },
      { data: likes },
      { data: dislikes },
      { data: abilities },
      { data: chat },
      { data: medicalData },
    ] = await Promise.all([
      supabase.from('user_profiles').select('id, name, date_of_birth, photo_url, city, region, country, languages').eq('id', learnerId).single(),
      supabase.from('user_profiles').select('id').eq('guardian_id', guardianId),
      supabase.from('user_likes').select('categories(name)').eq('user_id', learnerId),
      supabase.from('user_dislikes').select('categories(name)').eq('user_id', learnerId),
      supabase.from('user_abilities').select('categories(name)').eq('user_id', learnerId),
      supabase.from('chat_preferences').select('comprehension_level, open_to_online_chat').eq('user_id', learnerId).single(),
      supabase.from('user_medical_conditions').select('medical_conditions(label)').eq('user_id', learnerId),
    ]);

    if (!p) { setLoading(false); return; }

    const myIds = (mine ?? []).map((r: any) => r.id);
    setMyLearnerIds(myIds);

    let connectionStatus: ConnectionStatus = 'none';
    if (myIds.length > 0) {
      const { data: friendship } = await supabase
        .from('friendships')
        .select('requester_id, addressee_id, status')
        .or(
          myIds.map((id: string) => `requester_id.eq.${id},addressee_id.eq.${id}`).join(',')
        )
        .or(`requester_id.eq.${learnerId},addressee_id.eq.${learnerId}`)
        .maybeSingle();

      if (friendship) {
        if (friendship.status === 'accepted') connectionStatus = 'accepted';
        else if (myIds.includes(friendship.requester_id)) connectionStatus = 'pending_sent';
        else connectionStatus = 'pending_received';
      }
    }

    setProfile({
      id: p.id,
      name: p.name,
      date_of_birth: p.date_of_birth ?? null,
      photo_url: p.photo_url,
      city: p.city,
      region: p.region,
      country: p.country,
      likes: (likes ?? []).map((r: any) => r.categories?.name).filter(Boolean),
      dislikes: (dislikes ?? []).map((r: any) => r.categories?.name).filter(Boolean),
      abilities: (abilities ?? []).map((r: any) => r.categories?.name).filter(Boolean),
      languages: p.languages ?? [],
      comprehension_level: chat?.comprehension_level ?? null,
      open_to_online_chat: chat?.open_to_online_chat ?? false,
      medicalConditions: (medicalData ?? []).map((r: any) => r.medical_conditions?.label).filter(Boolean),
      connectionStatus,
    });
    setLoading(false);
  }

  async function sendRequest() {
    if (!guardian || !profile || myLearnerIds.length === 0) return;
    const myLearnerId = myLearnerIds[0];
    setSending(true);
    try {
      const { error } = await supabase.from('friendships').insert({
        requester_id: myLearnerId,
        addressee_id: profile.id,
        status: 'pending',
        requested_by_guardian_id: guardian.id,
      });
      if (error) throw new Error(error.message);

      setProfile(prev => prev ? { ...prev, connectionStatus: 'pending_sent' } : prev);
      Alert.alert('Request sent!', `A friend request has been sent to ${profile.name}'s guardian.`);
    } catch (err: any) {
      Alert.alert('Error', err.message ?? 'Something went wrong.');
    }
    setSending(false);
  }

  if (loading) {
    return <View style={s.center}><ActivityIndicator size="large" color={NICO.primary} /></View>;
  }
  if (!profile) {
    return <View style={s.center}><AppText style={s.errorText}>Profile not found</AppText></View>;
  }

  const avatarColor = AVATAR_COLORS[profile.name.charCodeAt(0) % AVATAR_COLORS.length];

  return (
    <View style={s.root}>
      <RainbowDivider />
      <ScrollView contentContainerStyle={s.content}>
        {/* Header card */}
        <View style={s.headerCard}>
          {profile.photo_url ? (
            <Image source={{ uri: profile.photo_url }} style={s.avatar} />
          ) : (
            <View style={[s.avatar, { backgroundColor: avatarColor }]}>
              <AppText style={s.avatarInitial}>{profile.name[0]?.toUpperCase()}</AppText>
            </View>
          )}
          <AppText style={s.name}>{profile.name}</AppText>
          <AppText style={s.subMeta}>
            {calcAge(profile.date_of_birth) ?? '—'} years old · {profile.city}, {profile.region}
          </AppText>
        </View>

        {/* About */}
        <View style={s.section}>
          <InfoRow label="Likes"               value={profile.likes.join(', ')}        fallback="None added" />
          <InfoRow label="Dislikes"            value={profile.dislikes.join(', ')}     fallback="None added" />
          <InfoRow label="What I Can Do"       value={profile.abilities.join(', ')}    fallback="None added" />
          <InfoRow label="Languages"           value={profile.languages.join(', ')}    fallback="Not set" />
          <InfoRow label="Comprehension Level" value={profile.comprehension_level}     fallback="Not set" />
          <InfoRow label="Medical Conditions"  value={profile.medicalConditions.join(', ')} fallback="None recorded" />
        </View>

        {/* Connect action — pinned to bottom */}
        <View style={s.actionCard}>
          {profile.connectionStatus === 'accepted' && (
            <View style={s.statusRow}>
              <AppText style={s.statusIcon}>✅</AppText>
              <AppText style={s.statusText}>Already friends</AppText>
            </View>
          )}
          {profile.connectionStatus === 'pending_sent' && (
            <View style={s.statusRow}>
              <AppText style={s.statusIcon}>⏳</AppText>
              <AppText style={s.statusText}>Friend request sent — waiting for guardian to accept</AppText>
            </View>
          )}
          {profile.connectionStatus === 'pending_received' && (
            <TouchableOpacity
              style={s.connectBtn}
              onPress={() => navigation.navigate('LearnerFriendRequests')}
            >
              <AppText style={s.connectBtnText}>Respond to friend request →</AppText>
            </TouchableOpacity>
          )}
          {profile.connectionStatus === 'none' && (
            <>
              <AppText style={s.connectHint}>
                Sending a request will notify {profile.name}'s guardian. They can accept or decline on behalf of their learner.
              </AppText>
              <TouchableOpacity
                style={[s.connectBtn, sending && s.btnDisabled]}
                onPress={sendRequest}
                disabled={sending}
              >
                {sending
                  ? <ActivityIndicator color={NICO.textOnAccent} />
                  : <AppText style={s.connectBtnText}>Send Friend Request</AppText>
                }
              </TouchableOpacity>
            </>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

function InfoRow({ label, value, fallback }: { label: string; value: string | null | undefined; fallback: string }) {
  return (
    <View style={s.infoRow}>
      <AppText style={s.infoLabel}>{label}</AppText>
      <AppText style={[s.infoValue, !value && s.infoEmpty]} numberOfLines={2}>
        {value || fallback}
      </AppText>
    </View>
  );
}

const s = StyleSheet.create({
  root:    { flex: 1, backgroundColor: NICO.screenBg },
  content: { padding: SPACING.base, paddingBottom: 48, gap: SPACING.md },
  center:  { flex: 1, justifyContent: 'center', alignItems: 'center' },
  errorText: { fontSize: IS_TABLET ? FONT_SIZE.lg : FONT_SIZE.md, color: NICO.textMuted },

  headerCard: {
    backgroundColor: NICO.surface, borderRadius: RADIUS.xl, padding: SPACING.lg,
    alignItems: 'center', gap: SPACING.sm,
    borderWidth: 1, borderColor: NICO.border,
    ...SHADOW.md,
  },
  avatar: { width: scale(88), height: scale(88), borderRadius: scale(44), justifyContent: 'center', alignItems: 'center', marginBottom: 4 },
  avatarInitial: { fontSize: IS_TABLET ? FONT_SIZE['5xl'] : FONT_SIZE['4xl'], fontWeight: FONT_WEIGHT.black, color: '#fff' },
  name: { fontSize: IS_TABLET ? FONT_SIZE['3xl'] : FONT_SIZE['2xl'], fontWeight: FONT_WEIGHT.black, color: NICO.text },
  subMeta: { fontSize: IS_TABLET ? FONT_SIZE.md : FONT_SIZE.sm, color: NICO.text, fontWeight: FONT_WEIGHT.semiBold },

  section: {
    backgroundColor: NICO.surface, borderRadius: RADIUS.xl, paddingHorizontal: SPACING.base, paddingVertical: SPACING.xs,
    borderWidth: 1, borderColor: NICO.border,
  },
  infoRow: {
    flexDirection: 'row', alignItems: 'flex-start',
    paddingVertical: SPACING.sm + 3, borderBottomWidth: 1, borderBottomColor: NICO.border,
  },
  infoLabel: { fontSize: IS_TABLET ? FONT_SIZE.md : FONT_SIZE.sm, fontWeight: FONT_WEIGHT.bold, color: NICO.textMuted, width: scale(140), marginRight: SPACING.md },
  infoValue: { fontSize: IS_TABLET ? FONT_SIZE.md : FONT_SIZE.sm, color: NICO.text, flex: 1, fontWeight: FONT_WEIGHT.medium, textTransform: 'capitalize' },
  infoEmpty: { color: NICO.textMuted, fontStyle: 'italic', textTransform: 'none' },

  actionCard: {
    backgroundColor: NICO.surface, borderRadius: RADIUS.xl, padding: SPACING.base, gap: SPACING.md,
    borderWidth: 1, borderColor: NICO.border,
  },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  statusIcon: { fontSize: IS_TABLET ? FONT_SIZE['2xl'] : FONT_SIZE.xl },
  statusText: { fontSize: IS_TABLET ? FONT_SIZE.lg : FONT_SIZE.md, color: NICO.text, fontWeight: FONT_WEIGHT.semiBold, flex: 1 },
  connectHint: { fontSize: IS_TABLET ? FONT_SIZE.md : FONT_SIZE.sm, color: NICO.text, fontWeight: FONT_WEIGHT.semiBold, lineHeight: 18 },
  connectBtn:     { ...BTN_SIZE.lg, ...BTN_VARIANT.primary },
  btnDisabled:    { opacity: 0.6 },
  connectBtnText: { color: NICO.textOnAccent, fontWeight: FONT_WEIGHT.bold, fontSize: IS_TABLET ? FONT_SIZE.lg : FONT_SIZE.md },
});
