import React, { useState } from 'react';
import { View, TouchableOpacity, StyleSheet, ViewStyle } from 'react-native';
import AppText from './AppText';
import LegalSheet from './LegalSheet';
import ContactSheet from './ContactSheet';
import { LegalSectionKey } from '../constants/legalContent';
import { NICO, SPACING, FONT_SIZE, FONT_WEIGHT } from '../constants/theme';

/**
 * Footer links — Privacy Policy · Terms of Service · Credits & Licenses · Contact Us — and © year.
 * Every link opens a bottom sheet in the app (nothing opens the website).
 * Used on: guardian dashboard, Account, Login, Learner select.
 * Put it last in a screen's scroll content; `marginTop: 'auto'` pins it to the bottom on short screens
 * when the scroll content has `flexGrow: 1`.
 */
export default function LegalFooter({ style }: { style?: ViewStyle }) {
  const [legalTab, setLegalTab] = useState<LegalSectionKey | null>(null);
  const [contactOpen, setContactOpen] = useState(false);

  const links: { label: string; onPress: () => void }[] = [
    { label: 'Privacy Policy',     onPress: () => setLegalTab('privacy') },
    { label: 'Terms of Service',   onPress: () => setLegalTab('terms') },
    { label: 'Credits & Licenses', onPress: () => setLegalTab('credits') },
    { label: 'Contact Us',         onPress: () => setContactOpen(true) },
  ];

  return (
    <View style={[s.footer, style]}>
      {/* Separate buttons, not links nested in one Text — nested-text taps are unreliable on iOS */}
      {/* Two fixed rows (Privacy · Terms / Credits · Contact) so a wrap never leaves a stray "·" */}
      {[links.slice(0, 2), links.slice(2)].map((row, r) => (
        <View key={r} style={s.links}>
          {row.map((l, i) => (
            <View key={l.label} style={s.item}>
              {i > 0 && <AppText style={s.dot}>·</AppText>}
              <TouchableOpacity onPress={l.onPress} activeOpacity={0.6} hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }} accessibilityRole="link">
                <AppText style={s.link}>{l.label}</AppText>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      ))}
      <AppText style={s.copy}>© {new Date().getFullYear()} Co-Heart</AppText>

      <LegalSheet visible={legalTab !== null} initialTab={legalTab ?? 'privacy'} onClose={() => setLegalTab(null)} />
      <ContactSheet visible={contactOpen} onClose={() => setContactOpen(false)} />
    </View>
  );
}

const s = StyleSheet.create({
  footer: { marginTop: 'auto', paddingTop: SPACING.xl, paddingBottom: SPACING.base, alignItems: 'center', gap: SPACING.xs },
  links:  { flexDirection: 'row', justifyContent: 'center', paddingHorizontal: SPACING.base },
  item:   { flexDirection: 'row', alignItems: 'center' },
  link:   { fontSize: FONT_SIZE.sm, fontWeight: FONT_WEIGHT.semiBold, color: NICO.link, textDecorationLine: 'underline' },
  dot:    { fontSize: FONT_SIZE.sm, color: NICO.textMuted, marginHorizontal: SPACING.sm },
  copy:   { fontSize: FONT_SIZE.xs, fontWeight: FONT_WEIGHT.medium, color: NICO.textMuted },
});
