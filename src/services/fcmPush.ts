// TE CONNECT — Firebase Cloud Messaging & Web Push Client
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { User } from '../types';
import { APPS_SCRIPT_URL } from '../config/api';

export const FIREBASE_VAPID_KEY = 'BI-1JI3ltghrA-omYfHX9VHeOaPV2qxFB6L7JkjYzpYiX-WYLwA5UBHBMhraq-ngDFp0LwergXn9a9UAI4L5r7I';
const PUSH_SUB_KEY = 'te_fcm_push_subscription';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Registers the Service Worker and subscribes the user's phone/browser
 * to Web Push notifications using the Firebase VAPID key.
 */
export async function registerPushNotifications(user?: User | null): Promise<boolean> {
  // ── NATIVE ANDROID / IOS EXPO PUSH TOKEN ─────────────────
  if (Platform.OS !== 'web') {
    try {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      if (finalStatus !== 'granted') {
        await AsyncStorage.setItem(PUSH_SUB_KEY, JSON.stringify({
          registered: false,
          error: 'Notification permission not granted by user in phone settings.',
          platform: Platform.OS,
          updatedAt: new Date().toISOString(),
        }));
        return false;
      }

      let pushToken: string | null = null;
      let tokenType = 'expo';
      let regError = '';

      const projectId =
        Constants?.expoConfig?.extra?.eas?.projectId ?? Constants?.easConfig?.projectId;

      // 1. Try Expo push token
      try {
        const tokenData = await (projectId && projectId !== 'YOUR_EAS_PROJECT_ID'
          ? Notifications.getExpoPushTokenAsync({ projectId })
          : Notifications.getExpoPushTokenAsync());
        if (tokenData?.data) {
          pushToken = tokenData.data;
          tokenType = 'expo';
        }
      } catch (err: any) {
        regError = err?.message || String(err);
        console.log('[Push] getExpoPushTokenAsync note:', regError);
      }

      // 2. If Expo token was not obtained, get native Android FCM token via google-services
      if (!pushToken) {
        try {
          const deviceTokenData = await Notifications.getDevicePushTokenAsync();
          if (deviceTokenData?.data) {
            pushToken = deviceTokenData.data;
            tokenType = 'fcm';
          }
        } catch (devErr: any) {
          regError = devErr?.message || String(devErr);
          console.log('[Push] getDevicePushTokenAsync note:', regError);
        }
      }

      if (pushToken) {
        await AsyncStorage.setItem(PUSH_SUB_KEY, JSON.stringify({
          registered: true,
          token: pushToken,
          token_type: tokenType,
          platform: Platform.OS,
          user: user?.name || 'Unknown',
          district: user?.district || 'Jajpur',
          registeredAt: new Date().toISOString(),
        }));

        await fetch(APPS_SCRIPT_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'registerPushSubscription',
            endpoint: pushToken,
            token_type: tokenType,
            user_name: user?.name || '',
            user_role: user?.role || '',
            district: user?.district || '',
            platform: Platform.OS,
          }),
        }).catch(() => {});
        return true;
      } else {
        await AsyncStorage.setItem(PUSH_SUB_KEY, JSON.stringify({
          registered: false,
          error: regError || 'Failed to acquire push token from device.',
          platform: Platform.OS,
          updatedAt: new Date().toISOString(),
        }));
      }
    } catch (e: any) {
      console.log('[Push] Native push registration note:', e);
    }
    return false;
  }

  // ── WEB SERVICE WORKER PUSH ──────────────────────────────
  if (typeof window === 'undefined') {
    return false;
  }

  if (!('serviceWorker' in navigator) || !('Notification' in window) || !('PushManager' in window)) {
    console.log('[Push] Service Worker, Notification or PushManager not supported in this browser.');
    return false;
  }

  try {
    // 1. Register the Service Worker
    const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js', {
      scope: '/',
    });
    await Promise.race([
      navigator.serviceWorker.ready,
      new Promise(resolve => setTimeout(resolve, 3000)),
    ]);

    // Register Periodic Background Sync if available
    if ('periodicSync' in registration) {
      try {
        await (registration as any).periodicSync.register('check-new-slabs', {
          minInterval: 60 * 1000,
        });
      } catch (e) {}
    }

    // 2. Request permission if not already granted
    let permission = Notification.permission;
    if (permission === 'default') {
      permission = await Notification.requestPermission();
    }

    if (permission !== 'granted') {
      console.log('[Push] Notification permission denied or dismissed.');
      return false;
    }

    // 3. Subscribe with the Firebase VAPID Key
    const applicationServerKey = urlBase64ToUint8Array(FIREBASE_VAPID_KEY);
    let subscription = await registration.pushManager.getSubscription();

    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: applicationServerKey as any,
      });
    }

    if (subscription) {
      const subJson = subscription.toJSON();
      await AsyncStorage.setItem(PUSH_SUB_KEY, JSON.stringify({
        subscription: subJson,
        user: user?.name || 'Unknown',
        district: user?.district || 'Jajpur',
        registeredAt: new Date().toISOString(),
      }));

      // Send subscription to backend
      fetch(APPS_SCRIPT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'registerPushSubscription',
          endpoint: subJson.endpoint,
          keys: subJson.keys,
          user_name: user?.name || '',
          user_role: user?.role || '',
          district: user?.district || '',
        }),
      }).catch(() => {});

      console.log('[Push] Web Push Subscription successful:', subJson.endpoint);
      return true;
    }

    return false;
  } catch (error) {
    console.warn('[Push] Error subscribing to Web Push:', error);
    return false;
  }
}

/**
 * Triggers a real background system notification via the Service Worker
 * to test wake-up, sound, and banner on mobile devices.
 */
export async function sendTestPushNotification(title?: string, body?: string): Promise<boolean> {
  if (Platform.OS !== 'web' || typeof window === 'undefined') {
    return false;
  }

  if (!('serviceWorker' in navigator) || !('Notification' in window)) {
    return false;
  }

  try {
    const reg = await Promise.race([
      navigator.serviceWorker.ready,
      new Promise<ServiceWorkerRegistration | null>(resolve => setTimeout(() => resolve(null), 3000)),
    ]);
    if (!reg) return false;

    if (Notification.permission === 'granted') {
      await reg.showNotification(title || '🏗️ TE CONNECT — Push Test', {
        body: body || 'Real push notifications are configured! Notifications will wake up your phone when new slabs or updates arrive.',
        icon: '/icon.png',
        badge: '/favicon.png',
        vibrate: [200, 100, 200, 100, 300],
        data: { url: '/notifications' },
      });
      return true;
    } else {
      const perm = await Notification.requestPermission();
      if (perm === 'granted') {
        await reg.showNotification(title || '🏗️ TE CONNECT — Push Test', {
          body: body || 'Notifications enabled! You will now receive background alerts.',
          icon: '/icon.png',
          badge: '/favicon.png',
          vibrate: [200, 100, 200],
          data: { url: '/notifications' },
        });
        return true;
      }
    }
  } catch (e) {
    console.warn('[Push] Failed to trigger test notification:', e);
  }
  return false;
}

export async function getPushStatus(): Promise<{
  registered: boolean;
  token?: string;
  error?: string;
  platform: string;
}> {
  try {
    const raw = await AsyncStorage.getItem(PUSH_SUB_KEY);
    if (!raw) {
      return { registered: false, platform: Platform.OS, error: 'Push not registered yet' };
    }
    const parsed = JSON.parse(raw);
    return {
      registered: !!(parsed.token || parsed.subscription),
      token: parsed.token || (parsed.subscription ? 'Web Push Active' : undefined),
      error: parsed.error,
      platform: parsed.platform || Platform.OS,
    };
  } catch (e: any) {
    return { registered: false, platform: Platform.OS, error: e?.message };
  }
}
