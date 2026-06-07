import React, { useEffect, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  Image, ActivityIndicator, Modal, Dimensions,
} from 'react-native';
import { supabase } from '../../lib/supabase';
import { COLORS } from '../../constants';
import type { Tutorial } from '../../types';
import { VideoView, useVideoPlayer } from 'expo-video';

const { width } = Dimensions.get('window');

export default function TutorialsScreen() {
  const [tutorials, setTutorials] = useState<Tutorial[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [playing, setPlaying] = useState<Tutorial | null>(null);
  const [categories, setCategories] = useState<string[]>([]);

  useEffect(() => { fetchTutorials(); }, []);

  async function fetchTutorials() {
    const { data } = await supabase.from('tutorials').select('*').order('created_at', { ascending: false });
    const items = data || [];
    setTutorials(items);
    const cats = [...new Set(items.map((t: Tutorial) => t.category))];
    setCategories(['All', ...cats]);
    setLoading(false);
  }

  const filtered = selectedCategory && selectedCategory !== 'All'
    ? tutorials.filter(t => t.category === selectedCategory)
    : tutorials;

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color={COLORS.primary} /></View>;

  return (
    <View style={styles.container}>
      {/* Category filter */}
      <FlatList
        horizontal
        data={categories}
        keyExtractor={c => c}
        style={styles.categoryBar}
        contentContainerStyle={styles.categoryBarContent}
        showsHorizontalScrollIndicator={false}
        renderItem={({ item }) => {
          const active = (!selectedCategory && item === 'All') || selectedCategory === item;
          return (
            <TouchableOpacity
              style={[styles.categoryChip, active && styles.categoryChipActive]}
              onPress={() => setSelectedCategory(item === 'All' ? null : item)}
            >
              <Text style={[styles.categoryChipText, active && styles.categoryChipTextActive]}>{item}</Text>
            </TouchableOpacity>
          );
        }}
      />

      <FlatList
        data={filtered}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.list}
        numColumns={2}
        columnWrapperStyle={styles.row}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.card} onPress={() => setPlaying(item)}>
            {item.thumbnail_url
              ? <Image source={{ uri: item.thumbnail_url }} style={styles.thumbnail} />
              : <View style={[styles.thumbnail, styles.thumbnailPlaceholder]}>
                  <Text style={styles.playIcon}>▶</Text>
                </View>
            }
            <View style={styles.cardBody}>
              <Text style={styles.cardTitle} numberOfLines={2}>{item.title}</Text>
              <Text style={styles.cardCategory}>{item.category}</Text>
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={<Text style={styles.empty}>No tutorials available yet.</Text>}
      />

      <VideoModal tutorial={playing} onClose={() => setPlaying(null)} />
    </View>
  );
}

function VideoModal({ tutorial, onClose }: { tutorial: Tutorial | null; onClose: () => void }) {
  const player = useVideoPlayer(tutorial?.video_url ?? null, p => { p.play(); });

  useEffect(() => {
    if (tutorial?.video_url) {
      player.replace({ uri: tutorial.video_url });
      player.play();
    }
  }, [tutorial?.video_url]);

  return (
    <Modal visible={!!tutorial} animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalContainer}>
        <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
          <Text style={styles.closeBtnText}>✕ Close</Text>
        </TouchableOpacity>
        {tutorial && (
          <>
            <VideoView player={player} style={styles.video} nativeControls contentFit="contain" />
            <View style={styles.videoInfo}>
              <Text style={styles.videoTitle}>{tutorial.title}</Text>
              <Text style={styles.videoDesc}>{tutorial.description}</Text>
            </View>
          </>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  categoryBar: { maxHeight: 56 },
  categoryBarContent: { paddingHorizontal: 16, paddingVertical: 10, gap: 8 },
  categoryChip: {
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20,
    backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border,
  },
  categoryChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  categoryChipText: { fontSize: 13, color: COLORS.textLight },
  categoryChipTextActive: { color: '#fff', fontWeight: '600' },
  list: { padding: 12, paddingBottom: 32 },
  row: { gap: 12 },
  card: {
    flex: 1, backgroundColor: COLORS.surface, borderRadius: 16,
    borderWidth: 1, borderColor: COLORS.border, overflow: 'hidden', marginBottom: 12,
  },
  thumbnail: { width: '100%', height: 110 },
  thumbnailPlaceholder: { backgroundColor: COLORS.primaryLight, justifyContent: 'center', alignItems: 'center' },
  playIcon: { fontSize: 32, color: COLORS.primary },
  cardBody: { padding: 10 },
  cardTitle: { fontSize: 14, fontWeight: '600', color: COLORS.text },
  cardCategory: { fontSize: 12, color: COLORS.secondary, marginTop: 4 },
  empty: { textAlign: 'center', color: COLORS.textLight, marginTop: 60, fontSize: 15 },
  modalContainer: { flex: 1, backgroundColor: '#000' },
  closeBtn: { padding: 16, paddingTop: 50 },
  closeBtnText: { color: '#fff', fontSize: 16 },
  video: { width, height: width * 0.5625 },
  videoInfo: { padding: 24 },
  videoTitle: { fontSize: 20, fontWeight: '700', color: '#fff', marginBottom: 8 },
  videoDesc: { fontSize: 15, color: '#aaa', lineHeight: 22 },
});
