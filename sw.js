const CACHE_NAME = "nimbus-v3";

const APP_ASSETS = [
  "/weather-app/",
  "/weather-app/index.html",
  "/weather-app/style.css",
  "/weather-app/script.js",
  "/weather-app/manifest.json",
  "/weather-app/icon-192.png",
  "/weather-app/icon-512.png"
];

/* Install */
self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(APP_ASSETS))
  );
  self.skipWaiting();
});

/* Activate */
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

/* Fetch — CACHE FIRST (ANDROID SAFE) */
self.addEventListener("fetch", event => {
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) {
        // Update cache in background (don’t block UI)
        fetch(event.request)
          .then(response => {
            if (response && response.status === 200) {
              caches.open(CACHE_NAME).then(cache => {
                cache.put(event.request, response.clone());
              });
            }
          })
          .catch(() => {});
        return cached;
      }

      // If not cached, try network
      return fetch(event.request)
        .then(response => {
          if (response && response.status === 200) {
            caches.open(CACHE_NAME).then(cache => {
              cache.put(event.request, response.clone());
            });
          }
          return response;
        })
        .catch(() => caches.match("/weather-app/index.html"));
    })
  );
});
