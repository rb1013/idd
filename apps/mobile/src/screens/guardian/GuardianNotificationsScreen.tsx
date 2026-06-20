import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/AuthContext';
import { COLORS } from '../../constants';

interface Notification {
  id: string;
  type: string;
  message: string;
  read: boolean;
  created_at: string;
}

export default function GuardianNotificationsScreen() {
  const { guardian } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (guardian) loadNotifications(guardian.id);
  }, [guardian]);

  async function loadNotifications(guardianId: string) {
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('guardian_id', guardianId)
      .order('created_at', { ascending: false });
    setNotifications(data || []);
    setLoading(false);
  }

  async function markRead(id: string) {
    await supabase.from('notifications').update({ read: true }).eq('id', id);
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  }

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color={COLORS.primary} /></View>;

  const unread = notifications.filter(n => !n.read).length;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.inner}>
      <View style={styles.listHeader}>
        <Text style={styles.sectionTitle}>Notifications</Text>
        {unread > 0 && <View style={styles.badge}><Text style={styles.badgeText}>{unread}</Text></View>}
      </View>

      {notifications.length === 0 ? (
        <Text style={styles.empty}>No notifications yet.</Text>
      ) : (
        notifications.map(n => (
          <TouchableOpacity
            key={n.id}
            style={[styles.notifCard, !n.read && styles.notifCardUnread]}
            onPress={() => !n.read && markRead(n.id)}
            activeOpacity={n.read ? 1 : 0.7}
          >
            <View style={styles.notifRow}>
              <Text style={styles.notifType}>{formatType(n.type)}</Text>
              {!n.read && <View style={styles.dot} />}
            </View>
            <Text style={styles.notifMessage}>{n.message}</Text>
            <Text style={styles.notifDate}>{new Date(n.created_at).toLocaleDateString()}</Text>
          </TouchableOpacity>
        ))
      )}
    </ScrollView>
  );
}

function formatType(type: string) {
  return type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  inner: { padding: 20, paddingBottom: 48 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: COLORS.text },
  listHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
  badge: { backgroundColor: COLORS.error, borderRadius: 10, paddingHorizontal: 7, paddingVertical: 2 },
  badgeText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  notifCard: {
    backgroundColor: COLORS.surface, borderRadius: 12,
    padding: 16, marginBottom: 10,
    borderWidth: 1, borderColor: COLORS.border,
  },
  notifCardUnread: { borderColor: COLORS.primary, backgroundColor: COLORS.primaryLight },
  notifRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  notifType: { fontSize: 12, fontWeight: '700', color: COLORS.primary, textTransform: 'uppercase', letterSpacing: 0.5 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.primary },
  notifMessage: { fontSize: 14, color: COLORS.text, lineHeight: 20 },
  notifDate: { fontSize: 12, color: COLORS.textLight, marginTop: 6 },
  empty: { color: COLORS.textLight, textAlign: 'center', marginTop: 32, fontSize: 15 },
});
