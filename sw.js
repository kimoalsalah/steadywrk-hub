/* ═══════════════════════════════════════════════════════════════
   STEADYWRK DISPATCH — Service Worker
   Strategy: Cache-first with network fallback
   ═══════════════════════════════════════════════════════════════ */

const CACHE_NAME = 'steadywrk-v1';
const PRECACHE_URLS = [
  '.',
  'index.html',
  'manifest.webmanifest',
  'icon.svg',
  'dispatch-training.html',
  'official-docs/dispatcher-package.html',
  'official-docs/call-script.html',
  'official-docs/sourcing-guide.html',
  'official-docs/opsec-rules.html'
];

/* ── Install: pre-cache all shell resources ── */
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_URLS);
    }).then(() => self.skipWaiting())
  );
});

/* ── Activate: clean up old caches ── */
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    }).then(() => self.clients.claim())
  );
});

/* ── Fetch: cache-first, network fallback ── */
self.addEventListener('fetch', (event) => {
  /* Only handle same-origin GET requests */
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        /* Serve from cache; refresh in background */
        fetch(event.request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(event.request, networkResponse.clone());
              });
            }
          })
          .catch(() => { /* offline — already served from cache */ });
        return cachedResponse;
      }
      /* Not in cache — try network, then cache it */
      return fetch(event.request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return networkResponse;
      }).catch(() => {
        /* Offline fallback — return index.html for navigation requests */
        if (event.request.destination === 'document') {
          return caches.match('index.html');
        }
      });
    })
  );
});
