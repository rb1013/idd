import React, { useCallback, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  TextInput, Modal, KeyboardAvoidingView, Platform,
  ActivityIndicator, Alert,
} from 'react-native';
import AppText from '../../components/AppText';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/AuthContext';
import { COLORS } from '../../constants';
import { GuardianNavParamList } from '../../navigation';

type Nav = NativeStackNavigationProp<GuardianNavParamList>;

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

interface Post {
  id: string;
  title: string;
  body: string;
  createdAt: string;
  guardianName: string;
  replyCount: number;
}

export default function DiscussionsScreen() {
  const navigation = useNavigation<Nav>();
  const { guardian } = useAuth();

  const [posts, setPosts]           = useState<Post[]>([]);
  const [loading, setLoading]       = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle]     = useState('');
  const [newBody, setNewBody]       = useState('');
  const [submitting, setSubmitting] = useState(false);

  useFocusEffect(useCallback(() => { load(); }, []));

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from('discussion_posts')
      .select('id, title, body, created_at, guardians(full_name), discussion_replies(id)')
      .order('created_at', { ascending: false });

    setPosts(
      (data ?? []).map((p: any) => ({
        id: p.id,
        title: p.title,
        body: p.body,
        createdAt: p.created_at,
        guardianName: p.guardians?.full_name ?? 'Unknown',
        replyCount: (p.discussion_replies ?? []).length,
      }))
    );
    setLoading(false);
  }

  async function submitPost() {
    if (!newTitle.trim() || !newBody.trim() || !guardian) return;
    setSubmitting(true);
    const { error } = await supabase.from('discussion_posts').insert({
      guardian_id: guardian.id,
      title: newTitle.trim(),
      body: newBody.trim(),
    });
    if (error) {
      Alert.alert('Error', error.message);
    } else {
      setNewTitle('');
      setNewBody('');
      setShowCreate(false);
      load();
    }
    setSubmitting(false);
  }

  if (loading) {
    return <View style={s.center}><ActivityIndicator size="large" color={COLORS.bloomAccent} /></View>;
  }

  return (
    <View style={s.container}>
      <FlatList
        data={posts}
        keyExtractor={p => p.id}
        contentContainerStyle={s.list}
        renderItem={({ item: p }) => (
          <TouchableOpacity
            style={s.card}
            onPress={() => navigation.navigate('DiscussionDetail', { postId: p.id })}
            activeOpacity={0.82}
          >
            <AppText style={s.postTitle}>{p.title}</AppText>
            <AppText style={s.postBody} numberOfLines={2}>{p.body}</AppText>
            <View style={s.postMeta}>
              <AppText style={s.metaText}>{p.guardianName}</AppText>
              <AppText style={s.metaDot}>·</AppText>
              <AppText style={s.metaText}>{timeAgo(p.createdAt)}</AppText>
              <AppText style={s.metaDot}>·</AppText>
              <AppText style={s.metaText}>
                {p.replyCount} {p.replyCount === 1 ? 'reply' : 'replies'}
              </AppText>
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={s.empty}>
            <AppText style={s.emptyEmoji}>💬</AppText>
            <AppText style={s.emptyText}>No discussions yet</AppText>
            <AppText style={s.emptyHint}>Start the first conversation</AppText>
          </View>
        }
      />

      <TouchableOpacity style={s.fab} onPress={() => setShowCreate(true)} activeOpacity={0.85}>
        <AppText style={s.fabText}>+ New Discussion</AppText>
      </TouchableOpacity>

      <Modal
        visible={showCreate}
        animationType="slide"
        transparent
        onRequestClose={() => setShowCreate(false)}
      >
        <KeyboardAvoidingView
          style={s.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <TouchableOpacity
            style={s.modalBackdrop}
            activeOpacity={1}
            onPress={() => setShowCreate(false)}
          />
          <View style={s.modalSheet}>
            <View style={s.modalHandle} />
            <AppText style={s.modalTitle}>Start a Discussion</AppText>

            <AppText style={s.fieldLabel}>Topic</AppText>
            <TextInput
              style={s.fieldInput}
              value={newTitle}
              onChangeText={setNewTitle}
              placeholder="What's on your mind?"
              placeholderTextColor={COLORS.bloomMuted}
              maxLength={120}
            />

            <AppText style={s.fieldLabel}>Details</AppText>
            <TextInput
              style={[s.fieldInput, s.fieldTextArea]}
              value={newBody}
              onChangeText={setNewBody}
              placeholder="Share more context…"
              placeholderTextColor={COLORS.bloomMuted}
              multiline
              numberOfLines={4}
            />

            <TouchableOpacity
              style={[s.submitBtn, (!newTitle.trim() || !newBody.trim() || submitting) && { opacity: 0.5 }]}
              onPress={submitPost}
              disabled={!newTitle.trim() || !newBody.trim() || submitting}
            >
              {submitting
                ? <ActivityIndicator color="#fff" />
                : <AppText style={s.submitBtnText}>Post Discussion</AppText>
              }
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bloomBody },
  center:    { flex: 1, justifyContent: 'center', alignItems: 'center' },
  list:      { padding: 16, paddingBottom: 100, gap: 10 },

  card: {
    backgroundColor: COLORS.bloomCard, borderRadius: 18, padding: 16, gap: 6,
    borderWidth: 1, borderColor: COLORS.bloomBorder,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },
  postTitle: { fontSize: 16, fontWeight: '800', color: COLORS.bloomText },
  postBody:  { fontSize: 13, color: '#4A5568', lineHeight: 18 },
  postMeta:  { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  metaText:  { fontSize: 12, color: '#5A6470' },
  metaDot:   { fontSize: 12, color: COLORS.bloomBorder },

  fab: {
    position: 'absolute', bottom: 28, right: 20, left: 20,
    backgroundColor: COLORS.bloomAccent, borderRadius: 16,
    paddingVertical: 16, alignItems: 'center',
    shadowColor: COLORS.bloomAccent, shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4, shadowRadius: 12, elevation: 8,
  },
  fabText: { color: COLORS.bloomOnAccent, fontWeight: '800', fontSize: 15 },

  empty:      { alignItems: 'center', paddingTop: 80, gap: 12 },
  emptyEmoji: { fontSize: 56 },
  emptyText:  { fontSize: 20, fontWeight: '800', color: COLORS.bloomText },
  emptyHint:  { fontSize: 14, color: COLORS.bloomMuted },

  modalOverlay:  { flex: 1, justifyContent: 'flex-end' },
  modalBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)' },
  modalSheet: {
    backgroundColor: COLORS.bloomCard,
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    padding: 24, paddingBottom: 40, gap: 12,
  },
  modalHandle: {
    width: 44, height: 4, backgroundColor: COLORS.bloomBorder,
    borderRadius: 2, alignSelf: 'center', marginBottom: 8,
  },
  modalTitle: { fontSize: 20, fontWeight: '900', color: COLORS.bloomText, marginBottom: 4 },

  fieldLabel: { fontSize: 12, fontWeight: '700', color: COLORS.bloomMuted, letterSpacing: 0.5, marginBottom: -4 },
  fieldInput: {
    backgroundColor: COLORS.bloomBody, borderRadius: 14, borderWidth: 1.5,
    borderColor: COLORS.bloomBorder, padding: 14,
    fontSize: 15, color: COLORS.bloomText,
  },
  fieldTextArea: { minHeight: 100, textAlignVertical: 'top' },

  submitBtn: {
    backgroundColor: COLORS.bloomAccent, borderRadius: 14,
    paddingVertical: 16, alignItems: 'center', marginTop: 4,
  },
  submitBtnText: { color: COLORS.bloomOnAccent, fontWeight: '800', fontSize: 15 },
});
