import React, { useEffect, useState } from 'react';
import {
  Modal, View, Text, StyleSheet, TouchableOpacity, Pressable,
  Image, ActivityIndicator, FlatList, ScrollView,
} from 'react-native';
import { speakLearner } from '../../lib/speech';
import { readCachedBoard, refreshBoard, AACBoard } from '../../lib/aacSymbols';
import { COLORS } from '../../constants';

interface Props {
  visible: boolean;
  onClose: () => void;
  onSend: (imageUrl: string) => void;
}

export default function CommunicationBoard({ visible, onClose, onSend }: Props) {
  const [board, setBoard]     = useState<AACBoard | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed]   = useState(false);

  // Each time the board opens: show the cached board instantly (if any), then refresh once in the
  // background. First open (no cache): wait for the refresh, which also downloads the images.
  async function openBoard() {
    setFailed(false);
    const cached = board ?? await readCachedBoard();
    if (cached) setBoard(cached);
    else setLoading(true);
    try {
      setBoard(await refreshBoard(cached));
    } catch {
      if (!cached) setFailed(true);   // nothing to show yet; with a cache, keep it quietly
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (visible) openBoard();
  }, [visible]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      {/* Tap-to-close layer sits BEHIND the sheet (not wrapping it), so scrolling inside works */}
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close" />
        <View style={styles.sheet}>
          <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.75}>
            <Text style={styles.closeBtnText}>✕</Text>
          </TouchableOpacity>
          {loading ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator size="large" color={COLORS.primary} />
              <Text style={styles.loadingText}>Loading…</Text>
            </View>
          ) : failed || !board ? (
            <View style={styles.loadingWrap}>
              <Text style={styles.loadingText}>Couldn't load the board.{'\n'}Check your connection and try again.</Text>
              <TouchableOpacity style={styles.retryBtn} onPress={openBoard} activeOpacity={0.8}>
                <Text style={styles.retryBtnText}>Try again</Text>
              </TouchableOpacity>
            </View>
          ) : (
          // Scrolls once the board is taller than the sheet's max height (admins can add phrases / symbols)
          <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
            {/* Introductory phrases */}
            <Text style={styles.sectionLabel}>Say hello 👋</Text>
            <View style={styles.phraseGrid}>
              {board.phrases.map(p => (
                <TouchableOpacity
                  key={p.id}
                  style={styles.phraseCell}
                  onPressIn={() => speakLearner(p.label)}
                  onPress={() => { onSend(p.phrase); onClose(); }}
                  activeOpacity={0.7}
                >
                  <Text style={styles.phraseEmoji}>{p.emoji}</Text>
                  <Text style={styles.phraseLabel} numberOfLines={1}>{p.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Picture symbols */}
            <Text style={styles.sectionLabel}>Symbols 🖼️</Text>
            <FlatList
              data={board.symbols}
              numColumns={5}
              keyExtractor={item => item.key}
              scrollEnabled={false}
              contentContainerStyle={styles.grid}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.cell}
                  onPressIn={() => speakLearner(item.label)}
                  onPress={() => { onSend(item.imageUrl); onClose(); }}
                  activeOpacity={0.7}
                >
                  <View style={styles.imgWrap}>
                    <Image
                      source={{ uri: item.localUri }}
                      style={styles.symbolImg}
                      resizeMode="contain"
                    />
                  </View>
                  <Text style={styles.symbolName} numberOfLines={1}>{item.label}</Text>
                </TouchableOpacity>
              )}
            />
          </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingBottom: 32,
    paddingHorizontal: 12,
    maxHeight: '80%',   // board scrolls inside; the ✕ above it stays on screen
  },
  scroll: { flexShrink: 1 },
  closeBtn: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: '#E53E3E',
    justifyContent: 'center', alignItems: 'center',
    alignSelf: 'center',
    marginTop: 16, marginBottom: 12,
    shadowColor: '#E53E3E', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4, shadowRadius: 8, elevation: 6,
  },
  closeBtnText: { fontSize: 22, fontWeight: '900', color: '#fff' },
  title: {
    fontSize: 17, fontWeight: '800', color: COLORS.text,
    textAlign: 'center', marginBottom: 16,
  },
  sectionLabel: {
    fontSize: 13, fontWeight: '700', color: COLORS.textLight,
    textTransform: 'uppercase', letterSpacing: 0.8,
    marginTop: 12, marginBottom: 8, marginLeft: 4,
  },
  phraseGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 8,
  },
  phraseCell: {
    width: '18%', alignItems: 'center', gap: 4,
    backgroundColor: '#F3F0FF', borderRadius: 14, paddingVertical: 10,
  },
  phraseEmoji: { fontSize: 28 },
  phraseLabel: { fontSize: 10, fontWeight: '600', color: COLORS.text, textAlign: 'center' },

  loadingWrap: {
    height: 160, justifyContent: 'center', alignItems: 'center', gap: 16,
  },
  loadingText: {
    fontSize: 14, color: COLORS.textLight, textAlign: 'center', lineHeight: 22,
  },
  retryBtn: {
    paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20, backgroundColor: COLORS.primary,
  },
  retryBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },
  grid: {
    gap: 8,
  },
  cell: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    gap: 6,
    borderRadius: 14,
  },
  imgWrap: {
    width: 56, height: 56,
    backgroundColor: '#F0F4F8',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  symbolImg: {
    width: 48,
    height: 48,
  },
  symbolName: {
    fontSize: 11, fontWeight: '600',
    color: COLORS.text,
    textAlign: 'center',
  },
});
