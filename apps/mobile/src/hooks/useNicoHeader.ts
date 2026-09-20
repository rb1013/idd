import { useLayoutEffect } from 'react';
import { NICO, FONT_SIZE } from '../constants/theme';

type Nav = { setOptions: (opts: Record<string, unknown>) => void };

/** Applies the NICO navigation header style to any native-stack screen. */
export default function useNicoHeader(navigation: Nav) {
  useLayoutEffect(() => {
    navigation.setOptions({
      headerStyle:         { backgroundColor: NICO.background },
      headerTitleStyle:    { color: NICO.text, fontSize: FONT_SIZE['2xl'] },
      headerTintColor:     NICO.text,
      headerShadowVisible: false,
    });
  }, [navigation]);
}
