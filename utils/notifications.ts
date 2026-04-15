import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getDailyAnimal, DAILY_ANIMALS } from './dailyAnimal';

const NOTIF_ENABLED_KEY = 'wilddex_daily_notif_enabled';
const NOTIF_HOUR_KEY = 'wilddex_daily_notif_hour';
const DEFAULT_HOUR = 17; // 5pm — after the work day
const AOTD_HOUR = 9; // 9am — morning discovery

// 14 distinct messages — cycle by day so each day feels fresh
const MESSAGES = [
  { title: '🦁 Your WildDex is calling!', body: "Get outside — there's a wild animal waiting to be discovered!" },
  { title: '🐦 Eyes up, explorer!', body: "Wildlife is everywhere if you look. What will you find today?" },
  { title: '🌿 Nature hour is here!', body: "Perfect time for a walk. Your collection won't fill itself!" },
  { title: "🦊 Don't break your streak!", body: "Head outside and add to your WildDex before the day ends." },
  { title: '🐝 Something wild is waiting!', body: "There's always a new species out there — go find it." },
  { title: '🦅 Golden hour for spotting!', body: "Animals are most active at dusk. Grab your camera!" },
  { title: '🌊 The wild world is waiting!', body: "Open your camera and see what's out there — you might be surprised." },
  { title: '🐢 Slow down and look around!', body: "The best sightings happen when you least expect them." },
  { title: '🦋 What flies near you today?', body: "Check your backyard, park, or window. Nature is closer than you think." },
  { title: '🌙 Evening adventure time!', body: "Twilight brings out owls, foxes, and more. Ready to spot?" },
  { title: '🐸 Explorer mode: ON', body: "You haven't spotted anything yet today. Let's fix that!" },
  { title: '🦜 New species await!', body: "Every walk is a chance to discover something new for your WildDex." },
  { title: '🏔️ Chase the next badge!', body: "You're closer than you think to your next achievement. Get outside!" },
  { title: '🐺 The wild calls to you!', body: "Step outside for 10 minutes. You'll be surprised what you find." },
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
  return val === null ? true : val === 'true';
}

export async function getNotificationHour(): Promise<number> {
  const val = await AsyncStorage.getItem(NOTIF_HOUR_KEY);
  return val !== null ? parseInt(val, 10) : DEFAULT_HOUR;
}

function getDayOfYear(): number {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 0);
  return Math.floor((now.getTime() - start.getTime()) / 86400000);
}

export async function enableDailyNotification(hour?: number): Promise<boolean> {
  const { status } = await Notifications.requestPermissionsAsync();
  if (status !== 'granted') return false;

  const notifHour = hour ?? (await getNotificationHour());
  await Notifications.cancelAllScheduledNotificationsAsync();

  const dayOfYear = getDayOfYear();
  const today = new Date();

  // Schedule 14 days of notifications, each with a different message
  for (let i = 0; i < 14; i++) {
    const msg = MESSAGES[(dayOfYear + i) % MESSAGES.length];
    const triggerDate = new Date(today);
    triggerDate.setDate(today.getDate() + i);
    triggerDate.setHours(notifHour, 0, 0, 0);

    if (triggerDate.getTime() > Date.now()) {
      await Notifications.scheduleNotificationAsync({
        content: { title: msg.title, body: msg.body, sound: true },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: triggerDate,
        },
      });
    }
  }

  await AsyncStorage.setItem(NOTIF_ENABLED_KEY, 'true');
  await AsyncStorage.setItem(NOTIF_HOUR_KEY, String(notifHour));
  return true;
}

export async function setNotificationHour(hour: number): Promise<void> {
  await AsyncStorage.setItem(NOTIF_HOUR_KEY, String(hour));
  const enabled = await getNotificationsEnabled();
  if (enabled) await enableDailyNotification(hour);
}

export async function disableDailyNotification(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
  await AsyncStorage.setItem(NOTIF_ENABLED_KEY, 'false');
}

function formatLabel(label: string): string {
  return label.split('_').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

export async function enableAotdNotifications(): Promise<void> {
  const { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') return;

  const today = new Date();

  // Schedule 14 days of AOTD morning notifications, each with the correct animal
  for (let i = 0; i < 14; i++) {
    const animal = getDailyAnimal(i);
    const name = formatLabel(animal.label);
    const triggerDate = new Date(today);
    triggerDate.setDate(today.getDate() + i);
    triggerDate.setHours(AOTD_HOUR, 0, 0, 0);

    if (triggerDate.getTime() > Date.now()) {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: `${animal.emoji} Animal of the Day: ${name}`,
          body: 'Open WildDex to discover a wild fact!',
          sound: true,
          data: { type: 'aotd' },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: triggerDate,
        },
      });
    }
  }
}

// Called on app open — always refresh the schedule so messages stay current
export async function initNotifications(): Promise<void> {
  const enabled = await getNotificationsEnabled();
  if (enabled !== false) {
    await Promise.all([enableDailyNotification(), enableAotdNotifications()]);
  }
}
