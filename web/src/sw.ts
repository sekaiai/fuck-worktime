/// <reference lib="webworker" />

import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching';

declare let self: ServiceWorkerGlobalScope;

interface PushMessagePayload {
  title?: string;
  body?: string;
  url?: string;
}

function normalizeUrl(rawUrl: unknown) {
  return typeof rawUrl === 'string' && rawUrl.trim() ? rawUrl : '/';
}

function parsePushPayload(data: PushEvent['data']) {
  if (!data) {
    return {
      title: '云上工时',
      body: '你有一条新的通知。',
      url: '/',
    };
  }

  try {
    const payload = data.json() as PushMessagePayload;

    return {
      title: payload.title?.trim() || '云上工时',
      body: payload.body?.trim() || '你有一条新的通知。',
      url: normalizeUrl(payload.url),
    };
  } catch {
    const text = data.text();

    return {
      title: '云上工时',
      body: text.trim() || '你有一条新的通知。',
      url: '/',
    };
  }
}

cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  const payload = parsePushPayload(event.data);

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      data: {
        url: payload.url,
      },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  const targetUrl = String(event.notification.data?.url ?? '/');

  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      const matchingClient = windowClients.find((client) => {
        return 'focus' in client && client.url === new URL(targetUrl, self.location.origin).href;
      });

      if (matchingClient && 'focus' in matchingClient) {
        return matchingClient.focus();
      }

      return self.clients.openWindow(targetUrl);
    }),
  );
});
