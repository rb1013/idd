import React, { useState } from 'react';
import {
  View, TouchableOpacity, Modal, FlatList, StyleSheet, StyleProp, ViewStyle,
} from 'react-native';
import AppText from './AppText';
import { CA_COUNTIES } from '../constants/caCounties';
import {
  NICO, SPACING, RADIUS, FONT_SIZE, FONT_WEIGHT, INPUT,
} from '../constants/theme';

const ALL_COUNTIES = 'All Counties';

interface Props {
  value: string;
  onSelect: (county: string) => void;
  placeholder?: string;
  icon?: string;
  style?: StyleProp<ViewStyle>;
}

export default function CountyFilterPill({ value, onSelect, placeholder = 'County…', icon, style }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <TouchableOpacity style={[styles.row, style]} onPress={() => setOpen(true)} activeOpacity={0.75}>
        {icon && <AppText style={styles.icon}>{icon}</AppText>}
        <AppText style={[styles.text, !value && styles.placeholder]} numberOfLines={1}>
          {value || placeholder}
        </AppText>
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={() => setOpen(false)}>
          <View style={styles.sheet} onStartShouldSetResponder={() => true}>
            <View style={styles.sheetHdr}>
              <AppText style={styles.sheetTitle}>Select County</AppText>
              <TouchableOpacity onPress={() => setOpen(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <AppText style={styles.sheetDone}>Done</AppText>
              </TouchableOpacity>
            </View>
            <FlatList
              data={[ALL_COUNTIES, ...CA_COUNTIES]}
              keyExtractor={item => item}
              style={styles.list}
              renderItem={({ item }) => {
                const selected = item === ALL_COUNTIES ? value === '' : value === item;
                return (
                  <TouchableOpacity
                    style={[styles.item, selected && styles.itemSelected]}
                    onPress={() => { onSelect(item === ALL_COUNTIES ? '' : item); setOpen(false); }}
                  >
                    <AppText style={[styles.itemText, selected && styles.itemTextSelected]}>{item}</AppText>
                    {selected && <AppText style={styles.check}>✓</AppText>}
                  </TouchableOpacity>
                );
              }}
              ItemSeparatorComponent={() => <View style={styles.divider} />}
            />
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  row: {
    ...INPUT.base, borderWidth: 0,
    flexDirection: 'row', alignItems: 'center', gap: SPACING.xs,
  },
  icon: { fontSize: FONT_SIZE.sm },
  text: { flex: 1, fontSize: FONT_SIZE.md, color: NICO.text },
  placeholder: { color: NICO.textMuted },

  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: NICO.surface, borderTopLeftRadius: RADIUS['3xl'], borderTopRightRadius: RADIUS['3xl'],
    maxHeight: '70%',
  },
  sheetHdr: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: SPACING.lg, borderBottomWidth: 1, borderBottomColor: NICO.border,
  },
  sheetTitle: { fontSize: FONT_SIZE.xl, fontWeight: FONT_WEIGHT.extraBold, color: NICO.text },
  sheetDone: { fontSize: FONT_SIZE.lg, fontWeight: FONT_WEIGHT.bold, color: NICO.primary },
  list: { flexGrow: 0 },
  item: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg, paddingVertical: SPACING.base,
  },
  itemSelected: { backgroundColor: NICO.primaryLight },
  itemText: { fontSize: FONT_SIZE.lg, color: NICO.text },
  itemTextSelected: { fontWeight: FONT_WEIGHT.bold, color: NICO.primary },
  check: { fontSize: FONT_SIZE.lg, color: NICO.primary, fontWeight: FONT_WEIGHT.bold },
  divider: { height: 1, backgroundColor: NICO.border, marginHorizontal: SPACING.lg },
});
