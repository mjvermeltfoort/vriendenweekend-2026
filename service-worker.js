const CACHE_NAME = 'vriendenweekend-dossier-shell-v41';

const APP_SHELL = [
  './',
  './index.html',
  './app-update.js',
  './config.js',
  './config.example.js',
  './supabase-api.js',
  './manifest.webmanifest',
  './games/game-assistant.css',
  './games/game-assistant.js',
  './games/game-shell.css',
  './games/game-shell.js',
  './games/code.html',
  './games/dwaalspoor.html',
  './games/kettingreactie.html',
  './games/memory.html',
  './games/mozaiek.html',
  './games/rebus.html',
  './games/schaduwzoeker.html',
  './games/tussen-de-letters.html',
  './games/vluchtroute.html',
  './games/vallende-stenen.html',
  './assets/schaduwzoeker-origineel.webp',
  './assets/schaduwzoeker-verschillen.webp'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL))
  );
});

self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    event.waitUntil(self.skipWaiting());
  }
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys =>
        Promise.all(
          keys
            .filter(key => key !== CACHE_NAME)
            .map(key => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  const normalizedKey = url.origin + url.pathname;

  if (url.origin !== self.location.origin) return;

  const isNetworkPreferred =
    url.pathname.endsWith('/manifest.webmanifest') ||
    url.pathname.endsWith('/config.js') ||
    url.pathname.includes('/icons/') ||
    url.pathname.endsWith('/service-worker.js');

  if (isNetworkPreferred) {
    event.respondWith(
      fetch(event.request).catch(() => caches.match(event.request).then(hit => hit || caches.match(normalizedKey)))
    );
    return;
  }

  if (event.request.mode === 'navigate') {
    const fallbackPath = url.pathname.endsWith('/games/code.html')
      ? './games/code.html'
      : url.pathname.endsWith('/games/dwaalspoor.html')
        ? './games/dwaalspoor.html'
      : url.pathname.endsWith('/games/kettingreactie.html')
        ? './games/kettingreactie.html'
      : url.pathname.endsWith('/games/mozaiek.html')
        ? './games/mozaiek.html'
        : url.pathname.endsWith('/games/memory.html')
          ? './games/memory.html'
        : url.pathname.endsWith('/games/vluchtroute.html')
          ? './games/vluchtroute.html'
        : url.pathname.endsWith('/games/vallende-stenen.html')
          ? './games/vallende-stenen.html'
        : url.pathname.endsWith('/games/schaduwzoeker.html')
          ? './games/schaduwzoeker.html'
        : url.pathname.endsWith('/games/tussen-de-letters.html')
          ? './games/tussen-de-letters.html'
        : url.pathname.endsWith('/games/rebus.html')
          ? './games/rebus.html'
        : './index.html';

    event.respondWith(
      fetch(event.request)
        .then(response => {
          const copy = response.clone();
          event.waitUntil(
            caches.open(CACHE_NAME).then(cache => {
              return cache.put(normalizedKey, copy);
            })
          );
          return response;
        })
        .catch(() =>
          caches.match(normalizedKey).then(hit => {
            if (hit) return hit;
            return caches.match(fallbackPath).then(pathHit => {
              if (pathHit) return pathHit;
              return caches.match('./index.html');
            });
          })
        )
    );

    return;
  }

  event.respondWith(
    fetch(event.request).catch(() =>
      caches.match(event.request).then(hit => hit || caches.match(normalizedKey))
    )
  );
});
