import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, Modal, FlatList,
  StyleSheet, SafeAreaView,
} from 'react-native';
import { COLORS } from '../constants';

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
      <Text style={s.label}>{label}</Text>

      <TouchableOpacity style={s.trigger} onPress={() => setOpen(true)} activeOpacity={0.75}>
        <Text style={selected.length === 0 ? s.placeholder : s.triggerValue} numberOfLines={1}>
          {triggerLabel}
        </Text>
        <Text style={s.arrow}>▼</Text>
      </TouchableOpacity>

      {selected.length > 0 && (
        <View style={s.chips}>
          {selected.map(opt => (
            <TouchableOpacity key={opt} style={s.chip} onPress={() => toggle(opt)} activeOpacity={0.7}>
              <Text style={s.chipText}>{opt}</Text>
              <Text style={s.chipX}>×</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={() => setOpen(false)}>
          <SafeAreaView style={s.sheet}>
            <View style={s.sheetHeader}>
              <Text style={s.sheetTitle}>{label}</Text>
              <TouchableOpacity onPress={() => setOpen(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Text style={s.done}>Done</Text>
              </TouchableOpacity>
            </View>
            <FlatList
              data={options}
              keyExtractor={item => item}
              renderItem={({ item }) => {
                const on = selected.includes(item);
                return (
                  <TouchableOpacity style={s.option} onPress={() => toggle(item)} activeOpacity={0.7}>
                    <Text style={[s.optionText, on && s.optionTextOn]}>{item}</Text>
                    <View style={[s.checkbox, on && s.checkboxOn]}>
                      {on && <Text style={s.checkmark}>✓</Text>}
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
  label: { fontSize: 14, fontWeight: '600', color: COLORS.bloomText, marginBottom: 8, marginTop: 16 },

  trigger: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: COLORS.bloomCard, borderWidth: 1, borderColor: COLORS.bloomBorder,
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 14, marginBottom: 4,
  },
  triggerValue: { fontSize: 15, color: COLORS.bloomText, flex: 1 },
  placeholder:  { fontSize: 15, color: COLORS.bloomMuted, flex: 1 },
  arrow: { fontSize: 11, color: COLORS.bloomMuted, marginLeft: 8 },

  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6, marginBottom: 4 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: COLORS.bloomActiveBg, borderRadius: 20,
    borderWidth: 1, borderColor: COLORS.bloomSageMid,
    paddingHorizontal: 10, paddingVertical: 5,
  },
  chipText: { fontSize: 13, color: COLORS.bloomActiveText, fontWeight: '600' },
  chipX:    { fontSize: 14, color: COLORS.bloomActiveText, fontWeight: '700', lineHeight: 16 },

  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: {
    backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '65%',
  },
  sheetHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 16, borderBottomWidth: 1, borderBottomColor: COLORS.bloomBorder,
  },
  sheetTitle: { fontSize: 16, fontWeight: '700', color: COLORS.bloomText },
  done:       { fontSize: 16, color: COLORS.bloomActiveText, fontWeight: '700' },

  option: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: COLORS.bloomBorder,
  },
  optionText:   { fontSize: 15, color: COLORS.bloomText, flex: 1, fontWeight: '400' },
  optionTextOn: { color: COLORS.bloomActiveText, fontWeight: '700' },

  checkbox: {
    width: 22, height: 22, borderRadius: 6,
    borderWidth: 1.5, borderColor: COLORS.bloomBorder,
    justifyContent: 'center', alignItems: 'center',
  },
  checkboxOn: { backgroundColor: COLORS.bloomAccent, borderColor: COLORS.bloomAccent },
  checkmark:  { color: '#fff', fontSize: 13, fontWeight: '900' },
});
