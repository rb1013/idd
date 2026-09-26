import React, { useCallback, useEffect, useState } from 'react';
import {
  View, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert, Dimensions,
} from 'react-native';
import AppText from '../../components/AppText';
import RainbowDivider from '../../components/RainbowDivider';
import ContentContainer from '../../components/ContentContainer';
import useNicoHeader from '../../hooks/useNicoHeader';
import * as Speech from 'expo-speech';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/AuthContext';
import { UserStackParamList } from '../../navigation';
import AvatarWithMood from '../../components/AvatarWithMood';
import {
  NICO, TEXT_STYLE, SPACING, RADIUS, SHADOW, FONT_SIZE, FONT_WEIGHT,
  BUTTERFLY_TILES, MAX_CONTENT_WIDTH, IS_TABLET, scale,
} from '../../constants/theme';

const { width } = Dimensions.get('window');
const CONTENT_W = IS_TABLET && MAX_CONTENT_WIDTH ? MAX_CONTENT_WIDTH : width;
const TILE_W = (CONTENT_W - SPACING.base * 2 - SPACING.md) / 2;

const EMPTY_MESSAGE = 'No friends added yet. Ask your guardian to add friends for you!';

function NoFriendsEmptyState() {
  return (
    <View style={s.emptyContainer}>
      <RainbowDivider />
      <View style={s.emptyContent}>
        <AppText style={s.emptyEmoji}>😊</AppText>
        <AppText style={s.emptyText}>No friends added yet.</AppText>
        <AppText style={s.emptyHint}>Ask your guardian to add friends for you!</AppText>
        <TouchableOpacity
          style={s.emptySpeakBtn}
          onPress={() => Speech.speak(EMPTY_MESSAGE, { rate: 0.65, pitch: 1.0 })}
          activeOpacity={0.75}
        >
          <AppText style={s.emptySpeakIcon}>🔊</AppText>
        </TouchableOpacity>
      </View>
    </View>
  );
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
  useNicoHeader(navigation);

  const [friends, setFriends] = useState<Friend[]>([]);
  const [loading, setLoading] = useState(true);
  const [messagingDisabled, setMessagingDisabled] = useState(false);
  const [blockedIds, setBlockedIds] = useState<Set<string>>(new Set());

  useFocusEffect(useCallback(() => {
    return () => { Speech.stop(); };
  }, []));

  useEffect(() => {
    if (!activeUser) return;
    loadFriends(activeUser.id);
    supabase.from('user_profiles').select('messaging_disabled').eq('id', activeUser.id).single()
      .then(({ data }) => { if (data) setMessagingDisabled(!!data.messaging_disabled); });
  }, [activeUser]);

  useFocusEffect(useCallback(() => {
    if (activeUser) loadHidden(activeUser.id);
  }, [activeUser]));

  async function loadHidden(userId: string) {
    const [{ data: blockedData }, { data: reportedData }] = await Promise.all([
      supabase
        .from('blocked_learners')
        .select('learner_id, blocked_learner_id')
        .or(`learner_id.eq.${userId},blocked_learner_id.eq.${userId}`),
      supabase
        .from('reports')
        .select('reported_learner_id')
        .eq('learner_id', userId),
    ]);
    const ids = new Set<string>();
    (blockedData ?? []).forEach((row: any) => {
      if (row.learner_id !== userId) ids.add(row.learner_id);
      if (row.blocked_learner_id !== userId) ids.add(row.blocked_learner_id);
    });
    (reportedData ?? []).forEach((row: any) => ids.add(row.reported_learner_id));
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
    if (messagingDisabled) return;
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
    Speech.speak(parts.join('. '), { rate: 0.65, pitch: 1.0 });
  }

  if (loading) return <View style={s.center}><ActivityIndicator size="large" color={NICO.primary} /></View>;

  const sorted = [...friends].filter(f => !blockedIds.has(f.id)).sort((a, b) => a.name.localeCompare(b.name));

  if (sorted.length === 0) {
    return <NoFriendsEmptyState />;
  }

  return (
    <View style={s.container}>
      <RainbowDivider />
      <ScrollView contentContainerStyle={s.content}>
        <ContentContainer>
          <View style={[s.tileGrid, sorted.length < 3 && s.tileGridStart]}>
            {sorted.map((friend, idx) => {
              const tile = BUTTERFLY_TILES[idx % BUTTERFLY_TILES.length];
              const online = isOnline(friend.last_seen_at);
              return (
                <TouchableOpacity
                  key={friend.id}
                  style={[s.tile, { backgroundColor: tile.bg, borderColor: tile.accent }]}
                  onPress={() => openChat(friend)}
                  activeOpacity={0.85}
                >
                  <TouchableOpacity
                    style={s.tileSpeakCorner}
                    onPress={() => speakFriend(friend)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <AppText style={s.tileSpeakIcon}>🔊</AppText>
                  </TouchableOpacity>
                  <View style={s.tileAvatarWrap}>
                    <AvatarWithMood name={friend.name} photo={friend.photo_url} size={scale(68)} mood={friend.current_mood} />
                    {online && <View style={s.onlineDot} />}
                  </View>
                  <AppText style={s.tileName} numberOfLines={2}>{friend.name}</AppText>
                  {friend.likes.length > 0 && (
                    <View style={s.tileLikesRow}>
                      <AppText style={s.tileEmojiLabel}>👍</AppText>
                      {friend.likes.slice(0, 3).map(like => (
                        <AppText key={like.name} style={s.tileLikeEmoji}>{like.emoji}</AppText>
                      ))}
                    </View>
                  )}
                  {friend.dislikes.length > 0 && (
                    <View style={s.tileLikesRow}>
                      <AppText style={s.tileEmojiLabel}>👎</AppText>
                      {friend.dislikes.slice(0, 3).map(dislike => (
                        <AppText key={dislike.name} style={s.tileLikeEmoji}>{dislike.emoji}</AppText>
                      ))}
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </ContentContainer>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: NICO.screenBg },
  content:   { padding: SPACING.base, paddingBottom: 48 },
  center:    { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: NICO.screenBg },

  emptyContainer: { flex: 1, backgroundColor: NICO.screenBg },
  emptyContent:   { flex: 1, justifyContent: 'center', alignItems: 'center', padding: SPACING.xl, gap: SPACING.md },
  emptyEmoji: { fontSize: scale(72) },
  emptyText:  { fontSize: FONT_SIZE['2xl'], fontWeight: FONT_WEIGHT.black, color: NICO.text, textAlign: 'center' },
  emptyHint:  { ...TEXT_STYLE.screenHint, textAlign: 'center', lineHeight: 24 },
  emptySpeakBtn: {
    marginTop: SPACING.sm, justifyContent: 'center', alignItems: 'center',
    width: scale(48), height: scale(48), borderRadius: scale(24),
    backgroundColor: BUTTERFLY_TILES[2].bg, borderWidth: 1.5, borderColor: BUTTERFLY_TILES[2].accent,
  },
  emptySpeakIcon: { fontSize: FONT_SIZE.xl },

  tileGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: SPACING.md },
  tileGridStart: { justifyContent: 'flex-start' },
  tile: {
    width: TILE_W, borderRadius: RADIUS['2xl'], borderWidth: 2,
    alignItems: 'center', paddingVertical: SPACING.lg, paddingHorizontal: SPACING.sm, gap: SPACING.sm,
    ...SHADOW.md,
  },
  tileAvatarWrap: { position: 'relative' },
  onlineDot: {
    position: 'absolute', bottom: 2, left: 2,
    width: scale(14), height: scale(14), borderRadius: scale(7),
    backgroundColor: NICO.success, borderWidth: 2, borderColor: '#fff',
  },
  tileName: { ...TEXT_STYLE.learnerTileTitle, textAlign: 'center' },
  tileLikesRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  tileEmojiLabel: { fontSize: FONT_SIZE.sm },
  tileLikeEmoji: { fontSize: FONT_SIZE.xl },
  tileSpeakCorner: {
    position: 'absolute', top: SPACING.sm, right: SPACING.sm,
    width: scale(30), height: scale(30), borderRadius: scale(15),
    backgroundColor: 'rgba(255,255,255,0.75)',
    justifyContent: 'center', alignItems: 'center',
    zIndex: 1,
  },
  tileSpeakIcon: { fontSize: FONT_SIZE.base },
});
