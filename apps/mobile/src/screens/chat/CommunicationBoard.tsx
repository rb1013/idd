import React, { useEffect, useState } from 'react';
import {
  Modal, View, Text, StyleSheet, TouchableOpacity,
  Image, ActivityIndicator, FlatList, ScrollView,
} from 'react-native';
import * as Speech from 'expo-speech';
import { loadAACSymbols, AACSymbol, PHRASE_SYMBOLS, PhraseSymbol } from '../../lib/aacSymbols';
import { COLORS } from '../../constants';

interface Props {
  visible: boolean;
  onClose: () => void;
  onSend: (imageUrl: string) => void;
}

export default function CommunicationBoard({ visible, onClose, onSend }: Props) {
  const [symbols, setSymbols] = useState<AACSymbol[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (visible && symbols.length === 0) {
      setLoading(true);
      loadAACSymbols().then(s => {
        setSymbols(s);
        setLoading(false);
      });
    }
  }, [visible]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={styles.backdrop} onPress={onClose} activeOpacity={1}>
        <View style={styles.sheet} onStartShouldSetResponder={() => true}>
          <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.75}>
            <Text style={styles.closeBtnText}>✕</Text>
          </TouchableOpacity>
          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Introductory phrases */}
            <Text style={styles.sectionLabel}>Say hello 👋</Text>
            <View style={styles.phraseGrid}>
              {PHRASE_SYMBOLS.map(p => (
                <TouchableOpacity
                  key={p.phrase}
                  style={styles.phraseCell}
                  onPressIn={() => Speech.speak(p.label, { rate: 0.65, pitch: 1.0 })}
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
            {loading ? (
              <View style={styles.loadingWrap}>
                <ActivityIndicator size="large" color={COLORS.primary} />
                <Text style={styles.loadingText}>Downloading symbols…{'\n'}This only happens once.</Text>
              </View>
            ) : (
              <FlatList
                data={symbols}
                numColumns={5}
                keyExtractor={item => item.keyword}
                scrollEnabled={false}
                contentContainerStyle={styles.grid}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.cell}
                    onPressIn={() => Speech.speak(item.name, { rate: 0.65, pitch: 1.0 })}
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
                    <Text style={styles.symbolName} numberOfLines={1}>{item.name}</Text>
                  </TouchableOpacity>
                )}
              />
            )}
          </ScrollView>
        </View>
      </TouchableOpacity>
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
  },
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
