import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Image, ActivityIndicator, ScrollView,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/AuthContext';
import { COLORS } from '../../constants';
import { UserStackParamList } from '../../navigation';

interface ConversationItem {
  conversation_id: string;
  friend_id: string;
  friend_name: string;
  friend_photo: string | null;
  last_message: string | null;
  last_message_at: string | null;
  unread_count: number;
}

const AVATAR_COLORS = ['#5CBB7A', '#9B59B6', '#F5A623', '#4A90E2', '#E53E3E', '#1ABC9C'];
function avatarColor(name: string) {
  return AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length];
}

function timeAgo(iso: string | null): string {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return 'Yesterday';
  return `${days} days ago`;
}

export default function MessagesScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<UserStackParamList>>();
  const { activeUser } = useAuth();
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!activeUser) return;
    const { data } = await supabase.rpc('get_user_conversations', { p_user_id: activeUser.id });
    setConversations((data || []) as ConversationItem[]);
    setLoading(false);
  }, [activeUser]);

  useEffect(() => {
    load();
    const unsub = navigation.addListener('focus', load);
    return unsub;
  }, [navigation, load]);

  async function openChat(item: ConversationItem) {
    // Await the stamp so DB is updated before MessagesScreen reloads on focus
    if (activeUser) {
      await supabase.rpc('mark_conversation_read', {
        p_conversation_id: item.conversation_id,
        p_user_id: activeUser.id,
      });
    }
    setConversations(prev =>
      prev.map(c => c.conversation_id === item.conversation_id ? { ...c, unread_count: 0 } : c),
    );
    navigation.navigate('Chat', {
      conversationId: item.conversation_id,
      participantName: item.friend_name,
      participantPhoto: item.friend_photo,
    });
  }

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color={COLORS.accent} /></View>;
  }

  const unread = conversations.filter(c => c.unread_count > 0);
  const recent = conversations
    .filter(c => c.last_message_at && c.unread_count === 0)
    .sort((a, b) => new Date(b.last_message_at!).getTime() - new Date(a.last_message_at!).getTime())
    .slice(0, 3);

  if (conversations.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyEmoji}>💬</Text>
        <Text style={styles.emptyText}>No messages yet</Text>
        <Text style={styles.emptyHint}>Start a chat from your Friends hub</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>

      {/* ── Unread section ── */}
      {unread.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionEmoji}>💬</Text>
            <Text style={styles.sectionTitle}>New Messages</Text>
          </View>
          <View style={styles.bubblesRow}>
            {unread.map(item => {
              const color = avatarColor(item.friend_name);
              return (
                <TouchableOpacity key={item.conversation_id} style={styles.bubble} onPress={() => openChat(item)} activeOpacity={0.8}>
                  <View style={[styles.bubbleRing, { borderColor: color }]}>
                    <AvatarCircle name={item.friend_name} photo={item.friend_photo} size={84} />
                    <View style={styles.unreadBadge}>
                      <Text style={styles.unreadBadgeText}>{item.unread_count > 9 ? '9+' : item.unread_count}</Text>
                    </View>
                  </View>
                  <Text style={[styles.bubbleName, { color }]} numberOfLines={1}>{item.friend_name.split(' ')[0]}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      )}

      {/* ── Recent section — individual card per conversation ── */}
      {recent.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionEmoji}>🕐</Text>
            <Text style={styles.sectionTitle}>Recent</Text>
          </View>
          {recent.map(item => {
            const color = avatarColor(item.friend_name);
            return (
              <TouchableOpacity
                key={item.conversation_id}
                style={[styles.recentCard, { borderLeftColor: color, backgroundColor: color + '12' }]}
                onPress={() => openChat(item)}
                activeOpacity={0.8}
              >
                <AvatarCircle name={item.friend_name} photo={item.friend_photo} size={64} />
                <View style={styles.recentInfo}>
                  <Text style={styles.recentName}>{item.friend_name}</Text>
                  <Text style={[styles.recentTime, { color }]}>{timeAgo(item.last_message_at)}</Text>
                </View>
                <Text style={[styles.recentArrow, { color }]}>›</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

    </ScrollView>
  );
}

function AvatarCircle({ name, photo, size }: { name: string; photo: string | null; size: number }) {
  const radius = size / 2;
  if (photo) {
    return <Image source={{ uri: photo }} style={{ width: size, height: size, borderRadius: radius }} />;
  }
  return (
    <View style={{
      width: size, height: size, borderRadius: radius,
      backgroundColor: avatarColor(name),
      justifyContent: 'center', alignItems: 'center',
    }}>
      <Text style={{ fontSize: size * 0.38, fontWeight: '800', color: '#fff' }}>{name[0]}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: 20, gap: 28, paddingBottom: 48 },
  center: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
    backgroundColor: COLORS.background, padding: 32, gap: 12,
  },
  emptyEmoji: { fontSize: 72 },
  emptyText: { fontSize: 24, fontWeight: '900', color: COLORS.text },
  emptyHint: { fontSize: 16, color: COLORS.textLight, textAlign: 'center' },

  section: { gap: 16 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  sectionEmoji: { fontSize: 26 },
  sectionTitle: { fontSize: 22, fontWeight: '900', color: COLORS.text },

  // Unread bubbles
  bubblesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 24 },
  bubble: { alignItems: 'center', gap: 10 },
  bubbleRing: {
    width: 92, height: 92, borderRadius: 46,
    borderWidth: 3.5,
    justifyContent: 'center', alignItems: 'center',
    position: 'relative',
  },
  bubbleName: {
    fontSize: 15, fontWeight: '800',
    maxWidth: 92, textAlign: 'center',
  },
  unreadBadge: {
    position: 'absolute', top: -4, right: -4,
    backgroundColor: COLORS.error,
    borderRadius: 13, minWidth: 26, height: 26,
    justifyContent: 'center', alignItems: 'center',
    paddingHorizontal: 5,
    borderWidth: 2.5, borderColor: COLORS.background,
  },
  unreadBadgeText: { color: '#fff', fontSize: 13, fontWeight: '900' },

  // Recent — one card per person
  recentCard: {
    flexDirection: 'row', alignItems: 'center', gap: 16,
    borderRadius: 22, padding: 16,
    borderLeftWidth: 6,
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.07, shadowRadius: 10, elevation: 3,
  },
  recentInfo: { flex: 1 },
  recentName: { fontSize: 22, fontWeight: '900', color: COLORS.text },
  recentTime: { fontSize: 14, fontWeight: '600', marginTop: 4 },
  recentArrow: { fontSize: 28, fontWeight: '900' },
});
