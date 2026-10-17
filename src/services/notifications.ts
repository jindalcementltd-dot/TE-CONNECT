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

// Default initial notifications in clean English
const DEFAULT_NOTIFICATIONS: AppNotification[] = [
  {
    id: 'notif_welcome',
    title: '🎉 Welcome to TE CONNECT',
    body: 'Track all slabs, sales, contractor meetings and active punching across Jajpur territory.',
    type: 'SYSTEM',
    timestamp: new Date().toISOString(),
    read: false,
  },
];

/**
 * Signature Distinct Audio Chime
 * Synthesizes a crisp, melodious 3-tone chime (E6 -> G#6 -> B6) using Web Audio API
 * Runs natively in all browsers/webviews with 0ms latency and no external audio file dependencies.
 */
export function playNotificationSound() {
  try {
    if (typeof window !== 'undefined') {
      const AudioCtx = (window as any).AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        const ctx = new AudioCtx();
        if (ctx.state === 'suspended') {
          ctx.resume();
        }
        const now = ctx.currentTime;

        const playTone = (freq: number, start: number, duration: number, peakVol: number) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, start);

          gain.gain.setValueAtTime(0, start);
          gain.gain.linearRampToValueAtTime(peakVol, start + 0.02);
          gain.gain.exponentialRampToValueAtTime(0.0005, start + duration);

          osc.connect(gain);
          gain.connect(ctx.destination);

          osc.start(start);
          osc.stop(start + duration);
        };

        // Signature distinct harmonic chime: 1318.5Hz (E6) -> 1661.2Hz (G#6) -> 1975.5Hz (B6)
        playTone(1318.51, now, 0.28, 0.22);
        playTone(1661.22, now + 0.08, 0.32, 0.25);
        playTone(1975.53, now + 0.16, 0.45, 0.28);
      }
    }
  } catch (e) {
    // Audio synthesis not available or blocked by autoplay policy
  }
}

/**
 * Request OS Browser Push Notification permission
 */
export async function requestPushPermission(): Promise<boolean> {
  if (typeof window !== 'undefined' && 'Notification' in window) {
    if (Notification.permission === 'granted') return true;
    if (Notification.permission !== 'denied') {
      try {
        const result = await Notification.requestPermission();
        return result === 'granted';
      } catch (e) {
        return false;
      }
    }
  }
  return false;
}

/**
 * Send a native browser OS push notification (displays in status bar / notification center)
 */
export async function sendBrowserPushNotification(title: string, body: string, iconUrl: string = '/icon.png') {
  if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
    try {
      if ('serviceWorker' in navigator) {
        const reg = await navigator.serviceWorker.getRegistration();
        if (reg) {
          reg.showNotification(title, {
            body,
            icon: iconUrl,
            badge: '/favicon.png',
            vibrate: [200, 100, 200],
            data: { url: '/' },
          } as any);
          return;
        }
      }
    } catch (e) {}

    try {
      new Notification(title, {
        body,
        icon: iconUrl,
      });
    } catch (e) {}
  }
}

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

  // 1. Play signature custom sound
  playNotificationSound();

  // 2. Trigger vibration on native mobile
  try {
    if (Platform.OS !== 'web') {
      Vibration.vibrate([0, 90, 50, 90]);
    }
  } catch (e) {}

  // 3. Send OS Native Web Push notification if allowed
  sendBrowserPushNotification(title, body);

  // 4. In-App visual toast banner
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
    const newQrSlabs = slabs.filter(
      s => s.slab_id && !seenIds.includes(s.slab_id) && (s.source === 'DEALER_QR' || s.source === 'PUBLIC_LINK')
    );

    if (newQrSlabs.length > 0) {
      for (const slab of newQrSlabs.slice(0, 3)) {
        await addNotification(
          `🏗️ New QR Slab Booking! (${slab.dealer_name || 'Dealer'})`,
          `Cement: ${slab.expected_cement || '50 Bags'} | Date: ${slab.slab_date} | Contact: ${slab.contractor_name || slab.remark || 'Counter Booking'}`,
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
