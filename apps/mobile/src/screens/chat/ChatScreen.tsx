import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  View, Text, FlatList, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator,
  Alert, Image,
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
            <Text style={styles.headerSpeaker}>📢</Text>
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
                  <Text style={styles.speakMsgIcon}>📢</Text>
                </TouchableOpacity>
              </View>
              <Text style={[styles.timestamp, styles.timestampThem]}>{timeLabel}</Text>
            </View>
          );
        }}
      />

      {/* Bottom controls */}
      <View style={styles.bottom}>

        {/* Communication Board — prominent button */}
        <TouchableOpacity
          style={styles.boardBtn}
          onPress={() => setBoardVisible(true)}
          activeOpacity={0.8}
        >
          <Text style={styles.boardBtnIcon}>🗣️</Text>
          <Text style={styles.boardBtnLabel}>Communication Board</Text>
        </TouchableOpacity>

        {/* Text input */}
        <View style={styles.inputRow}>
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
  container: { flex: 1, backgroundColor: '#EFF6FF' },
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
    backgroundColor: '#FFF7ED', alignSelf: 'flex-start',
    borderBottomLeftRadius: 6,
    borderLeftWidth: 4, borderLeftColor: '#F97316',
    shadowColor: '#F97316', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1, shadowRadius: 4, elevation: 1,
  },
  bubbleMine: {
    backgroundColor: '#4F46E5', alignSelf: 'flex-end',
    borderBottomRightRadius: 6,
  },
  bubbleWrapThem: { alignSelf: 'flex-start', alignItems: 'flex-start', gap: 3 },
  bubbleWrapMine: { alignSelf: 'flex-end', alignItems: 'flex-end', gap: 3 },
  bubbleSpeakRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  speakMsgBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: '#EDE9FE',
    justifyContent: 'center', alignItems: 'center',
  },
  speakMsgIcon: { fontSize: 16 },
  bubbleText: { fontSize: 19, color: COLORS.text, lineHeight: 27 },
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

  // Symbol bubbles
  bubbleSymbol: { padding: 6, backgroundColor: 'transparent' },
  symbolBubbleImg: { width: 80, height: 80 },

  // Communication Board button — prominent
  boardBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 10, backgroundColor: '#8B5CF6',
    borderRadius: 20, paddingVertical: 16,
    shadowColor: '#8B5CF6', shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.4, shadowRadius: 14, elevation: 8,
  },
  boardBtnIcon: { fontSize: 28 },
  boardBtnLabel: { fontSize: 18, fontWeight: '900', color: '#fff', letterSpacing: 0.3 },

  // Input
  inputRow: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 10,
  },
  input: {
    flex: 1, backgroundColor: '#EEF2FF',
    borderWidth: 1.5, borderColor: '#C7D2FE',
    borderRadius: 22, paddingHorizontal: 16, paddingVertical: 10,
    fontSize: 16, color: COLORS.text, maxHeight: 100,
  },
  sendBtn: {
    width: 46, height: 46, borderRadius: 23,
    backgroundColor: '#4F46E5',
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#4F46E5', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35, shadowRadius: 8, elevation: 5,
  },
  sendBtnDisabled: { opacity: 0.4 },
  sendBtnIcon: { fontSize: 18, color: '#fff', marginLeft: 2 },
});
