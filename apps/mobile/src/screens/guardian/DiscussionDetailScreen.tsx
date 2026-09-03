import React, { useCallback, useRef, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  TextInput, KeyboardAvoidingView, Platform, ActivityIndicator, Alert,
} from 'react-native';
import AppText from '../../components/AppText';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useHeaderHeight } from '@react-navigation/elements';
import { useFocusEffect, useRoute, RouteProp } from '@react-navigation/native';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/AuthContext';
import { COLORS } from '../../constants';
import { GuardianNavParamList } from '../../navigation';

type Route = RouteProp<GuardianNavParamList, 'DiscussionDetail'>;

const AVATAR_COLORS = [COLORS.statusRed, COLORS.statusPurple, COLORS.statusTeal, COLORS.statusAmber, COLORS.statusBlue, COLORS.statusPink];

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

interface Post  { id: string; title: string; body: string; guardianName: string; createdAt: string }
interface Reply { id: string; content: string; guardianName: string; guardianId: string; createdAt: string }

export default function DiscussionDetailScreen() {
  const route   = useRoute<Route>();
  const { postId } = route.params;
  const { guardian } = useAuth();
  const insets     = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();

  const [post, setPost]         = useState<Post | null>(null);
  const [replies, setReplies]   = useState<Reply[]>([]);
  const [loading, setLoading]   = useState(true);
  const [replyText, setReplyText] = useState('');
  const [sending, setSending]   = useState(false);
  const listRef = useRef<FlatList>(null);

  useFocusEffect(useCallback(() => { load(); }, [postId]));

  async function load() {
    setLoading(true);
    const [{ data: p }, { data: r }] = await Promise.all([
      supabase
        .from('discussion_posts')
        .select('id, title, body, created_at, guardians(full_name)')
        .eq('id', postId)
        .single(),
      supabase
        .from('discussion_replies')
        .select('id, content, created_at, guardian_id, guardians(full_name)')
        .eq('post_id', postId)
        .order('created_at', { ascending: true }),
    ]);

    if (p) setPost({ id: p.id, title: p.title, body: p.body, guardianName: p.guardians?.full_name ?? 'Unknown', createdAt: p.created_at });
    setReplies((r ?? []).map((x: any) => ({ id: x.id, content: x.content, guardianName: x.guardians?.full_name ?? 'Unknown', guardianId: x.guardian_id, createdAt: x.created_at })));
    setLoading(false);
  }

  async function submitReply() {
    if (!replyText.trim() || !guardian) return;
    setSending(true);
    const { error } = await supabase.from('discussion_replies').insert({
      post_id: postId,
      guardian_id: guardian.id,
      content: replyText.trim(),
    });
    if (error) {
      Alert.alert('Error', error.message);
    } else {
      setReplyText('');
      await load();
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    }
    setSending(false);
  }

  if (loading) {
    return <View style={s.center}><ActivityIndicator size="large" color={COLORS.bloomAccent} /></View>;
  }

  return (
    <KeyboardAvoidingView
      style={s.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={headerHeight}
    >
      <FlatList
        ref={listRef}
        data={replies}
        keyExtractor={r => r.id}
        contentContainerStyle={s.list}
        ListHeaderComponent={
          post ? (
            <View style={s.postCard}>
              <AppText style={s.postTitle}>{post.title}</AppText>
              <AppText style={s.postBody}>{post.body}</AppText>
              <AppText style={s.postMeta}>{post.guardianName} · {timeAgo(post.createdAt)}</AppText>
              {replies.length > 0 && (
                <AppText style={s.repliesHeader}>
                  {replies.length} {replies.length === 1 ? 'Reply' : 'Replies'}
                </AppText>
              )}
            </View>
          ) : null
        }
        ListEmptyComponent={
          <View style={s.noReplies}>
            <AppText style={s.noRepliesText}>No replies yet — be the first!</AppText>
          </View>
        }
        renderItem={({ item: r }) => {
          const color = AVATAR_COLORS[r.guardianName.charCodeAt(0) % AVATAR_COLORS.length];
          const isMe  = r.guardianId === guardian?.id;
          return (
            <View style={[s.replyRow, isMe && s.replyRowMe]}>
              <View style={[s.replyAvatar, { backgroundColor: color }]}>
                <AppText style={s.replyAvatarText}>{r.guardianName[0]?.toUpperCase()}</AppText>
              </View>
              <View style={[s.bubble, isMe && s.bubbleMe]}>
                <AppText style={[s.bubbleAuthor, isMe && s.bubbleAuthorMe]}>
                  {isMe ? 'You' : r.guardianName}
                </AppText>
                <AppText style={[s.bubbleContent, isMe && s.bubbleContentMe]}>{r.content}</AppText>
                <AppText style={[s.bubbleTime, isMe && s.bubbleTimeMe]}>{timeAgo(r.createdAt)}</AppText>
              </View>
            </View>
          );
        }}
      />

      <View style={s.replyBar(insets.bottom)}>
        <TextInput
          style={s.replyInput}
          value={replyText}
          onChangeText={setReplyText}
          placeholder="Write a reply…"
          placeholderTextColor={COLORS.bloomMuted}
          returnKeyType="send"
          submitBehavior="submit"
          onSubmitEditing={submitReply}
          maxLength={500}
        />
        <TouchableOpacity
          style={[s.sendBtn, (!replyText.trim() || sending) && { opacity: 0.4 }]}
          onPress={submitReply}
          disabled={!replyText.trim() || sending}
        >
          {sending
            ? <ActivityIndicator size="small" color="#fff" />
            : <AppText style={s.sendBtnText}>↑</AppText>
          }
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  root:   { flex: 1, backgroundColor: COLORS.bloomBody },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  list:   { padding: 16, paddingBottom: 12, gap: 10 },

  postCard: {
    backgroundColor: COLORS.bloomCard, borderRadius: 20, padding: 20, gap: 8, marginBottom: 8,
    borderWidth: 1, borderColor: COLORS.bloomBorder,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },
  postTitle:     { fontSize: 20, fontWeight: '900', color: COLORS.bloomText },
  postBody:      { fontSize: 15, color: COLORS.bloomText, lineHeight: 22 },
  postMeta:      { fontSize: 12, color: COLORS.bloomMuted, marginTop: 4 },
  repliesHeader: { fontSize: 11, fontWeight: '800', color: COLORS.bloomMuted, letterSpacing: 0.8, marginTop: 8, textTransform: 'uppercase' },

  replyRow:   { flexDirection: 'row', gap: 10, alignItems: 'flex-end' },
  replyRowMe: { flexDirection: 'row-reverse' },

  replyAvatar: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  replyAvatarText: { fontSize: 12, fontWeight: '800', color: '#fff' },

  bubble: {
    flex: 1, maxWidth: '80%', backgroundColor: COLORS.bloomCard,
    borderRadius: 16, borderBottomLeftRadius: 4, padding: 12, gap: 3,
    borderWidth: 1, borderColor: COLORS.bloomBorder,
  },
  bubbleMe:          { backgroundColor: COLORS.bloomAccent, borderBottomLeftRadius: 16, borderBottomRightRadius: 4, borderColor: COLORS.bloomAccent },
  bubbleAuthor:      { fontSize: 11, fontWeight: '700', color: COLORS.bloomAccent },
  bubbleAuthorMe:    { color: 'rgba(255,255,255,0.65)' },
  bubbleContent:     { fontSize: 14, color: COLORS.bloomText, lineHeight: 20 },
  bubbleContentMe:   { color: COLORS.bloomOnAccent },
  bubbleTime:        { fontSize: 10, color: COLORS.bloomMuted, marginTop: 2 },
  bubbleTimeMe:      { color: 'rgba(255,255,255,0.55)' },

  noReplies:     { alignItems: 'center', paddingTop: 24 },
  noRepliesText: { fontSize: 14, color: COLORS.bloomMuted, fontStyle: 'italic' },

  replyBar: (bottomInset: number) => ({
    flexDirection: 'row', alignItems: 'flex-end', gap: 10,
    padding: 12, paddingBottom: Math.max(bottomInset + 8, 16),
    backgroundColor: COLORS.bloomCard,
    borderTopWidth: 1, borderTopColor: COLORS.bloomBorder,
  }),
  replyInput: {
    flex: 1, backgroundColor: COLORS.bloomBody, borderRadius: 20,
    borderWidth: 1.5, borderColor: COLORS.bloomBorder,
    paddingHorizontal: 16, paddingVertical: 10,
    fontSize: 15, color: COLORS.bloomText, maxHeight: 120,
  },
  sendBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: COLORS.bloomAccent, justifyContent: 'center', alignItems: 'center',
  },
  sendBtnText: { color: COLORS.bloomOnAccent, fontSize: 18, fontWeight: '700' },
});
