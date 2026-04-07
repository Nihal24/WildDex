import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';

const NOTIF_ENABLED_KEY = 'wilddex_daily_notif_enabled';
const NOTIF_HOUR = 9; // 9am daily

const MESSAGES = [
  { title: '🦁 Your WildDex is calling!', body: "Get outside — there's a wild animal waiting to be discovered!" },
  { title: '🐦 Daily challenge unlocked!', body: "Can you spot something new today? Your collection needs you!" },
  { title: '🌿 Adventure awaits!', body: "A new species is out there right now — go catch it!" },
  { title: "🦊 Don't break your streak!", body: "Head outside and add to your WildDex before the day ends!" },
  { title: '🐝 Nature is wild today!', body: "There's always something new to discover — get exploring!" },
  { title: '🦅 Eyes up, explorer!', body: "Wildlife is everywhere if you look! What will you find today?" },
  { title: '🌊 The wild world is waiting!', body: "Open your camera and see what's out there — you might be surprised!" },
];

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function getNotificationsEnabled(): Promise<boolean> {
  const val = await AsyncStorage.getItem(NOTIF_ENABLED_KEY);
  // Default to true if never set
  return val === null ? true : val === 'true';
}

export async function enableDailyNotification(): Promise<boolean> {
  const { status } = await Notifications.requestPermissionsAsync();
  if (status !== 'granted') return false;

  await Notifications.cancelAllScheduledNotificationsAsync();

  const msg = MESSAGES[Math.floor(Math.random() * MESSAGES.length)];
  await Notifications.scheduleNotificationAsync({
    content: { title: msg.title, body: msg.body },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour: NOTIF_HOUR,
      minute: 0,
    },
  });

  await AsyncStorage.setItem(NOTIF_ENABLED_KEY, 'true');
  return true;
}

export async function disableDailyNotification(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
  await AsyncStorage.setItem(NOTIF_ENABLED_KEY, 'false');
}

// Call on app startup to ensure notifications are scheduled if enabled by default
export async function initNotifications(): Promise<void> {
  const val = await AsyncStorage.getItem(NOTIF_ENABLED_KEY);
  if (val === null) {
    // First launch — enable by default
    await enableDailyNotification();
  }
}
