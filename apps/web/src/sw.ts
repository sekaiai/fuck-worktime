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
  let payload:
    | {
        title?: string;
        body?: string;
        url?: string;
      }
    | undefined;

  try {
    payload = event.data?.json() as
      | {
          title?: string;
          body?: string;
          url?: string;
        }
      | undefined;
  } catch (error) {
    console.error('[SW] Failed to parse push payload as JSON.', error);
    payload = {
      body: event.data?.text() ?? '你有一条新的通知。',
    };
  }

  console.info('[SW] Push event received.', {
    hasData: !!event.data,
    title: payload?.title ?? '云上工时',
    url: payload?.url ?? '/',
  });

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

  console.info('[SW] Notification clicked.', { targetUrl });

  event.notification.close();
  event.waitUntil(self.clients.openWindow(targetUrl));
});
