import AsyncStorage from '@react-native-async-storage/async-storage';
import { Vibration, Platform } from 'react-native';
import Toast from 'react-native-toast-message';
import { Slab } from '../types';

const NOTIFICATIONS_STORAGE_KEY = 'teconnect_notifications_v1';
const SEEN_SLABS_KEY = 'teconnect_seen_slab_ids_v1';

export type NotificationType = 'SLAB' | 'PUNCH' | 'SALE' | 'MEETING' | 'DEALER' | 'SYSTEM';

export interface AppNotification {
  id: string;
  title: string;
  body: string;
  type: NotificationType;
  timestamp: string; // ISO string
  read: boolean;
  data?: Record<string, any>;
}

// Default initial notifications if empty
const DEFAULT_NOTIFICATIONS: AppNotification[] = [
  {
    id: 'notif_welcome',
    title: '🎉 TE CONNECT ରେ ସ୍ୱାଗତ (Welcome to TE CONNECT)',
    body: 'ଜାଜପୁର ଓ ଭଦ୍ରକ ଟେରିଟୋରୀର ସମସ୍ତ ସ୍ଲାବ୍, ବିକ୍ରୟ ଏବଂ ପଞ୍ଚିଂ ଏଠାରେ ଟ୍ରାକ୍ କରନ୍ତୁ।',
    type: 'SYSTEM',
    timestamp: new Date().toISOString(),
    read: false,
  },
];

export async function getNotifications(): Promise<AppNotification[]> {
  try {
    const raw = await AsyncStorage.getItem(NOTIFICATIONS_STORAGE_KEY);
    if (!raw) {
      await AsyncStorage.setItem(NOTIFICATIONS_STORAGE_KEY, JSON.stringify(DEFAULT_NOTIFICATIONS));
      return DEFAULT_NOTIFICATIONS;
    }
    const list: AppNotification[] = JSON.parse(raw);
    return list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  } catch (e) {
    return DEFAULT_NOTIFICATIONS;
  }
}

export async function getUnreadNotificationsCount(): Promise<number> {
  const list = await getNotifications();
  return list.filter(n => !n.read).length;
}

export async function addNotification(
  title: string,
  body: string,
  type: NotificationType,
  data?: Record<string, any>
): Promise<AppNotification> {
  const list = await getNotifications();
  const newNotif: AppNotification = {
    id: `notif_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    title,
    body,
    type,
    timestamp: new Date().toISOString(),
    read: false,
    data,
  };

  const updated = [newNotif, ...list].slice(0, 50); // Keep latest 50
  await AsyncStorage.setItem(NOTIFICATIONS_STORAGE_KEY, JSON.stringify(updated));

  // Trigger tactile / visual real notification
  try {
    if (Platform.OS !== 'web') {
      Vibration.vibrate([0, 80, 40, 80]);
    }
  } catch (e) {}

  Toast.show({
    type: 'info',
    text1: title,
    text2: body,
    visibilityTime: 4000,
  });

  return newNotif;
}

export async function markNotificationAsRead(id: string): Promise<void> {
  const list = await getNotifications();
  const updated = list.map(n => (n.id === id ? { ...n, read: true } : n));
  await AsyncStorage.setItem(NOTIFICATIONS_STORAGE_KEY, JSON.stringify(updated));
}

export async function markAllNotificationsAsRead(): Promise<void> {
  const list = await getNotifications();
  const updated = list.map(n => ({ ...n, read: true }));
  await AsyncStorage.setItem(NOTIFICATIONS_STORAGE_KEY, JSON.stringify(updated));
}

export async function clearAllNotifications(): Promise<void> {
  await AsyncStorage.setItem(NOTIFICATIONS_STORAGE_KEY, JSON.stringify([]));
}

export async function checkAndNotifyNewSlabs(slabs: Slab[]): Promise<void> {
  if (!slabs || slabs.length === 0) return;
  try {
    const rawSeen = await AsyncStorage.getItem(SEEN_SLABS_KEY);
    const seenIds: string[] = rawSeen ? JSON.parse(rawSeen) : [];

    // Find new slabs from DEALER_QR or PUBLIC_LINK that haven't been notified yet
    const newQrSlabs = slabs.filter(s => s.slab_id && !seenIds.includes(s.slab_id) && (s.source === 'DEALER_QR' || s.source === 'PUBLIC_LINK'));

    if (newQrSlabs.length > 0) {
      for (const slab of newQrSlabs.slice(0, 3)) {
        await addNotification(
          `🏗️ ନୂଆ QR ସ୍ଲାବ୍ ବୁକିଂ! (${slab.dealer_name || 'Dealer'})`,
          `ସିମେଣ୍ଟ: ${slab.expected_cement || '50 ବସ୍ତା'} | ତାରିଖ: ${slab.slab_date} | ଯୋଗାଯୋଗ: ${slab.contractor_name || slab.remark || 'N/A'}`,
          'SLAB',
          { slab_id: slab.slab_id, dealer_id: slab.dealer_id }
        );
      }
      const updatedSeen = Array.from(new Set([...seenIds, ...slabs.map(s => s.slab_id)])).slice(-200);
      await AsyncStorage.setItem(SEEN_SLABS_KEY, JSON.stringify(updatedSeen));
    } else if (seenIds.length === 0) {
      // Initialize seen IDs with current records so existing records don't trigger bulk toasts
      const initialSeen = slabs.map(s => s.slab_id).slice(-200);
      await AsyncStorage.setItem(SEEN_SLABS_KEY, JSON.stringify(initialSeen));
    }
  } catch (e) {
    // Ignore notification check error
  }
}
