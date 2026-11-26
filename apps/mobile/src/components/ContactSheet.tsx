import React from 'react';
import { Modal, View, TouchableOpacity, Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AppText from './AppText';
import { SUPPORT_EMAIL } from '../constants/legal';
import { NICO, SPACING, RADIUS, FONT_SIZE, FONT_WEIGHT, MAX_CONTENT_WIDTH } from '../constants/theme';

interface Props {
  visible: boolean;
  onClose: () => void;
}

/** Contact Us — same text as the Support page's Contact Us card; the email is plain text, not a link. */
export default function ContactSheet({ visible, onClose }: Props) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={s.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close" />

        <View style={[s.sheet, { paddingBottom: Math.max(insets.bottom, SPACING.base) + SPACING.sm }]}>
          <View style={s.hdr}>
            <AppText style={s.hdrTitle}>Contact Us</AppText>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} accessibilityLabel="Close">
              <AppText style={s.close}>✕</AppText>
            </TouchableOpacity>
          </View>

          <View style={s.body}>
            <AppText style={s.text}>Questions, feedback, or need help with Co-Heart? Email us:</AppText>
            <View style={s.row}>
              <AppText style={s.label}>Email: </AppText>
              <AppText style={s.email} selectable>{SUPPORT_EMAIL}</AppText>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: {
    width: '100%', maxWidth: MAX_CONTENT_WIDTH, alignSelf: 'center',
    backgroundColor: NICO.screenBg,
    borderTopLeftRadius: RADIUS.xl, borderTopRightRadius: RADIUS.xl,
  },
  hdr: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg, paddingVertical: SPACING.base,
    borderBottomWidth: 1, borderBottomColor: NICO.border,
  },
  hdrTitle: { fontSize: FONT_SIZE.lg, fontWeight: FONT_WEIGHT.extraBold, color: NICO.text },
  close:    { fontSize: FONT_SIZE.xl, fontWeight: FONT_WEIGHT.bold, color: NICO.textMuted },

  body:  { paddingHorizontal: SPACING.lg, paddingTop: SPACING.base, gap: SPACING.sm },
  text:  { fontSize: FONT_SIZE.md, fontWeight: FONT_WEIGHT.bold, color: NICO.text, lineHeight: 21 },
  row:   { flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap' },
  label: { fontSize: FONT_SIZE.lg, fontWeight: FONT_WEIGHT.extraBold, color: NICO.text },
  email: { fontSize: FONT_SIZE.md, fontWeight: FONT_WEIGHT.bold, color: NICO.success },
});
