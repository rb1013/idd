import React from 'react';
import { Image, StyleSheet, View } from 'react-native';
import AppText from './AppText';
import { NICO, FONT_SIZE, FONT_WEIGHT, SPACING } from '../constants/theme';

export const ELIS_TAGLINE = 'Network for Inclusion, Connectivity & Opportunity';
export const ELIS_LOGO    = require('../../assets/nico-trans-2.png');

export default function AppLogo() {
  return (
    <>
      <View style={s.logoWrapper}>
        <Image source={ELIS_LOGO} style={s.logo} resizeMode="contain" />
      </View>
      <AppText style={s.tagline}>{ELIS_TAGLINE}</AppText>
    </>
  );
}

const s = StyleSheet.create({
  logoWrapper: {
    backgroundColor: 'transparent',
    alignItems:      'center',
  },
  logo: {
    width:  162,
    height: 147,
  },
  tagline: {
    fontSize:   FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.bold,
    color:      NICO.textMuted,
    textAlign:  'center',
    marginTop:  SPACING.xs,
    paddingHorizontal: SPACING.lg,
  },
});
