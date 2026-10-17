// TE CONNECT — Firebase Cloud Messaging & Web Push Client
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { User } from '../types';

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
  if (Platform.OS !== 'web' || typeof window === 'undefined') {
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
