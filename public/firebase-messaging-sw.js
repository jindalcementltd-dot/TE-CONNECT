// TE CONNECT — Service Worker with Firebase Cloud Messaging, Web Push & Background Poller
/* eslint-disable no-restricted-globals */

const CACHE_NAME = 'te-connect-v4';
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwD_2lt1qBbtcEiTcjbct565HUusllU1YW4b5i3fS_cEQBmBE_ZZ8WLBlPOXhs6ELum_g/exec';

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
  // Kick off background check immediately on activate
  checkForNewSlabsInBackground();
});

// ── BACKGROUND SLAB MONITOR (WORKS WHEN APP IS CLOSED) ──
async function checkForNewSlabsInBackground() {
  try {
    const res = await fetch(`${APPS_SCRIPT_URL}?action=getSlabs`);
    if (!res.ok) return;
    const json = await res.json();
    if (!json || !json.success || !Array.isArray(json.data)) return;

    const slabs = json.data;
    if (slabs.length === 0) return;

    const cache = await caches.open('te-connect-meta');
    const lastSeenResp = await cache.match('/last-known-slab-id');
    let lastKnownId = '';
    if (lastSeenResp) {
      lastKnownId = await lastSeenResp.text();
    }

    // Newest slab is the last one in the list
    const latestSlab = slabs[slabs.length - 1];
    if (!latestSlab || !latestSlab.slab_id) return;

    if (lastKnownId && latestSlab.slab_id !== lastKnownId) {
      // Check if this latest slab was from QR or created recently
      const title = `🏗️ New Slab Alert! (${latestSlab.dealer_name || 'Dealer'})`;
      const body = `Expected: ${latestSlab.expected_cement || '50 Bags'} | Date: ${latestSlab.slab_date || 'Upcoming'} | By: ${latestSlab.contractor_name || latestSlab.remark || 'Booking'}`;

      await self.registration.showNotification(title, {
        body,
        icon: '/icon.png',
        badge: '/favicon.png',
        vibrate: [300, 100, 300, 100, 400],
        tag: `slab-${latestSlab.slab_id}`,
        renotify: true,
        requireInteraction: true,
        data: {
          url: `/(tabs)/slab`,
          timestamp: Date.now(),
        },
        actions: [
          { action: 'open', title: 'Open Slab 🏗️' },
          { action: 'dismiss', title: 'Dismiss' }
        ]
      });
    }

    // Update last known ID
    await cache.put('/last-known-slab-id', new Response(latestSlab.slab_id));
  } catch (err) {
    // Offline or network error
  }
}

// Background poller interval: checks every 60s
setInterval(checkForNewSlabsInBackground, 60 * 1000);

// Periodic Sync event listener for Chromium-based Android browsers
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'check-new-slabs') {
    event.waitUntil(checkForNewSlabsInBackground());
  }
});

// Push notification listener (even when app is closed / phone locked)
self.addEventListener('push', (event) => {
  event.waitUntil(
    (async () => {
      let data = {};
      try {
        if (event.data) {
          data = event.data.json();
        }
      } catch (err) {
        try {
          data = { title: '🏗️ TE CONNECT Alert', body: event.data ? event.data.text() : '' };
        } catch (e) {
          data = {};
        }
      }

      // If push payload is empty (e.g. server ping / wakeup), poll backend immediately
      if (!data.title && (!data.notification || !data.notification.title)) {
        await checkForNewSlabsInBackground();
        return;
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
        vibrate: [300, 100, 300, 100, 400],
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

      await self.registration.showNotification(title, options);
    })()
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
