import AsyncStorage from '@react-native-async-storage/async-storage';
import { Vibration, Platform } from 'react-native';
import Toast from 'react-native-toast-message';
import { Audio } from 'expo-av';
import * as Notifications from 'expo-notifications';
import { Slab } from '../types';
import { CHIME_BASE64 } from './chimeBase64';

// Configure expo-notifications handler for native apps (foreground notifications)
if (Platform.OS !== 'web') {
  try {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
      }),
    });
  } catch (e) {}
}

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

// ──────────────────────────────────────────────────────────
// ANDROID NOTIFICATION CHANNEL & PERMISSIONS
// ──────────────────────────────────────────────────────────
export async function setupAndroidNotificationChannel() {
  if (Platform.OS === 'android') {
    try {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'TE CONNECT Alerts',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 150, 250, 150, 400],
        lightColor: '#C91F2B',
        enableLights: true,
        enableVibrate: true,
        showBadge: true,
      });
    } catch (e) {
      console.warn('[NotificationChannel] error:', e);
    }
  }
}

export async function requestAppNotificationPermission(): Promise<boolean> {
  if (Platform.OS !== 'web') {
    try {
      await setupAndroidNotificationChannel();
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      return finalStatus === 'granted';
    } catch (e) {
      console.warn('[Permissions] native error:', e);
      return false;
    }
  } else {
    return requestPushPermission();
  }
}

// ──────────────────────────────────────────────────────────
// NATIVE & WEB AUDIO ENGINE
// ──────────────────────────────────────────────────────────
let sharedAudioCtx: any = null;
let sharedAudioEl: any = null;
let isAudioUnlocked = false;

export function initAndUnlockAudio() {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return;
  try {
    const AudioCtx = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (AudioCtx && !sharedAudioCtx) {
      sharedAudioCtx = new AudioCtx();
    }
    if (sharedAudioCtx && sharedAudioCtx.state === 'suspended') {
      sharedAudioCtx.resume().catch(() => {});
    }

    const DomAudio = typeof window !== 'undefined' ? (window as any).Audio : null;
    if (!sharedAudioEl && DomAudio) {
      sharedAudioEl = new DomAudio(CHIME_BASE64);
      sharedAudioEl.volume = 1.0;
      sharedAudioEl.load();
    }
    isAudioUnlocked = true;
  } catch (e) {}
}

// Auto-register touch/click listeners on mobile browser to unlock audio pipeline on first tap
if (Platform.OS === 'web' && typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
  const unlockHandler = () => {
    initAndUnlockAudio();
    window.removeEventListener('click', unlockHandler);
    window.removeEventListener('touchstart', unlockHandler);
    window.removeEventListener('touchend', unlockHandler);
  };
  window.addEventListener('click', unlockHandler, { passive: true });
  window.addEventListener('touchstart', unlockHandler, { passive: true });
  window.addEventListener('touchend', unlockHandler, { passive: true });
}

/**
 * Signature Distinct Audio Chime
 * Native Android APK: Plays chime via expo-av
 * Web Browser: Dual-engine Base64 HTML5 Audio + Web Audio synthesizer fallback
 */
export async function playNotificationSound() {
  // 1. Native Android / iOS Audio
  if (Platform.OS !== 'web') {
    try {
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: true,
      });

      const { sound } = await Audio.Sound.createAsync(
        { uri: CHIME_BASE64 },
        { shouldPlay: true, volume: 1.0 }
      );

      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          sound.unloadAsync().catch(() => {});
        }
      });
    } catch (e) {
      console.warn('[Audio] native playback error:', e);
    }
    return;
  }

  // 2. Web Browser Audio
  initAndUnlockAudio();

  let played = false;

  // Engine 1: HTML5 Audio with Base64 Chime WAV
  try {
    const DomAudio = typeof window !== 'undefined' ? (window as any).Audio : null;
    if (DomAudio) {
      const audio = new DomAudio(CHIME_BASE64);
      audio.volume = 1.0;
      const promise = audio.play();
      if (promise !== undefined) {
        promise
          .then(() => {
            played = true;
          })
          .catch(() => {
            synthesizeWebAudioChime();
          });
      } else {
        played = true;
      }
    }
  } catch (e) {}

  if (!played) {
    synthesizeWebAudioChime();
  }
}

function synthesizeWebAudioChime() {
  try {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;

    const AudioCtx = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;

    if (!sharedAudioCtx) {
      sharedAudioCtx = new AudioCtx();
    }
    if (sharedAudioCtx && sharedAudioCtx.state === 'suspended') {
      sharedAudioCtx.resume().catch(() => {});
    }

    const ctx = sharedAudioCtx;
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

    // Harmonic 3-tone chime: E6 -> G#6 -> B6
    playTone(1318.51, now, 0.28, 0.35);
    playTone(1661.22, now + 0.09, 0.32, 0.4);
    playTone(1975.53, now + 0.18, 0.5, 0.45);
  } catch (e) {}
}

/**
 * Request OS Browser Push Notification permission
 */
export async function requestPushPermission(): Promise<boolean> {
  initAndUnlockAudio();
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
            vibrate: [250, 100, 250],
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

  // 1. Play signature sound chime immediately (Native Android APK + Web)
  playNotificationSound();

  // 2. Trigger distinct rhythmic vibration
  try {
    if (Platform.OS !== 'web') {
      Vibration.vibrate([0, 250, 150, 250, 150, 400]);
    } else if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate([250, 150, 250, 150, 400]);
    }
  } catch (e) {}

  // 3. System Notification
  if (Platform.OS !== 'web') {
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          data: data || {},
          sound: true,
          color: '#C91F2B',
          vibrate: [0, 250, 150, 250, 150, 400],
        },
        trigger: null, // show immediately
      });
    } catch (e) {
      console.warn('[Notifications] Native schedule error:', e);
    }
  } else {
    sendBrowserPushNotification(title, body);
  }

  // 4. In-App visual toast banner
  Toast.show({
    type: 'info',
    text1: title,
    text2: body,
    visibilityTime: 4000,
  });

  return newNotif;
}

export async function testAppNotification(title?: string, body?: string) {
  const notifTitle = title || '🔔 TE CONNECT Alert';
  const notifBody = body || 'Sound & Notification working successfully on your device!';

  await addNotification(
    notifTitle,
    notifBody,
    'SYSTEM',
    { test: true }
  );
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
