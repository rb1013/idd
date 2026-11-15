import React from 'react';
import { ScrollView, TouchableOpacity, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import AppText from './AppText';
import { NICO, TEXT_STYLE, SPACING, RADIUS, FONT_SIZE, FONT_WEIGHT } from '../constants/theme';

export type ActiveFilterChip = {
  key: string;
  label: string;
  onRemove: () => void;
};

type Props = {
  chips: ActiveFilterChip[];
  onClearAll: () => void;
  /** Capitalize chip labels (e.g. lowercase values like "easy") */
  capitalize?: boolean;
  /** Override the row's padding, e.g. when the parent already pads horizontally */
  contentStyle?: StyleProp<ViewStyle>;
};

/**
 * Removable chips for filters chosen in a FilterSheet, shown under the "More Filters" link.
 * Renders nothing when no filters are active.
 */
export default function ActiveFilterChips({ chips, onClearAll, capitalize = false, contentStyle }: Props) {
  if (chips.length === 0) return null;

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.row} contentContainerStyle={[s.content, contentStyle]}>
      {chips.map(c => (
        <TouchableOpacity key={c.key} style={s.chip} onPress={c.onRemove} activeOpacity={0.75}>
          <AppText style={[s.chipText, capitalize && s.capitalize]}>{c.label}</AppText>
          <AppText style={s.chipX}>×</AppText>
        </TouchableOpacity>
      ))}
      <TouchableOpacity style={s.clearAll} onPress={onClearAll} activeOpacity={0.75}>
        <AppText style={s.clearAllText}>Clear all</AppText>
      </TouchableOpacity>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  row:     { maxHeight: 48, flexGrow: 0 },
  content: { paddingHorizontal: SPACING.base, paddingBottom: SPACING.sm, gap: SPACING.sm, alignItems: 'center' },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: NICO.primaryLight, borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.md, paddingVertical: 6,
  },
  chipText:   { ...TEXT_STYLE.caption, fontSize: FONT_SIZE.md, color: NICO.primary },
  capitalize: { textTransform: 'capitalize' },
  chipX:      { fontSize: FONT_SIZE.lg, color: NICO.primary, fontWeight: FONT_WEIGHT.bold },
  clearAll: {
    paddingHorizontal: SPACING.md, paddingVertical: 6,
    borderRadius: RADIUS.full, borderWidth: 1, borderColor: NICO.border,
  },
  clearAllText: { ...TEXT_STYLE.caption, fontSize: FONT_SIZE.md, color: NICO.textMuted },
});
