// Service Worker for Engaz Pro (إنجاز برو) PWA
const CACHE_NAME = 'engaz-pro-pwa-v2';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/icons/icon-192.svg',
  '/icons/icon-512.svg',
  '/icons/icon-maskable.svg',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

// 1. Install: Precache App Shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn('[SW] Precache partial error (non-fatal):', err);
      });
    })
  );
  self.skipWaiting();
});

// 2. Activate: Clean up obsolete caches & take immediate control
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
    })
  );
  self.clients.claim();
});

// 3. Fetch strategy:
// - /api/* requests: STRICT NETWORK-ONLY (Never cache stale financial balances or transactions)
// - Navigation requests: Network First -> Fallback to cached index.html for SPA routing
// - Static assets (JS/CSS/images/fonts): Cache First -> Network fallback
self.addEventListener('fetch', (event) => {
  const request = event.request;

  // Only intercept GET requests
  if (request.method !== 'GET') {
    return;
  }

  const url = new URL(request.url);

  // Ignore non-http requests (e.g. chrome-extension://, data:, blob:)
  if (!url.protocol.startsWith('http')) {
    return;
  }

  // Strict Rule: NEVER cache API calls. Financial data must always be live from backend.
  if (url.pathname.startsWith('/api/')) {
    return;
  }

  // SPA Navigation or client-side route requests: Network First, fallback to cached index.html
  const isSpaNavigation =
    request.mode === 'navigate' ||
    request.headers.get('accept')?.includes('text/html') ||
    (!url.pathname.includes('.') && !url.pathname.startsWith('/api/'));

  if (isSpaNavigation) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, responseClone));
          }
          return response;
        })
        .catch(() => {
          return caches.match('/index.html').then((match) => match || caches.match('/'));
        })
    );
    return;
  }

  // Static Assets (fonts, js, css, icons, svgs): Cache First, fallback to Network
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        // Fetch in background to update cache for next time (Stale-While-Revalidate)
        fetch(request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              caches.open(CACHE_NAME).then((cache) => cache.put(request, networkResponse));
            }
          })
          .catch(() => {});
        return cachedResponse;
      }

      return fetch(request)
        .then((networkResponse) => {
          if (
            networkResponse &&
            networkResponse.status === 200 &&
            (url.pathname.endsWith('.js') ||
              url.pathname.endsWith('.css') ||
              url.pathname.endsWith('.svg') ||
              url.pathname.endsWith('.png') ||
              url.pathname.includes('/assets/'))
          ) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, responseClone));
          }
          return networkResponse;
        })
        .catch((err) => {
          // If network failed and request was a route without extension, fallback to index.html
          if (request.headers.get('accept')?.includes('text/html') || !url.pathname.includes('.')) {
            return caches.match('/index.html').then((match) => match || caches.match('/'));
          }
          throw err;
        });
    })
  );
});
