// TE CONNECT — Firebase Cloud Messaging & Web Push Service Worker
/* eslint-disable no-restricted-globals */

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Listen for incoming Web Push notifications (even when app is closed / phone screen locked)
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
  const icon = data.icon || '/assets/adaptive-icon.png';
  const badge = data.badge || '/assets/favicon.png';

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
      // If a window is already open, focus it and navigate
      for (let i = 0; i < clientList.length; i++) {
        const client = clientList[i];
        if (client.url && 'focus' in client) {
          if (client.navigate) {
            client.navigate(targetUrl);
          }
          return client.focus();
        }
      }
      // Otherwise open a new window
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});
