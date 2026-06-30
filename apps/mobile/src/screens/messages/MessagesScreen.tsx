import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Image, ActivityIndicator, Alert,
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

export default function MessagesScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<UserStackParamList>>();
  const { activeUser } = useAuth();
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!activeUser) return;
    const { data } = await supabase.rpc('get_user_conversations', { p_user_id: activeUser.id });
    const filtered = (data || []).filter((c: ConversationItem) => c.unread_count > 0 && c.last_message);
    setConversations(filtered);
    setLoading(false);
  }, [activeUser]);

  useEffect(() => {
    load();
    const unsubscribe = navigation.addListener('focus', load);
    return unsubscribe;
  }, [navigation, load]);

  function openChat(item: ConversationItem) {
    // Remove from unread list immediately so count clears on return
    setConversations(prev => prev.filter(c => c.conversation_id !== item.conversation_id));
    if (activeUser) {
      supabase.rpc('mark_conversation_read', {
        p_conversation_id: item.conversation_id,
        p_user_id: activeUser.id,
      });
    }
    navigation.navigate('Chat', {
      conversationId: item.conversation_id,
      participantName: item.friend_name,
    });
  }

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color={COLORS.accent} /></View>;
  }

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
    <FlatList
      data={conversations}
      keyExtractor={item => item.conversation_id}
      contentContainerStyle={styles.list}
      renderItem={({ item }) => (
        <View style={[styles.card, item.unread_count > 0 && styles.cardUnread]}>
          <View style={styles.avatarWrapper}>
            {item.friend_photo
              ? <Image source={{ uri: item.friend_photo }} style={styles.avatar} />
              : (
                <View style={styles.avatarPlaceholder}>
                  <Text style={styles.avatarInitial}>{item.friend_name[0]}</Text>
                </View>
              )
            }
            {item.unread_count > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{item.unread_count}</Text>
              </View>
            )}
          </View>

          <View style={styles.info}>
            <Text style={styles.name}>{item.friend_name}</Text>
            {item.last_message ? (
              <Text
                style={[styles.preview, item.unread_count > 0 && styles.previewUnread]}
                numberOfLines={1}
              >
                {item.last_message}
              </Text>
            ) : (
              <Text style={styles.preview}>No messages yet</Text>
            )}
          </View>

          <TouchableOpacity style={styles.readBtn} onPress={() => openChat(item)} activeOpacity={0.85}>
            <Text style={styles.readBtnText}>Read</Text>
          </TouchableOpacity>
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
    backgroundColor: COLORS.background, padding: 32,
  },
  emptyEmoji: { fontSize: 64, marginBottom: 16 },
  emptyText: { fontSize: 22, fontWeight: '700', color: COLORS.text, marginBottom: 8 },
  emptyHint: { fontSize: 15, color: COLORS.textLight, textAlign: 'center' },

  list: { padding: 20, gap: 12 },

  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    padding: 16,
    gap: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  cardUnread: {
    borderColor: COLORS.accent,
  },

  avatarWrapper: { position: 'relative' },
  avatar: { width: 60, height: 60, borderRadius: 30 },
  avatarPlaceholder: {
    width: 60, height: 60, borderRadius: 30,
    backgroundColor: COLORS.accentLight,
    justifyContent: 'center', alignItems: 'center',
  },
  avatarInitial: { fontSize: 24, fontWeight: '700', color: COLORS.accent },

  badge: {
    position: 'absolute', top: -4, right: -4,
    backgroundColor: COLORS.accent,
    borderRadius: 11, minWidth: 22, height: 22,
    justifyContent: 'center', alignItems: 'center',
    paddingHorizontal: 5,
    borderWidth: 2, borderColor: COLORS.surface,
  },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '800' },

  info: { flex: 1 },
  name: { fontSize: 18, fontWeight: '700', color: COLORS.text, marginBottom: 4 },
  preview: { fontSize: 14, color: COLORS.textLight },
  previewUnread: { color: COLORS.text, fontWeight: '600' },

  readBtn: {
    backgroundColor: COLORS.accent,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  readBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
