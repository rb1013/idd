import React, { useCallback, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  Image, ActivityIndicator, Alert, TextInput, Modal,
} from 'react-native';
import { useFocusEffect, useRoute, RouteProp } from '@react-navigation/native';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/AuthContext';
import { COLORS, TUTORIAL_TARGET_SKILLS, TUTORIAL_COMPREHENSION } from '../../constants';
import { GuardianNavParamList } from '../../navigation';
import type { Tutorial } from '../../types';

type RouteType = RouteProp<GuardianNavParamList, 'TutorialLibrary'>;

const FORMAT_EMOJI: Record<string, string> = { video: '🎬', slideshow: '🖼' };

interface LinkedUser {
  id: string;
  name: string;
  photo_url: string | null;
}

export default function TutorialLibraryScreen() {
  useRoute<RouteType>();
  const { guardian } = useAuth();

  const [tutorials, setTutorials] = useState<Tutorial[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterSkill, setFilterSkill] = useState('');
  const [filterLevel, setFilterLevel] = useState('');
  const [filterFormat, setFilterFormat] = useState('');

  // Users belonging to this guardian
  const [users, setUsers] = useState<LinkedUser[]>([]);

  // Assign-to-user flow
  const [linkingTutorial, setLinkingTutorial] = useState<Tutorial | null>(null);
  const [linking, setLinking] = useState(false);
  const [alreadyLinkedUserIds, setAlreadyLinkedUserIds] = useState<Set<string>>(new Set());
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());

  // Featured / favourite flow: userId -> Set of featured tutorialIds
  const [featuredMap, setFeaturedMap] = useState<Record<string, Set<string>>>({});
  const [featuringTutorial, setFeaturingTutorial] = useState<Tutorial | null>(null);
  const [featureAssignedUsers, setFeatureAssignedUsers] = useState<LinkedUser[]>([]);
  const [togglingFeature, setTogglingFeature] = useState(false);

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
    const u = (data as LinkedUser[]) || [];
    setUsers(u);
    if (u.length > 0) loadFeaturedMap(u.map(x => x.id));
  }

  async function loadFeaturedMap(userIds: string[]) {
    const { data } = await supabase
      .from('user_tutorials')
      .select('user_id, tutorial_id')
      .in('user_id', userIds)
      .eq('is_featured', true);
    const map: Record<string, Set<string>> = {};
    for (const { user_id, tutorial_id } of (data ?? []) as { user_id: string; tutorial_id: string }[]) {
      if (!map[user_id]) map[user_id] = new Set();
      map[user_id].add(tutorial_id);
    }
    setFeaturedMap(map);
  }

  // ── Assign flow ────────────────────────────────────────────────────────────

  async function openLinkModal(tutorial: Tutorial) {
    if (users.length === 0) { Alert.alert('No users', 'You have no IDD users to link this tutorial to.'); return; }
    const { data } = await supabase
      .from('user_tutorials')
      .select('user_id')
      .eq('tutorial_id', tutorial.id);
    const linked = new Set<string>((data ?? []).map((r: any) => r.user_id));
    setAlreadyLinkedUserIds(linked);
    setSelectedUserIds(new Set(linked));
    setLinkingTutorial(tutorial);
  }

  function toggleUserSelection(userId: string) {
    setSelectedUserIds(prev => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId); else next.add(userId);
      return next;
    });
  }

  async function confirmLinkSelection() {
    if (!linkingTutorial) return;
    setLinking(true);
    try {
      const toAdd = [...selectedUserIds].filter(id => !alreadyLinkedUserIds.has(id));
      const toRemove = [...alreadyLinkedUserIds].filter(id => !selectedUserIds.has(id));

      if (toAdd.length > 0) {
        await supabase.from('user_tutorials').upsert(
          toAdd.map(uid => ({ user_id: uid, tutorial_id: linkingTutorial.id, added_by_guardian_id: guardian?.id ?? null })),
          { onConflict: 'user_id,tutorial_id' },
        );
      }
      for (const uid of toRemove) {
        await supabase.from('user_tutorials').delete().eq('user_id', uid).eq('tutorial_id', linkingTutorial.id);
        // clean up featured map locally
        setFeaturedMap(prev => {
          const next = { ...prev };
          if (next[uid]) { next[uid] = new Set(next[uid]); next[uid].delete(linkingTutorial.id); }
          return next;
        });
      }

      const addedNames = users.filter(u => toAdd.includes(u.id)).map(u => u.name);
      const removedNames = users.filter(u => toRemove.includes(u.id)).map(u => u.name);
      const parts: string[] = [];
      if (addedNames.length) parts.push(`Added to: ${addedNames.join(', ')}`);
      if (removedNames.length) parts.push(`Removed from: ${removedNames.join(', ')}`);
      if (parts.length === 0) parts.push('No changes made.');

      Alert.alert('Done', parts.join('\n'));
      setLinkingTutorial(null);
    } catch (err: unknown) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Something went wrong.');
    }
    setLinking(false);
  }

  // ── Feature / favourite flow ───────────────────────────────────────────────

  async function openFeatureModal(tutorial: Tutorial) {
    const { data } = await supabase
      .from('user_tutorials')
      .select('user_id')
      .eq('tutorial_id', tutorial.id)
      .in('user_id', users.map(u => u.id));
    const assignedIds = new Set((data ?? []).map((r: any) => r.user_id));
    const assigned = users.filter(u => assignedIds.has(u.id));
    if (assigned.length === 0) {
      Alert.alert('Not assigned', 'Add this tutorial to a user first before marking it as a favourite.');
      return;
    }
    if (assigned.length === 1) {
      await toggleFeatured(tutorial, assigned[0].id);
      return;
    }
    setFeatureAssignedUsers(assigned);
    setFeaturingTutorial(tutorial);
  }

  async function toggleFeatured(tutorial: Tutorial, userId: string) {
    const currentSet = featuredMap[userId] ?? new Set<string>();
    const isCurrentlyFeatured = currentSet.has(tutorial.id);
    if (!isCurrentlyFeatured && currentSet.size >= 3) {
      Alert.alert('Limit reached', `You can only feature up to 3 tutorials per user. Remove a favourite first.`);
      return;
    }
    setTogglingFeature(true);
    const newVal = !isCurrentlyFeatured;
    await supabase.from('user_tutorials')
      .update({ is_featured: newVal })
      .eq('user_id', userId)
      .eq('tutorial_id', tutorial.id);
    setFeaturedMap(prev => {
      const next = { ...prev };
      const s = new Set<string>(prev[userId] ?? []);
      if (newVal) s.add(tutorial.id); else s.delete(tutorial.id);
      next[userId] = s;
      return next;
    });
    setTogglingFeature(false);
    setFeaturingTutorial(null);
  }

  // ── Rendering ──────────────────────────────────────────────────────────────

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
          placeholderTextColor={COLORS.bloomMuted}
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
          options={['', 'video', 'slideshow']}
          value={filterFormat}
          onSelect={setFilterFormat}
          labels={{ '': 'All', video: '🎬 Video', slideshow: '🖼 Slideshow' }}
        />
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color={COLORS.bloomAccent} /></View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={t => t.id}
          contentContainerStyle={styles.list}
          numColumns={2}
          columnWrapperStyle={styles.row}
          renderItem={({ item: t }) => {
            const isFeaturedForAny = Object.values(featuredMap).some(s => s.has(t.id));
            return (
              <View style={[styles.card, isFeaturedForAny && styles.cardFeatured]}>
                {/* Thumbnail */}
                <View>
                  {t.thumbnail_url
                    ? <Image source={{ uri: t.thumbnail_url }} style={styles.thumb} />
                    : (
                      <View style={[styles.thumb, styles.thumbPlaceholder]}>
                        <Text style={styles.thumbEmoji}>{FORMAT_EMOJI[t.format] ?? '📚'}</Text>
                      </View>
                    )
                  }
                  {/* Star button overlay */}
                  <TouchableOpacity
                    style={[styles.starBtn, isFeaturedForAny && styles.starBtnActive]}
                    onPress={() => openFeatureModal(t)}
                    hitSlop={{ top: 6, right: 6, bottom: 6, left: 6 }}
                  >
                    <Text style={styles.starBtnText}>{isFeaturedForAny ? '⭐' : '☆'}</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.cardBody}>
                  <Text style={styles.cardTitle} numberOfLines={2}>{t.display_name || t.category}</Text>
                  <Text style={styles.cardMeta}>{t.category}</Text>
                  <View style={styles.cardMetas}>
                    <Text style={styles.cardMetaChip}>{t.comprehension_level}</Text>
                    {t.duration_seconds ? <Text style={styles.cardMetaChip}>{t.duration_seconds}s</Text> : null}
                    <Text style={styles.cardMetaChip}>🔗 {t.link_count ?? 0} {(t.link_count ?? 0) === 1 ? 'User' : 'Users'}</Text>
                  </View>
                  <TouchableOpacity style={styles.addBtn} onPress={() => openLinkModal(t)}>
                    <Text style={styles.addBtnText}>＋ Add to User</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          }}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyEmoji}>🔍</Text>
              <Text style={styles.emptyText}>No tutorials found</Text>
              <Text style={styles.emptyHint}>Try adjusting your search or filters</Text>
            </View>
          }
        />
      )}

      {/* Assign-to-user modal */}
      <Modal visible={!!linkingTutorial} animationType="slide" transparent onRequestClose={() => setLinkingTutorial(null)}>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setLinkingTutorial(null)}>
          <TouchableOpacity style={styles.pickerCard} activeOpacity={1} onPress={() => {}}>
            <Text style={styles.pickerTitle}>Add to users</Text>
            <Text style={styles.pickerSub}>"{linkingTutorial?.display_name || linkingTutorial?.category}"</Text>

            {users.map(user => {
              const checked = selectedUserIds.has(user.id);
              return (
                <TouchableOpacity
                  key={user.id}
                  style={[styles.userRow, checked && styles.userRowSelected]}
                  onPress={() => toggleUserSelection(user.id)}
                  disabled={linking}
                  activeOpacity={0.7}
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
                  <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
                    {checked && <Text style={styles.checkmark}>✓</Text>}
                  </View>
                </TouchableOpacity>
              );
            })}

            <TouchableOpacity
              style={[styles.confirmBtn, linking && { opacity: 0.6 }]}
              onPress={confirmLinkSelection}
              disabled={linking}
            >
              {linking
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={styles.confirmBtnText}>Confirm</Text>
              }
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setLinkingTutorial(null)}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Feature-for-user modal (multi-user case only) */}
      <Modal visible={!!featuringTutorial} animationType="slide" transparent onRequestClose={() => setFeaturingTutorial(null)}>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setFeaturingTutorial(null)}>
          <TouchableOpacity style={styles.pickerCard} activeOpacity={1} onPress={() => {}}>
            <Text style={styles.pickerTitle}>⭐ Mark as Favourite</Text>
            <Text style={styles.pickerSub}>Select which user(s) should see this at the top</Text>

            {featureAssignedUsers.map(user => {
              const isFeatured = (featuredMap[user.id] ?? new Set()).has(featuringTutorial?.id ?? '');
              const count = (featuredMap[user.id] ?? new Set()).size;
              return (
                <TouchableOpacity
                  key={user.id}
                  style={[styles.userRow, isFeatured && styles.userRowFeatured]}
                  onPress={() => featuringTutorial && toggleFeatured(featuringTutorial, user.id)}
                  disabled={togglingFeature || (!isFeatured && count >= 3)}
                  activeOpacity={0.7}
                >
                  {user.photo_url
                    ? <Image source={{ uri: user.photo_url }} style={styles.userAvatar} />
                    : (
                      <View style={[styles.userAvatar, styles.userAvatarPlaceholder]}>
                        <Text style={styles.userAvatarText}>{user.name[0]}</Text>
                      </View>
                    )
                  }
                  <View style={{ flex: 1 }}>
                    <Text style={styles.userName}>{user.name}</Text>
                    {!isFeatured && count >= 3 && (
                      <Text style={styles.featureLimitNote}>3/3 favourites used</Text>
                    )}
                  </View>
                  <Text style={styles.featureStar}>{isFeatured ? '⭐' : '☆'}</Text>
                </TouchableOpacity>
              );
            })}

            <TouchableOpacity style={styles.cancelBtn} onPress={() => setFeaturingTutorial(null)}>
              <Text style={styles.cancelBtnText}>Done</Text>
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
  container: { flex: 1, backgroundColor: COLORS.bloomBody },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 60 },

  searchRow: { padding: 14, paddingBottom: 6 },
  searchInput: {
    backgroundColor: COLORS.bloomCard, borderRadius: 14, borderWidth: 1.5, borderColor: COLORS.bloomBorder,
    paddingHorizontal: 16, paddingVertical: 13, fontSize: 15, fontWeight: '500', color: COLORS.bloomText,
  },

  filterSection: { gap: 2 },
  filterRow: { maxHeight: 44 },
  filterRowContent: { paddingHorizontal: 12, paddingVertical: 6, gap: 8 },
  filterChip: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 18,
    backgroundColor: COLORS.bloomCard, borderWidth: 1.5, borderColor: COLORS.bloomBorder,
  },
  filterChipActive: { backgroundColor: COLORS.bloomNavy, borderColor: COLORS.bloomNavy },
  filterChipText: { fontSize: 13, fontWeight: '600', color: COLORS.bloomMuted },
  filterChipTextActive: { color: '#fff', fontWeight: '700' },

  list: { padding: 12, paddingBottom: 32 },
  row: { gap: 12, marginBottom: 12 },

  card: {
    flex: 1, backgroundColor: COLORS.bloomCard, borderRadius: 18,
    borderWidth: 1.5, borderColor: COLORS.bloomBorder, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },
  cardFeatured: {
    borderColor: '#F59E0B', borderWidth: 2,
    shadowColor: '#F59E0B', shadowOpacity: 0.25, shadowRadius: 10, elevation: 5,
  },
  thumb: { width: '100%', height: 120 },
  thumbPlaceholder: { backgroundColor: '#DAEAFF', justifyContent: 'center', alignItems: 'center' },
  thumbEmoji: { fontSize: 44 },

  starBtn: {
    position: 'absolute', top: 8, right: 8,
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center', alignItems: 'center',
  },
  starBtnActive: { backgroundColor: 'rgba(245,158,11,0.85)' },
  starBtnText: { fontSize: 15 },

  cardBody: { padding: 12, gap: 4 },
  cardTitle: { fontSize: 15, fontWeight: '800', color: COLORS.bloomText, lineHeight: 20 },
  cardMeta: { fontSize: 12, fontWeight: '500', color: COLORS.secondary, marginBottom: 2 },
  cardMetas: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginBottom: 6 },
  cardMetaChip: {
    fontSize: 11, fontWeight: '600', color: COLORS.bloomMuted,
    backgroundColor: COLORS.bloomBorder, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3,
    textTransform: 'capitalize',
  },
  addBtn: { backgroundColor: '#DAEAFF', borderRadius: 10, paddingVertical: 9, alignItems: 'center', marginTop: 2 },
  addBtnText: { fontSize: 13, fontWeight: '800', color: COLORS.bloomAccent },

  empty: { alignItems: 'center', paddingTop: 60, gap: 8 },
  emptyEmoji: { fontSize: 48 },
  emptyText: { fontSize: 18, fontWeight: '700', color: COLORS.bloomText },
  emptyHint: { fontSize: 13, color: COLORS.bloomMuted },

  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  pickerCard: {
    backgroundColor: COLORS.bloomCard, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, paddingBottom: 40, gap: 12,
  },
  pickerTitle: { fontSize: 22, fontWeight: '800', color: COLORS.bloomText },
  pickerSub: { fontSize: 14, color: COLORS.bloomMuted, marginBottom: 4 },

  userRow: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: COLORS.bloomBody, borderRadius: 16, padding: 16,
    borderWidth: 2, borderColor: 'transparent',
  },
  userRowSelected: { borderColor: COLORS.bloomAccent, backgroundColor: '#DAEAFF' },
  userRowFeatured: { borderColor: '#F59E0B', backgroundColor: '#FFFBEB' },
  userAvatar: { width: 50, height: 50, borderRadius: 25 },
  userAvatarPlaceholder: { backgroundColor: '#DAEAFF', justifyContent: 'center', alignItems: 'center' },
  userAvatarText: { fontSize: 20, fontWeight: '800', color: COLORS.bloomAccent },
  userName: { fontSize: 17, fontWeight: '700', color: COLORS.bloomText },
  featureLimitNote: { fontSize: 11, color: COLORS.bloomMuted, marginTop: 2 },
  featureStar: { fontSize: 22 },

  checkbox: {
    width: 26, height: 26, borderRadius: 13, borderWidth: 2, borderColor: COLORS.bloomBorder,
    backgroundColor: COLORS.bloomCard, justifyContent: 'center', alignItems: 'center',
  },
  checkboxChecked: { backgroundColor: COLORS.bloomAccent, borderColor: COLORS.bloomAccent },
  checkmark: { color: '#fff', fontSize: 14, fontWeight: '800' },
  confirmBtn: { marginTop: 4, paddingVertical: 15, alignItems: 'center', backgroundColor: COLORS.bloomNavy, borderRadius: 16 },
  confirmBtnText: { fontWeight: '800', fontSize: 15, color: '#fff' },
  cancelBtn: { paddingVertical: 13, alignItems: 'center', backgroundColor: COLORS.bloomBorder, borderRadius: 16 },
  cancelBtnText: { fontWeight: '700', fontSize: 15, color: COLORS.bloomText },
});
