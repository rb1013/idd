import React, { useState } from 'react';
import { Modal, View, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import AppText from './AppText';
import { NICO, SPACING, RADIUS, FONT_SIZE, FONT_WEIGHT, BTN_SIZE, BTN_VARIANT } from '../constants/theme';

export type FilterSheetOption = {
  key: string;
  label: string;
  capitalize?: boolean;
};

export type FilterSheetSection = {
  key: string;
  emoji?: string;
  title: string;
  /** 'multi' (default) toggles individual items; 'single' replaces selection */
  type?: 'multi' | 'single';
  options: FilterSheetOption[];
  selected: string[];
  onToggle: (key: string) => void;
};

type Props = {
  visible: boolean;
  title?: string;
  sections: FilterSheetSection[];
  onClearAll: () => void;
  onDone: () => void;
  /** Optional extra content rendered inside the scroll area below all sections. */
  extraContent?: React.ReactNode;
  /** Set true when extraContent has active state, so "Clear all" stays visible. */
  hasExtraActive?: boolean;
};

export default function FilterSheet({ visible, title = 'More Filters', sections, onClearAll, onDone, extraContent, hasExtraActive }: Props) {
  // accordion: one section open at a time (null = all closed)
  const [openId, setOpenId] = useState<string | null>(null);

  const hasAnyActive = hasExtraActive || sections.some(s => s.selected.length > 0);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onDone}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onDone}>
        <View style={styles.sheet} onStartShouldSetResponder={() => true}>

          {/* Header */}
          <View style={styles.hdr}>
            <AppText style={styles.hdrTitle}>{title}</AppText>
            {hasAnyActive && (
              <TouchableOpacity onPress={onClearAll} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <AppText style={styles.hdrClear}>Clear all</AppText>
              </TouchableOpacity>
            )}
          </View>

          {/* Sections */}
          <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {sections.map(section => {
              const isOpen = openId === section.key;
              const activeCount = section.type === 'single' ? 0 : section.selected.length;

              return (
                <View key={section.key} style={styles.section}>
                  {/* Section header (accordion toggle) */}
                  <TouchableOpacity
                    style={styles.secHdr}
                    onPress={() => setOpenId(isOpen ? null : section.key)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.secHdrLeft}>
                      {section.emoji != null && (
                        <AppText style={styles.secEmoji}>{section.emoji}</AppText>
                      )}
                      <AppText style={styles.secTitle}>{section.title}</AppText>
                      {activeCount > 0 && (
                        <View style={styles.badge}>
                          <AppText style={styles.badgeText}>{activeCount}</AppText>
                        </View>
                      )}
                    </View>
                    <AppText style={styles.secChevron}>{isOpen ? '▲' : '▼'}</AppText>
                  </TouchableOpacity>

                  {/* Options (shown when open) */}
                  {isOpen && section.options.map(opt => {
                    const selected = section.selected.includes(opt.key);
                    const handlePress = () => {
                      if (section.type === 'single') {
                        section.onToggle(opt.key);
                      } else {
                        section.onToggle(opt.key);
                      }
                    };
                    return (
                      <TouchableOpacity
                        key={opt.key}
                        style={[styles.option, selected && styles.optionActive]}
                        onPress={handlePress}
                        activeOpacity={0.7}
                      >
                        <AppText style={[
                          styles.optionText,
                          selected && styles.optionTextActive,
                          opt.capitalize && { textTransform: 'capitalize' as const },
                        ]}>
                          {opt.label}
                        </AppText>
                        <View style={[styles.check, selected && styles.checkActive]}>
                          {selected && <AppText style={styles.checkMark}>✓</AppText>}
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              );
            })}
            {extraContent}
          </ScrollView>

          {/* Done button */}
          <TouchableOpacity style={styles.doneBtn} onPress={onDone}>
            <AppText style={styles.doneBtnText}>Done</AppText>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: NICO.screenBg,
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    paddingBottom: SPACING.xl,
    maxHeight: '85%',
  },

  // Header
  hdr: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.base,
    borderBottomWidth: 1,
    borderBottomColor: NICO.border,
  },
  hdrTitle: {
    fontSize: FONT_SIZE.lg,
    fontWeight: FONT_WEIGHT.extraBold,
    color: NICO.text,
  },
  hdrClear: {
    fontSize: FONT_SIZE.base,
    fontWeight: FONT_WEIGHT.semiBold,
    color: NICO.primary,
  },

  scroll: { maxHeight: '75%' },

  // Section accordion
  section: {
    borderBottomWidth: 1,
    borderBottomColor: NICO.border,
  },
  secHdr: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.base,
  },
  secHdrLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    flex: 1,
  },
  secEmoji: { fontSize: FONT_SIZE.md },
  secTitle: {
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.bold,
    color: NICO.text,
  },
  secChevron: {
    fontSize: FONT_SIZE.xs,
    color: NICO.textMuted,
  },

  // Badge on section header
  badge: {
    backgroundColor: NICO.primary,
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.xs,
    paddingVertical: 1,
    minWidth: 18,
    alignItems: 'center',
  },
  badgeText: {
    fontSize: FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.extraBold,
    color: NICO.textOnAccent,
  },

  // Option row
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.base,
    borderTopWidth: 1,
    borderTopColor: NICO.border,
  },
  optionActive: { backgroundColor: NICO.primaryLight },
  optionText: {
    flex: 1,
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.medium,
    color: NICO.text,
  },
  optionTextActive: {
    color: NICO.primary,
    fontWeight: FONT_WEIGHT.semiBold,
  },

  // Checkbox
  check: {
    width: 22,
    height: 22,
    borderRadius: RADIUS.xs,
    borderWidth: 2,
    borderColor: NICO.border,
    backgroundColor: NICO.screenBg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkActive: { backgroundColor: NICO.primary, borderColor: NICO.primary },
  checkMark: {
    color: NICO.textOnAccent,
    fontSize: FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.extraBold,
  },

  // Done button
  doneBtn: {
    marginHorizontal: SPACING.lg,
    marginTop: SPACING.base,
    ...BTN_SIZE.lg,
    ...BTN_VARIANT.primary,
  },
  doneBtnText: {
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.bold,
    color: NICO.textOnAccent,
  },
});
