import React from 'react';
import { Image, ImageSourcePropType, StyleSheet, View, TextStyle } from 'react-native';
import AppText from './AppText';
import { NICO, FONT_SIZE, FONT_WEIGHT, SPACING } from '../constants/theme';

export const ELIS_TAGLINE = 'Network for Inclusion, Connectivity & Opportunity';
export const ELIS_LOGO    = require('../../assets/nico-trans-2.png');

// Shared "Co-Heart" branding tagline — used on the Login and Learner Select
// screens, the two places the co-heart-trans.png logo is shown.
export const BRAND_LOGO    = require('../../assets/co-heart-trans.png');
export const BRAND_TAGLINE = 'Where hearts align & journeys are shared';
export const BRAND_TAGLINE_STYLE: TextStyle = {
  fontFamily: 'Raleway_700Bold_Italic',
  fontSize:   16,
  color:      '#3B5680',
};

interface Props {
  source?: ImageSourcePropType;
  logoStyle?: { width: number; height: number };
  tagline?: string;
  taglineStyle?: TextStyle;
  taglineSingleLine?: boolean;
}

export default function AppLogo({ source = ELIS_LOGO, logoStyle, tagline = ELIS_TAGLINE, taglineStyle, taglineSingleLine }: Props) {
  return (
    <>
      <View style={s.logoWrapper}>
        <Image source={source} style={[s.logo, logoStyle]} resizeMode="contain" />
      </View>
      <AppText
        style={[s.tagline, taglineStyle]}
        numberOfLines={taglineSingleLine ? 1 : undefined}
        adjustsFontSizeToFit={taglineSingleLine}
      >
        {tagline}
      </AppText>
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
