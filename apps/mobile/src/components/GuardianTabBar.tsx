import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AppText from './AppText';
import { GuardianNavParamList } from '../navigation';
import { NICO, TEXT_STYLE, SPACING, FONT_WEIGHT, scale } from '../constants/theme';

type Nav = NativeStackNavigationProp<GuardianNavParamList>;

const TABS: { label: string; icon: string; screen: keyof GuardianNavParamList }[] = [
  { label: 'Tutorials',   icon: '📚', screen: 'Learning' },
  { label: 'Connections', icon: '👥', screen: 'GuardianConnections' },
  { label: 'Discussions', icon: '💬', screen: 'Discussions' },
  { label: 'Events',      icon: '🎉', screen: 'Events' },
];

/** Persistent bottom bar shown only on the 4 top-level guardian tile screens — not on their sub-pages. */
export default function GuardianTabBar() {
  const navigation = useNavigation<Nav>();
  const route = useRoute();
  const insets = useSafeAreaInsets();

  return (
    <View style={s.bar}>
      <View style={[s.inner, { paddingBottom: insets.bottom || SPACING.sm }]}>
        {TABS.map(tab => {
          const active = route.name === tab.screen;
          return (
            <TouchableOpacity
              key={tab.screen}
              style={s.item}
              onPress={() => { if (!active) navigation.navigate(tab.screen as any); }}
              activeOpacity={0.75}
            >
              <AppText style={s.icon}>{tab.icon}</AppText>
              <AppText style={[s.label, active && s.labelActive]}>{tab.label}</AppText>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  bar: {
    backgroundColor: NICO.surface,
    borderTopWidth: 1,
    borderTopColor: NICO.border,
  },
  inner: {
    flexDirection: 'row',
    paddingTop: SPACING.sm,
    paddingHorizontal: SPACING.sm,
  },
  item:        { flex: 1, alignItems: 'center', gap: 3, paddingVertical: SPACING.xs },
  icon:        { fontSize: scale(22) },
  label:       { ...TEXT_STYLE.caption, color: NICO.textMuted },
  labelActive: { color: NICO.primary, fontWeight: FONT_WEIGHT.extraBold },
});
