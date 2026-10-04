import React from 'react';
import {
  View, Image, Modal, TouchableOpacity, ActivityIndicator, StyleSheet,
} from 'react-native';
import AppText from './AppText';
import {
  NICO, SPACING, RADIUS, SHADOW, FONT_SIZE, FONT_WEIGHT, scale,
} from '../constants/theme';

const AVATAR_COLORS = [NICO.teal, NICO.orange, NICO.coral, NICO.pink, NICO.purple, NICO.primary];
function avatarColor(name: string) {
  return AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length];
}

export interface GuardianPeekInfo {
  name: string;
  photoUrl: string | null;
  county: string;
  situationTags: string[];
}

interface Props {
  visible: boolean;
  guardian: GuardianPeekInfo | null;
  loading?: boolean;
  onClose: () => void;
  /** Optional extra content (e.g. Connect/Accept buttons) rendered below the note. */
  footer?: React.ReactNode;
}

// Single shared "sneak peek" bottom sheet for tapping a guardian's name —
// used from GuardianConnectionsScreen, EventsScreen, EventDetailScreen, and
// TutorialLibraryScreen, which previously each had their own copy.
export default function GuardianPeekSheet({ visible, guardian, loading, onClose, footer }: Props) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose}>
        <View style={styles.sheet} onStartShouldSetResponder={() => true}>
          <View style={styles.pill} />
          {loading && !guardian ? (
            <ActivityIndicator size="large" color={NICO.primary} style={styles.loading} />
          ) : guardian ? (
            <>
              <View style={styles.row}>
                {guardian.photoUrl ? (
                  <Image source={{ uri: guardian.photoUrl }} style={styles.avatar} />
                ) : (
                  <View style={[styles.avatar, styles.avatarFallback, { backgroundColor: avatarColor(guardian.name) }]}>
                    <AppText style={styles.avatarInitial}>{guardian.name[0]?.toUpperCase()}</AppText>
                  </View>
                )}
                <View style={styles.info}>
                  <AppText style={styles.name} numberOfLines={1}>{guardian.name}</AppText>
                  {!!guardian.county && <AppText style={styles.county} numberOfLines={1}>📍 {guardian.county}</AppText>}
                </View>
              </View>

              {guardian.situationTags.length > 0 && (
                <View style={styles.tagsSection}>
                  <AppText style={styles.tagsLabel}>Regional Support Category</AppText>
                  <View style={styles.tagsRow}>
                    {guardian.situationTags.map(tag => (
                      <View key={tag} style={styles.tag}>
                        <AppText style={styles.tagText}>{tag}</AppText>
                      </View>
                    ))}
                  </View>
                </View>
              )}

              <AppText style={styles.note}>
                <AppText style={styles.noteAsterisk}>***</AppText> Please connect with guardian for more details
              </AppText>

              {footer}
            </>
          ) : null}
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: NICO.surface, borderTopLeftRadius: RADIUS['3xl'], borderTopRightRadius: RADIUS['3xl'],
    padding: SPACING.lg, ...SHADOW.xl,
  },
  pill: { width: scale(38), height: 4, backgroundColor: NICO.border, borderRadius: 2, alignSelf: 'center', marginBottom: SPACING.base },
  loading: { marginVertical: SPACING.xl },

  row: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  avatar: { width: scale(52), height: scale(52), borderRadius: scale(26) },
  avatarFallback: { justifyContent: 'center', alignItems: 'center' },
  avatarInitial: { fontSize: FONT_SIZE.xl, fontWeight: FONT_WEIGHT.extraBold, color: '#fff' },
  info: { flex: 1, minWidth: 0, gap: 2 },
  name: { fontSize: FONT_SIZE['2xl'], fontWeight: FONT_WEIGHT.extraBold, color: NICO.text },
  county: { fontSize: FONT_SIZE.lg, fontWeight: FONT_WEIGHT.medium, color: NICO.text },

  tagsSection: { marginTop: SPACING.base, gap: SPACING.sm },
  tagsLabel: { fontSize: FONT_SIZE.sm, fontWeight: FONT_WEIGHT.bold, color: NICO.text, textTransform: 'uppercase', letterSpacing: 0.8 },
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.xs },
  tag: { backgroundColor: NICO.primaryLight, borderRadius: RADIUS.full, paddingHorizontal: SPACING.md, paddingVertical: SPACING.xs },
  tagText: { fontSize: FONT_SIZE.md, fontWeight: FONT_WEIGHT.bold, color: NICO.primary },

  note: { fontSize: FONT_SIZE.md, fontWeight: FONT_WEIGHT.semiBold, color: NICO.text, marginTop: SPACING.base, marginBottom: SPACING.lg, textAlign: 'center' },
  noteAsterisk: { fontSize: FONT_SIZE.md, fontWeight: FONT_WEIGHT.extraBold, color: NICO.error },
});
