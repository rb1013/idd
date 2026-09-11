import React from 'react';
import { Image, View, StyleSheet } from 'react-native';
import { COLORS } from '../constants';
import AppText from './AppText';

export const ELIS_APP_NAME = 'ELIS';
export const ELIS_TAGLINE = 'Empathy · Learning · Inclusive · Support';
export const ELIS_LOGO = require('../../assets/elis-5-transparent.png');

export default function AppLogo() {
  return (
    <>
      <Image source={ELIS_LOGO} style={s.elisLogo} resizeMode="contain" />
      <AppText style={s.appName}>{ELIS_APP_NAME}</AppText>
      <View style={s.taglinePill}>
        <AppText style={s.tagline}>{ELIS_TAGLINE}</AppText>
      </View>
    </>
  );
}

const s = StyleSheet.create({
  elisLogo:    { width: 108, height: 108, transform: [{ translateX: 0 }, { translateY: 18 }] },
  appName:     { fontSize: 32, fontWeight: '900', color: COLORS.bloomOnAccent, letterSpacing: 3, marginTop: 4, paddingLeft: 2 },
  taglinePill: { marginTop: 10, backgroundColor: 'rgba(45,49,46,0.13)', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 6 },
  tagline:     { fontSize: 13, fontWeight: '700', color: COLORS.bloomOnAccent, letterSpacing: 1.5 },
});
