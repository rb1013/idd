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
type Tab = 'discussions' | 'tutorials' | 'events';

type NotifType =
  | 'tutorial_approved'
  | 'tutorial_rejected'
  | 'discussion_reply'
  | 'event_rsvp';

interface GuardianNotification {
  id: string;
  type: NotifType;
  message: string;
  ref_id: string | null;
  read: boolean;
  created_at: string;
}

const NOTIF_META: Record<NotifType, { icon: string; label: string }> = {
  tutorial_approved: { icon: '🎓', label: 'Tutorial Approved' },
  tutorial_rejected: { icon: '❌', label: 'Tutorial Rejected' },
  discussion_reply:  { icon: '💬', label: 'New Reply'         },
  event_rsvp:        { icon: '📅', label: 'Event RSVP'        },
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

function fullTimestamp(dateStr: string): string {
  return new Date(dateStr).toLocaleString(undefined, {
    month: 'short', day: 'numeric',
    hour: 'numeric', minute: '2-digit',
  });
}

export default function GuardianNotificationsScreen() {
  const navigation = useNavigation<Nav>();
  const { guardian } = useAuth();
  const [discussions, setDiscussions] = useState<GuardianNotification[]>([]);
  const [tutorials, setTutorials]     = useState<GuardianNotification[]>([]);
  const [events, setEvents]           = useState<GuardianNotification[]>([]);
  const [loading, setLoading]         = useState(true);
  const [activeTab, setActiveTab]     = useState<Tab>('discussions');

  useNicoHeader(navigation);

  useFocusEffect(
    useCallback(() => {
      if (guardian) load(guardian.id);
    }, [guardian]),
  );

  async function load(guardianId: string) {
    setLoading(true);
    const { data: settings } = await supabase
      .from('app_settings')
      .select('notif_tutorial_window_hours, notif_discussion_limit')
      .single();
    const windowHours = settings?.notif_tutorial_window_hours ?? 48;
    const discLimit   = settings?.notif_discussion_limit ?? 30;
    const cutoff = new Date(Date.now() - windowHours * 60 * 60 * 1000).toISOString();

    const [{ data: disc }, { data: tut }, { data: evt }] = await Promise.all([
      supabase
        .from('notifications')
        .select('id, type, message, ref_id, read, created_at')
        .eq('guardian_id', guardianId)
        .in('type', ['discussion_reply'])
        .eq('read', false)
        .order('created_at', { ascending: false })
        .limit(discLimit),
      supabase
        .from('notifications')
        .select('id, type, message, ref_id, read, created_at')
        .eq('guardian_id', guardianId)
        .in('type', ['tutorial_approved', 'tutorial_rejected'])
        .eq('dismissed', false)
        .gte('created_at', cutoff)
        .order('created_at', { ascending: false })
        .limit(30),
      supabase
        .from('notifications')
        .select('id, type, message, ref_id, read, created_at')
        .eq('guardian_id', guardianId)
        .eq('type', 'event_rsvp')
        .eq('read', false)
        .order('created_at', { ascending: false })
        .limit(30),
    ]);

    setDiscussions((disc as GuardianNotification[]) ?? []);
    setTutorials((tut as GuardianNotification[]) ?? []);
    setEvents((evt as GuardianNotification[]) ?? []);
    setLoading(false);
  }

  async function handleTap(n: GuardianNotification) {
    if (!n.read) {
      await supabase.from('notifications').update({ read: true }).eq('id', n.id);
      setDiscussions(prev => prev.map(x => x.id === n.id ? { ...x, read: true } : x));
      setTutorials(prev => prev.map(x => x.id === n.id ? { ...x, read: true } : x));
      setEvents(prev => prev.map(x => x.id === n.id ? { ...x, read: true } : x));
    }
    switch (n.type) {
      case 'tutorial_approved':
      case 'tutorial_rejected':
        if (n.ref_id) navigation.navigate('TutorialPreview', { tutorialId: n.ref_id });
        break;
      case 'discussion_reply':
        if (n.ref_id) navigation.navigate('DiscussionDetail', { postId: n.ref_id });
        break;
      case 'event_rsvp':
        if (n.ref_id) navigation.navigate('EventDetail', { eventId: n.ref_id });
        break;
    }
  }

  async function dismissTutorial(id: string) {
    supabase.from('notifications').update({ dismissed: true }).eq('id', id).then(() => {});
    setTutorials(prev => prev.filter(n => n.id !== id));
  }

  const unreadDiscussions = discussions.filter(n => !n.read).length;
  const unreadTutorials   = tutorials.filter(n => !n.read).length;
  const unreadEvents      = events.filter(n => !n.read).length;
  const tabData           = activeTab === 'discussions' ? discussions : activeTab === 'tutorials' ? tutorials : events;

  if (loading) {
    return <View style={s.center}><ActivityIndicator size="large" color={NICO.primary} /></View>;
  }

  function renderCard(n: GuardianNotification) {
    const meta      = NOTIF_META[n.type] ?? { icon: '🔔', label: n.type };
    const wasUnread = !n.read;
    const isTutorial = n.type === 'tutorial_approved' || n.type === 'tutorial_rejected';
    return (
      <TouchableOpacity
        key={n.id}
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
          <AppText style={s.cardTime}>
            {isTutorial
              ? `${timeAgo(n.created_at)}  ·  ${fullTimestamp(n.created_at)}`
              : timeAgo(n.created_at)
            }
          </AppText>
        </View>
        {isTutorial && (
          <TouchableOpacity
            style={s.dismissBtn}
            onPress={() => dismissTutorial(n.id)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <AppText style={s.dismissIcon}>✕</AppText>
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    );
  }

  return (
    <View style={s.container}>
      <RainbowDivider />

      {/* Tab bar */}
      <View style={s.tabBar}>
        {(['discussions', 'tutorials', 'events'] as Tab[]).map(tab => {
          const unread = tab === 'discussions' ? unreadDiscussions : tab === 'tutorials' ? unreadTutorials : unreadEvents;
          const active = activeTab === tab;
          const label  = tab === 'discussions' ? 'Discussions' : tab === 'tutorials' ? 'Tutorials' : 'Events';
          return (
            <TouchableOpacity
              key={tab}
              style={[s.tab, active && s.tabActive]}
              onPress={() => setActiveTab(tab)}
              activeOpacity={0.75}
            >
              <AppText style={[s.tabTxt, active && s.tabTxtActive]}>{label}</AppText>
              {unread > 0 && (
                <View style={s.tabBadge}>
                  <AppText style={s.tabBadgeText}>{unread > 9 ? '9+' : unread}</AppText>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={s.tabPane}>
        <FlatList
          data={tabData}
          keyExtractor={n => n.id}
          contentContainerStyle={s.list}
          renderItem={({ item: n }) => renderCard(n)}
          ListEmptyComponent={
            <View style={s.empty}>
              <AppText style={s.emptyEmoji}>🔔</AppText>
              <AppText style={s.emptyText}>No notifications</AppText>
              <AppText style={s.emptyHint}>
                {activeTab === 'discussions'
                  ? 'Replies to your discussion posts will appear here'
                  : activeTab === 'tutorials'
                  ? 'Tutorial approvals and rejections from the last 48 hours will appear here'
                  : 'RSVP activity on your hosted events will appear here'
                }
              </AppText>
            </View>
          }
        />
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: NICO.background },
  center:    { flex: 1, justifyContent: 'center', alignItems: 'center' },

  tabBar: {
    flexDirection: 'row', backgroundColor: NICO.surface,
    borderBottomWidth: 1, borderBottomColor: NICO.border,
  },
  tab: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: SPACING.xs, paddingVertical: SPACING.md,
    borderBottomWidth: 2, borderBottomColor: 'transparent',
  },
  tabActive:    { borderBottomColor: NICO.primary },
  tabTxt:       { fontSize: FONT_SIZE.md, fontWeight: FONT_WEIGHT.medium, color: NICO.textMuted },
  tabTxtActive: { fontSize: FONT_SIZE.md, fontWeight: FONT_WEIGHT.extraBold, color: NICO.primary },
  tabBadge: {
    backgroundColor: NICO.error, borderRadius: RADIUS.full,
    minWidth: scale(16), height: scale(16), paddingHorizontal: 3,
    justifyContent: 'center', alignItems: 'center',
  },
  tabBadgeText: { fontSize: scale(9), fontWeight: FONT_WEIGHT.extraBold, color: '#fff' },

  tabPane: { flex: 1, backgroundColor: NICO.background },
  list:    { padding: SPACING.base, paddingBottom: 48, gap: SPACING.sm },

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

  dismissBtn:  { padding: SPACING.xs, justifyContent: 'center', alignItems: 'center' },
  dismissIcon: { fontSize: scale(14), color: NICO.textMuted, fontWeight: FONT_WEIGHT.bold },

  empty:      { alignItems: 'center', paddingTop: 80, gap: SPACING.md },
  emptyEmoji: { fontSize: 56 },
  emptyText:  { ...TEXT_STYLE.cardTitle },
  emptyHint:  { ...TEXT_STYLE.hint, textAlign: 'center', paddingHorizontal: SPACING.xl },
});
