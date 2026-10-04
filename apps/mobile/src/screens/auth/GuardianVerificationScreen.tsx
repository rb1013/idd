import React, { useState } from 'react';
import {
  View, TouchableOpacity, StyleSheet,
  ScrollView, Modal, Platform,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import AppText from '../../components/AppText';
import ContentContainer from '../../components/ContentContainer';
import {
  NICO, TEXT_STYLE, SPACING, RADIUS, FONT_SIZE, FONT_WEIGHT,
  BTN_SIZE, BTN_VARIANT, scale,
} from '../../constants/theme';

const MIN_AGE = 18;

const PRIVACY_COMMITMENTS = [
  'We NEVER ask for or store any medical or clinical data.',
  'Profiles are only visible to other verified guardians.',
  'We do not track behavior or use data for advertising.',
];

const CONSENT_TEXT =
  "I consent to allowing this app to securely store my learner's first name, age, gender, location, and photo solely to help me search for and connect with nearby families.";

function ageFromDob(d: Date): number {
  const today = new Date();
  let age = today.getFullYear() - d.getFullYear();
  const m = today.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < d.getDate())) age--;
  return age;
}

export default function GuardianVerificationScreen() {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();

  const [dob, setDob] = useState<Date | null>(null);
  const [tempDob, setTempDob] = useState(new Date(2000, 0, 1));
  const [showDobPicker, setShowDobPicker] = useState(false);
  const [consent, setConsent] = useState(false);
  const [failModalVisible, setFailModalVisible] = useState(false);

  function handleContinue() {
    const isAdult = dob != null && ageFromDob(dob) >= MIN_AGE;
    if (!isAdult || !consent) {
      setFailModalVisible(true);
      return;
    }
    // DOB never leaves this screen — only the fact that verification passed
    // matters downstream, so nothing is persisted here.
    // Replace (not navigate) so this verification screen doesn't stay in the
    // stack — pressing back from Register should go straight to Login, not
    // back through the consent screen.
    navigation.replace('GuardianRegister');
  }

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={[styles.inner, { paddingBottom: Math.max(insets.bottom + 24, 48) }]}
        keyboardShouldPersistTaps="handled"
      >
        <ContentContainer>
          <AppText style={styles.title}>Guardian Verification</AppText>
          <AppText style={styles.paragraph}>
            To protect our community and comply with child privacy laws, we must verify that you
            are an adult guardian before you can create a learner profile or search for friends.
          </AppText>

          <AppText style={styles.label}>Please enter your Date of Birth</AppText>
          <TouchableOpacity
            style={styles.pickerBtn}
            onPress={() => { setTempDob(dob ?? new Date(2000, 0, 1)); setShowDobPicker(true); }}
            activeOpacity={0.75}
          >
            <AppText style={[styles.pickerBtnText, !dob && styles.placeholder]}>
              {dob ? dob.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' }) : 'MM / DD / YYYY'}
            </AppText>
            <AppText style={styles.pickerBtnIcon}>📅</AppText>
          </TouchableOpacity>

          <AppText style={styles.sectionTitle}>Our Privacy Commitments</AppText>
          <View style={styles.commitmentList}>
            {PRIVACY_COMMITMENTS.map(line => (
              <View key={line} style={styles.commitmentRow}>
                <AppText style={styles.commitmentBullet}>•</AppText>
                <AppText style={styles.commitmentText}>{line}</AppText>
              </View>
            ))}
          </View>

          <TouchableOpacity style={styles.consentRow} onPress={() => setConsent(v => !v)} activeOpacity={0.8}>
            <View style={[styles.checkbox, consent && styles.checkboxOn]}>
              {consent && <AppText style={styles.checkmark}>✓</AppText>}
            </View>
            <AppText style={styles.consentText}>{CONSENT_TEXT}</AppText>
          </TouchableOpacity>

          <TouchableOpacity style={styles.button} onPress={handleContinue} activeOpacity={0.85}>
            <AppText style={styles.buttonText}>Continue</AppText>
          </TouchableOpacity>
        </ContentContainer>
      </ScrollView>

      <Modal visible={showDobPicker} transparent animationType="slide" onRequestClose={() => setShowDobPicker(false)}>
        <TouchableOpacity style={styles.sheetBackdrop} activeOpacity={1} onPress={() => setShowDobPicker(false)}>
          <View style={styles.sheet} onStartShouldSetResponder={() => true}>
            <View style={styles.sheetHdr}>
              <TouchableOpacity onPress={() => setShowDobPicker(false)}>
                <AppText style={styles.sheetCancel}>Cancel</AppText>
              </TouchableOpacity>
              <AppText style={styles.sheetTitle}>Date of Birth</AppText>
              <TouchableOpacity onPress={() => { setDob(tempDob); setShowDobPicker(false); }}>
                <AppText style={styles.sheetDone}>Done</AppText>
              </TouchableOpacity>
            </View>
            <DateTimePicker
              value={tempDob}
              mode="date"
              display="spinner"
              maximumDate={new Date()}
              onChange={(_, d) => { if (d) setTempDob(d); }}
              style={{ height: 220 }}
            />
          </View>
        </TouchableOpacity>
      </Modal>

      <Modal visible={failModalVisible} transparent animationType="fade" onRequestClose={() => setFailModalVisible(false)}>
        <TouchableOpacity style={styles.failOverlay} activeOpacity={1} onPress={() => setFailModalVisible(false)}>
          <View style={styles.failCard} onStartShouldSetResponder={() => true}>
            <AppText style={styles.failTitle}>Guardian verification failed</AppText>
            <AppText style={styles.failBody}>
              You should be 18 year of age or older to create an account with us and provide your consent for privacy policy
            </AppText>
            <TouchableOpacity style={styles.failCloseBtn} onPress={() => setFailModalVisible(false)} activeOpacity={0.85}>
              <AppText style={styles.failCloseBtnText}>OK</AppText>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: NICO.screenBg },
  inner:     { padding: SPACING.xl },

  title:     { ...TEXT_STYLE.sectionTitle, marginBottom: SPACING.md, marginTop: SPACING.base },
  paragraph: { fontSize: FONT_SIZE.md, color: NICO.text, fontWeight: FONT_WEIGHT.semiBold, lineHeight: 22, textAlign: 'justify', marginBottom: SPACING.xl },

  label: { ...TEXT_STYLE.fieldLabel, marginBottom: SPACING.sm },

  pickerBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: NICO.surface, borderWidth: 1.5, borderColor: NICO.border,
    borderRadius: RADIUS.md, paddingHorizontal: SPACING.base, paddingVertical: SPACING.base,
    marginBottom: SPACING.xl,
  },
  pickerBtnText: { fontSize: FONT_SIZE.lg, color: NICO.text, fontWeight: FONT_WEIGHT.semiBold },
  placeholder:   { color: NICO.textMuted },
  pickerBtnIcon: { fontSize: FONT_SIZE.xl },

  sectionTitle: { ...TEXT_STYLE.fieldLabel, fontSize: FONT_SIZE.lg, marginBottom: SPACING.md },
  commitmentList: { gap: SPACING.sm, marginBottom: SPACING.xl },
  commitmentRow: { flexDirection: 'row', gap: SPACING.sm },
  commitmentBullet: { fontSize: FONT_SIZE.md, color: NICO.primary, fontWeight: FONT_WEIGHT.extraBold },
  commitmentText: { flex: 1, fontSize: FONT_SIZE.md, color: NICO.text, fontWeight: FONT_WEIGHT.semiBold, lineHeight: 21 },

  consentRow: {
    flexDirection: 'row', gap: SPACING.md, alignItems: 'flex-start',
    backgroundColor: NICO.background, borderRadius: RADIUS.lg,
    padding: SPACING.base, marginBottom: SPACING.xl,
  },
  checkbox: {
    width: scale(24), height: scale(24), borderRadius: RADIUS.sm,
    borderWidth: 2, borderColor: NICO.border, backgroundColor: NICO.surface,
    justifyContent: 'center', alignItems: 'center', flexShrink: 0, marginTop: 2,
  },
  checkboxOn: { backgroundColor: NICO.primary, borderColor: NICO.primary },
  checkmark:  { fontSize: FONT_SIZE.base, fontWeight: FONT_WEIGHT.black, color: NICO.textOnAccent },
  consentText: { flex: 1, fontSize: FONT_SIZE.md, color: NICO.text, fontWeight: FONT_WEIGHT.semiBold, lineHeight: 21 },

  button:     { ...BTN_SIZE.lg, ...BTN_VARIANT.primary },
  buttonText: { ...TEXT_STYLE.buttonPrimary },

  sheetBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: {
    backgroundColor: NICO.surface, borderTopLeftRadius: RADIUS['3xl'], borderTopRightRadius: RADIUS['3xl'],
    paddingBottom: Platform.OS === 'ios' ? SPACING['2xl'] : SPACING.lg,
  },
  sheetHdr: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: SPACING.lg, borderBottomWidth: 1, borderBottomColor: NICO.border,
  },
  sheetTitle:  { fontSize: FONT_SIZE.xl, fontWeight: FONT_WEIGHT.bold, color: NICO.text },
  sheetCancel: { fontSize: FONT_SIZE.lg, color: NICO.textMuted },
  sheetDone:   { fontSize: FONT_SIZE.lg, fontWeight: FONT_WEIGHT.bold, color: NICO.primary },

  failOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: SPACING.xl },
  failCard: {
    backgroundColor: NICO.surface, borderRadius: RADIUS['2xl'],
    padding: SPACING.xl, width: '100%', gap: SPACING.md,
  },
  failTitle: { fontSize: FONT_SIZE.xl, fontWeight: FONT_WEIGHT.extraBold, color: NICO.error },
  failBody:  { fontSize: FONT_SIZE.lg, fontWeight: FONT_WEIGHT.semiBold, color: NICO.text, lineHeight: 24 },
  failCloseBtn:     { ...BTN_SIZE.md, ...BTN_VARIANT.primary, marginTop: SPACING.xs },
  failCloseBtnText: { ...TEXT_STYLE.buttonPrimary },
});
