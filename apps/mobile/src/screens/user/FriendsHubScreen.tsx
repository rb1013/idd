import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert, Dimensions,
} from 'react-native';

const TILE_W = (Dimensions.get('window').width - 40 - 12) / 2; // 20px padding each side, 12px gap
import AppText from '../../components/AppText';
import * as Speech from 'expo-speech';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/AuthContext';
import { COLORS, USER_TILE_CYCLE, USER_HEADER } from '../../constants';
import { UserStackParamList } from '../../navigation';
import AvatarWithMood from '../../components/AvatarWithMood';

const EMPTY_MESSAGE = 'No friends added yet. Ask your guardian to add friends for you!';

function NoFriendsEmptyState() {
  const spokenRef = useRef(false);

  useFocusEffect(useCallback(() => {
    if (!spokenRef.current) {
      spokenRef.current = true;
      const t = setTimeout(() => Speech.speak(EMPTY_MESSAGE, { rate: 0.8, pitch: 1.1 }), 600);
      return () => { clearTimeout(t); Speech.stop(); };
    }
    return () => { Speech.stop(); };
  }, []));

  return (
    <View style={emptyStyles.container}>
      <AppText style={emptyStyles.emoji}>😊</AppText>
      <AppText style={emptyStyles.message}>No friends added yet.</AppText>
      <AppText style={emptyStyles.hint}>Ask your guardian to add friends for you!</AppText>
      <TouchableOpacity
        style={emptyStyles.speakBtn}
        onPress={() => Speech.speak(EMPTY_MESSAGE, { rate: 0.8, pitch: 1.1 })}
        activeOpacity={0.75}
      >
        <AppText style={emptyStyles.speakBtnText}>🔊  Hear this again</AppText>
      </TouchableOpacity>
    </View>
  );
}

const emptyStyles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40, gap: 12 },
  emoji:     { fontSize: 72 },
  message:   { fontSize: 22, fontWeight: '800', color: COLORS.text, textAlign: 'center' },
  hint:      { fontSize: 16, color: COLORS.textLight, textAlign: 'center', lineHeight: 24 },
  speakBtn:  {
    marginTop: 16, paddingHorizontal: 24, paddingVertical: 12,
    borderRadius: 20, backgroundColor: '#FDEADB',
    borderWidth: 1.5, borderColor: '#D4A888',
  },
  speakBtnText: { fontSize: 15, fontWeight: '700', color: '#C4693A' },
});


const AVATAR_COLORS = ['#4A90E2', '#5CBB7A', '#F5A623', '#9B59B6', '#E53E3E', '#1ABC9C'];
function avatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function isOnline(lastSeenAt: string | null): boolean {
  if (!lastSeenAt) return false;
  return Date.now() - new Date(lastSeenAt).getTime() < 5 * 60 * 1000;
}

interface CategoryItem { name: string; emoji: string; }

interface Friend {
  id: string;
  name: string;
  photo_url: string | null;
  last_seen_at: string | null;
  current_mood: string | null;
  is_pinned: boolean;
  likes: CategoryItem[];
  dislikes: CategoryItem[];
}


export default function FriendsHubScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<UserStackParamList>>();
  const { activeUser } = useAuth();
  const [friends, setFriends] = useState<Friend[]>([]);
  const [loading, setLoading] = useState(true);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerStyle:      { backgroundColor: USER_HEADER.backgroundColor },
      headerTintColor:  USER_HEADER.tintColor,
      headerTitleStyle: { color: USER_HEADER.tintColor, fontWeight: '900' as const, fontSize: 18 },
      headerRight:      undefined,
    });
  }, [navigation]);

  const [blockedIds, setBlockedIds] = useState<Set<string>>(new Set());

  useEffect(() => { if (activeUser) { loadFriends(activeUser.id); loadBlocked(activeUser.id); } }, [activeUser]);

  async function loadBlocked(userId: string) {
    const { data } = await supabase
      .from('blocked_learners')
      .select('learner_id, blocked_learner_id')
      .or(`learner_id.eq.${userId},blocked_learner_id.eq.${userId}`);
    const ids = new Set<string>();
    (data ?? []).forEach((row: any) => {
      if (row.learner_id !== userId) ids.add(row.learner_id);
      if (row.blocked_learner_id !== userId) ids.add(row.blocked_learner_id);
    });
    setBlockedIds(ids);
  }

  async function loadFriends(userId: string) {
    const { data, error } = await supabase
      .from('friendships')
      .select(`
        id, requester_id, addressee_id, requester_pinned, addressee_pinned,
        requester:user_profiles!friendships_requester_id_fkey(id, name, photo_url, last_seen_at, current_mood),
        addressee:user_profiles!friendships_addressee_id_fkey(id, name, photo_url, last_seen_at, current_mood)
      `)
      .eq('status', 'accepted')
      .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`);

    if (error) { setLoading(false); return; }

    const list = (data || []).map((f: any) => {
      const isRequester = f.requester_id === userId;
      const friend = isRequester ? f.addressee : f.requester;
      const isPinned = isRequester ? f.requester_pinned : f.addressee_pinned;
      return { id: friend.id, name: friend.name, photo_url: friend.photo_url, last_seen_at: friend.last_seen_at, current_mood: friend.current_mood ?? null, is_pinned: isPinned, likes: [] as CategoryItem[], dislikes: [] as CategoryItem[] };
    });

    if (list.length > 0) {
      const friendIds = list.map((f: Friend) => f.id);
      const [{ data: likesData }, { data: dislikesData }] = await Promise.all([
        supabase.from('user_likes').select('user_id, categories(name, emoji)').in('user_id', friendIds),
        supabase.from('user_dislikes').select('user_id, categories(name, emoji)').in('user_id', friendIds),
      ]);
      const likesByUser: Record<string, CategoryItem[]> = {};
      (likesData || []).forEach((row: any) => {
        if (!likesByUser[row.user_id]) likesByUser[row.user_id] = [];
        if (row.categories?.name) likesByUser[row.user_id].push({ name: row.categories.name, emoji: row.categories.emoji || '⭐' });
      });
      const dislikesByUser: Record<string, CategoryItem[]> = {};
      (dislikesData || []).forEach((row: any) => {
        if (!dislikesByUser[row.user_id]) dislikesByUser[row.user_id] = [];
        if (row.categories?.name) dislikesByUser[row.user_id].push({ name: row.categories.name, emoji: row.categories.emoji || '🔸' });
      });
      list.forEach((f: Friend) => {
        f.likes = (likesByUser[f.id] || []).slice(0, 4);
        f.dislikes = (dislikesByUser[f.id] || []).slice(0, 4);
      });
    }

    setFriends(list);
    setLoading(false);
  }

  async function openChat(friend: Friend) {
    if (!activeUser) return;
    const { data: convId, error } = await supabase.rpc('find_or_create_conversation', {
      p_user_a: activeUser.id, p_user_b: friend.id,
    });
    if (error || !convId) { Alert.alert('Chat error', error?.message ?? 'Failed to open chat'); return; }
    navigation.navigate('Chat', { conversationId: convId, participantName: friend.name, participantPhoto: friend.photo_url });
  }

  function speakFriend(friend: Friend) {
    const parts: string[] = [friend.name];
    if (friend.likes.length) parts.push(`Likes: ${friend.likes.map(l => l.name).join(', ')}`);
    if (friend.dislikes.length) parts.push(`Dislikes: ${friend.dislikes.map(d => d.name).join(', ')}`);
    Speech.speak(parts.join('. '), { rate: 0.85, pitch: 1.0 });
  }

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color={COLORS.primary} /></View>;

  if (friends.length === 0) {
    return <NoFriendsEmptyState />;
  }

  const sorted = [...friends].filter(f => !blockedIds.has(f.id)).sort((a, b) => a.name.localeCompare(b.name));

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.tileGrid}>
        {sorted.map((friend, idx) => {
          const tile = USER_TILE_CYCLE[idx % USER_TILE_CYCLE.length];
          const online = isOnline(friend.last_seen_at);
          return (
            <TouchableOpacity
              key={friend.id}
              style={[styles.tile, { backgroundColor: tile.backgroundColor, borderColor: tile.borderColor }]}
              onPress={() => openChat(friend)}
              activeOpacity={0.8}
            >
              <TouchableOpacity
                style={styles.tileSpeakCorner}
                onPress={() => speakFriend(friend)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <AppText style={styles.tileSpeakIcon}>🔊</AppText>
              </TouchableOpacity>
              <View style={styles.tileAvatarWrap}>
                <AvatarWithMood name={friend.name} photo={friend.photo_url} size={68} mood={friend.current_mood} />
              </View>
              <AppText style={styles.tileName} numberOfLines={2}>{friend.name}</AppText>
              {friend.likes.length > 0 && (
                <View style={styles.tileLikesRow}>
                  <AppText style={styles.tileEmojiLabel}>👍</AppText>
                  {friend.likes.slice(0, 3).map(like => (
                    <AppText key={like.name} style={styles.tileLikeEmoji}>{like.emoji}</AppText>
                  ))}
                </View>
              )}
              {friend.dislikes.length > 0 && (
                <View style={styles.tileLikesRow}>
                  <AppText style={styles.tileEmojiLabel}>👎</AppText>
                  {friend.dislikes.slice(0, 3).map(dislike => (
                    <AppText key={dislike.name} style={styles.tileLikeEmoji}>{dislike.emoji}</AppText>
                  ))}
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: USER_HEADER.pageBackground },
  content: { padding: 20, gap: 28, paddingBottom: 48 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: USER_HEADER.pageBackground, padding: 32, gap: 12 },
  emptyEmoji: { fontSize: 72 },
  emptyText: { fontSize: 24, fontWeight: '900', color: COLORS.text },
  emptyHint: { fontSize: 16, color: COLORS.textLight, textAlign: 'center' },

  section: { gap: 16 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  sectionEmoji: { fontSize: 26 },
  sectionTitle: { fontSize: 22, fontWeight: '700', color: COLORS.text },

  card: {
    flexDirection: 'row', alignItems: 'center', gap: 16,
    borderRadius: 22, padding: 16, borderLeftWidth: 6,
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.07, shadowRadius: 10, elevation: 3,
  },

  avatarWrap: { position: 'relative', flexShrink: 0 },
  statusDot: {
    position: 'absolute', top: 1, right: 1,
    width: 14, height: 14, borderRadius: 7,
    borderWidth: 2, borderColor: USER_HEADER.pageBackground,
  },
  dotOnline:  { backgroundColor: '#5CBB7A' },
  dotOffline: { backgroundColor: '#BDC3C7' },

  info: { flex: 1, minWidth: 0 },
  name: { fontSize: 22, fontWeight: '900', color: COLORS.text },
  emojiRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 },
  emojiLabel: { fontSize: 16 },
  likeEmoji: { fontSize: 22 },
  dislikeEmoji: { fontSize: 22, opacity: 0.7 },

  tileGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  tile: {
    width: TILE_W, borderRadius: 22, borderWidth: 2,
    alignItems: 'center', paddingVertical: 18, paddingHorizontal: 10, gap: 8,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08, shadowRadius: 10, elevation: 3,
  },
  tileAvatarWrap: { position: 'relative' },
  tileName: { fontSize: 15, fontWeight: '600', color: COLORS.text, textAlign: 'center' },
  tileLikesRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  tileEmojiLabel: { fontSize: 14 },
  tileLikeEmoji: { fontSize: 18 },
  tileSpeakCorner: {
    position: 'absolute', top: 8, right: 8,
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.08)',
    justifyContent: 'center', alignItems: 'center',
    zIndex: 1,
  },
  tileSpeakIcon: { fontSize: 13 },
});
