const CACHE_NAME = 'streamcut-v2';

// Shell assets that must survive being offline: the app bundle, the icons, and
// both typefaces. Satoshi alone is not enough any more — Azeret Mono carries
// every timecode, duration and label in the UI.
const PRECACHE = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/fonts/satoshi-var.woff2',
  '/fonts/azeret-mono-400.woff2',
  '/fonts/azeret-mono-500.woff2',
  '/fonts/azeret-mono-700.woff2',
  '/icon-192.png',
  '/icon-512.png',
  '/favicon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) =>
        // Don't let one missing icon abort the whole install.
        Promise.allSettled(PRECACHE.map((url) => cache.add(url)))
      )
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

const isStatic = (url) =>
  /\.(?:css|js|mjs|woff2?|ttf|png|jpg|jpeg|svg|webp|ico|json)(?:$|\?)/i.test(url.pathname) ||
  url.pathname === '/' ||
  url.pathname.endsWith('/index.html');

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Never touch the API, video ranges, or non-GET work.
  if (request.method !== 'GET' || url.pathname.includes('/api/')) return;
  if (url.origin !== location.origin) return;

  // Media is streamed with byte ranges; caching it would be wrong and huge.
  if (url.pathname.startsWith('/uploads/') || url.pathname.startsWith('/media/')) return;

  if (isStatic(url)) {
    // Cache-first with background refresh: fonts and bundles are versioned or
    // immutable, and this keeps the app opening instantly offline.
    event.respondWith(
      caches.match(request).then((hit) => {
        const refresh = fetch(request)
          .then((res) => {
            if (res && res.ok) {
              const clone = res.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
            }
            return res;
          })
          .catch(() => hit);
        return hit || refresh;
      })
    );
    return;
  }

  // Everything else: network, fall back to cache.
  event.respondWith(
    fetch(request)
      .then((res) => {
        if (res && res.ok) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return res;
      })
      .catch(() => caches.match(request).then((hit) => hit || caches.match('/')))
  );
});
