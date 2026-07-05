import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  Image, ActivityIndicator, Alert, TextInput, Modal, Dimensions,
} from 'react-native';
import { useFocusEffect, useRoute, RouteProp } from '@react-navigation/native';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/AuthContext';
import { COLORS, TUTORIAL_TARGET_SKILLS, TUTORIAL_COMPREHENSION } from '../../constants';
import { RootStackParamList } from '../../navigation';
import type { Tutorial } from '../../types';

const { width } = Dimensions.get('window');

type RouteType = RouteProp<RootStackParamList, 'TutorialLibrary'>;

const FORMAT_EMOJI: Record<string, string> = { video: '🎬', slideshow: '🖼', cards: '🃏' };

interface LinkedUser {
  id: string;
  name: string;
  photo_url: string | null;
}

export default function TutorialLibraryScreen() {
  const route = useRoute<RouteType>();
  const { guardian } = useAuth();

  const [tutorials, setTutorials] = useState<Tutorial[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterSkill, setFilterSkill] = useState('');
  const [filterLevel, setFilterLevel] = useState('');
  const [filterFormat, setFilterFormat] = useState('');

  // Link-to-user flow
  const [users, setUsers] = useState<LinkedUser[]>([]);
  const [linkingTutorial, setLinkingTutorial] = useState<Tutorial | null>(null);
  const [linking, setLinking] = useState(false);
  const [linkedSet, setLinkedSet] = useState<Set<string>>(new Set());

  useFocusEffect(
    useCallback(() => {
      loadTutorials();
      if (guardian) loadGuardianUsers(guardian.id);
    }, [guardian]),
  );

  async function loadTutorials() {
    setLoading(true);
    const { data } = await supabase
      .from('tutorials')
      .select('*')
      .eq('status', 'approved')
      .order('created_at', { ascending: false });
    setTutorials((data as Tutorial[]) || []);
    setLoading(false);
  }

  async function loadGuardianUsers(guardianId: string) {
    const { data } = await supabase
      .from('user_profiles')
      .select('id, name, photo_url')
      .eq('guardian_id', guardianId);
    setUsers((data as LinkedUser[]) || []);
  }

  async function loadLinkedTutorials(userId: string) {
    const { data } = await supabase
      .from('user_tutorials')
      .select('tutorial_id')
      .eq('user_id', userId);
    setLinkedSet(new Set((data ?? []).map((r: any) => r.tutorial_id)));
  }

  async function linkToUser(tutorial: Tutorial, user: LinkedUser) {
    setLinking(true);
    const { error } = await supabase.from('user_tutorials').upsert({
      user_id: user.id,
      tutorial_id: tutorial.id,
      added_by_guardian_id: guardian?.id ?? null,
    }, { onConflict: 'user_id,tutorial_id' });

    if (error) {
      Alert.alert('Error', error.message);
    } else {
      setLinkedSet(prev => new Set([...prev, tutorial.id]));
      Alert.alert('Added!', `"${tutorial.title}" has been added to ${user.name}'s learning page.`);
      setLinkingTutorial(null);
    }
    setLinking(false);
  }

  async function unlinkFromUser(tutorial: Tutorial, user: LinkedUser) {
    setLinking(true);
    await supabase.from('user_tutorials')
      .delete()
      .eq('user_id', user.id)
      .eq('tutorial_id', tutorial.id);
    setLinkedSet(prev => { const s = new Set(prev); s.delete(tutorial.id); return s; });
    setLinking(false);
  }

  const filtered = tutorials.filter(t => {
    const q = search.toLowerCase();
    const matchSearch = !q || t.title.toLowerCase().includes(q) || (t.topic ?? '').toLowerCase().includes(q) || t.category.toLowerCase().includes(q);
    const matchSkill = !filterSkill || t.category === filterSkill;
    const matchLevel = !filterLevel || t.comprehension_level === filterLevel;
    const matchFormat = !filterFormat || t.format === filterFormat;
    return matchSearch && matchSkill && matchLevel && matchFormat;
  });

  return (
    <View style={styles.container}>
      {/* Search bar */}
      <View style={styles.searchRow}>
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Search tutorials…"
          placeholderTextColor={COLORS.textLight}
          clearButtonMode="while-editing"
        />
      </View>

      {/* Filter chips */}
      <View style={styles.filterSection}>
        <FilterRow
          label="Skill"
          options={['', ...TUTORIAL_TARGET_SKILLS]}
          value={filterSkill}
          onSelect={setFilterSkill}
          labels={{ '': 'All Skills' }}
        />
        <FilterRow
          label="Level"
          options={['', ...TUTORIAL_COMPREHENSION]}
          value={filterLevel}
          onSelect={setFilterLevel}
          labels={{ '': 'All Levels', easy: 'Easy', medium: 'Medium', complex: 'Complex', fluent: 'Fluent' }}
        />
        <FilterRow
          label="Format"
          options={['', 'video', 'slideshow', 'cards']}
          value={filterFormat}
          onSelect={setFilterFormat}
          labels={{ '': 'All', video: '🎬 Video', slideshow: '🖼 Slideshow', cards: '🃏 Cards' }}
        />
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color={COLORS.primary} /></View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={t => t.id}
          contentContainerStyle={styles.list}
          numColumns={2}
          columnWrapperStyle={styles.row}
          renderItem={({ item: t }) => (
            <View style={styles.card}>
              {/* Thumbnail */}
              {t.thumbnail_url
                ? <Image source={{ uri: t.thumbnail_url }} style={styles.thumb} />
                : (
                  <View style={[styles.thumb, styles.thumbPlaceholder]}>
                    <Text style={styles.thumbEmoji}>{FORMAT_EMOJI[t.format] ?? '📚'}</Text>
                  </View>
                )
              }
              <View style={styles.cardBody}>
                <Text style={styles.cardTitle} numberOfLines={2}>{t.title}</Text>
                <Text style={styles.cardMeta}>{t.category}</Text>
                <View style={styles.cardMetas}>
                  <Text style={styles.cardMetaChip}>{t.comprehension_level}</Text>
                  {t.duration_seconds && <Text style={styles.cardMetaChip}>{t.duration_seconds}s</Text>}
                  {t.link_count > 0 && <Text style={styles.cardMetaChip}>🔗 {t.link_count}</Text>}
                </View>
                <TouchableOpacity
                  style={styles.addBtn}
                  onPress={async () => {
                    if (users.length === 0) { Alert.alert('No users', 'You have no IDD users to link this tutorial to.'); return; }
                    // If only one user, show link/unlink directly; otherwise show user picker
                    if (users.length === 1) {
                      await loadLinkedTutorials(users[0].id);
                    }
                    setLinkingTutorial(t);
                    if (users.length === 1) await loadLinkedTutorials(users[0].id);
                  }}
                >
                  <Text style={styles.addBtnText}>＋ Add to User</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyEmoji}>🔍</Text>
              <Text style={styles.emptyText}>No tutorials found</Text>
              <Text style={styles.emptyHint}>Try adjusting your search or filters</Text>
            </View>
          }
        />
      )}

      {/* User picker modal */}
      <Modal visible={!!linkingTutorial} animationType="slide" transparent onRequestClose={() => setLinkingTutorial(null)}>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setLinkingTutorial(null)}>
          <TouchableOpacity style={styles.pickerCard} activeOpacity={1} onPress={() => {}}>
            <Text style={styles.pickerTitle}>Add to which user?</Text>
            <Text style={styles.pickerSub}>"{linkingTutorial?.title}"</Text>

            {users.map(user => {
              const isLinked = linkedSet.has(linkingTutorial?.id ?? '');
              return (
                <TouchableOpacity
                  key={user.id}
                  style={styles.userRow}
                  onPress={async () => {
                    if (!linkingTutorial) return;
                    await loadLinkedTutorials(user.id);
                    const alreadyLinked = linkedSet.has(linkingTutorial.id);
                    if (alreadyLinked) {
                      Alert.alert(
                        'Already added',
                        `"${linkingTutorial.title}" is already on ${user.name}'s learning page. Remove it?`,
                        [
                          { text: 'Keep', style: 'cancel' },
                          { text: 'Remove', style: 'destructive', onPress: () => unlinkFromUser(linkingTutorial, user) },
                        ],
                      );
                    } else {
                      linkToUser(linkingTutorial, user);
                    }
                  }}
                  disabled={linking}
                >
                  {user.photo_url
                    ? <Image source={{ uri: user.photo_url }} style={styles.userAvatar} />
                    : (
                      <View style={[styles.userAvatar, styles.userAvatarPlaceholder]}>
                        <Text style={styles.userAvatarText}>{user.name[0]}</Text>
                      </View>
                    )
                  }
                  <Text style={styles.userName}>{user.name}</Text>
                  {linking && <ActivityIndicator size="small" color={COLORS.primary} />}
                </TouchableOpacity>
              );
            })}

            <TouchableOpacity style={styles.cancelBtn} onPress={() => setLinkingTutorial(null)}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

function FilterRow({ label, options, value, onSelect, labels }: {
  label: string;
  options: string[];
  value: string;
  onSelect: (v: string) => void;
  labels?: Record<string, string>;
}) {
  return (
    <FlatList
      horizontal
      data={options}
      keyExtractor={o => o}
      style={styles.filterRow}
      contentContainerStyle={styles.filterRowContent}
      showsHorizontalScrollIndicator={false}
      renderItem={({ item }) => {
        const active = value === item;
        const display = labels?.[item] ?? item;
        return (
          <TouchableOpacity
            style={[styles.filterChip, active && styles.filterChipActive]}
            onPress={() => onSelect(item)}
          >
            <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>{display}</Text>
          </TouchableOpacity>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 60 },

  searchRow: { padding: 14, paddingBottom: 6 },
  searchInput: {
    backgroundColor: COLORS.surface, borderRadius: 14, borderWidth: 1.5, borderColor: COLORS.border,
    paddingHorizontal: 16, paddingVertical: 13, fontSize: 15, fontWeight: '500', color: COLORS.text,
  },

  filterSection: { gap: 2 },
  filterRow: { maxHeight: 44 },
  filterRowContent: { paddingHorizontal: 12, paddingVertical: 6, gap: 8 },
  filterChip: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 18,
    backgroundColor: COLORS.surface, borderWidth: 1.5, borderColor: COLORS.border,
  },
  filterChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  filterChipText: { fontSize: 13, fontWeight: '600', color: COLORS.textLight },
  filterChipTextActive: { color: '#fff', fontWeight: '700' },

  list: { padding: 12, paddingBottom: 32 },
  row: { gap: 12, marginBottom: 12 },

  card: {
    flex: 1, backgroundColor: COLORS.surface, borderRadius: 18,
    borderWidth: 1.5, borderColor: COLORS.border, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },
  thumb: { width: '100%', height: 120 },
  thumbPlaceholder: { backgroundColor: COLORS.primaryLight, justifyContent: 'center', alignItems: 'center' },
  thumbEmoji: { fontSize: 44 },
  cardBody: { padding: 12, gap: 4 },
  cardTitle: { fontSize: 15, fontWeight: '800', color: COLORS.text, lineHeight: 20 },
  cardMeta: { fontSize: 12, fontWeight: '500', color: COLORS.secondary, marginBottom: 2 },
  cardMetas: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginBottom: 6 },
  cardMetaChip: {
    fontSize: 11, fontWeight: '600', color: COLORS.textLight,
    backgroundColor: '#F0F4F8', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3,
    textTransform: 'capitalize',
  },
  addBtn: { backgroundColor: COLORS.primaryLight, borderRadius: 10, paddingVertical: 9, alignItems: 'center', marginTop: 2 },
  addBtnText: { fontSize: 13, fontWeight: '800', color: COLORS.primary },

  empty: { alignItems: 'center', paddingTop: 60, gap: 8 },
  emptyEmoji: { fontSize: 48 },
  emptyText: { fontSize: 18, fontWeight: '700', color: COLORS.text },
  emptyHint: { fontSize: 13, color: COLORS.textLight },

  overlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  pickerCard: {
    backgroundColor: COLORS.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, paddingBottom: 40, gap: 12,
  },
  pickerTitle: { fontSize: 22, fontWeight: '800', color: COLORS.text },
  pickerSub: { fontSize: 14, color: COLORS.textLight, marginBottom: 4 },
  userRow: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: COLORS.background, borderRadius: 16, padding: 16,
  },
  userAvatar: { width: 50, height: 50, borderRadius: 25 },
  userAvatarPlaceholder: { backgroundColor: COLORS.primaryLight, justifyContent: 'center', alignItems: 'center' },
  userAvatarText: { fontSize: 20, fontWeight: '800', color: COLORS.primary },
  userName: { flex: 1, fontSize: 17, fontWeight: '700', color: COLORS.text },
  cancelBtn: { marginTop: 4, paddingVertical: 15, alignItems: 'center', backgroundColor: COLORS.border, borderRadius: 16 },
  cancelBtnText: { fontWeight: '700', fontSize: 15, color: COLORS.text },
});
