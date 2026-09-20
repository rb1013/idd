import React from 'react';
import { TouchableOpacity } from 'react-native';
import AppText from './AppText';
import { NICO, FONT_SIZE, FONT_WEIGHT } from '../constants/theme';

type Props = {
  onPress: () => void;
  isActive?: boolean;
  label?: string;
};

export default function MoreFiltersLink({ onPress, isActive = false, label = 'More Filters' }: Props) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.65} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
      <AppText style={{
        fontSize: FONT_SIZE.md,
        fontWeight: isActive ? FONT_WEIGHT.bold : FONT_WEIGHT.medium,
        color: isActive ? NICO.primary : NICO.textMuted,
        textDecorationLine: 'underline',
      }}>
        {label}
      </AppText>
    </TouchableOpacity>
  );
}
