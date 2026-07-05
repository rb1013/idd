import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  View, Text, FlatList, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator,
  Alert, ScrollView, Image,
} from 'react-native';
import * as Speech from 'expo-speech';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/AuthContext';
import { COLORS } from '../../constants';
import { Message } from '../../types';
import { UserStackParamList } from '../../navigation';
import CommunicationBoard from './CommunicationBoard';
import { isSymbolMessage } from '../../lib/aacSymbols';

type Route = RouteProp<UserStackParamList, 'Chat'>;

const QUICK_REPLIES = [
  { emoji: '👋', text: 'Hello! How are you?' },
  { emoji: '🤔', text: 'What are you doing?' },
  { emoji: '🎮', text: 'Want to play?' },
];

const REACTIONS = ['👍', '❌', '⏳', '👀'];

const MACROS = [
  'Yes 👍', 'No ❌', 'On my way 🏃', 'Talk later 📞', 'Received 📥', 'Running late ⏳',
];

const AVATAR_COLORS = ['#5CBB7A', '#9B59B6', '#F5A623', '#4A90E2', '#E53E3E', '#1ABC9C'];
function avatarColor(name: string) {
  return AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length];
}

export default function ChatScreen() {
  const { activeUser } = useAuth();
  const navigation = useNavigation<NativeStackNavigationProp<UserStackParamList>>();
  const route = useRoute<Route>();
  const { conversationId, participantName, participantPhoto } = route.params;

  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [friendLastSeen, setFriendLastSeen] = useState<string | null>(null);
  const [boardVisible, setBoardVisible] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  const isOnline = friendLastSeen
    ? Date.now() - new Date(friendLastSeen).getTime() < 5 * 60 * 1000
    : false;

  // Custom header: friend photo centred, tap speaks name
  useLayoutEffect(() => {
    navigation.setOptions({
      headerBackTitle: '',
      headerTitleAlign: 'center',
      headerTitle: () => (
        <TouchableOpacity
          style={styles.headerTitle}
          onPress={() => Speech.speak(participantName, { rate: 0.85, pitch: 1.0 })}
          activeOpacity={0.75}
        >
          <View style={styles.headerPhotoRow}>
            {participantPhoto
              ? <Image source={{ uri: participantPhoto }} style={styles.headerPhoto} />
              : (
                <View style={[styles.headerPhotoPlaceholder, { backgroundColor: avatarColor(participantName) }]}>
                  <Text style={styles.headerInitial}>{participantName[0]}</Text>
                </View>
              )
            }
            <Text style={styles.headerSpeaker}>🔊</Text>
          </View>
          <Text style={styles.headerName}>{participantName}</Text>
          {isOnline
            ? <Text style={styles.headerOnline}>● Online</Text>
            : <Text style={styles.headerHint}>Tap to hear</Text>
          }
        </TouchableOpacity>
      ),
    });
  }, [navigation, participantName, participantPhoto, isOnline]);

  // Fetch friend's last_seen_at for online status
  useEffect(() => {
    if (!activeUser) return;
    supabase
      .from('conversation_participants')
      .select('user_id, user_profiles!inner(last_seen_at)')
      .eq('conversation_id', conversationId)
      .neq('user_id', activeUser.id)
      .single()
      .then(({ data }) => {
        if (data) {
          const profile = data.user_profiles as any;
          setFriendLastSeen(profile?.last_seen_at ?? null);
        }
      });
  }, [conversationId, activeUser]);

  // Realtime subscription
  useEffect(() => {
    fetchMessages();
    const channel = supabase
      .channel(`chat:${conversationId}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'messages',
        filter: `conversation_id=eq.${conversationId}`,
      }, payload => {
        setMessages(prev => [...prev, payload.new as Message]);
        setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [conversationId]);

  // Mark read on enter and exit
  useEffect(() => {
    if (!activeUser) return;
    const stamp = () => supabase.rpc('mark_conversation_read', {
      p_conversation_id: conversationId,
      p_user_id: activeUser.id,
    });
    stamp();
    return () => { stamp(); };
  }, [conversationId, activeUser]);

  async function fetchMessages() {
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });
    if (error) Alert.alert('Load error', error.message);
    setMessages(data || []);
    setLoading(false);
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: false }), 100);
  }

  async function sendMessage(content: string, fromInput = false) {
    const trimmed = content.trim();
    if (!trimmed || !activeUser) return;
    if (fromInput) setText('');

    const { data, error } = await supabase
      .from('messages')
      .insert({ conversation_id: conversationId, sender_id: activeUser.id, content: trimmed })
      .select()
      .single();

    if (error) {
      Alert.alert('Send error', error.message);
      if (fromInput) setText(trimmed);
      return;
    }
    if (data) {
      setMessages(prev => prev.some(m => m.id === data.id) ? prev : [...prev, data as Message]);
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color={COLORS.primary} /></View>;
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}
    >
      {/* Messages list */}
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => {
          const isMine = item.sender_id === activeUser!.id;
          const timeLabel = new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          const isSymbol = isSymbolMessage(item.content);

          if (isMine) {
            return (
              <View style={styles.bubbleWrapMine}>
                <View style={[styles.bubble, styles.bubbleMine, isSymbol && styles.bubbleSymbol]}>
                  {isSymbol
                    ? <Image source={{ uri: item.content }} style={styles.symbolBubbleImg} resizeMode="contain" />
                    : <Text style={[styles.bubbleText, styles.bubbleTextMine]}>{item.content}</Text>
                  }
                </View>
                <Text style={[styles.timestamp, styles.timestampMine]}>{timeLabel}</Text>
              </View>
            );
          }
          return (
            <View style={styles.bubbleWrapThem}>
              <View style={styles.bubbleSpeakRow}>
                <View style={[styles.bubble, styles.bubbleThem, isSymbol && styles.bubbleSymbol]}>
                  {isSymbol
                    ? <Image source={{ uri: item.content }} style={styles.symbolBubbleImg} resizeMode="contain" />
                    : <Text style={styles.bubbleText}>{item.content}</Text>
                  }
                </View>
                <TouchableOpacity
                  style={styles.speakMsgBtn}
                  onPress={() => Speech.speak(isSymbol ? item.content.split('/').pop()?.split('.')[0]?.replace(/_/g, ' ') ?? '' : item.content, { rate: 0.85, pitch: 1.0 })}
                  activeOpacity={0.7}
                >
                  <Text style={styles.speakMsgIcon}>🔊</Text>
                </TouchableOpacity>
              </View>
              <Text style={[styles.timestamp, styles.timestampThem]}>{timeLabel}</Text>
            </View>
          );
        }}
      />

      {/* Bottom controls */}
      <View style={styles.bottom}>

        {/* 3 quick-reply sentence buttons */}
        <View style={styles.quickReplies}>
          {QUICK_REPLIES.map(q => (
            <TouchableOpacity
              key={q.text}
              style={styles.quickReplyBtn}
              onPress={() => sendMessage(`${q.emoji} ${q.text}`)}
              activeOpacity={0.75}
            >
              <Text style={styles.quickReplyEmoji}>{q.emoji}</Text>
              <Text style={styles.quickReplyText}>{q.text}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Emoji reaction tray */}
        <View style={styles.reactionRow}>
          <Text style={styles.reactionLabel}>REACT</Text>
          {REACTIONS.map(r => (
            <TouchableOpacity
              key={r}
              style={styles.reactionBtn}
              onPress={() => sendMessage(r)}
              activeOpacity={0.7}
            >
              <Text style={styles.reactionEmoji}>{r}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Macro chip row */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.macroScroll}
          contentContainerStyle={styles.macroContent}
        >
          {MACROS.map(m => (
            <TouchableOpacity
              key={m}
              style={styles.macroChip}
              onPress={() => sendMessage(m)}
              activeOpacity={0.75}
            >
              <Text style={styles.macroText}>{m}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Text input */}
        <View style={styles.inputRow}>
          <TouchableOpacity
            style={styles.boardBtn}
            onPress={() => setBoardVisible(true)}
            activeOpacity={0.75}
          >
            <Text style={styles.boardBtnIcon}>🗣️</Text>
          </TouchableOpacity>
          <TextInput
            style={styles.input}
            value={text}
            onChangeText={setText}
            placeholder="Type a message…"
            placeholderTextColor={COLORS.textLight}
            multiline
            maxLength={500}
          />
          <TouchableOpacity
            style={[styles.sendBtn, !text.trim() && styles.sendBtnDisabled]}
            onPress={() => sendMessage(text, true)}
            disabled={!text.trim()}
          >
            <Text style={styles.sendBtnIcon}>➤</Text>
          </TouchableOpacity>
        </View>

      </View>

      <CommunicationBoard
        visible={boardVisible}
        onClose={() => setBoardVisible(false)}
        onSend={(imageUrl) => sendMessage(imageUrl)}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  // Header
  headerTitle: { flexDirection: 'column', alignItems: 'center', gap: 2 },
  headerPhotoRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  headerPhoto: { width: 50, height: 50, borderRadius: 25, borderWidth: 2.5, borderColor: COLORS.primary },
  headerPhotoPlaceholder: {
    width: 50, height: 50, borderRadius: 25,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 2.5, borderColor: COLORS.primary,
  },
  headerInitial: { fontSize: 20, fontWeight: '800', color: '#fff' },
  headerSpeaker: { fontSize: 20 },
  headerName: { fontSize: 15, fontWeight: '800', color: COLORS.primary },
  headerHint: { fontSize: 10, color: COLORS.textLight },
  headerOnline: { fontSize: 11, fontWeight: '700', color: '#16A34A' },

  // Messages
  list: { padding: 16, gap: 6, paddingBottom: 8 },
  bubble: {
    maxWidth: '75%', padding: 12, borderRadius: 20,
  },
  bubbleThem: {
    backgroundColor: COLORS.surface, alignSelf: 'flex-start',
    borderBottomLeftRadius: 6,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 4, elevation: 1,
  },
  bubbleMine: {
    backgroundColor: COLORS.primary, alignSelf: 'flex-end',
    borderBottomRightRadius: 6,
  },
  bubbleWrapThem: { alignSelf: 'flex-start', alignItems: 'flex-start', gap: 3 },
  bubbleWrapMine: { alignSelf: 'flex-end', alignItems: 'flex-end', gap: 3 },
  bubbleSpeakRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  speakMsgBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center', alignItems: 'center',
  },
  speakMsgIcon: { fontSize: 16 },
  bubbleText: { fontSize: 16, color: COLORS.text, lineHeight: 22 },
  bubbleTextMine: { color: '#fff' },
  timestamp: { fontSize: 11 },
  timestampThem: { color: COLORS.textLight, marginLeft: 6 },
  timestampMine: { color: COLORS.textLight, marginRight: 6 },

  // Bottom panel
  bottom: {
    backgroundColor: COLORS.surface,
    borderTopWidth: 1, borderTopColor: COLORS.border,
    paddingTop: 10, paddingBottom: Platform.OS === 'ios' ? 24 : 14,
    paddingHorizontal: 12,
    gap: 10,
  },

  // Quick replies
  quickReplies: { gap: 7 },
  quickReplyBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: COLORS.primaryLight,
    borderWidth: 1.5, borderColor: COLORS.primary,
    borderRadius: 16, paddingVertical: 11, paddingHorizontal: 14,
  },
  quickReplyEmoji: { fontSize: 20 },
  quickReplyText: { fontSize: 15, fontWeight: '700', color: '#1D4ED8' },

  // Reaction tray
  reactionRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
  },
  reactionLabel: {
    fontSize: 10, fontWeight: '800', color: COLORS.textLight,
    letterSpacing: 0.8, width: 40,
  },
  reactionBtn: {
    width: 46, height: 46, borderRadius: 23,
    backgroundColor: '#F0F4F8',
    borderWidth: 1.5, borderColor: COLORS.border,
    justifyContent: 'center', alignItems: 'center',
  },
  reactionEmoji: { fontSize: 22 },

  // Macros
  macroScroll: { flexGrow: 0 },
  macroContent: { gap: 8, paddingHorizontal: 2 },
  macroChip: {
    backgroundColor: '#F0F4F8',
    borderWidth: 1.5, borderColor: COLORS.border,
    borderRadius: 20, paddingVertical: 8, paddingHorizontal: 14,
  },
  macroText: { fontSize: 14, fontWeight: '600', color: COLORS.text },

  // Symbol bubbles
  bubbleSymbol: { padding: 6, backgroundColor: 'transparent' },
  symbolBubbleImg: { width: 80, height: 80 },

  // Input
  inputRow: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 10,
  },
  boardBtn: {
    width: 46, height: 46, borderRadius: 23,
    backgroundColor: '#EFF6FF',
    borderWidth: 1.5, borderColor: COLORS.primary,
    justifyContent: 'center', alignItems: 'center',
  },
  boardBtnIcon: { fontSize: 22 },
  input: {
    flex: 1, backgroundColor: '#F0F4F8',
    borderWidth: 1.5, borderColor: COLORS.border,
    borderRadius: 22, paddingHorizontal: 16, paddingVertical: 10,
    fontSize: 16, color: COLORS.text, maxHeight: 100,
  },
  sendBtn: {
    width: 46, height: 46, borderRadius: 23,
    backgroundColor: COLORS.primary,
    justifyContent: 'center', alignItems: 'center',
    shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35, shadowRadius: 8, elevation: 5,
  },
  sendBtnDisabled: { opacity: 0.4 },
  sendBtnIcon: { fontSize: 18, color: '#fff', marginLeft: 2 },
});
