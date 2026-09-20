import React, { useCallback, useState } from 'react';
import {
  View, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator,
} from 'react-native';
import AppText from '../../components/AppText';
import RainbowDivider from '../../components/RainbowDivider';
import useNicoHeader from '../../hooks/useNicoHeader';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/AuthContext';
import { GuardianNavParamList } from '../../navigation';
import {
  NICO, TEXT_STYLE, SPACING, RADIUS, SHADOW, FONT_SIZE, FONT_WEIGHT, scale,
} from '../../constants/theme';

type Nav = NativeStackNavigationProp<GuardianNavParamList>;

type NotifType =
  | 'tutorial_approved'
  | 'tutorial_rejected'
  | 'discussion_reply'
  | 'connection_request'
  | 'connection_accepted'
  | 'connection_rejected';

interface GuardianNotification {
  id: string;
  type: NotifType;
  message: string;
  ref_id: string | null;
  read: boolean;
  created_at: string;
}

const NOTIF_META: Record<NotifType, { icon: string; label: string }> = {
  tutorial_approved:   { icon: '🎓', label: 'Tutorial Approved'  },
  tutorial_rejected:   { icon: '❌', label: 'Tutorial Rejected'  },
  discussion_reply:    { icon: '💬', label: 'New Reply'           },
  connection_request:  { icon: '🤝', label: 'Connection Request'  },
  connection_accepted: { icon: '✓',  label: 'Request Accepted'   },
  connection_rejected: { icon: '✕',  label: 'Request Declined'   },
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1)  return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7)  return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export default function GuardianNotificationsScreen() {
  const navigation = useNavigation<Nav>();
  const { guardian } = useAuth();
  const [notifications, setNotifications] = useState<GuardianNotification[]>([]);
  const [loading, setLoading] = useState(true);

  useNicoHeader(navigation);

  useFocusEffect(
    useCallback(() => {
      if (guardian) load(guardian.id);
    }, [guardian]),
  );

  async function load(guardianId: string) {
    setLoading(true);
    const { data } = await supabase
      .from('notifications')
      .select('id, type, message, ref_id, read, created_at')
      .eq('guardian_id', guardianId)
      .in('type', ['tutorial_approved', 'tutorial_rejected', 'discussion_reply', 'connection_request', 'connection_accepted', 'connection_rejected'])
      .order('created_at', { ascending: false })
      .limit(30);
    setNotifications((data as GuardianNotification[]) ?? []);
    // Mark all as read
    await supabase
      .from('notifications')
      .update({ read: true })
      .eq('guardian_id', guardianId)
      .eq('read', false)
      .in('type', ['tutorial_approved', 'tutorial_rejected', 'discussion_reply', 'connection_request', 'connection_accepted', 'connection_rejected']);
    setLoading(false);
  }

  function handleTap(n: GuardianNotification) {
    switch (n.type) {
      case 'tutorial_approved':
        navigation.navigate('Learning', { initialTab: 'my', initialStatus: 'approved' });
        break;
      case 'tutorial_rejected':
        navigation.navigate('Learning', { initialTab: 'my', initialStatus: 'rejected' });
        break;
      case 'discussion_reply':
        if (n.ref_id) navigation.navigate('DiscussionDetail', { postId: n.ref_id });
        break;
      case 'connection_request':
        navigation.navigate('GuardianConnections', { initialTab: 'requests', initialSubTab: 'received' });
        break;
      case 'connection_accepted':
        navigation.navigate('GuardianConnections', { initialTab: 'connected' });
        break;
      case 'connection_rejected':
        navigation.navigate('GuardianConnections', { initialTab: 'requests', initialSubTab: 'sent' });
        break;
    }
  }

  if (loading) {
    return <View style={s.center}><ActivityIndicator size="large" color={NICO.primary} /></View>;
  }

  return (
    <View style={s.container}>
      <RainbowDivider />
      <FlatList
        data={notifications}
        keyExtractor={n => n.id}
        contentContainerStyle={s.list}
        renderItem={({ item: n }) => {
          const meta = NOTIF_META[n.type] ?? { icon: '🔔', label: n.type };
          const wasUnread = !n.read;
          return (
            <TouchableOpacity
              style={[s.card, wasUnread && s.cardUnread]}
              onPress={() => handleTap(n)}
              activeOpacity={0.8}
            >
              {wasUnread && <View style={s.unreadStripe} />}
              {wasUnread
                ? <View style={s.unreadDot} />
                : <AppText style={s.readTick}>✓</AppText>
              }
              <AppText style={s.cardIcon}>{meta.icon}</AppText>
              <View style={s.cardBody}>
                <AppText style={s.cardLabel}>{meta.label}</AppText>
                <AppText style={s.cardMessage}>{n.message}</AppText>
                <AppText style={s.cardTime}>{timeAgo(n.created_at)}</AppText>
              </View>
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={
          <View style={s.empty}>
            <AppText style={s.emptyEmoji}>🔔</AppText>
            <AppText style={s.emptyText}>No notifications yet</AppText>
            <AppText style={s.emptyHint}>Activity from tutorials, discussions and connections will appear here</AppText>
          </View>
        }
      />
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: NICO.background },
  center:    { flex: 1, justifyContent: 'center', alignItems: 'center' },
  list:      { padding: SPACING.base, paddingBottom: 48, gap: SPACING.sm },

  card: {
    backgroundColor: NICO.screenBg,
    borderRadius: RADIUS.xl,
    borderWidth: 1, borderColor: NICO.border,
    flexDirection: 'row', alignItems: 'flex-start',
    gap: SPACING.md, padding: SPACING.md,
    overflow: 'hidden',
    ...SHADOW.sm,
  },
  cardUnread: {
    backgroundColor: NICO.chatBubbleMe,
    borderColor: NICO.teal,
    // inset shadow via extra shadow layers
    shadowColor: NICO.teal,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 6,
    elevation: 3,
  },
  unreadStripe: {
    position: 'absolute', left: 0, top: 0, bottom: 0,
    width: 4, backgroundColor: NICO.teal,
    borderTopLeftRadius: RADIUS.xl, borderBottomLeftRadius: RADIUS.xl,
  },
  unreadDot: {
    position: 'absolute', top: SPACING.md, right: SPACING.md,
    width: 9, height: 9, borderRadius: 5,
    backgroundColor: NICO.error,
  },
  readTick: {
    position: 'absolute', top: SPACING.sm, right: SPACING.md,
    fontSize: scale(18), fontWeight: FONT_WEIGHT.extraBold,
    color: NICO.success,
  },
  cardIcon:    { fontSize: scale(22), marginTop: 1 },
  cardBody:    { flex: 1, gap: 2 },
  cardLabel:   { fontSize: FONT_SIZE.xs, fontWeight: FONT_WEIGHT.extraBold, color: NICO.primary, textTransform: 'uppercase', letterSpacing: 0.6 },
  cardMessage: { fontSize: FONT_SIZE.md, color: NICO.text, lineHeight: 20 },
  cardTime:    { fontSize: FONT_SIZE.xs, color: NICO.textMuted, marginTop: 2 },

  empty:      { alignItems: 'center', paddingTop: 80, gap: SPACING.md },
  emptyEmoji: { fontSize: 56 },
  emptyText:  { ...TEXT_STYLE.cardTitle },
  emptyHint:  { ...TEXT_STYLE.hint, textAlign: 'center', paddingHorizontal: SPACING.xl },
});
