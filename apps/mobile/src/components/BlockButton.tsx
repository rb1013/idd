import React, { useState } from 'react';
import { TouchableOpacity, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import AppText from './AppText';
import { NICO, scale } from '../constants/theme';
import { useAuth } from '../lib/AuthContext';
import { blockGuardian } from '../lib/blocking';

/**
 * 🚫 block button — icon only, same size/look as 🚩 (ReportFlag) and the ✏️ / 🗑️ card actions.
 * Confirms, blocks, then calls onBlocked so the screen can close a sheet / refresh its list.
 * Never renders for the logged-in guardian themselves.
 */
export default function BlockButton({
  guardianId,
  guardianName,
  onBlocked,
  style,
}: {
  guardianId: string;
  guardianName: string;
  onBlocked?: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const { guardian } = useAuth();
  const [busy, setBusy] = useState(false);

  if (!guardianId || guardianId === guardian?.id) return null;

  async function onPress() {
    if (busy) return;
    setBusy(true);
    const blocked = await blockGuardian(guardianId, guardianName || 'this guardian');
    setBusy(false);
    if (blocked) onBlocked?.();
  }

  return (
    <TouchableOpacity
      style={[s.btn, busy && s.busy, style]}
      // stopPropagation: the button often sits on a tappable card
      onPress={e => { e.stopPropagation?.(); onPress(); }}
      disabled={busy}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}   // 28 + 16 = 44pt touch area
      accessibilityRole="button"
      accessibilityLabel="Block guardian"
    >
      <AppText style={s.icon}>🚫</AppText>
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  btn: {
    width: scale(28), height: scale(28), borderRadius: scale(14),
    backgroundColor: NICO.primaryLight, justifyContent: 'center', alignItems: 'center',
  },
  busy: { opacity: 0.5 },
  icon: { fontSize: scale(14) },
});
