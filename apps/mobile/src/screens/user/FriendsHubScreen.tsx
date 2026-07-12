import React, { useEffect, useLayoutEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert,
} from 'react-native';
import * as Speech from 'expo-speech';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/AuthContext';
import { COLORS } from '../../constants';
import { UserStackParamList } from '../../navigation';
import AvatarWithMood from '../../components/AvatarWithMood';

const CATEGORY_EMOJI: Record<string, string> = {
  Music: '🎵', Sports: '⚽', Art: '🎨', Cooking: '🍳',
  Movies: '🎬', Reading: '📚', Dancing: '💃', Gaming: '🎮',
  Animals: '🐾', Nature: '🌿', Swimming: '🏊',
};

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

interface Friend {
  id: string;
  name: string;
  photo_url: string | null;
  last_seen_at: string | null;
  current_mood: string | null;
  is_pinned: boolean;
  likes: string[];
}


export default function FriendsHubScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<UserStackParamList>>();
  const { activeUser } = useAuth();
  const [friends, setFriends] = useState<Friend[]>([]);
  const [loading, setLoading] = useState(true);

  useLayoutEffect(() => { navigation.setOptions({ headerRight: undefined }); }, [navigation]);

  useEffect(() => { if (activeUser) loadFriends(activeUser.id); }, [activeUser]);

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
      return { id: friend.id, name: friend.name, photo_url: friend.photo_url, last_seen_at: friend.last_seen_at, current_mood: friend.current_mood ?? null, is_pinned: isPinned, likes: [] as string[] };
    });

    if (list.length > 0) {
      const friendIds = list.map((f: Friend) => f.id);
      const { data: likesData } = await supabase
        .from('user_likes').select('user_id, categories(name)').in('user_id', friendIds);
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
      p_user_a: activeUser.id, p_user_b: friend.id,
    });
    if (error || !convId) { Alert.alert('Chat error', error?.message ?? 'Failed to open chat'); return; }
    navigation.navigate('Chat', { conversationId: convId, participantName: friend.name, participantPhoto: friend.photo_url });
  }

  function speakFriend(friend: Friend) {
    const text = friend.likes.length ? `${friend.name}. Likes: ${friend.likes.join(', ')}` : friend.name;
    Speech.speak(text, { rate: 0.85, pitch: 1.0 });
  }

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color={COLORS.primary} /></View>;

  if (friends.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyEmoji}>🤝</Text>
        <Text style={styles.emptyText}>No friends yet!</Text>
        <Text style={styles.emptyHint}>Go to Discovery to find people to connect with</Text>
      </View>
    );
  }

  const sort = (list: Friend[]) => [...list].sort((a, b) => a.name.localeCompare(b.name));
  const pinned  = sort(friends.filter(f => f.is_pinned));
  const online  = sort(friends.filter(f => !f.is_pinned && isOnline(f.last_seen_at)));
  const offline = sort(friends.filter(f => !f.is_pinned && !isOnline(f.last_seen_at)));

  const sections: { emoji: string; title: string; data: Friend[] }[] = [
    { emoji: '⭐', title: 'Favourites',    data: pinned  },
    { emoji: '🟢', title: 'Online Now',    data: online  },
    { emoji: '👥', title: 'All Friends',   data: offline },
  ].filter(s => s.data.length > 0);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {sections.map(section => (
        <View key={section.title} style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionEmoji}>{section.emoji}</Text>
            <Text style={styles.sectionTitle}>{section.title}</Text>
          </View>

          {section.data.map(friend => {
            const color = avatarColor(friend.name);
            const online = isOnline(friend.last_seen_at);
            return (
              <TouchableOpacity
                key={friend.id}
                style={[styles.card, { borderLeftColor: color, backgroundColor: color + '12' }]}
                onPress={() => openChat(friend)}
                activeOpacity={0.8}
              >
                {/* Avatar with mood badge; online dot sits on top-right */}
                <View style={styles.avatarWrap}>
                  <AvatarWithMood name={friend.name} photo={friend.photo_url} size={64} mood={friend.current_mood} />
                  <View style={[styles.statusDot, online ? styles.dotOnline : styles.dotOffline]} />
                </View>

                {/* Info */}
                <View style={styles.info}>
                  <Text style={styles.name}>{friend.name}</Text>
                  {friend.likes.length > 0 && (
                    <View style={styles.likesRow}>
                      {friend.likes.map(like => (
                        <Text key={like} style={styles.likeEmoji}>
                          {CATEGORY_EMOJI[like] ?? '⭐'}
                        </Text>
                      ))}
                    </View>
                  )}
                </View>

                {/* Speak button */}
                <TouchableOpacity
                  style={styles.speakBtn}
                  onPress={() => speakFriend(friend)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Text style={styles.speakIcon}>📢</Text>
                </TouchableOpacity>

                <Text style={[styles.arrow, { color }]}>›</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: 20, gap: 28, paddingBottom: 48 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background, padding: 32, gap: 12 },
  emptyEmoji: { fontSize: 72 },
  emptyText: { fontSize: 24, fontWeight: '900', color: COLORS.text },
  emptyHint: { fontSize: 16, color: COLORS.textLight, textAlign: 'center' },

  section: { gap: 16 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  sectionEmoji: { fontSize: 26 },
  sectionTitle: { fontSize: 22, fontWeight: '900', color: COLORS.text },

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
    borderWidth: 2, borderColor: COLORS.background,
  },
  dotOnline:  { backgroundColor: '#5CBB7A' },
  dotOffline: { backgroundColor: '#BDC3C7' },

  info: { flex: 1, minWidth: 0 },
  name: { fontSize: 22, fontWeight: '900', color: COLORS.text },
  likesRow: { flexDirection: 'row', gap: 4, marginTop: 6 },
  likeEmoji: { fontSize: 22 },

  speakBtn: {
    width: 42, height: 42, borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.06)',
    justifyContent: 'center', alignItems: 'center', flexShrink: 0,
  },
  speakIcon: { fontSize: 20 },
  arrow: { fontSize: 28, fontWeight: '900', flexShrink: 0 },
});
