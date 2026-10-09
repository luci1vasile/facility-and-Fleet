// Facility and Fleet Maintenance - Background Service Worker Daemon
// Runs in the background even when the application window/tab is closed by the user.
// Executes 09:00 CET Overdue/Due Soon Push Notifications and triggers Automatic Daily Backups.

const SW_STATE_CACHE = 'ffm-background-state-cache-v1';
const SW_STATE_KEY = '/__ffm_sw_background_state__.json';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      await self.clients.claim();
      await runBackgroundCheckInServiceWorker();
    })()
  );
});

async function saveSwState(state) {
  try {
    const cache = await caches.open(SW_STATE_CACHE);
    await cache.put(
      SW_STATE_KEY,
      new Response(JSON.stringify(state), {
        headers: { 'Content-Type': 'application/json' },
      })
    );
  } catch (err) {
    // Ignore storage errors
  }
}

async function loadSwState() {
  try {
    const cache = await caches.open(SW_STATE_CACHE);
    const res = await cache.match(SW_STATE_KEY);
    if (!res) return null;
    return await res.json();
  } catch {
    return null;
  }
}

async function runBackgroundCheckInServiceWorker() {
  try {
    const res = await fetch('/api/background/check-and-run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    if (res.ok) {
      const data = await res.json();
      if (data && data.shouldShowPushNotification && data.pushPayload) {
        await self.registration.showNotification(data.pushPayload.title, {
          body: data.pushPayload.body,
          icon: '/pwa-192x192.png',
          badge: '/pwa-192x192.png',
          tag: data.pushPayload.tag || 'ffm-0900-cet-alert',
          renotify: true,
          requireInteraction: true,
          data: { url: '/' },
        });
      }
      return;
    }
  } catch {
    // Offline fallback: evaluate cached state directly inside Service Worker
  }

  const cached = await loadSwState();
  if (!cached) return;

  try {
    const now = new Date();
    const cetFormatter = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/Berlin',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      hour12: false,
    });
    const parts = cetFormatter.formatToParts(now);
    const getPart = (type) =>
      (parts.find((p) => p.type === type) || {}).value || '00';
    const cetDateISO = `${getPart('year')}-${getPart('month')}-${getPart('day')}`;
    const cetHour = parseInt(getPart('hour'), 10);

    const overdueCount = Number(cached.overdueCount || 0);
    const dueSoonCount = Number(cached.dueSoonCount || 0);

    if (
      (overdueCount > 0 || dueSoonCount > 0) &&
      cetHour >= 9 &&
      cached.lastSwNotifyDateCET !== cetDateISO
    ) {
      cached.lastSwNotifyDateCET = cetDateISO;
      await saveSwState(cached);

      await self.registration.showNotification(
        'Notificare Automată 09:00 CET — Facility and Fleet Maintenance',
        {
          body: `Alerte active în fundal: ${overdueCount} Overdue și ${dueSoonCount} Due soon necesită atenție!`,
          icon: '/pwa-192x192.png',
          badge: '/pwa-192x192.png',
          tag: `ffm-sw-0900-${cetDateISO}`,
          requireInteraction: true,
          data: { url: '/' },
        }
      );
    }
  } catch {
    // Ignore
  }
}

self.addEventListener('message', (event) => {
  const data = event.data;
  if (!data || typeof data !== 'object') return;

  if (data.type === 'SYNC_STATE_TO_SW') {
    event.waitUntil(
      (async () => {
        await saveSwState(data.payload || {});
        await runBackgroundCheckInServiceWorker();
      })()
    );
  } else if (data.type === 'RUN_BACKGROUND_CHECK_NOW') {
    event.waitUntil(runBackgroundCheckInServiceWorker());
  }
});

self.addEventListener('periodicsync', (event) => {
  if (
    event.tag === 'ffm-background-daemon' ||
    event.tag === 'ffm-daily-check-0900-cet'
  ) {
    event.waitUntil(runBackgroundCheckInServiceWorker());
  }
});

self.addEventListener('sync', (event) => {
  if (event.tag === 'ffm-background-sync') {
    event.waitUntil(runBackgroundCheckInServiceWorker());
  }
});

self.addEventListener('push', (event) => {
  let payload = {
    title: 'Facility and Fleet Maintenance — Alerte Mentenanță & Flotă',
    body: 'Verificați elementele Overdue și Due soon din aplicație.',
  };
  try {
    if (event.data) {
      payload = JSON.parse(event.data.text());
    }
  } catch {
    // Fallback to default payload
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: '/pwa-192x192.png',
      badge: '/pwa-192x192.png',
      tag: 'ffm-push-notification',
      data: { url: '/' },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl =
    (event.notification.data && event.notification.data.url) || '/';

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if ('focus' in client) {
            return client.focus();
          }
        }
        if (self.clients.openWindow) {
          return self.clients.openWindow(targetUrl);
        }
      })
  );
});

// Background heartbeat inside Service Worker while alive
setInterval(() => {
  runBackgroundCheckInServiceWorker();
}, 60 * 1000);
