import React from 'react';
import { Text, TextProps, StyleSheet, TextStyle } from 'react-native';
import { FONTS } from '../constants';

const weightToFamily: Record<string, string> = {
  '100': FONTS.regular,
  '200': FONTS.regular,
  '300': FONTS.regular,
  '400': FONTS.regular,
  '500': FONTS.medium,
  '600': FONTS.semiBold,
  '700': FONTS.bold,
  '800': FONTS.extraBold,
  '900': FONTS.black,
  normal: FONTS.regular,
  bold:   FONTS.bold,
};

export default function AppText({ style, ...props }: TextProps) {
  const flat = StyleSheet.flatten(style) as TextStyle | undefined;
  const weight = String(flat?.fontWeight ?? '400');
  const fontFamily = weightToFamily[weight] ?? FONTS.regular;
  return <Text style={[{ fontFamily }, style]} {...props} />;
}
