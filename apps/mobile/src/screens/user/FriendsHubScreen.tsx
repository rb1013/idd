import React, { useEffect, useLayoutEffect, useState } from 'react';
import {
  View, Text, StyleSheet, SectionList, TouchableOpacity,
  Image, ActivityIndicator, Alert,
} from 'react-native';
import * as Speech from 'expo-speech';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/AuthContext';
import { COLORS } from '../../constants';
import { UserStackParamList } from '../../navigation';

const CATEGORY_EMOJI: Record<string, string> = {
  Music: '🎵', Sports: '⚽', Art: '🎨', Cooking: '🍳',
  Movies: '🎬', Reading: '📚', Dancing: '💃', Gaming: '🎮',
  Animals: '🐾', Nature: '🌿', Swimming: '🏊',
};

function getEmoji(name: string): string {
  return CATEGORY_EMOJI[name] ?? '⭐';
}

function isOnline(lastSeenAt: string | null): boolean {
  if (!lastSeenAt) return false;
  return Date.now() - new Date(lastSeenAt).getTime() < 5 * 60 * 1000;
}

interface Friend {
  id: string;
  name: string;
  photo_url: string | null;
  last_seen_at: string | null;
  is_pinned: boolean;
  likes: string[];
}

export default function FriendsHubScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<UserStackParamList>>();
  const { activeUser } = useAuth();
  const [friends, setFriends] = useState<Friend[]>([]);
  const [loading, setLoading] = useState(true);

  useLayoutEffect(() => {
    navigation.setOptions({ headerRight: undefined });
  }, [navigation]);

  useEffect(() => {
    if (activeUser) loadFriends(activeUser.id);
  }, [activeUser]);

  async function loadFriends(userId: string) {
    const { data, error } = await supabase
      .from('friendships')
      .select(`
        id, requester_id, addressee_id, requester_pinned, addressee_pinned,
        requester:user_profiles!friendships_requester_id_fkey(id, name, photo_url, last_seen_at),
        addressee:user_profiles!friendships_addressee_id_fkey(id, name, photo_url, last_seen_at)
      `)
      .eq('status', 'accepted')
      .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`);

    if (error) { setLoading(false); return; }

    const list = (data || []).map((f: any) => {
      const isRequester = f.requester_id === userId;
      const friend = isRequester ? f.addressee : f.requester;
      const isPinned = isRequester ? f.requester_pinned : f.addressee_pinned;
      return {
        id: friend.id,
        name: friend.name,
        photo_url: friend.photo_url,
        last_seen_at: friend.last_seen_at,
        is_pinned: isPinned,
        likes: [] as string[],
      };
    });

    if (list.length > 0) {
      const friendIds = list.map((f: Friend) => f.id);
      const { data: likesData } = await supabase
        .from('user_likes')
        .select('user_id, categories(name)')
        .in('user_id', friendIds);

      const likesByUser: Record<string, string[]> = {};
      (likesData || []).forEach((row: any) => {
        if (!likesByUser[row.user_id]) likesByUser[row.user_id] = [];
        if (row.categories?.name) likesByUser[row.user_id].push(row.categories.name);
      });

      list.forEach((f: Friend) => { f.likes = (likesByUser[f.id] || []).slice(0, 4); });
    }

    setFriends(list);
    setLoading(false);
  }

  async function openChat(friend: Friend) {
    if (!activeUser) return;
    const { data: convId, error } = await supabase.rpc('find_or_create_conversation', {
      p_user_a: activeUser.id,
      p_user_b: friend.id,
    });
    if (error || !convId) { Alert.alert('Chat error', error?.message ?? 'Failed to open chat'); return; }
    navigation.navigate('Chat', { conversationId: convId, participantName: friend.name, participantPhoto: friend.photo_url });
  }

  function speakFriend(friend: Friend) {
    const likeLabels = friend.likes.join(', ');
    const text = likeLabels ? `${friend.name}. Likes: ${likeLabels}` : friend.name;
    Speech.speak(text, { rate: 0.85, pitch: 1.0 });
  }

  function speakWord(word: string) {
    Speech.speak(word, { rate: 0.85, pitch: 1.0 });
  }

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color={COLORS.primary} /></View>;
  }

  if (friends.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyEmoji}>🤝</Text>
        <Text style={styles.emptyText}>No friends yet!</Text>
        <Text style={styles.emptyHint}>Go to Discovery to find people to connect with</Text>
      </View>
    );
  }

  const sortGroup = (list: Friend[]) =>
    [...list].sort((a, b) => a.name.localeCompare(b.name));

  const pinned = sortGroup(friends.filter(f => f.is_pinned));
  const online = sortGroup(friends.filter(f => !f.is_pinned && isOnline(f.last_seen_at)));
  const offline = sortGroup(friends.filter(f => !f.is_pinned && !isOnline(f.last_seen_at)));

  const sections = [
    { title: '⭐  Favourites', data: pinned },
    { title: 'All Friends', data: [...online, ...offline] },
  ].filter(s => s.data.length > 0);

  return (
    <SectionList
      sections={sections}
      keyExtractor={item => item.id}
      contentContainerStyle={styles.list}
      stickySectionHeadersEnabled={false}
      renderSectionHeader={({ section }) => (
        <Text style={styles.sectionLabel}>{section.title}</Text>
      )}
      renderItem={({ item }) => {
        const online = isOnline(item.last_seen_at);
        return (
          <TouchableOpacity
            style={[styles.card, item.is_pinned && styles.cardPinned]}
            onPress={() => openChat(item)}
            activeOpacity={0.85}
          >
            {/* Avatar + status ring */}
            <View style={styles.avatarWrap}>
              {item.photo_url
                ? <Image source={{ uri: item.photo_url }} style={styles.avatar} />
                : (
                  <View style={[styles.avatarPlaceholder, { backgroundColor: stringToColor(item.name) }]}>
                    <Text style={styles.avatarInitial}>{item.name[0]}</Text>
                  </View>
                )
              }
              <View style={[styles.ring, online ? styles.ringOnline : styles.ringOffline]} />
              <View style={[styles.statusDot, online ? styles.dotOnline : styles.dotOffline]} />
              {item.is_pinned && <View style={styles.pinBadge}><Text style={styles.pinStar}>⭐</Text></View>}
            </View>

            {/* Info */}
            <View style={styles.info}>
              <TouchableOpacity
                onLongPress={() => speakWord(item.name)}
                delayLongPress={400}
                activeOpacity={1}
              >
                <Text style={styles.name}>{item.name}</Text>
              </TouchableOpacity>

              {item.likes.length > 0 && (
                <View style={styles.likesRow}>
                  {item.likes.map(like => (
                    <TouchableOpacity
                      key={like}
                      onLongPress={() => speakWord(like)}
                      delayLongPress={400}
                      activeOpacity={1}
                    >
                      <Text style={styles.likeEmoji}>{getEmoji(like)}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>

            {/* Speaker button — stops propagation via onPress priority */}
            <TouchableOpacity
              style={styles.speakBtn}
              onPress={() => speakFriend(item)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={styles.speakIcon}>📢</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        );
      }}
    />
  );
}

const AVATAR_COLORS = ['#4A90E2', '#5CBB7A', '#F5A623', '#9B59B6', '#E53E3E', '#1ABC9C'];
function stringToColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background, padding: 32 },
  emptyEmoji: { fontSize: 64, marginBottom: 16 },
  emptyText: { fontSize: 22, fontWeight: '700', color: COLORS.text, marginBottom: 8 },
  emptyHint: { fontSize: 15, color: COLORS.textLight, textAlign: 'center' },

  list: { padding: 16, paddingBottom: 48, gap: 12 },

  sectionLabel: {
    fontSize: 13, fontWeight: '700', color: COLORS.textLight,
    textTransform: 'uppercase', letterSpacing: 0.8,
    paddingHorizontal: 4, paddingTop: 8, paddingBottom: 4,
  },

  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 24,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.07,
    shadowRadius: 10,
    elevation: 3,
    minHeight: 96,
  },
  cardPinned: {
    borderWidth: 2.5,
    borderColor: '#F5A623',
  },

  avatarWrap: { position: 'relative', flexShrink: 0 },
  avatar: { width: 72, height: 72, borderRadius: 36 },
  avatarPlaceholder: {
    width: 72, height: 72, borderRadius: 36,
    justifyContent: 'center', alignItems: 'center',
  },
  avatarInitial: { fontSize: 28, fontWeight: '800', color: '#fff' },

  ring: {
    position: 'absolute', top: -5, left: -5, right: -5, bottom: -5,
    borderRadius: 41, borderWidth: 4,
  },
  ringOnline:  { borderColor: '#5CBB7A' },
  ringOffline: { borderColor: '#BDC3C7' },

  statusDot: {
    position: 'absolute', bottom: 2, right: 2,
    width: 18, height: 18, borderRadius: 9,
    borderWidth: 3, borderColor: COLORS.surface,
  },
  dotOnline:  { backgroundColor: '#5CBB7A' },
  dotOffline: { backgroundColor: '#BDC3C7' },

  pinBadge: {
    position: 'absolute', top: -3, left: -3,
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: '#F5A623',
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 2, borderColor: COLORS.surface,
  },
  pinStar: { fontSize: 10 },

  info: { flex: 1, minWidth: 0 },
  name: { fontSize: 19, fontWeight: '800', color: COLORS.text },
  likesRow: { flexDirection: 'row', gap: 6, marginTop: 8 },
  likeEmoji: { fontSize: 26 },

  speakBtn: {
    width: 52, height: 52,
    borderRadius: 16,
    backgroundColor: '#FDE8C0',
    justifyContent: 'center', alignItems: 'center',
    flexShrink: 0,
  },
  speakIcon: { fontSize: 24 },
});
