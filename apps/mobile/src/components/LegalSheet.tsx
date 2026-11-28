import React, { useEffect, useRef, useState } from 'react';
import { Modal, View, ScrollView, TouchableOpacity, Pressable, StyleSheet, type ScrollViewInstance } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AppText from './AppText';
import { LEGAL_CONTENT, LegalBlock, LegalSectionKey } from '../constants/legalContent';
import { NICO, SPACING, RADIUS, FONT_SIZE, FONT_WEIGHT, MAX_CONTENT_WIDTH } from '../constants/theme';

const TABS: { key: LegalSectionKey; label: string }[] = [
  { key: 'privacy', label: 'Privacy' },
  { key: 'terms',   label: 'Terms' },
  { key: 'credits', label: 'Credits' },
];

interface Props {
  visible: boolean;
  /** Tab to show when the sheet opens */
  initialTab?: LegalSectionKey;
  onClose: () => void;
}

/** Privacy Policy / Terms of Service / Credits & Licenses, read in-app (content: constants/legalContent.ts). */
export default function LegalSheet({ visible, initialTab = 'privacy', onClose }: Props) {
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<LegalSectionKey>(initialTab);
  const scrollRef = useRef<ScrollViewInstance>(null);

  // Open on the tab the caller asked for
  useEffect(() => { if (visible) setTab(initialTab); }, [visible, initialTab]);

  function switchTab(key: LegalSectionKey) {
    setTab(key);
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }

  const section = LEGAL_CONTENT[tab];

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={s.overlay}>
        {/* Tap outside the sheet to close */}
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close" />

        <View style={[s.sheet, { paddingBottom: Math.max(insets.bottom, SPACING.base) }]}>
          {/* Header */}
          <View style={s.hdr}>
            <AppText style={s.hdrTitle}>{section.title}</AppText>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} accessibilityLabel="Close">
              <AppText style={s.close}>✕</AppText>
            </TouchableOpacity>
          </View>

          {/* Tabs */}
          <View style={s.tabs}>
            {TABS.map(t => (
              <TouchableOpacity key={t.key} style={[s.tab, tab === t.key && s.tabActive]} onPress={() => switchTab(t.key)} activeOpacity={0.8}>
                <AppText style={[s.tabTxt, tab === t.key && s.tabTxtActive]}>{t.label}</AppText>
              </TouchableOpacity>
            ))}
          </View>

          <ScrollView ref={scrollRef} style={s.scroll} contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator>
            {section.blocks.map((b, i) => <Block key={`${tab}-${i}`} block={b} />)}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

/** Text with **bold** segments */
function Rich({ text, style }: { text: string; style: any }) {
  const parts = text.split(/\*\*(.+?)\*\*/g);
  return (
    <AppText style={style}>
      {parts.map((p, i) => (i % 2 === 1 ? <AppText key={i} style={[style, s.bold]}>{p}</AppText> : p))}
    </AppText>
  );
}

function Block({ block }: { block: LegalBlock }) {
  switch (block.t) {
    case 'h3': return <Rich text={block.text} style={s.h3} />;
    case 'h4': return <Rich text={block.text} style={s.h4} />;
    case 'p':  return <Rich text={block.text} style={s.p} />;
    case 'ul':
      return (
        <View style={s.list}>
          {block.items.map((item, i) => (
            <View key={i} style={s.li}>
              <AppText style={s.bullet}>•</AppText>
              <Rich text={item} style={[s.p, s.liText]} />
            </View>
          ))}
        </View>
      );
    case 'table':
      // A table doesn't fit a phone's width — one card per row, each cell labelled with its column
      return (
        <View style={s.list}>
          {block.rows.map((row, r) => (
            <View key={r} style={s.card}>
              {row.map((cell, c) => (
                c === 0
                  ? <Rich key={c} text={cell} style={s.cardTitle} />
                  : (
                    <View key={c}>
                      <AppText style={s.cardLabel}>{block.head[c]}</AppText>
                      <Rich text={cell} style={s.p} />
                    </View>
                  )
              ))}
            </View>
          ))}
        </View>
      );
  }
}

const s = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: {
    height: '90%', width: '100%', maxWidth: MAX_CONTENT_WIDTH, alignSelf: 'center',
    backgroundColor: NICO.screenBg,
    borderTopLeftRadius: RADIUS.xl, borderTopRightRadius: RADIUS.xl,
  },

  hdr: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg, paddingVertical: SPACING.base,
  },
  hdrTitle: { fontSize: FONT_SIZE.lg, fontWeight: FONT_WEIGHT.extraBold, color: NICO.text, flexShrink: 1 },
  close:    { fontSize: FONT_SIZE.xl, fontWeight: FONT_WEIGHT.bold, color: NICO.textMuted },

  tabs: {
    flexDirection: 'row', paddingHorizontal: SPACING.lg, gap: SPACING.sm,
    paddingBottom: SPACING.sm, borderBottomWidth: 1, borderBottomColor: NICO.border,
  },
  tab:          { paddingVertical: SPACING.xs, paddingHorizontal: SPACING.md, borderRadius: RADIUS.full, backgroundColor: NICO.background },
  tabActive:    { backgroundColor: NICO.primary },
  tabTxt:       { fontSize: FONT_SIZE.md, fontWeight: FONT_WEIGHT.semiBold, color: NICO.text },
  tabTxtActive: { color: NICO.textOnAccent, fontWeight: FONT_WEIGHT.bold },

  scroll:        { flex: 1 },
  scrollContent: { paddingHorizontal: SPACING.lg, paddingTop: SPACING.base, paddingBottom: SPACING.xl, gap: SPACING.sm },

  h3:   { fontSize: FONT_SIZE.lg, fontWeight: FONT_WEIGHT.extraBold, color: NICO.text, marginTop: SPACING.md },
  h4:   { fontSize: FONT_SIZE.md, fontWeight: FONT_WEIGHT.bold, color: NICO.text, marginTop: SPACING.xs },
  p:    { fontSize: FONT_SIZE.md, fontWeight: FONT_WEIGHT.regular, color: NICO.text, lineHeight: 21 },
  bold: { fontWeight: FONT_WEIGHT.bold },

  list:   { gap: SPACING.xs },
  li:     { flexDirection: 'row', gap: SPACING.sm },
  bullet: { fontSize: FONT_SIZE.md, color: NICO.text, lineHeight: 21 },
  liText: { flex: 1 },

  card:      { backgroundColor: NICO.backgroundLight, borderRadius: RADIUS.md, padding: SPACING.md, gap: SPACING.xs },
  cardTitle: { fontSize: FONT_SIZE.md, fontWeight: FONT_WEIGHT.regular, color: NICO.text },
  cardLabel: { fontSize: FONT_SIZE.xs, fontWeight: FONT_WEIGHT.bold, color: NICO.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },
});
