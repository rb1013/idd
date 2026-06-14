import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, FlatList, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { RouteProp, useRoute } from '@react-navigation/native';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/AuthContext';
import { COLORS } from '../../constants';
import { Message } from '../../types';
import { RootStackParamList } from '../../navigation';

type Route = RouteProp<RootStackParamList, 'Chat'>;

export default function ChatScreen() {
  const { activeUser } = useAuth();
  const route = useRoute<Route>();
  const { conversationId } = route.params;
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    fetchMessages();

    const channel = supabase
      .channel(`chat:${conversationId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `conversation_id=eq.${conversationId}`,
      }, payload => {
        setMessages(prev => [...prev, payload.new as Message]);
        setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [conversationId]);

  async function fetchMessages() {
    const { data } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });
    setMessages(data || []);
    setLoading(false);
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: false }), 100);
  }

  async function sendMessage() {
    const trimmed = text.trim();
    if (!trimmed) return;
    setText('');
    await supabase.from('messages').insert({
      conversation_id: conversationId,
      sender_id: activeUser!.id,
      content: trimmed,
    });
  }

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color={COLORS.primary} /></View>;

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => {
          const isMine = item.sender_id === activeUser!.id;
          return (
            <View style={[styles.bubble, isMine ? styles.bubbleMine : {}]}>
              <Text style={[styles.bubbleText, isMine && styles.bubbleTextMine]}>{item.content}</Text>
              <Text style={styles.timestamp}>
                {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </Text>
            </View>
          );
        }}
      />
      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          value={text}
          onChangeText={setText}
          placeholder="Type a message..."
          placeholderTextColor={COLORS.textLight}
          multiline
          maxLength={500}
        />
        <TouchableOpacity style={styles.sendBtn} onPress={sendMessage} disabled={!text.trim()}>
          <Text style={styles.sendBtnText}>Send</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  list: { padding: 16, gap: 8 },
  bubble: {
    maxWidth: '75%', padding: 12, borderRadius: 16,
    backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border,
    alignSelf: 'flex-start',
  },
  bubbleMine: {
    backgroundColor: COLORS.primary, borderColor: COLORS.primary, alignSelf: 'flex-end',
  },
  bubbleText: { fontSize: 16, color: COLORS.text },
  bubbleTextMine: { color: '#fff' },
  timestamp: { fontSize: 11, color: COLORS.textLight, marginTop: 4, alignSelf: 'flex-end' },
  inputRow: {
    flexDirection: 'row', alignItems: 'flex-end', padding: 12, gap: 8,
    backgroundColor: COLORS.surface, borderTopWidth: 1, borderTopColor: COLORS.border,
  },
  input: {
    flex: 1, backgroundColor: COLORS.background, borderWidth: 1, borderColor: COLORS.border,
    borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, fontSize: 16,
    color: COLORS.text, maxHeight: 120,
  },
  sendBtn: {
    backgroundColor: COLORS.primary, borderRadius: 20,
    paddingHorizontal: 18, paddingVertical: 10,
  },
  sendBtnText: { color: '#fff', fontWeight: '600', fontSize: 15 },
});
