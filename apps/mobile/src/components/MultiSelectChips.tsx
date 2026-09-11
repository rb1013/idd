import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { COLORS } from '../constants';

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
      {max && <Text style={styles.limitHint}>{selected.length}/{max} selected</Text>}
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
              <Text style={[styles.chipText, active && styles.chipTextActive, disabled && styles.chipTextDisabled]}>
                {option}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  limitHint: { fontSize: 12, color: COLORS.textLight, marginBottom: 8 },
  container: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: COLORS.bloomBorder,
    backgroundColor: COLORS.bloomCard,
  },
  chipActive: { borderColor: COLORS.bloomSageMid, backgroundColor: COLORS.bloomActiveBg },
  chipDisabled: { opacity: 0.35 },
  chipText: { fontSize: 14, color: COLORS.bloomText, fontWeight: '500' },
  chipTextActive: { color: COLORS.bloomActiveText, fontWeight: '700' },
  chipTextDisabled: { color: COLORS.bloomMuted },
});
