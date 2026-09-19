import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { MAX_CONTENT_WIDTH } from '../constants/theme';

interface Props {
  children: React.ReactNode;
  style?: ViewStyle | ViewStyle[];
}

export default function ContentContainer({ children, style }: Props) {
  return <View style={[s.container, style]}>{children}</View>;
}

const s = StyleSheet.create({
  container: {
    width:     '100%',
    maxWidth:  MAX_CONTENT_WIDTH,
    alignSelf: 'center',
  },
});
