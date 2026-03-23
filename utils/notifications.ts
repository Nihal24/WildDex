import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';

const NOTIF_ENABLED_KEY = 'wilddex_daily_notif_enabled';
const NOTIF_HOUR = 9; // 9am daily

const MESSAGES = [
  { title: '🦎 Time to explore!', body: 'Go find a new animal to add to your WildDex.' },
  { title: '🐦 Nature is calling', body: 'Head outside and spot something wild today.' },
  { title: '🌿 Daily discovery', body: 'Your WildDex is waiting — go find something new.' },
  { title: '🦊 New sighting?', body: 'Take a photo of an animal and identify it today.' },
  { title: '🐝 Get outside!', body: "There's wildlife around you — go find it." },
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
  return val === 'true';
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
