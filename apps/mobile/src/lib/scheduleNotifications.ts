import * as Notifications from 'expo-notifications';
import { ScheduleItem } from '../types';

// Configure how notifications are presented when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: false, // user spec: push only, no in-app banner
    shouldPlaySound:  false,
    shouldSetBadge:   false,
    shouldShowAlert:  false,
    shouldShowList:   false,
  }),
});

const CHANNEL_ID = 'schedule';

async function ensureChannel() {
  // Android only — no-op on iOS
  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: 'Schedule',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
  });
}

async function requestPermission(): Promise<boolean> {
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

/**
 * Cancel all previously scheduled class notifications and re-schedule
 * for the items returned by get_user_schedule_today. Should be called
 * on focus whenever schedule data is refreshed.
 *
 * Only fires when the app is in the background (foreground handler suppresses
 * the banner per user requirement).
 */
export async function refreshScheduleNotifications(items: ScheduleItem[]): Promise<void> {
  const granted = await requestPermission();
  if (!granted) return;

  await ensureChannel();

  // Cancel any previously scheduled class notifications
  const existing = await Notifications.getAllScheduledNotificationsAsync();
  const classTags = existing.filter(n => n.content.data?.type === 'schedule_class');
  await Promise.all(classTags.map(n => Notifications.cancelScheduledNotificationAsync(n.identifier)));

  const now = new Date();
  const todayBase = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  for (const item of items) {
    const [h, m] = item.start_time.split(':').map(Number);
    const classStart = new Date(todayBase.getTime());
    classStart.setHours(h, m, 0, 0);

    // Fire 15 minutes before class
    const fireAt = new Date(classStart.getTime() - 15 * 60 * 1000);

    // Skip if the notification time has already passed
    if (fireAt <= now) continue;

    await Notifications.scheduleNotificationAsync({
      content: {
        title: `${item.emoji} ${item.title} in 15 minutes`,
        body: `Starting at ${formatTime(item.start_time)}`,
        sound: true,
        data: { type: 'schedule_class', itemId: item.id },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: fireAt,
        channelId: CHANNEL_ID,
      },
    });
  }
}

function formatTime(t: string): string {
  const [h, m] = t.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  return `${h % 12 || 12}:${m.toString().padStart(2, '0')} ${period}`;
}
