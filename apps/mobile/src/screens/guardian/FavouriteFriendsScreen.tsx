import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Image, ActivityIndicator, Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/AuthContext';
import { COLORS } from '../../constants';

interface FriendForPin {
  friendshipId: string;
  friendName: string;
  friendPhotoUrl: string | null;
  isPinned: boolean;
  isRequester: boolean;
}

export default function FavouriteFriendsScreen() {
  const { guardian } = useAuth();
  const [friends, setFriends] = useState<FriendForPin[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      if (guardian) load(guardian.id);
    }, [guardian]),
  );

  async function load(guardianId: string) {
    setLoading(true);

    const { data: learner } = await supabase
      .from('user_profiles')
      .select('id')
      .eq('guardian_id', guardianId)
      .single();

    if (!learner) { setLoading(false); return; }

    const { data, error } = await supabase
      .from('friendships')
      .select(`
        id, requester_id, addressee_id, requester_pinned, addressee_pinned,
        requester:user_profiles!friendships_requester_id_fkey(id, name, photo_url),
        addressee:user_profiles!friendships_addressee_id_fkey(id, name, photo_url)
      `)
      .eq('status', 'accepted')
      .or(`requester_id.eq.${learner.id},addressee_id.eq.${learner.id}`);

    if (!error && data) {
      const list: FriendForPin[] = data.map((f: any) => {
        const isRequester = f.requester_id === learner.id;
        const friend = isRequester ? f.addressee : f.requester;
        return {
          friendshipId: f.id,
          friendName: friend.name,
          friendPhotoUrl: friend.photo_url,
          isPinned: isRequester ? f.requester_pinned : f.addressee_pinned,
          isRequester,
        };
      });
      setFriends(list.sort((a, b) => a.friendName.localeCompare(b.friendName)));
    }
    setLoading(false);
  }

  async function togglePin(item: FriendForPin) {
    const pinnedCount = friends.filter(f => f.isPinned).length;
    if (!item.isPinned && pinnedCount >= 3) {
      Alert.alert('Max 3 favourites', 'Unpin a friend first before adding another.');
      return;
    }
    const column = item.isRequester ? 'requester_pinned' : 'addressee_pinned';
    const { error } = await supabase
      .from('friendships')
      .update({ [column]: !item.isPinned })
      .eq('id', item.friendshipId);
    if (!error) {
      setFriends(prev =>
        prev.map(f => f.friendshipId === item.friendshipId ? { ...f, isPinned: !f.isPinned } : f)
      );
    }
  }

  if (loading) {
    return <View style={s.center}><ActivityIndicator size="large" color={COLORS.bloomAccent} /></View>;
  }

  if (friends.length === 0) {
    return (
      <View style={s.center}>
        <Text style={s.emptyEmoji}>⭐</Text>
        <Text style={s.emptyTitle}>No friends yet</Text>
        <Text style={s.emptyHint}>Use "Find Friends for Learners" to add friends first.</Text>
      </View>
    );
  }

  const pinned = friends.filter(f => f.isPinned).length;

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content}>
      <Text style={s.hint}>Pin up to 3 friends — they appear at the top of the learner's Friends list.</Text>
      <Text style={s.counter}>{pinned}/3 pinned</Text>

      {friends.map(item => (
        <TouchableOpacity
          key={item.friendshipId}
          style={s.row}
          onPress={() => togglePin(item)}
          activeOpacity={0.8}
        >
          {item.friendPhotoUrl ? (
            <Image source={{ uri: item.friendPhotoUrl }} style={s.avatar} />
          ) : (
            <View style={[s.avatar, s.avatarPlaceholder]}>
              <Text style={s.avatarInitial}>{item.friendName[0]?.toUpperCase()}</Text>
            </View>
          )}
          <Text style={s.name}>{item.friendName}</Text>
          <View style={[s.pinBtn, item.isPinned && s.pinBtnActive]}>
            <Text style={s.pinIcon}>{item.isPinned ? '⭐' : '☆'}</Text>
          </View>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bloomBody },
  content:   { padding: 16, paddingBottom: 48 },
  center:    { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12, padding: 32 },
  emptyEmoji: { fontSize: 56 },
  emptyTitle: { fontSize: 20, fontWeight: '800', color: COLORS.bloomText },
  emptyHint:  { fontSize: 14, color: COLORS.bloomMuted, textAlign: 'center' },

  hint:    { fontSize: 13, color: COLORS.bloomMuted, marginBottom: 4 },
  counter: { fontSize: 13, fontWeight: '700', color: COLORS.bloomAccent, marginBottom: 16 },

  row: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.bloomBorder,
  },
  avatar: { width: 48, height: 48, borderRadius: 24 },
  avatarPlaceholder: { backgroundColor: '#DAEAFF', justifyContent: 'center', alignItems: 'center' },
  avatarInitial: { fontSize: 18, fontWeight: '700', color: COLORS.bloomAccent },
  name: { flex: 1, fontSize: 16, fontWeight: '600', color: COLORS.bloomText },
  pinBtn: {
    width: 44, height: 44, borderRadius: 12,
    backgroundColor: COLORS.bloomBorder,
    justifyContent: 'center', alignItems: 'center',
  },
  pinBtnActive: { backgroundColor: '#FDE8C0' },
  pinIcon: { fontSize: 22 },
});
