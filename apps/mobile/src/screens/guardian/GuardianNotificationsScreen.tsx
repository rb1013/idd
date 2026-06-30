import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  ActivityIndicator, Alert,
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
  friendship_id: string | null;
  friendship?: {
    id: string;
    status: string;
    requester_id: string;
    addressee_id: string;
  } | null;
  user_id: string;
}

export default function GuardianNotificationsScreen() {
  const { guardian } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);

  useEffect(() => {
    if (guardian) loadNotifications(guardian.id);
  }, [guardian]);

  async function loadNotifications(guardianId: string) {
    const { data } = await supabase
      .from('notifications')
      .select('*, friendship:friendships(id, status, requester_id, addressee_id)')
      .eq('guardian_id', guardianId)
      .order('created_at', { ascending: false });
    setNotifications((data as Notification[]) || []);
    setLoading(false);
  }

  async function markRead(id: string) {
    await supabase.from('notifications').update({ read: true }).eq('id', id);
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  }

  async function handleFriendRequest(notification: Notification, action: 'accepted' | 'rejected') {
    if (!notification.friendship_id) return;
    setActing(notification.id);

    const { error } = await supabase
      .from('friendships')
      .update({ status: action })
      .eq('id', notification.friendship_id);

    if (error) {
      Alert.alert('Error', error.message);
      setActing(null);
      return;
    }

    // Mark read and update local state
    await supabase.from('notifications').update({ read: true }).eq('id', notification.id);
    setNotifications(prev => prev.map(n =>
      n.id === notification.id
        ? { ...n, read: true, friendship: n.friendship ? { ...n.friendship, status: action } : null }
        : n
    ));
    setActing(null);
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
        notifications.map(n => {
          const isAddresseeNotif =
            n.type === 'friend_request' &&
            n.friendship?.addressee_id === n.user_id &&
            n.friendship?.status === 'pending';

          return (
            <TouchableOpacity
              key={n.id}
              style={[styles.notifCard, !n.read && styles.notifCardUnread]}
              onPress={() => !n.read && !isAddresseeNotif && markRead(n.id)}
              activeOpacity={isAddresseeNotif ? 1 : 0.7}
            >
              <View style={styles.notifRow}>
                <Text style={styles.notifType}>{formatType(n.type)}</Text>
                {!n.read && <View style={styles.dot} />}
              </View>
              <Text style={styles.notifMessage}>{n.message}</Text>
              <Text style={styles.notifDate}>{new Date(n.created_at).toLocaleDateString()}</Text>

              {isAddresseeNotif && (
                <View style={styles.actionRow}>
                  <TouchableOpacity
                    style={[styles.actionBtn, styles.acceptBtn]}
                    onPress={() => handleFriendRequest(n, 'accepted')}
                    disabled={acting === n.id}
                  >
                    {acting === n.id
                      ? <ActivityIndicator size="small" color="#fff" />
                      : <Text style={styles.actionBtnText}>✓  Accept</Text>
                    }
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionBtn, styles.rejectBtn]}
                    onPress={() => handleFriendRequest(n, 'rejected')}
                    disabled={acting === n.id}
                  >
                    <Text style={[styles.actionBtnText, { color: COLORS.error }]}>✕  Reject</Text>
                  </TouchableOpacity>
                </View>
              )}

              {n.type === 'friend_request' && n.friendship && n.friendship.status !== 'pending' && (
                <Text style={styles.resolvedLabel}>
                  {n.friendship.status === 'accepted' ? '✓ Accepted' : '✕ Rejected'}
                </Text>
              )}
            </TouchableOpacity>
          );
        })
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
  actionRow: { flexDirection: 'row', gap: 10, marginTop: 14 },
  actionBtn: {
    flex: 1, paddingVertical: 10, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5,
  },
  acceptBtn: { backgroundColor: COLORS.secondary, borderColor: COLORS.secondary },
  rejectBtn: { backgroundColor: COLORS.surface, borderColor: COLORS.error },
  actionBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },
  resolvedLabel: { marginTop: 10, fontSize: 13, fontWeight: '600', color: COLORS.textLight },
  empty: { color: COLORS.textLight, textAlign: 'center', marginTop: 32, fontSize: 15 },
});
