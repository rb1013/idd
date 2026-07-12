import React, { useCallback, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  Image, ActivityIndicator, Alert,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/AuthContext';
import { COLORS } from '../../constants';
import { GuardianNavParamList } from '../../navigation';
import type { Tutorial, TutorialStatus } from '../../types';

const STATUS_COLORS: Record<TutorialStatus, { bg: string; text: string }> = {
  generating: { bg: '#E8ECEF', text: '#5D6D7E' },
  preview:    { bg: '#FEF3CD', text: '#B7791F' },
  pending:    { bg: '#DBEAFE', text: '#1D4ED8' },
  approved:   { bg: '#D1FAE5', text: '#065F46' },
  rejected:   { bg: '#FEE2E2', text: '#991B1B' },
};

const STATUS_LABELS: Record<TutorialStatus, string> = {
  generating: 'Generating…',
  preview:    'Review Needed',
  pending:    'Pending Review',
  approved:   'Approved',
  rejected:   'Rejected',
};

const FORMAT_EMOJI: Record<string, string> = {
  video: '🎬', slideshow: '🖼',
};

type Filter = 'all' | TutorialStatus;

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'preview', label: 'Review Needed' },
  { key: 'pending', label: 'Pending' },
  { key: 'approved', label: 'Approved' },
  { key: 'rejected', label: 'Rejected' },
];

export default function GuardianTutorialsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<GuardianNavParamList>>();
  const { guardian } = useAuth();
  const [tutorials, setTutorials] = useState<Tutorial[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>('all');
  const [quota, setQuota] = useState<{ used: number; limit: number } | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (guardian) { load(guardian.id); }
    }, [guardian]),
  );

  async function load(guardianId: string) {
    setLoading(true);
    const [{ data: tuts }, { data: quotaRow }] = await Promise.all([
      supabase
        .from('tutorials')
        .select('*')
        .eq('created_by_guardian_id', guardianId)
        .order('created_at', { ascending: false }),
      supabase
        .from('guardian_tutorial_quota')
        .select('count')
        .eq('guardian_id', guardianId)
        .eq('month', new Date().toISOString().slice(0, 7))
        .single(),
    ]);
    setTutorials((tuts as Tutorial[]) || []);
    setQuota({ used: quotaRow?.count ?? 0, limit: 10 });
    setLoading(false);
  }

  async function deleteTutorial(t: Tutorial) {
    const linked = t.link_count > 0;
    const msg = linked
      ? `This tutorial is linked to ${t.link_count} user profile${t.link_count > 1 ? 's' : ''}. Deleting it will remove it from their learning page. Continue?`
      : 'Delete this tutorial? This cannot be undone.';
    Alert.alert('Delete Tutorial', msg, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          await supabase.from('tutorials').delete().eq('id', t.id);
          setTutorials(prev => prev.filter(x => x.id !== t.id));
        },
      },
    ]);
  }

  const filtered = filter === 'all' ? tutorials : tutorials.filter(t => t.status === filter);

  return (
    <View style={styles.container}>
      {/* Quota bar */}
      {quota && (
        <View style={styles.quotaBar}>
          <View style={styles.quotaHeader}>
            <Text style={styles.quotaLabel}>Monthly quota</Text>
            <Text style={[styles.quotaCount, quota.used >= 10 && { color: COLORS.error }]}>
              {quota.used} / {quota.limit} used
            </Text>
          </View>
          <View style={styles.quotaTrack}>
            <View style={[styles.quotaFill, {
              width: `${Math.min((quota.used / quota.limit) * 100, 100)}%` as any,
              backgroundColor: quota.used >= 10 ? COLORS.error : COLORS.primary,
            }]} />
          </View>
        </View>
      )}

      {/* Action buttons */}
      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.btn, styles.btnPrimary, quota?.used !== undefined && quota.used >= 10 && styles.btnDisabled]}
          onPress={() => {
            if (quota && quota.used >= 10) { Alert.alert('Quota reached', 'You have used all 10 tutorials for this month.'); return; }
            navigation.navigate('CreateTutorial');
          }}
        >
          <Text style={styles.btnTextPrimary}>✨  Create Tutorial</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.btn, styles.btnSecondary]}
          onPress={() => navigation.navigate('TutorialLibrary', {})}
        >
          <Text style={styles.btnTextSecondary}>📚  Browse Library</Text>
        </TouchableOpacity>
      </View>

      {/* Filter chips */}
      <FlatList
        horizontal
        data={FILTERS}
        keyExtractor={f => f.key}
        style={styles.filterBar}
        contentContainerStyle={styles.filterBarContent}
        showsHorizontalScrollIndicator={false}
        renderItem={({ item }) => {
          const active = filter === item.key;
          return (
            <TouchableOpacity
              style={[styles.filterChip, active && styles.filterChipActive]}
              onPress={() => setFilter(item.key)}
            >
              <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>{item.label}</Text>
            </TouchableOpacity>
          );
        }}
      />

      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color={COLORS.primary} /></View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={t => t.id}
          contentContainerStyle={styles.list}
          renderItem={({ item: t }) => (
            <TouchableOpacity
              style={styles.card}
              onPress={() => {
                if (t.status === 'generating') return;
                navigation.navigate('TutorialPreview', { tutorialId: t.id });
              }}
              activeOpacity={t.status === 'generating' ? 1 : 0.85}
            >
              {/* Thumbnail */}
              <View style={styles.thumb}>
                {t.thumbnail_url
                  ? <Image source={{ uri: t.thumbnail_url }} style={styles.thumbImage} />
                  : <Text style={styles.thumbEmoji}>{FORMAT_EMOJI[t.format] ?? '📚'}</Text>
                }
              </View>

              {/* Info */}
              <View style={styles.cardInfo}>
                <Text style={styles.cardTitle} numberOfLines={2}>{t.display_name || t.category}</Text>
                <Text style={styles.cardSub}>{t.category}</Text>
                <View style={styles.cardMeta}>
                  <View style={[styles.statusBadge, { backgroundColor: STATUS_COLORS[t.status as TutorialStatus].bg }]}>
                    <Text style={[styles.statusText, { color: STATUS_COLORS[t.status as TutorialStatus].text }]}>
                      {STATUS_LABELS[t.status as TutorialStatus]}
                    </Text>
                  </View>
                  {t.duration_seconds && (
                    <Text style={styles.metaText}>{t.duration_seconds}s</Text>
                  )}
                  {t.link_count > 0 && (
                    <Text style={styles.metaText}>🔗 {t.link_count} {t.link_count === 1 ? 'User' : 'Users'}</Text>
                  )}
                </View>
              </View>

              {/* Delete button */}
              {t.status !== 'generating' && (
                <TouchableOpacity
                  style={styles.deleteBtn}
                  onPress={() => deleteTutorial(t)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Text style={styles.deleteBtnText}>🗑</Text>
                </TouchableOpacity>
              )}
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyEmoji}>📚</Text>
              <Text style={styles.emptyText}>No tutorials yet</Text>
              <Text style={styles.emptyHint}>Create a tutorial to get started</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 60 },

  quotaBar: {
    marginHorizontal: 16, marginTop: 16,
    backgroundColor: COLORS.surface, borderRadius: 16,
    padding: 16, gap: 10,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },
  quotaHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  quotaLabel: { fontSize: 14, fontWeight: '600', color: COLORS.text },
  quotaCount: { fontSize: 14, fontWeight: '800', color: COLORS.primary },
  quotaTrack: { height: 8, backgroundColor: '#F0F4F8', borderRadius: 4, overflow: 'hidden' },
  quotaFill: { height: '100%', borderRadius: 4 },

  actions: { flexDirection: 'row', gap: 12, marginHorizontal: 16, marginTop: 16 },
  btn: { flex: 1, paddingVertical: 14, borderRadius: 14, alignItems: 'center' },
  btnPrimary: {
    backgroundColor: COLORS.primary,
    shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35, shadowRadius: 8, elevation: 5,
  },
  btnSecondary: { backgroundColor: COLORS.surface, borderWidth: 2, borderColor: COLORS.primary },
  btnDisabled: { opacity: 0.45 },
  btnTextPrimary: { color: '#fff', fontWeight: '800', fontSize: 15 },
  btnTextSecondary: { color: COLORS.primary, fontWeight: '800', fontSize: 15 },

  filterBar: { maxHeight: 52, marginTop: 14 },
  filterBarContent: { paddingHorizontal: 16, gap: 8, alignItems: 'center' },
  filterChip: {
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20,
    backgroundColor: COLORS.surface, borderWidth: 1.5, borderColor: COLORS.border,
  },
  filterChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  filterChipText: { fontSize: 13, fontWeight: '600', color: COLORS.textLight },
  filterChipTextActive: { color: '#fff', fontWeight: '700' },

  list: { padding: 16, gap: 14 },

  card: {
    backgroundColor: COLORS.surface, borderRadius: 18,
    flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07, shadowRadius: 10, elevation: 3,
  },
  thumb: {
    width: 80, height: 80, borderRadius: 14,
    backgroundColor: COLORS.primaryLight,
    justifyContent: 'center', alignItems: 'center',
    overflow: 'hidden', flexShrink: 0,
  },
  thumbImage: { width: 80, height: 80 },
  thumbEmoji: { fontSize: 36 },
  cardInfo: { flex: 1, minWidth: 0, gap: 4 },
  cardTitle: { fontSize: 17, fontWeight: '800', color: COLORS.text, lineHeight: 22 },
  cardSub: { fontSize: 13, color: COLORS.textLight, fontWeight: '500' },
  cardMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4, flexWrap: 'wrap' },
  statusBadge: { borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4 },
  statusText: { fontSize: 12, fontWeight: '700' },
  metaText: { fontSize: 13, color: COLORS.textLight, fontWeight: '500' },
  deleteBtn: { padding: 6 },
  deleteBtnText: { fontSize: 22 },

  empty: { alignItems: 'center', paddingTop: 80, gap: 12 },
  emptyEmoji: { fontSize: 72 },
  emptyText: { fontSize: 22, fontWeight: '800', color: COLORS.text },
  emptyHint: { fontSize: 15, color: COLORS.textLight },
});
