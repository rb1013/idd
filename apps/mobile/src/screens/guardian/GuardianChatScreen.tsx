import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, FlatList, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator, Alert,
} from 'react-native';
import { Filter } from 'bad-words';
import wordConfig from '../../lib/badWordsList.json';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RouteProp, useRoute } from '@react-navigation/native';
import { useHeaderHeight } from '@react-navigation/elements';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/AuthContext';
import { GuardianNavParamList } from '../../navigation';
import {
  NICO, SPACING, RADIUS, SHADOW, FONT_SIZE, FONT_WEIGHT, scale,
} from '../../constants/theme';

type Route = RouteProp<GuardianNavParamList, 'GuardianChat'>;

interface GuardianMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  created_at: string;
}

export default function GuardianChatScreen() {
  const { guardian, session } = useAuth();
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const route = useRoute<Route>();
  const { conversationId } = route.params;

  const [messages, setMessages] = useState<GuardianMessage[]>([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  const wordFilter = useRef<Filter | null>(null);
  if (!wordFilter.current) {
    const f = new Filter();
    if (wordConfig.add.length) f.addWords(...wordConfig.add);
    if (wordConfig.remove.length) f.removeWords(...wordConfig.remove);
    wordFilter.current = f;
  }

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
    const stamp = () => supabase.rpc('mark_guardian_conversation_read', {
      p_conversation_id: conversationId,
      p_guardian_id: guardian.id,
    });
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
    if (wordFilter.current?.isProfane(trimmed)) {
      Alert.alert("Let's use kind words", 'That message contains language we can\'t send.');
      return;
    }

    setSending(true);
    setText('');

    // Layer 2: edge function validates against custom list then inserts
    const { data, error } = await supabase.functions.invoke('send-guardian-message', {
      body: { conversation_id: conversationId, content: trimmed },
      headers: { Authorization: `Bearer ${session?.access_token}` },
    });

    setSending(false);

    if (error || data?.error) {
      if (data?.error === 'blocked') {
        Alert.alert("Let's use kind words", 'That message contains language we can\'t send.');
      } else {
        let detail = data?.error ?? error?.message ?? 'Failed to send';
        try {
          const body = await (error as any)?.context?.json?.();
          if (body?.error) detail = `${body.error}${body.detail ? ': ' + body.detail : ''}`;
        } catch {}
        Alert.alert('Send error', detail);
      }
      setText(trimmed);
      return;
    }

    if (data?.message) {
      setMessages(prev => prev.some(m => m.id === data.message.id) ? prev : [...prev, data.message as GuardianMessage]);
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
