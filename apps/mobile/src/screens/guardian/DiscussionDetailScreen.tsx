import React, { useCallback, useRef, useState } from 'react';
import {
  View, FlatList, TouchableOpacity, StyleSheet,
  TextInput, KeyboardAvoidingView, Platform, ActivityIndicator, Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import AppText from '../../components/AppText';
import RainbowDivider from '../../components/RainbowDivider';
import useNicoHeader from '../../hooks/useNicoHeader';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useHeaderHeight } from '@react-navigation/elements';
import { useFocusEffect, useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/AuthContext';
import { GuardianNavParamList } from '../../navigation';
import {
  NICO, TEXT_STYLE, SPACING, RADIUS, SHADOW, FONT_SIZE, FONT_WEIGHT,
  BUTTERFLY_BORDER, scale,
} from '../../constants/theme';

type Route = RouteProp<GuardianNavParamList, 'DiscussionDetail'>;

const AVATAR_PALETTE = ['#38BDF8', '#818CF8', '#C084FC', '#FB923C', '#34D399', '#FBBF24'];

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1)  return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7)  return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

interface Post  { id: string; title: string; body: string; guardianName: string; createdAt: string }
interface Reply { id: string; content: string; guardianName: string; guardianId: string; createdAt: string }

export default function DiscussionDetailScreen() {
  const navigation = useNavigation();
  const route      = useRoute<Route>();
  const { postId } = route.params;
  const { guardian } = useAuth();
  const insets       = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();

  const [post, setPost]         = useState<Post | null>(null);
  const [replies, setReplies]   = useState<Reply[]>([]);
  const [loading, setLoading]   = useState(true);
  const [replyText, setReplyText] = useState('');
  const [sending, setSending]   = useState(false);
  const listRef = useRef<FlatList>(null);

  useNicoHeader(navigation);
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
    return <View style={s.center}><ActivityIndicator size="large" color={NICO.primary} /></View>;
  }

  return (
    <KeyboardAvoidingView
      style={s.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={headerHeight}
    >
      <RainbowDivider />

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
          const color = AVATAR_PALETTE[r.guardianName.charCodeAt(0) % AVATAR_PALETTE.length];
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

      {/* Reply bar */}
      <View style={[s.replyBar, { paddingBottom: Math.max(insets.bottom + 8, 16) }]}>
        <LinearGradient
          colors={[...BUTTERFLY_BORDER.colors]}
          start={BUTTERFLY_BORDER.start}
          end={BUTTERFLY_BORDER.end}
          style={s.replyInputGradient}
        >
          <TextInput
            style={s.replyInput}
            value={replyText}
            onChangeText={setReplyText}
            placeholder="Write a reply…"
            placeholderTextColor={NICO.textMuted}
            returnKeyType="send"
            submitBehavior="submit"
            onSubmitEditing={submitReply}
            maxLength={500}
            multiline
          />
        </LinearGradient>
        <TouchableOpacity
          style={[s.sendBtn, (!replyText.trim() || sending) && { opacity: 0.4 }]}
          onPress={submitReply}
          disabled={!replyText.trim() || sending}
          activeOpacity={0.8}
        >
          {sending
            ? <ActivityIndicator size="small" color={NICO.textOnAccent} />
            : <AppText style={s.sendBtnText}>↑</AppText>
          }
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  root:   { flex: 1, backgroundColor: NICO.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  list:   { padding: SPACING.base, paddingBottom: SPACING.md, gap: SPACING.sm },

  // Post card
  postCard: {
    backgroundColor: NICO.screenBg, borderRadius: RADIUS.xl,
    padding: SPACING.lg, gap: SPACING.xs, marginBottom: SPACING.sm,
    borderWidth: 1, borderColor: NICO.border,
    ...SHADOW.md,
  },
  postTitle:     { fontSize: scale(FONT_SIZE.xl), fontWeight: FONT_WEIGHT.extraBold, color: NICO.text },
  postBody:      { fontSize: FONT_SIZE.md, color: NICO.text, lineHeight: 22 },
  postMeta:      { ...TEXT_STYLE.hint, marginTop: SPACING.xs },
  repliesHeader: {
    fontSize: FONT_SIZE.xs, fontWeight: FONT_WEIGHT.extraBold,
    color: NICO.textMuted, letterSpacing: 0.8,
    marginTop: SPACING.sm, textTransform: 'uppercase',
  },

  // Reply bubbles
  replyRow:        { flexDirection: 'row', gap: SPACING.sm, alignItems: 'flex-end' },
  replyRowMe:      { flexDirection: 'row-reverse' },
  replyAvatar:     { width: scale(32), height: scale(32), borderRadius: scale(16), justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  replyAvatarText: { fontSize: scale(FONT_SIZE.sm), fontWeight: FONT_WEIGHT.extraBold, color: '#fff' },

  bubble: {
    flex: 1, maxWidth: '80%',
    backgroundColor: NICO.chatBubbleOther,
    borderRadius: RADIUS.lg, borderBottomLeftRadius: RADIUS.xs,
    padding: SPACING.md, gap: 3,
    borderWidth: 1, borderColor: NICO.chatBubbleOther,
  },
  bubbleMe:        { backgroundColor: NICO.chatBubbleMe, borderColor: NICO.chatBubbleMe, borderBottomLeftRadius: RADIUS.lg, borderBottomRightRadius: RADIUS.xs },
  bubbleAuthor:    { fontSize: FONT_SIZE.xs, fontWeight: FONT_WEIGHT.bold, color: NICO.primary },
  bubbleAuthorMe:  { color: NICO.primary },
  bubbleContent:   { fontSize: FONT_SIZE.md, color: NICO.text, lineHeight: 20 },
  bubbleContentMe: { color: NICO.text },
  bubbleTime:      { fontSize: FONT_SIZE.xs, color: NICO.textMuted, marginTop: 2 },
  bubbleTimeMe:    { color: NICO.textMuted },

  noReplies:     { alignItems: 'center', paddingTop: SPACING.xl },
  noRepliesText: { ...TEXT_STYLE.hint, fontStyle: 'italic' },

  // Reply bar
  replyBar: {
    flexDirection: 'row', alignItems: 'flex-end', gap: SPACING.sm,
    padding: SPACING.md,
    backgroundColor: NICO.screenBg,
    borderTopWidth: 1, borderTopColor: NICO.border,
  },
  replyInputGradient: {
    flex: 1, padding: BUTTERFLY_BORDER.width,
    borderRadius: RADIUS.xl + BUTTERFLY_BORDER.width,
  },
  replyInput: {
    backgroundColor: NICO.screenBg, borderRadius: RADIUS.xl,
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm,
    fontSize: FONT_SIZE.md, color: NICO.text, maxHeight: 120,
  },
  sendBtn: {
    width: scale(40), height: scale(40), borderRadius: scale(20),
    backgroundColor: NICO.primary, justifyContent: 'center', alignItems: 'center',
  },
  sendBtnText: { color: NICO.textOnAccent, fontSize: scale(FONT_SIZE.xl), fontWeight: FONT_WEIGHT.bold },
});
