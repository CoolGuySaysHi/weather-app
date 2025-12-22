const CACHE_NAME = "nimbus-v4";

const APP_ASSETS = [
  "/weather-app/",
  "/weather-app/index.html",
  "/weather-app/style.css",
  "/weather-app/script.js",
  "/weather-app/manifest.json",
  "/weather-app/icon-192.png",
  "/weather-app/icon-512.png"
];

self.addEventListener("message", event => {
  if (event.data === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(APP_ASSETS))
  );
  // ❌ no skipWaiting here — enables update prompt
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.map(key => key !== CACHE_NAME && caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", event => {
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) {
        fetch(event.request)
          .then(res => {
            if (res && res.status === 200) {
              caches.open(CACHE_NAME).then(cache =>
                cache.put(event.request, res.clone())
              );
            }
          })
          .catch(() => {});
        return cached;
      }

      return fetch(event.request)
        .then(res => {
          if (res && res.status === 200) {
            caches.open(CACHE_NAME).then(cache =>
              cache.put(event.request, res.clone())
            );
          }
          return res;
        })
        .catch(() => caches.match("/weather-app/index.html"));
    })
  );
});
