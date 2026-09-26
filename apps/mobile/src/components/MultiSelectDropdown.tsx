import React, { useState } from 'react';
import {
  View, TouchableOpacity, Modal, FlatList,
  StyleSheet, SafeAreaView,
} from 'react-native';
import AppText from './AppText';
import {
  NICO, TEXT_STYLE, SPACING, RADIUS, FONT_SIZE, FONT_WEIGHT,
} from '../constants/theme';

interface Props {
  label: string;
  options: string[];
  selected: string[];
  onToggle: (selected: string[]) => void;
  placeholder?: string;
}

export default function MultiSelectDropdown({ label, options, selected, onToggle, placeholder = 'Select...' }: Props) {
  const [open, setOpen] = useState(false);

  function toggle(opt: string) {
    if (selected.includes(opt)) {
      onToggle(selected.filter(s => s !== opt));
    } else {
      onToggle([...selected, opt]);
    }
  }

  const triggerLabel = selected.length === 0
    ? placeholder
    : `${selected.length} selected`;

  return (
    <>
      <AppText style={s.label}>{label}</AppText>

      <TouchableOpacity style={s.trigger} onPress={() => setOpen(true)} activeOpacity={0.75}>
        <AppText style={selected.length === 0 ? s.placeholder : s.triggerValue} numberOfLines={1}>
          {triggerLabel}
        </AppText>
        <AppText style={s.arrow}>▼</AppText>
      </TouchableOpacity>

      {selected.length > 0 && (
        <View style={s.chips}>
          {selected.map(opt => (
            <TouchableOpacity key={opt} style={s.chip} onPress={() => toggle(opt)} activeOpacity={0.7}>
              <AppText style={s.chipText}>{opt}</AppText>
              <AppText style={s.chipX}>×</AppText>
            </TouchableOpacity>
          ))}
        </View>
      )}

      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={() => setOpen(false)}>
          <SafeAreaView style={s.sheet} onStartShouldSetResponder={() => true}>
            <View style={s.sheetHeader}>
              <AppText style={s.sheetTitle}>{label}</AppText>
              <TouchableOpacity onPress={() => setOpen(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <AppText style={s.done}>Done</AppText>
              </TouchableOpacity>
            </View>
            <FlatList
              data={options}
              keyExtractor={item => item}
              renderItem={({ item }) => {
                const on = selected.includes(item);
                return (
                  <TouchableOpacity style={s.option} onPress={() => toggle(item)} activeOpacity={0.7}>
                    <AppText style={[s.optionText, on && s.optionTextOn]}>{item}</AppText>
                    <View style={[s.checkbox, on && s.checkboxOn]}>
                      {on && <AppText style={s.checkmark}>✓</AppText>}
                    </View>
                  </TouchableOpacity>
                );
              }}
            />
          </SafeAreaView>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

const s = StyleSheet.create({
  label: { ...TEXT_STYLE.fieldLabel, marginBottom: SPACING.sm, marginTop: SPACING.base },

  trigger: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: NICO.surface, borderWidth: 1.5, borderColor: NICO.border,
    borderRadius: RADIUS.md, paddingHorizontal: SPACING.md, paddingVertical: SPACING.md, marginBottom: 4,
  },
  triggerValue: { fontSize: FONT_SIZE.lg, color: NICO.text, flex: 1 },
  placeholder:  { fontSize: FONT_SIZE.lg, color: NICO.textMuted, flex: 1 },
  arrow: { fontSize: FONT_SIZE.sm, color: NICO.textMuted, marginLeft: SPACING.sm },

  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.xs, marginTop: SPACING.xs, marginBottom: 4 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: NICO.primaryLight, borderRadius: RADIUS.full,
    borderWidth: 1, borderColor: NICO.primary,
    paddingHorizontal: SPACING.sm, paddingVertical: 5,
  },
  chipText: { fontSize: FONT_SIZE.base, color: NICO.primary, fontWeight: FONT_WEIGHT.bold },
  chipX:    { fontSize: FONT_SIZE.md, color: NICO.primary, fontWeight: FONT_WEIGHT.bold, lineHeight: 16 },

  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: {
    backgroundColor: NICO.surface, borderTopLeftRadius: RADIUS['3xl'], borderTopRightRadius: RADIUS['3xl'], maxHeight: '65%',
  },
  sheetHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: SPACING.base, borderBottomWidth: 1, borderBottomColor: NICO.border,
  },
  sheetTitle: { fontSize: FONT_SIZE.xl, fontWeight: FONT_WEIGHT.extraBold, color: NICO.text },
  done:       { fontSize: FONT_SIZE.xl, color: NICO.primary, fontWeight: FONT_WEIGHT.bold },

  option: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: SPACING.base, paddingVertical: SPACING.md,
    borderBottomWidth: 1, borderBottomColor: NICO.border,
  },
  optionText:   { fontSize: FONT_SIZE.lg, color: NICO.text, flex: 1, fontWeight: FONT_WEIGHT.regular },
  optionTextOn: { color: NICO.primary, fontWeight: FONT_WEIGHT.bold },

  checkbox: {
    width: 22, height: 22, borderRadius: RADIUS.xs,
    borderWidth: 1.5, borderColor: NICO.border,
    justifyContent: 'center', alignItems: 'center',
  },
  checkboxOn: { backgroundColor: NICO.primary, borderColor: NICO.primary },
  checkmark:  { color: NICO.textOnAccent, fontSize: FONT_SIZE.base, fontWeight: FONT_WEIGHT.black },
});
