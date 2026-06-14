import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { COLORS } from '../constants';

interface Props {
  options: string[];
  selected: string[];
  onToggle: (selected: string[]) => void;
  single?: boolean;
}

export default function MultiSelectChips({ options, selected, onToggle, single }: Props) {
  function toggle(option: string) {
    if (single) {
      onToggle([option]);
      return;
    }
    if (selected.includes(option)) {
      onToggle(selected.filter(s => s !== option));
    } else {
      onToggle([...selected, option]);
    }
  }

  return (
    <View style={styles.container}>
      {options.map(option => {
        const active = selected.includes(option);
        return (
          <TouchableOpacity
            key={option}
            style={[styles.chip, active && styles.chipActive]}
            onPress={() => toggle(option)}
            delayPressIn={50}
          >
            <Text style={[styles.chipText, active && styles.chipTextActive]}>{option}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  chipActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primaryLight },
  chipText: { fontSize: 14, color: COLORS.textLight },
  chipTextActive: { color: COLORS.primaryDark, fontWeight: '600' },
});
