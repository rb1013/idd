import React, { useCallback, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  Image, ActivityIndicator, Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/AuthContext';
import { COLORS } from '../../constants';

const AVATAR_COLORS = ['#FF6B6B', '#845EF7', '#20C997', '#F59E0B', '#3B82F6', '#EC4899'];

interface FriendRequest {
  friendshipId: string;
  requesterId: string;
  requesterName: string;
  requesterPhoto: string | null;
  requesterAge: number;
  requesterCity: string;
  requesterRegion: string;
  requesterGuardianName: string | null;
  myLearnerId: string;
  myLearnerName: string;
  direction: 'incoming' | 'outgoing';
}

export default function LearnerFriendRequestsScreen() {
  const { guardian } = useAuth();
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (guardian) load(guardian.id);
    }, [guardian]),
  );

  async function load(guardianId: string) {
    setLoading(true);

    // Get my learners
    const { data: myLearners } = await supabase
      .from('user_profiles')
      .select('id, name')
      .eq('guardian_id', guardianId);

    if (!myLearners || myLearners.length === 0) { setLoading(false); return; }

    const myIds = myLearners.map((l: any) => l.id);
    const myMap: Record<string, string> = {};
    myLearners.forEach((l: any) => { myMap[l.id] = l.name; });

    // Fetch pending friendships involving my learners
    const { data: friendships } = await supabase
      .from('friendships')
      .select('id, requester_id, addressee_id, requested_by_guardian_id, status')
      .eq('status', 'pending')
      .or(
        myIds.map((id: string) => `requester_id.eq.${id},addressee_id.eq.${id}`).join(',')
      );

    if (!friendships || friendships.length === 0) { setLoading(false); setRequests([]); return; }

    // Fetch other learner profiles
    const otherIds = friendships.map((f: any) =>
      myIds.includes(f.requester_id) ? f.addressee_id : f.requester_id
    );

    const { data: otherProfiles } = await supabase
      .from('user_profiles')
      .select('id, name, age, photo_url, city, region, guardian_id')
      .in('id', otherIds);

    // Fetch other guardians' names
    const otherGuardianIds = [...new Set((otherProfiles ?? []).map((p: any) => p.guardian_id).filter(Boolean))];
    const { data: otherGuardians } = otherGuardianIds.length > 0
      ? await supabase.from('guardians').select('id, full_name').in('id', otherGuardianIds)
      : { data: [] };

    const guardianNameMap: Record<string, string> = {};
    (otherGuardians ?? []).forEach((g: any) => { guardianNameMap[g.id] = g.full_name; });

    const profileMap: Record<string, any> = {};
    (otherProfiles ?? []).forEach((p: any) => { profileMap[p.id] = p; });

    const list: FriendRequest[] = friendships.map((f: any) => {
      const iAmRequester = myIds.includes(f.requester_id);
      const myLearnerId  = iAmRequester ? f.requester_id : f.addressee_id;
      const otherId      = iAmRequester ? f.addressee_id : f.requester_id;
      const other        = profileMap[otherId];

      return {
        friendshipId: f.id,
        requesterId: otherId,
        requesterName: other?.name ?? 'Unknown',
        requesterPhoto: other?.photo_url ?? null,
        requesterAge: other?.age ?? 0,
        requesterCity: other?.city ?? '',
        requesterRegion: other?.region ?? '',
        requesterGuardianName: other?.guardian_id ? (guardianNameMap[other.guardian_id] ?? null) : null,
        myLearnerId,
        myLearnerName: myMap[myLearnerId] ?? '',
        direction: iAmRequester ? 'outgoing' : 'incoming',
      };
    });

    setRequests(list);
    setLoading(false);
  }

  async function accept(req: FriendRequest) {
    setProcessing(req.friendshipId);
    const { error } = await supabase
      .from('friendships')
      .update({ status: 'accepted' })
      .eq('id', req.friendshipId);

    if (error) {
      Alert.alert('Error', error.message);
    } else {
      // Auto-connect guardians: find requester's guardian and create guardian connection if needed
      const { data: requesterProfile } = await supabase
        .from('user_profiles').select('guardian_id').eq('id', req.requesterId).single();

      if (requesterProfile?.guardian_id && guardian) {
        try {
          await supabase.from('guardian_connections').upsert({
            requester_id: requesterProfile.guardian_id,
            addressee_id: guardian.id,
            status: 'accepted',
          }, { onConflict: 'requester_id,addressee_id', ignoreDuplicates: true });
        } catch {}
      }

      setRequests(prev => prev.filter(r => r.friendshipId !== req.friendshipId));
      Alert.alert('Connected!', `${req.myLearnerName} and ${req.requesterName} are now friends.`);
    }
    setProcessing(null);
  }

  async function decline(req: FriendRequest) {
    Alert.alert(
      'Decline request',
      `Decline the friend request from ${req.requesterName}'s guardian?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Decline', style: 'destructive', onPress: async () => {
            setProcessing(req.friendshipId);
            await supabase.from('friendships').update({ status: 'rejected' }).eq('id', req.friendshipId);
            setRequests(prev => prev.filter(r => r.friendshipId !== req.friendshipId));
            setProcessing(null);
          },
        },
      ]
    );
  }

  async function cancel(req: FriendRequest) {
    Alert.alert(
      'Cancel request',
      `Cancel your friend request for ${req.requesterName}?`,
      [
        { text: 'Keep', style: 'cancel' },
        {
          text: 'Cancel request', style: 'destructive', onPress: async () => {
            setProcessing(req.friendshipId);
            await supabase.from('friendships').delete().eq('id', req.friendshipId);
            setRequests(prev => prev.filter(r => r.friendshipId !== req.friendshipId));
            setProcessing(null);
          },
        },
      ]
    );
  }

  const incoming = requests.filter(r => r.direction === 'incoming');
  const outgoing = requests.filter(r => r.direction === 'outgoing');

  if (loading) {
    return <View style={s.center}><ActivityIndicator size="large" color={COLORS.bloomAccent} /></View>;
  }

  if (requests.length === 0) {
    return (
      <View style={s.center}>
        <Text style={s.emptyEmoji}>🤝</Text>
        <Text style={s.emptyText}>No pending requests</Text>
        <Text style={s.emptyHint}>Find friends for your learner from the Community screen</Text>
      </View>
    );
  }

  function renderRequest(req: FriendRequest) {
    const color = AVATAR_COLORS[req.requesterName.charCodeAt(0) % AVATAR_COLORS.length];
    const isProcessing = processing === req.friendshipId;

    return (
      <View key={req.friendshipId} style={s.card}>
        {/* Learner avatar */}
        {req.requesterPhoto ? (
          <Image source={{ uri: req.requesterPhoto }} style={s.avatar} />
        ) : (
          <View style={[s.avatar, { backgroundColor: color }]}>
            <Text style={s.avatarInitial}>{req.requesterName[0]?.toUpperCase()}</Text>
          </View>
        )}

        {/* Info */}
        <View style={s.info}>
          <Text style={s.name}>{req.requesterName}</Text>
          <Text style={s.meta}>
            {req.requesterAge} yrs · {req.requesterCity}, {req.requesterRegion}
          </Text>
          {req.requesterGuardianName && (
            <Text style={s.guardianNote}>Guardian: {req.requesterGuardianName}</Text>
          )}
          <Text style={s.forLearner}>
            {req.direction === 'incoming' ? `For ${req.myLearnerName}` : `From ${req.myLearnerName}`}
          </Text>
        </View>

        {/* Actions */}
        {req.direction === 'incoming' && (
          <View style={s.actions}>
            {isProcessing ? <ActivityIndicator color={COLORS.bloomAccent} /> : (
              <>
                <TouchableOpacity style={s.acceptBtn} onPress={() => accept(req)}>
                  <Text style={s.acceptBtnText}>✓ Accept</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.declineBtn} onPress={() => decline(req)}>
                  <Text style={s.declineBtnText}>Decline</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        )}
        {req.direction === 'outgoing' && (
          <View style={s.actions}>
            {isProcessing ? <ActivityIndicator color={COLORS.bloomMuted} /> : (
              <TouchableOpacity style={s.cancelBtn} onPress={() => cancel(req)}>
                <Text style={s.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>
    );
  }

  return (
    <FlatList
      style={s.container}
      contentContainerStyle={s.content}
      data={[]}
      renderItem={null}
      ListHeaderComponent={
        <>
          {incoming.length > 0 && (
            <>
              <Text style={s.sectionTitle}>INCOMING ({incoming.length})</Text>
              {incoming.map(renderRequest)}
            </>
          )}
          {outgoing.length > 0 && (
            <>
              <Text style={[s.sectionTitle, { marginTop: incoming.length > 0 ? 24 : 0 }]}>
                SENT ({outgoing.length})
              </Text>
              {outgoing.map(renderRequest)}
            </>
          )}
        </>
      }
    />
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bloomBody },
  content: { padding: 16, paddingBottom: 48 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12, padding: 32 },
  emptyEmoji: { fontSize: 56 },
  emptyText: { fontSize: 20, fontWeight: '800', color: COLORS.bloomText },
  emptyHint: { fontSize: 14, color: COLORS.bloomMuted, textAlign: 'center' },

  sectionTitle: {
    fontSize: 11, fontWeight: '900', color: COLORS.bloomMuted,
    letterSpacing: 1.2, marginBottom: 12,
  },

  card: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: COLORS.bloomCard, borderRadius: 18, padding: 14, marginBottom: 10,
    borderWidth: 1, borderColor: COLORS.bloomBorder,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },
  avatar: { width: 52, height: 52, borderRadius: 26, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  avatarInitial: { fontSize: 20, fontWeight: '800', color: '#fff' },

  info: { flex: 1, minWidth: 0, gap: 2 },
  name: { fontSize: 15, fontWeight: '800', color: COLORS.bloomText },
  meta: { fontSize: 12, color: COLORS.bloomMuted },
  guardianNote: { fontSize: 12, color: COLORS.bloomAccent, fontWeight: '600' },
  forLearner: { fontSize: 11, color: COLORS.bloomMuted, marginTop: 2, fontStyle: 'italic' },

  actions: { alignItems: 'center', gap: 6 },
  acceptBtn: {
    backgroundColor: COLORS.bloomNavy, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 7,
  },
  acceptBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  declineBtn: {
    backgroundColor: '#FEE2E2', borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 7,
  },
  declineBtnText: { color: '#DC2626', fontWeight: '700', fontSize: 13 },
  cancelBtn: {
    backgroundColor: COLORS.bloomBorder, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 7,
  },
  cancelBtnText: { color: COLORS.bloomMuted, fontWeight: '600', fontSize: 12 },
});
