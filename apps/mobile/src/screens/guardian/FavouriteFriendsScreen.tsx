import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Image, ActivityIndicator, Alert,
} from 'react-native';
import AppText from '../../components/AppText';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { GuardianNavParamList } from '../../navigation';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/AuthContext';
import { COLORS, calcAge } from '../../constants';

const AVATAR_COLORS = [COLORS.statusRed, COLORS.statusPurple, COLORS.statusTeal, COLORS.statusAmber, COLORS.statusBlue, COLORS.statusPink];

interface FriendForPin {
  friendshipId: string;
  friendId: string;
  friendName: string;
  friendPhotoUrl: string | null;
  friendDob: string | null;
  friendCity: string;
  friendRegion: string;
  isPinned: boolean;
  isRequester: boolean;
}

export default function FavouriteFriendsScreen() {
  const { guardian } = useAuth();
  const navigation = useNavigation<NativeStackNavigationProp<GuardianNavParamList>>();
  const [friends, setFriends] = useState<FriendForPin[]>([]);
  const [loading, setLoading] = useState(true);
  const [removeTooltip, setRemoveTooltip] = useState<string | null>(null);

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
        requester:user_profiles!friendships_requester_id_fkey(id, name, photo_url, date_of_birth, city, region),
        addressee:user_profiles!friendships_addressee_id_fkey(id, name, photo_url, date_of_birth, city, region)
      `)
      .eq('status', 'accepted')
      .or(`requester_id.eq.${learner.id},addressee_id.eq.${learner.id}`);

    if (!error && data) {
      const list: FriendForPin[] = data.map((f: any) => {
        const isRequester = f.requester_id === learner.id;
        const friend = isRequester ? f.addressee : f.requester;
        return {
          friendshipId: f.id,
          friendId: friend.id,
          friendName: friend.name,
          friendPhotoUrl: friend.photo_url,
          friendDob: friend.date_of_birth ?? null,
          friendCity: friend.city ?? '',
          friendRegion: friend.region ?? '',
          isPinned: isRequester ? f.requester_pinned : f.addressee_pinned,
          isRequester,
        };
      });
      setFriends(list.sort((a, b) => a.friendName.localeCompare(b.friendName)));
    }
    setLoading(false);
  }

  async function removeFriend(item: FriendForPin) {
    Alert.alert(
      'Remove friend',
      `Remove ${item.friendName} from your learner's friends list?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            const { error } = await supabase
              .from('friendships')
              .delete()
              .eq('id', item.friendshipId);
            if (error) {
              Alert.alert('Error', error.message);
            } else {
              setFriends(prev => prev.filter(f => f.friendshipId !== item.friendshipId));
            }
          },
        },
      ],
    );
  }

  async function togglePin(item: FriendForPin) {
    const pinnedCount = friends.filter(f => f.isPinned).length;
    if (!item.isPinned && pinnedCount >= 5) {
      Alert.alert('Max 5 favourites', 'Unpin a friend first before adding another.');
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
        <AppText style={s.emptyEmoji}>⭐</AppText>
        <AppText style={s.emptyTitle}>No friends yet</AppText>
        <TouchableOpacity onPress={() => navigation.navigate('LearnerDiscovery')} activeOpacity={0.7}>
          <AppText style={s.emptyLink}>Find Friends for Learners →</AppText>
        </TouchableOpacity>
      </View>
    );
  }

  const pinned = friends.filter(f => f.isPinned).length;

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content}>
      <AppText style={s.hint}>Pin up to 5 favourites — they appear at the top of the learner's Friends list.</AppText>
      <AppText style={s.counter}>{pinned}/5 pinned</AppText>

      {friends.map((item, index) => {
        const color = AVATAR_COLORS[index % AVATAR_COLORS.length];
        const showTooltip = removeTooltip === item.friendshipId;
        return (
          <View key={item.friendshipId} style={s.rowWrap}>
            <View style={s.row}>
              {/* Avatar */}
              {item.friendPhotoUrl ? (
                <Image source={{ uri: item.friendPhotoUrl }} style={s.avatar} />
              ) : (
                <View style={[s.avatar, { backgroundColor: color }]}>
                  <AppText style={s.avatarInitial}>{item.friendName[0]?.toUpperCase()}</AppText>
                </View>
              )}

              {/* Info */}
              <View style={s.rowInfo}>
                <AppText style={s.name} numberOfLines={1}>{item.friendName}</AppText>
                <AppText style={s.meta} numberOfLines={1}>
                  {calcAge(item.friendDob) ?? '—'} yrs · {item.friendCity}{item.friendRegion ? `, ${item.friendRegion}` : ''}
                </AppText>
              </View>

              {/* Pin toggle */}
              <TouchableOpacity
                style={[s.pinBtn, item.isPinned && s.pinBtnActive]}
                onPress={() => togglePin(item)}
                activeOpacity={0.8}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <AppText style={s.pinIcon}>{item.isPinned ? '⭐' : '☆'}</AppText>
              </TouchableOpacity>

              {/* Remove */}
              <TouchableOpacity
                style={[s.removeBtn, showTooltip && s.removeBtnActive]}
                onPress={() => removeFriend(item)}
                onPressIn={() => setRemoveTooltip(item.friendshipId)}
                onPressOut={() => setRemoveTooltip(null)}
                activeOpacity={0.8}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <AppText style={s.removeIcon}>✕</AppText>
              </TouchableOpacity>
            </View>

            {showTooltip && (
              <View style={s.tooltip}>
                <AppText style={s.tooltipText}>Remove {item.friendName} from friends list</AppText>
              </View>
            )}
          </View>
        );
      })}
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
  emptyLink:  { fontSize: 14, color: COLORS.bloomAccent, fontWeight: '700', textAlign: 'center', marginTop: 8 },

  hint:    { fontSize: 13, color: COLORS.bloomMuted, marginBottom: 4 },
  counter: { fontSize: 13, fontWeight: '700', color: COLORS.bloomAccent, marginBottom: 16 },

  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: COLORS.bloomCard, borderRadius: 14, padding: 12,
    borderWidth: 1, borderColor: COLORS.bloomBorder,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 6, elevation: 2,
  },
  avatar: { width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center' },
  avatarInitial: { fontSize: 18, fontWeight: '800', color: '#fff' },
  rowInfo: { flex: 1, minWidth: 0, gap: 2 },
  name: { fontSize: 14, fontWeight: '800', color: COLORS.bloomText },
  meta: { fontSize: 11, color: COLORS.bloomMuted, fontWeight: '500' },
  pinBtn: {
    width: 44, height: 44, borderRadius: 12,
    backgroundColor: COLORS.bloomBorder,
    justifyContent: 'center', alignItems: 'center', flexShrink: 0,
  },
  pinBtnActive: { backgroundColor: '#FDE8C0' },
  pinIcon: { fontSize: 22 },
  rowWrap: { marginBottom: 8 },
  removeBtn: {
    width: 44, height: 44, borderRadius: 12,
    backgroundColor: COLORS.statusRedLight,
    justifyContent: 'center', alignItems: 'center', flexShrink: 0,
  },
  removeBtnActive: { backgroundColor: '#FECACA' },
  removeIcon: { fontSize: 16, fontWeight: '700', color: COLORS.statusRedDark },
  tooltip: {
    backgroundColor: '#1E3350',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginTop: 4,
    alignSelf: 'flex-end',
    marginRight: 2,
  },
  tooltipText: { fontSize: 12, color: '#fff', fontWeight: '600' },
});
