import React, { useState } from 'react';
import {
  View, TouchableOpacity, Modal, FlatList, StyleSheet, SafeAreaView,
} from 'react-native';
import AppText from './AppText';
import {
  NICO, TEXT_STYLE, SPACING, RADIUS, FONT_SIZE, FONT_WEIGHT,
} from '../constants/theme';

interface Props {
  label: string;
  value: string;
  options: string[];
  onSelect: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

export default function DropdownPicker({ label, value, options, onSelect, placeholder = 'Select...', disabled }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <AppText style={styles.label}>{label}</AppText>
      <TouchableOpacity
        style={[styles.picker, disabled && styles.pickerDisabled]}
        onPress={() => !disabled && setOpen(true)}
        activeOpacity={disabled ? 1 : 0.7}
      >
        <AppText style={value ? styles.value : styles.placeholder}>{value || placeholder}</AppText>
        {!disabled && <AppText style={styles.arrow}>▼</AppText>}
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setOpen(false)}>
          <SafeAreaView style={styles.sheet} onStartShouldSetResponder={() => true}>
            <View style={styles.sheetHeader}>
              <AppText style={styles.sheetTitle}>{label}</AppText>
              <TouchableOpacity onPress={() => setOpen(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <AppText style={styles.done}>Done</AppText>
              </TouchableOpacity>
            </View>
            <FlatList
              data={options}
              keyExtractor={item => item}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.option, item === value && styles.optionActive]}
                  onPress={() => { onSelect(item); setOpen(false); }}
                >
                  <AppText style={[styles.optionText, item === value && styles.optionTextActive]}>{item}</AppText>
                  {item === value && <AppText style={styles.check}>✓</AppText>}
                </TouchableOpacity>
              )}
            />
          </SafeAreaView>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  label: { ...TEXT_STYLE.fieldLabel, marginBottom: SPACING.sm, marginTop: SPACING.base },
  picker: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: NICO.surface, borderWidth: 1.5, borderColor: NICO.border,
    borderRadius: RADIUS.md, padding: SPACING.md, marginBottom: 4,
  },
  pickerDisabled: { backgroundColor: NICO.background },
  value: { fontSize: FONT_SIZE.lg, color: NICO.text },
  placeholder: { fontSize: FONT_SIZE.lg, color: NICO.textMuted },
  arrow: { fontSize: FONT_SIZE.sm, color: NICO.textMuted },
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: { backgroundColor: NICO.surface, borderTopLeftRadius: RADIUS['3xl'], borderTopRightRadius: RADIUS['3xl'], maxHeight: '60%' },
  sheetHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: SPACING.base, borderBottomWidth: 1, borderBottomColor: NICO.border,
  },
  sheetTitle: { fontSize: FONT_SIZE.xl, fontWeight: FONT_WEIGHT.extraBold, color: NICO.text },
  done: { fontSize: FONT_SIZE.xl, color: NICO.primary, fontWeight: FONT_WEIGHT.bold },
  option: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: SPACING.base, borderBottomWidth: 1, borderBottomColor: NICO.border,
  },
  optionActive: { backgroundColor: NICO.primaryLight },
  optionText: { fontSize: FONT_SIZE.lg, color: NICO.text },
  optionTextActive: { color: NICO.primary, fontWeight: FONT_WEIGHT.bold },
  check: { color: NICO.primary, fontSize: FONT_SIZE.lg, fontWeight: FONT_WEIGHT.bold },
});
