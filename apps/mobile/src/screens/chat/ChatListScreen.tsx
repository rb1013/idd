import React, { useEffect, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  Image, ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/AuthContext';
import { COLORS } from '../../constants';
import { Conversation } from '../../types';
import { UserStackParamList } from '../../navigation';

type Nav = NativeStackNavigationProp<UserStackParamList>;

export default function ChatListScreen() {
  const { activeUser } = useAuth();
  const navigation = useNavigation<Nav>();
  const [conversations, setConversations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (activeUser) fetchConversations();
  }, [activeUser]);

  async function fetchConversations() {
    const { data } = await supabase
      .from('conversation_participants')
      .select(`
        conversation_id,
        conversations (
          id, created_at,
          messages (id, content, created_at, sender_id)
        )
      `)
      .eq('user_id', activeUser!.id);

    if (!data) { setLoading(false); return; }

    // Fetch the other participant's profile for each conversation
    const enriched = await Promise.all(data.map(async (row: any) => {
      const { data: otherParticipants } = await supabase
        .from('conversation_participants')
        .select('user_id, user_profiles(name, photo_url)')
        .eq('conversation_id', row.conversation_id)
        .neq('user_id', activeUser!.id);

      const other = otherParticipants?.[0];
      const messages = row.conversations?.messages || [];
      const lastMessage = messages.sort((a: any, b: any) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )[0];

      return {
        id: row.conversation_id,
        otherUser: (other as any)?.user_profiles,
        lastMessage,
      };
    }));

    setConversations(enriched.filter(c => c.otherUser));
    setLoading(false);
  }

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color={COLORS.primary} /></View>;

  return (
    <View style={styles.container}>
      <FlatList
        data={conversations}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.row}
            onPress={() => navigation.navigate('Chat', { conversationId: item.id, participantName: item.otherUser.name })}
          >
            {item.otherUser?.photo_url
              ? <Image source={{ uri: item.otherUser.photo_url }} style={styles.avatar} />
              : <View style={styles.avatarPlaceholder}><Text style={styles.avatarInitial}>{item.otherUser?.name?.[0]}</Text></View>
            }
            <View style={styles.info}>
              <Text style={styles.name}>{item.otherUser?.name}</Text>
              <Text style={styles.preview} numberOfLines={1}>{item.lastMessage?.content || 'Start a conversation!'}</Text>
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <Text style={styles.empty}>No conversations yet.{'\n'}Connect with someone to start chatting!</Text>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  list: { padding: 16, gap: 4 },
  row: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.surface, borderRadius: 14,
    padding: 14, borderWidth: 1, borderColor: COLORS.border, marginBottom: 8,
  },
  avatar: { width: 50, height: 50, borderRadius: 25 },
  avatarPlaceholder: {
    width: 50, height: 50, borderRadius: 25,
    backgroundColor: COLORS.primaryLight, justifyContent: 'center', alignItems: 'center',
  },
  avatarInitial: { fontSize: 20, fontWeight: '700', color: COLORS.primary },
  info: { flex: 1, marginLeft: 14 },
  name: { fontSize: 16, fontWeight: '600', color: COLORS.text },
  preview: { fontSize: 14, color: COLORS.textLight, marginTop: 2 },
  empty: { textAlign: 'center', color: COLORS.textLight, marginTop: 60, fontSize: 15, lineHeight: 24 },
});
