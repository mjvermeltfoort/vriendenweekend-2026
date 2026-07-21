const CACHE_NAME = 'vriendenweekend-dossier-shell-v17';

const APP_SHELL = [
  './',
  './index.html',
  './config.js',
  './manifest.webmanifest',
  './games/code.html',
  './games/memory.html',
  './games/mozaiek.html',
  './games/rebus.html',
  './games/vluchtroute.html'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL))
  );

  self.skipWaiting();
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

  if (url.origin !== self.location.origin) return;

  const isAlwaysFresh =
    url.pathname.endsWith('/manifest.webmanifest') ||
    url.pathname.endsWith('/config.js') ||
    url.pathname.includes('/icons/') ||
    url.pathname.endsWith('/service-worker.js');

  if (isAlwaysFresh) {
    event.respondWith(fetch(event.request));
    return;
  }

  if (event.request.mode === 'navigate') {
    const fallbackPath = url.pathname.endsWith('/games/code.html')
      ? './games/code.html'
      : url.pathname.endsWith('/games/mozaiek.html')
        ? './games/mozaiek.html'
        : url.pathname.endsWith('/games/memory.html')
          ? './games/memory.html'
        : url.pathname.endsWith('/games/vluchtroute.html')
          ? './games/vluchtroute.html'
        : url.pathname.endsWith('/games/rebus.html')
          ? './games/rebus.html'
        : './index.html';

    event.respondWith(
      fetch(event.request)
        .then(response => {
          const copy = response.clone();

          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, copy);
          });

          return response;
        })
        .catch(() =>
          caches.match(event.request).then(hit => {
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
    fetch(event.request).catch(() => caches.match(event.request))
  );
});
