import React, { useState } from 'react';
import { View, TouchableOpacity, StyleSheet, ScrollView, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import AppText from '../../components/AppText';
import ContentContainer from '../../components/ContentContainer';
import LegalSheet from '../../components/LegalSheet';
import {
  NICO, TEXT_STYLE, SPACING, FONT_SIZE, FONT_WEIGHT, BTN_SIZE, BTN_VARIANT,
} from '../../constants/theme';

// First step of guardian sign-up (before Guardian Verification): agree to the Privacy Policy and
// Terms of Service before any personal data is entered (Apple Guidelines 1.2 / 5.1.1).
// Agree → Guardian Verification (the acceptance time is carried through sign-up and saved as
// guardians.terms_accepted_at). Decline → message, then back to Login.
export default function PrivacyConsentScreen() {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  // Privacy Policy & Terms open in-app (bottom sheet), not the website
  const [policyOpen, setPolicyOpen] = useState(false);

  function decline() {
    Alert.alert(
      'Agreement required',
      'You need to agree to the Privacy Policy and Terms of Service to create an account.',
      [{ text: 'OK', onPress: () => navigation.navigate('Login') }],
    );
  }

  function agree() {
    // Replace so Back from Guardian Verification returns to Login, not to this page
    navigation.replace('GuardianVerification', { termsAcceptedAt: new Date().toISOString() });
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={[styles.inner, { paddingBottom: Math.max(insets.bottom + 24, 48) }]}>
        <ContentContainer>
          <AppText style={styles.title}>Before you continue</AppText>
          <AppText style={styles.paragraph}>
            Co-Heart stores your and your learner's information to help you connect with families.
            We don't sell data or use it for advertising, and we have zero tolerance for abusive content.
          </AppText>

          <TouchableOpacity onPress={() => setPolicyOpen(true)} activeOpacity={0.7} accessibilityRole="link">
            <AppText style={styles.link}>Read the Privacy Policy & Terms of Service</AppText>
          </TouchableOpacity>

          <AppText style={styles.note}>
            By tapping Agree, you confirm you have read and agree to the Privacy Policy and Terms of Service.
          </AppText>

          <View style={styles.btnRow}>
            <TouchableOpacity style={[styles.btn, styles.btnOutline]} onPress={decline} activeOpacity={0.85}>
              <AppText style={styles.btnOutlineText}>Decline</AppText>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.btn, styles.btnPrimary]} onPress={agree} activeOpacity={0.85}>
              <AppText style={styles.btnPrimaryText}>Agree</AppText>
            </TouchableOpacity>
          </View>
        </ContentContainer>
      </ScrollView>

      <LegalSheet visible={policyOpen} initialTab="privacy" onClose={() => setPolicyOpen(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: NICO.screenBg },
  inner:     { padding: SPACING.xl },

  title:     { ...TEXT_STYLE.sectionTitle, marginBottom: SPACING.md, marginTop: SPACING.base },
  paragraph: { fontSize: FONT_SIZE.md, color: NICO.text, fontWeight: FONT_WEIGHT.semiBold, lineHeight: 22, marginBottom: SPACING.xl },
  link:      { fontSize: FONT_SIZE.lg, color: NICO.link, fontWeight: FONT_WEIGHT.bold, textDecorationLine: 'underline', marginBottom: SPACING.xl },
  note:      { fontSize: FONT_SIZE.sm, color: NICO.text, fontWeight: FONT_WEIGHT.semiBold, lineHeight: 18, marginBottom: SPACING.xl },

  btnRow:         { flexDirection: 'row', gap: SPACING.md },
  btn:            { ...BTN_SIZE.lg, flex: 1 },
  btnPrimary:     { ...BTN_VARIANT.primary },
  btnOutline:     { ...BTN_VARIANT.outline },
  btnPrimaryText: { ...TEXT_STYLE.buttonPrimary },
  btnOutlineText: { ...TEXT_STYLE.buttonPrimary, color: NICO.primary },
});
