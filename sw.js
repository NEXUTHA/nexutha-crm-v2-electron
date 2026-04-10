// NEXUTHA CRM V2 — Service Worker DISABLED v2
const CACHE_VERSION = 'v20260404221348';
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.map(k => caches.delete(k))))
    .then(() => self.clients.matchAll()).then(clients => clients.forEach(c => c.navigate(c.url)))
  );
  self.clients.claim();
});
self.addEventListener('fetch', e => e.respondWith(fetch(e.request)));
