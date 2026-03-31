/// <reference lib="webworker" />

import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching';

declare let self: ServiceWorkerGlobalScope;

cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  const payload = event.data?.json() as
    | {
        title?: string;
        body?: string;
        url?: string;
      }
    | undefined;

  event.waitUntil(
    self.registration.showNotification(payload?.title ?? '云上工时', {
      body: payload?.body ?? '你有一条新的通知。',
      data: {
        url: payload?.url ?? '/',
      },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  const targetUrl = String(event.notification.data?.url ?? '/');

  event.notification.close();
  event.waitUntil(self.clients.openWindow(targetUrl));
});

