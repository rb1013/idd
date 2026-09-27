import { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../lib/supabase';

/**
 * Mirrors the three unread categories GuardianNotificationsScreen tracks
 * (discussions / tutorials / events) but only checks for presence via
 * head-count queries, so screens showing the notifications bell (e.g.
 * GuardianTabBar) can light up a dot without fetching any row data.
 *
 * Re-checks on focus, same pattern GuardianNotificationsScreen already uses —
 * no realtime subscription, so the dot updates on the next screen focus
 * rather than instantly when a push notification arrives.
 */
export default function useHasUnreadNotifications(guardianId: string | undefined) {
  const [hasUnread, setHasUnread] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (!guardianId) {
        setHasUnread(false);
        return;
      }
      let active = true;

      (async () => {
        const { data: settings } = await supabase
          .from('app_settings')
          .select('notif_tutorial_window_hours')
          .single();
        const windowHours = settings?.notif_tutorial_window_hours ?? 48;
        const cutoff = new Date(Date.now() - windowHours * 60 * 60 * 1000).toISOString();

        const [{ count: discCount }, { count: tutCount }, { count: evtCount }] = await Promise.all([
          supabase
            .from('notifications')
            .select('id', { count: 'exact', head: true })
            .eq('guardian_id', guardianId)
            .eq('type', 'discussion_reply')
            .eq('read', false),
          supabase
            .from('notifications')
            .select('id', { count: 'exact', head: true })
            .eq('guardian_id', guardianId)
            .in('type', ['tutorial_approved', 'tutorial_rejected'])
            .eq('dismissed', false)
            .eq('read', false)
            .gte('created_at', cutoff),
          supabase
            .from('notifications')
            .select('id', { count: 'exact', head: true })
            .eq('guardian_id', guardianId)
            .eq('type', 'event_rsvp')
            .eq('read', false),
        ]);

        if (active) {
          setHasUnread((discCount ?? 0) + (tutCount ?? 0) + (evtCount ?? 0) > 0);
        }
      })();

      return () => { active = false; };
    }, [guardianId]),
  );

  return hasUnread;
}
