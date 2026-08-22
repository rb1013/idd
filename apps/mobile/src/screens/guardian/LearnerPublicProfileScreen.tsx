import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Image, ActivityIndicator, Alert,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/AuthContext';
import { COLORS } from '../../constants';
import { GuardianNavParamList } from '../../navigation';

type Nav   = NativeStackNavigationProp<GuardianNavParamList>;
type Route = RouteProp<GuardianNavParamList, 'LearnerPublicProfile'>;

const AVATAR_COLORS = ['#FF6B6B', '#845EF7', '#20C997', '#F59E0B', '#3B82F6', '#EC4899'];

type ConnectionStatus = 'none' | 'pending_sent' | 'pending_received' | 'accepted';

interface LearnerProfile {
  id: string;
  name: string;
  age: number;
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
  connectionStatus: ConnectionStatus;
}

export default function LearnerPublicProfileScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const { learnerId } = route.params;
  const { guardian } = useAuth();

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
    ] = await Promise.all([
      supabase.from('user_profiles').select('id, name, age, photo_url, city, region, country, languages').eq('id', learnerId).single(),
      supabase.from('user_profiles').select('id').eq('guardian_id', guardianId),
      supabase.from('user_likes').select('categories(name)').eq('user_id', learnerId),
      supabase.from('user_dislikes').select('categories(name)').eq('user_id', learnerId),
      supabase.from('user_abilities').select('categories(name)').eq('user_id', learnerId),
      supabase.from('chat_preferences').select('comprehension_level, open_to_online_chat').eq('user_id', learnerId).single(),
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
      age: p.age,
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

      const { data: addresseeProfile } = await supabase
        .from('user_profiles').select('guardian_id').eq('id', profile.id).single();
      if (addresseeProfile?.guardian_id) {
        await supabase.from('notifications').insert({
          guardian_id: addresseeProfile.guardian_id,
          user_id: profile.id,
          type: 'friend_request',
          message: `${guardian.full_name} wants to connect their learner with ${profile.name}.`,
        });
      }

      setProfile(prev => prev ? { ...prev, connectionStatus: 'pending_sent' } : prev);
      Alert.alert('Request sent!', `A friend request has been sent to ${profile.name}'s guardian.`);
    } catch (err: any) {
      Alert.alert('Error', err.message ?? 'Something went wrong.');
    }
    setSending(false);
  }

  if (loading) {
    return <View style={s.center}><ActivityIndicator size="large" color={COLORS.bloomAccent} /></View>;
  }
  if (!profile) {
    return <View style={s.center}><Text style={s.errorText}>Profile not found</Text></View>;
  }

  const avatarColor = AVATAR_COLORS[profile.name.charCodeAt(0) % AVATAR_COLORS.length];

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content}>
      {/* Header card */}
      <View style={s.headerCard}>
        {profile.photo_url ? (
          <Image source={{ uri: profile.photo_url }} style={s.avatar} />
        ) : (
          <View style={[s.avatar, { backgroundColor: avatarColor }]}>
            <Text style={s.avatarInitial}>{profile.name[0]?.toUpperCase()}</Text>
          </View>
        )}
        <Text style={s.name}>{profile.name}</Text>
        <Text style={s.subMeta}>
          {profile.age} years old · {profile.city}, {profile.region}
        </Text>
        {profile.comprehension_level && (
          <View style={s.levelBadge}>
            <Text style={s.levelBadgeText}>{profile.comprehension_level} level</Text>
          </View>
        )}
      </View>

      {/* Interests */}
      <Section title="Likes">
        {profile.likes.length > 0
          ? <View style={s.chips}>{profile.likes.map(l => <Chip key={l} label={l} color="#D4F0DE" textColor="#065F46" />)}</View>
          : <Text style={s.emptyChip}>None added</Text>
        }
      </Section>

      <Section title="Dislikes">
        {profile.dislikes.length > 0
          ? <View style={s.chips}>{profile.dislikes.map(l => <Chip key={l} label={l} color="#FEE2E2" textColor="#991B1B" />)}</View>
          : <Text style={s.emptyChip}>None added</Text>
        }
      </Section>

      <Section title="What I Can Do">
        {profile.abilities.length > 0
          ? <View style={s.chips}>{profile.abilities.map(l => <Chip key={l} label={l} color="#DAEAFF" textColor={COLORS.bloomAccent} />)}</View>
          : <Text style={s.emptyChip}>None added</Text>
        }
      </Section>

      <Section title="Languages">
        {profile.languages.length > 0
          ? <View style={s.chips}>{profile.languages.map(l => <Chip key={l} label={l} color="#F3E8FF" textColor="#6B21A8" />)}</View>
          : <Text style={s.emptyChip}>None added</Text>
        }
      </Section>

      <Section title="Comprehension Level">
        {profile.comprehension_level
          ? <View style={s.chips}><Chip label={profile.comprehension_level} color="#DAEAFF" textColor={COLORS.bloomAccent} /></View>
          : <Text style={s.emptyChip}>Not set</Text>
        }
      </Section>

      {/* Connect action — pinned to bottom */}
      <View style={s.actionCard}>
        {profile.connectionStatus === 'accepted' && (
          <View style={s.statusRow}>
            <Text style={s.statusIcon}>✅</Text>
            <Text style={s.statusText}>Already friends</Text>
          </View>
        )}
        {profile.connectionStatus === 'pending_sent' && (
          <View style={s.statusRow}>
            <Text style={s.statusIcon}>⏳</Text>
            <Text style={s.statusText}>Friend request sent — waiting for guardian to accept</Text>
          </View>
        )}
        {profile.connectionStatus === 'pending_received' && (
          <TouchableOpacity
            style={s.connectBtn}
            onPress={() => navigation.navigate('LearnerFriendRequests')}
          >
            <Text style={s.connectBtnText}>Respond to friend request →</Text>
          </TouchableOpacity>
        )}
        {profile.connectionStatus === 'none' && (
          <>
            <Text style={s.connectHint}>
              Sending a request will notify {profile.name}'s guardian. They can accept or decline on behalf of their learner.
            </Text>
            <TouchableOpacity
              style={[s.connectBtn, sending && { opacity: 0.6 }]}
              onPress={sendRequest}
              disabled={sending}
            >
              {sending
                ? <ActivityIndicator color={COLORS.bloomAccent} />
                : <Text style={s.connectBtnText}>Send Friend Request</Text>
              }
            </TouchableOpacity>
          </>
        )}
      </View>
    </ScrollView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={s.section}>
      <Text style={s.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function Chip({ label, color, textColor }: { label: string; color: string; textColor: string }) {
  return (
    <View style={[s.chip, { backgroundColor: color }]}>
      <Text style={[s.chipText, { color: textColor }]}>{label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bloomBody },
  content: { padding: 16, paddingBottom: 48, gap: 14 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  errorText: { fontSize: 16, color: COLORS.bloomMuted },

  headerCard: {
    backgroundColor: COLORS.bloomCard, borderRadius: 20, padding: 24,
    alignItems: 'center', gap: 8,
    borderWidth: 1, borderColor: COLORS.bloomBorder,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 10, elevation: 3,
  },
  avatar: { width: 88, height: 88, borderRadius: 44, justifyContent: 'center', alignItems: 'center', marginBottom: 4 },
  avatarInitial: { fontSize: 36, fontWeight: '900', color: '#fff' },
  name: { fontSize: 24, fontWeight: '900', color: COLORS.bloomText },
  subMeta: { fontSize: 14, color: COLORS.bloomMuted, fontWeight: '500' },
  levelBadge: { backgroundColor: '#DAEAFF', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 5, marginTop: 4 },
  levelBadgeText: { fontSize: 13, fontWeight: '700', color: COLORS.bloomAccent, textTransform: 'capitalize' },

  actionCard: {
    backgroundColor: COLORS.bloomCard, borderRadius: 16, padding: 16, gap: 12,
    borderWidth: 1, borderColor: COLORS.bloomBorder,
  },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  statusIcon: { fontSize: 20 },
  statusText: { fontSize: 14, color: COLORS.bloomText, fontWeight: '600', flex: 1 },
  connectHint: { fontSize: 13, color: COLORS.bloomMuted, lineHeight: 18 },
  connectBtn: {
    backgroundColor: COLORS.bloomAccent, borderRadius: 12,
    paddingVertical: 14, alignItems: 'center',
  },
  connectBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },

  section: {
    backgroundColor: COLORS.bloomCard, borderRadius: 16, padding: 16, gap: 12,
    borderWidth: 1, borderColor: COLORS.bloomBorder,
  },
  sectionTitle: { fontSize: 13, fontWeight: '900', color: COLORS.bloomText, letterSpacing: 0.5 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7 },
  chipText: { fontSize: 13, fontWeight: '700' },
  emptyChip: { fontSize: 13, color: COLORS.bloomMuted, fontStyle: 'italic' },
});
