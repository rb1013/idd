import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  View, Text, FlatList, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator, Alert,
} from 'react-native';
import { containsProfanity, isBlockedWordsError, showKindWordsAlert } from '../../lib/contentFilter';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useHeaderHeight } from '@react-navigation/elements';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/AuthContext';
import { GuardianNavParamList } from '../../navigation';
import RainbowDivider from '../../components/RainbowDivider';
import ReportFlag from '../../components/ReportFlag';
import BlockButton from '../../components/BlockButton';
import useNicoHeader from '../../hooks/useNicoHeader';
import {
  NICO, SPACING, RADIUS, SHADOW, FONT_SIZE, FONT_WEIGHT, scale,
} from '../../constants/theme';

type Route = RouteProp<GuardianNavParamList, 'GuardianChat'>;
type Nav = NativeStackNavigationProp<GuardianNavParamList>;

interface GuardianMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  created_at: string;
}

export default function GuardianChatScreen() {
  const { guardian } = useAuth();
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const { conversationId, participantId, participantName } = route.params;

  useNicoHeader(navigation);

  // 🚩 🚫 in the header act on the OTHER guardian in this conversation (never yourself).
  // After blocking, leave the chat — the conversation is now hidden for both.
  useLayoutEffect(() => {
    const actions = (
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginRight: SPACING.xs }}>
        <ReportFlag target={{ area: 'guardian_chat', conversationId }} />
        {!!participantId && (
          <BlockButton guardianId={participantId} guardianName={participantName} onBlocked={() => navigation.goBack()} />
        )}
      </View>
    );
    navigation.setOptions({
      headerRight: () => actions,
      // iOS 26 wraps custom headerRight elements in a "Liquid Glass" pill by default —
      // hidesSharedBackground turns that off so only our own element renders.
      unstable_headerRightItems: () => [
        { type: 'custom', element: actions, hidesSharedBackground: true },
      ],
    });
  }, [navigation, conversationId, participantId, participantName]);

  const [messages, setMessages] = useState<GuardianMessage[]>([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const flatListRef = useRef<FlatList>(null);


  useEffect(() => {
    fetchMessages();
    const channel = supabase
      .channel(`guardian-chat:${conversationId}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'guardian_messages',
        filter: `conversation_id=eq.${conversationId}`,
      }, payload => {
        setMessages(prev => prev.some(m => m.id === (payload.new as GuardianMessage).id)
          ? prev
          : [...prev, payload.new as GuardianMessage]);
        setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [conversationId]);

  // Mark read on enter and exit
  useEffect(() => {
    if (!guardian) return;
    // supabase-js queries are lazy: without .then()/await the request is never sent, which is why
    // last_read_at never moved and the Connections unread badge kept coming back.
    const stamp = () => {
      supabase.rpc('mark_guardian_conversation_read', {
        p_conversation_id: conversationId,
        p_guardian_id: guardian.id,
      }).then(({ data, error }) => {
        if (error) console.warn('mark_guardian_conversation_read failed:', error.message);
        else if (data === 0) console.warn('mark_guardian_conversation_read matched no row', conversationId);
      });
    };
    stamp();
    return () => { stamp(); };
  }, [conversationId, guardian]);

  async function fetchMessages() {
    const { data, error } = await supabase
      .from('guardian_messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });
    if (error) Alert.alert('Load error', error.message);
    setMessages(data || []);
    setLoading(false);
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: false }), 100);
  }

  async function sendMessage() {
    const trimmed = text.trim();
    if (!trimmed || !guardian) return;

    // Layer 1: client-side profanity check
    if (containsProfanity(trimmed)) {
      showKindWordsAlert('message');
      return;
    }

    setSending(true);
    setText('');

    // Direct insert (migration 099): the database checks sender, participant, guardian block and
    // blocked words (layer 2) — replaces the send-guardian-message edge function (6 sequential steps)
    const { data, error } = await supabase
      .from('guardian_messages')
      .insert({ conversation_id: conversationId, sender_id: guardian.id, content: trimmed })
      .select()
      .single();

    setSending(false);

    if (error) {
      if (isBlockedWordsError(error)) {
        showKindWordsAlert('message');
      } else if (error.code === '42501') {
        // Refused by the insert rule: a guardian block (either way) or no longer in this chat.
        // Don't reveal which — show a neutral message.
        Alert.alert("Couldn't send message", 'This conversation is no longer available.');
      } else {
        Alert.alert('Send error', error.message);
      }
      setText(trimmed);
      return;
    }

    if (data) {
      setMessages(prev => prev.some(m => m.id === data.id) ? prev : [...prev, data as GuardianMessage]);
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color={NICO.primary} /></View>;
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={headerHeight}
    >
      <RainbowDivider />

      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item }) => {
          const isMine = item.sender_id === guardian!.id;
          const timeLabel = new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          return (
            <View style={isMine ? styles.bubbleWrapMine : styles.bubbleWrapThem}>
              <View style={[styles.bubble, isMine ? styles.bubbleMine : styles.bubbleThem]}>
                <Text style={styles.bubbleText}>{item.content}</Text>
              </View>
              <Text style={[styles.timestamp, isMine ? styles.timestampMine : styles.timestampThem]}>{timeLabel}</Text>
            </View>
          );
        }}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No messages yet — say hello!</Text>
          </View>
        }
      />

      <View style={[styles.bottom, { paddingBottom: Math.max(insets.bottom + 8, 16) }]}>
        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            value={text}
            onChangeText={setText}
            placeholder="Type a message…"
            placeholderTextColor={NICO.textMuted}
            returnKeyType="send"
            onSubmitEditing={sendMessage}
            submitBehavior="submit"
            multiline
            maxLength={500}
          />
          <TouchableOpacity
            style={[styles.sendBtn, (!text.trim() || sending) && styles.sendBtnDisabled]}
            onPress={sendMessage}
            disabled={!text.trim() || sending}
          >
            {sending ? <ActivityIndicator color={NICO.textOnAccent} /> : <Text style={styles.sendBtnIcon}>➤</Text>}
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: NICO.screenBg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: NICO.screenBg },

  list: { padding: SPACING.base, gap: SPACING.xs, paddingBottom: SPACING.sm, flexGrow: 1 },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: scale(80) },
  emptyText: { fontSize: FONT_SIZE.md, color: NICO.textMuted },

  bubble: { maxWidth: '75%', padding: SPACING.md, borderRadius: RADIUS.xl },
  bubbleThem: {
    backgroundColor: NICO.chatBubbleOther, alignSelf: 'flex-start',
    borderBottomLeftRadius: 6, ...SHADOW.sm,
  },
  bubbleMine: {
    backgroundColor: NICO.chatBubbleMe, alignSelf: 'flex-end',
    borderBottomRightRadius: 6, ...SHADOW.sm,
  },
  bubbleWrapThem: { alignSelf: 'flex-start', alignItems: 'flex-start', gap: 3 },
  bubbleWrapMine: { alignSelf: 'flex-end', alignItems: 'flex-end', gap: 3 },
  bubbleText: { fontSize: FONT_SIZE.lg, color: NICO.text, lineHeight: 22 },
  timestamp: { fontSize: FONT_SIZE.xs, color: NICO.textMuted },
  timestampThem: { marginLeft: 6 },
  timestampMine: { marginRight: 6 },

  bottom: {
    backgroundColor: NICO.surface,
    borderTopWidth: 1, borderTopColor: NICO.border,
    paddingTop: SPACING.sm, paddingHorizontal: SPACING.md,
  },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: SPACING.sm },
  input: {
    flex: 1, backgroundColor: NICO.primaryLight,
    borderWidth: 1.5, borderColor: NICO.border,
    borderRadius: RADIUS['2xl'], paddingHorizontal: SPACING.base, paddingVertical: SPACING.md,
    fontSize: FONT_SIZE.lg, color: NICO.text, maxHeight: 100,
  },
  sendBtn: {
    width: scale(46), height: scale(46), borderRadius: scale(23),
    backgroundColor: NICO.primary,
    justifyContent: 'center', alignItems: 'center',
    ...SHADOW.btnPrimary,
  },
  sendBtnDisabled: { opacity: 0.4 },
  sendBtnIcon: { fontSize: FONT_SIZE['2xl'], color: NICO.textOnAccent, marginLeft: 2 },
});
