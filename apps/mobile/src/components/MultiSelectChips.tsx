import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import AppText from './AppText';
import {
  NICO, TEXT_STYLE, SPACING, RADIUS, FONT_SIZE, FONT_WEIGHT,
} from '../constants/theme';

interface Props {
  options: string[];
  selected: string[];
  onToggle: (selected: string[]) => void;
  single?: boolean;
  max?: number;
}

export default function MultiSelectChips({ options, selected, onToggle, single, max }: Props) {
  function toggle(option: string) {
    if (single) {
      onToggle([option]);
      return;
    }
    if (selected.includes(option)) {
      onToggle(selected.filter(s => s !== option));
    } else {
      if (max !== undefined && selected.length >= max) return;
      onToggle([...selected, option]);
    }
  }

  const limitReached = max !== undefined && selected.length >= max;

  return (
    <View>
      {max && <AppText style={styles.limitHint}>{selected.length}/{max} selected</AppText>}
      <View style={styles.container}>
        {options.map(option => {
          const active = selected.includes(option);
          const disabled = !active && limitReached;
          return (
            <TouchableOpacity
              key={option}
              style={[styles.chip, active && styles.chipActive, disabled && styles.chipDisabled]}
              onPress={() => toggle(option)}
              delayPressIn={50}
              activeOpacity={disabled ? 1 : 0.7}
            >
              <AppText style={[styles.chipText, active && styles.chipTextActive, disabled && styles.chipTextDisabled]}>
                {option}
              </AppText>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  limitHint: { ...TEXT_STYLE.caption, marginBottom: SPACING.sm },
  container: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  chip: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.full,
    borderWidth: 1.5,
    borderColor: NICO.border,
    backgroundColor: NICO.surface,
  },
  chipActive: { borderColor: NICO.primary, backgroundColor: NICO.primaryLight },
  chipDisabled: { opacity: 0.35 },
  chipText: { fontSize: FONT_SIZE.md, color: NICO.text, fontWeight: FONT_WEIGHT.medium },
  chipTextActive: { color: NICO.primary, fontWeight: FONT_WEIGHT.bold },
  chipTextDisabled: { color: NICO.textMuted },
});
