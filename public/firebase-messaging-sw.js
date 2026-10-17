// TE CONNECT — Service Worker with Firebase Cloud Messaging & Web Push
/* eslint-disable no-restricted-globals */

const CACHE_NAME = 'te-connect-v3';
const ASSETS_TO_CACHE = [
  '/',
  '/manifest.json',
  '/favicon.png',
  '/icon.png',
  '/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE).catch(() => {});
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Push notification listener (even when app is closed / phone locked)
self.addEventListener('push', (event) => {
  let data = {};
  try {
    if (event.data) {
      data = event.data.json();
    }
  } catch (err) {
    try {
      data = { title: 'TE CONNECT Alert', body: event.data ? event.data.text() : '' };
    } catch (e) {
      data = {};
    }
  }

  const title = data.title || (data.notification && data.notification.title) || '🏗️ TE CONNECT Notification';
  const body = data.body || (data.notification && data.notification.body) || 'New activity recorded in your territory.';
  const url = data.url || (data.data && data.data.url) || '/';
  const icon = data.icon || '/icon.png';
  const badge = data.badge || '/favicon.png';

  const options = {
    body: body,
    icon: icon,
    badge: badge,
    vibrate: [200, 100, 200, 100, 300],
    tag: data.tag || 'te-connect-' + Date.now(),
    renotify: true,
    requireInteraction: true,
    data: {
      url: url,
      timestamp: Date.now(),
    },
    actions: [
      { action: 'open', title: 'Open App 📱' },
      { action: 'dismiss', title: 'Dismiss' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'dismiss') {
    return;
  }

  const targetUrl = (event.notification.data && event.notification.data.url) || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (let i = 0; i < clientList.length; i++) {
        const client = clientList[i];
        if (client.url && 'focus' in client) {
          if (client.navigate) {
            client.navigate(targetUrl);
          }
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});
