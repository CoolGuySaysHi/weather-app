const CACHE_NAME = "nimbus-v2";

const APP_ASSETS = [
  "/weather-app/",
  "/weather-app/index.html",
  "/weather-app/style.css",
  "/weather-app/script.js",
  "/weather-app/manifest.json",
  "/weather-app/icon-192.png",
  "/weather-app/icon-512.png"
];

/* Allow update prompt */
self.addEventListener("message", event => {
  if (event.data === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

/* Install: cache app shell */
self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(APP_ASSETS))
  );
  self.skipWaiting();
});

/* Activate: clear old caches */
self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.map(key => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      )
    )
  );
  self.clients.claim();
});

/* Fetch: network → cache → fallback */
self.addEventListener("fetch", event => {
  event.respondWith(
    fetch(event.request)
      .then(response => {
        const clone = response.clone();
        caches.open(CACHE_NAME).then(cache => {
          cache.put(event.request, clone);
        });
        return response;
      })
      .catch(() =>
        caches.match(event.request).then(res => {
          return res || caches.match("/weather-app/index.html");
        })
      )
  );
});
