import { useLayoutEffect } from 'react';
import { NICO } from '../constants/theme';

type Nav = { setOptions: (opts: Record<string, unknown>) => void };

/** Applies the NICO navigation header style to any native-stack screen. */
export default function useNicoHeader(navigation: Nav) {
  useLayoutEffect(() => {
    navigation.setOptions({
      headerStyle:         { backgroundColor: NICO.background },
      headerTitleStyle:    { color: NICO.text },
      headerTintColor:     NICO.text,
      headerShadowVisible: false,
    });
  }, [navigation]);
}
