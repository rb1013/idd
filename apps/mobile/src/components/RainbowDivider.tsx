import React from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { BUTTERFLY_BORDER } from '../constants/theme';

export default function RainbowDivider() {
  return (
    <LinearGradient
      colors={[...BUTTERFLY_BORDER.colors]}
      start={BUTTERFLY_BORDER.start}
      end={BUTTERFLY_BORDER.end}
      style={{ height: BUTTERFLY_BORDER.width, width: '100%' }}
    />
  );
}
