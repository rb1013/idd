import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/AuthContext';
import { COLORS } from '../../constants';

export default function GuardianAccountScreen() {
  const { guardian, signOut } = useAuth();
  const [notifSettings, setNotifSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (guardian) loadSettings(guardian.id);
  }, [guardian]);

  async function loadSettings(guardianId: string) {
    const { data } = await supabase
      .from('guardian_notification_settings')
      .select('*')
      .eq('guardian_id', guardianId)
      .single();
    setNotifSettings(data || null);
    setLoading(false);
  }

  async function toggleSetting(key: string) {
    const current = notifSettings?.[key] ?? false;
    const updated = { ...notifSettings, [key]: !current, guardian_id: guardian!.id };
    if (!notifSettings) {
      await supabase.from('guardian_notification_settings').insert(updated);
    } else {
      await supabase.from('guardian_notification_settings').update({ [key]: !current }).eq('guardian_id', guardian!.id);
    }
    setNotifSettings(updated);
  }

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color={COLORS.primary} /></View>;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.inner}>
      {/* Account details */}
      <Text style={styles.sectionTitle}>Account Details</Text>
      <View style={styles.card}>
        <InfoRow label="Name" value={guardian?.full_name ?? '—'} />
        <View style={styles.divider} />
        <InfoRow label="Email" value={guardian?.email ?? '—'} />
        {guardian?.phone && <>
          <View style={styles.divider} />
          <InfoRow label="Phone" value={guardian.phone} />
        </>}
      </View>

      {/* Notification settings */}
      <Text style={[styles.sectionTitle, { marginTop: 28 }]}>Notification Settings</Text>
      <View style={styles.card}>
        <Toggle
          label="Friend requests"
          value={notifSettings?.notify_on_friend_request ?? false}
          onToggle={() => toggleSetting('notify_on_friend_request')}
        />
        <View style={styles.divider} />
        <Toggle
          label="Messages"
          value={notifSettings?.notify_on_message ?? false}
          onToggle={() => toggleSetting('notify_on_message')}
        />
        <View style={styles.divider} />
        <Toggle
          label="Profile changes"
          value={notifSettings?.notify_on_profile_change ?? false}
          onToggle={() => toggleSetting('notify_on_profile_change')}
        />
      </View>

      <TouchableOpacity style={styles.signOutBtn} onPress={signOut}>
        <Text style={styles.signOutText}>Sign Out</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

function Toggle({ label, value, onToggle }: { label: string; value: boolean; onToggle: () => void }) {
  return (
    <TouchableOpacity style={styles.toggleRow} onPress={onToggle} delayPressIn={50}>
      <Text style={styles.toggleLabel}>{label}</Text>
      <View style={[styles.toggle, value && styles.toggleOn]}>
        <View style={[styles.toggleThumb, value && styles.toggleThumbOn]} />
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  inner: { padding: 20, paddingBottom: 48 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: COLORS.text, marginBottom: 12 },
  card: { backgroundColor: COLORS.surface, borderRadius: 14, borderWidth: 1, borderColor: COLORS.border },
  divider: { height: 1, backgroundColor: COLORS.border },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16 },
  infoLabel: { fontSize: 15, color: COLORS.textLight },
  infoValue: { fontSize: 15, color: COLORS.text, fontWeight: '500' },
  toggleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16 },
  toggleLabel: { fontSize: 15, color: COLORS.text },
  toggle: { width: 46, height: 26, borderRadius: 13, backgroundColor: COLORS.border, justifyContent: 'center', padding: 2 },
  toggleOn: { backgroundColor: COLORS.primary },
  toggleThumb: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#fff' },
  toggleThumbOn: { alignSelf: 'flex-end' },
  signOutBtn: { marginTop: 32, padding: 16, alignItems: 'center' },
  signOutText: { color: COLORS.textLight, fontSize: 15 },
});
