const CACHE_NAME = "nimbus-v2";

const APP_ASSETS = [
  "/weather-app/",
  "/weather-app/index.html",
  "/weather-app/style.css",
  "/weather-app/script.js",
  "/weather-app/manifest.json",
  "/weather-app/icons/icon-192.png",
  "/weather-app/icons/icon-512.png"
];

/* =========================
   INSTALL
========================= */
self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(APP_ASSETS);
    })
  );
  self.skipWaiting();
});

/* =========================
   ACTIVATE
========================= */
self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys
          .filter(k => k !== CACHE_NAME)
          .map(k => caches.delete(k))
      );
    })
  );
  self.clients.claim();
});

/* =========================
   FETCH
========================= */
self.addEventListener("fetch", event => {
  const url = new URL(event.request.url);

  /* 🚫 NEVER touch third-party APIs (Open-Meteo, geocoding, etc.) */
  if (url.origin !== self.location.origin) {
    return;
  }

  /* 📦 Cache-first for app assets */
  event.respondWith(
    caches.match(event.request).then(cached => {
      return (
        cached ||
        fetch(event.request).then(response => {
          // Only cache valid GET responses
          if (
            event.request.method === "GET" &&
            response.status === 200
          ) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => {
              cache.put(event.request, clone);
            });
          }
          return response;
        })
      );
    }).catch(() => {
      // Offline fallback (optional)
      if (event.request.mode === "navigate") {
        return caches.match("/weather-app/index.html");
      }
    })
  );
});
