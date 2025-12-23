/* =========================
   Nimbus Service Worker
   Auto-updating & safe
========================= */

const CACHE_VERSION = "nimbus-v5";
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const RUNTIME_CACHE = `${CACHE_VERSION}-runtime`;

/* =========================
   Files to precache
========================= */
const PRECACHE_ASSETS = [
  "./",
  "./index.html",
  "./style.css",
  "./script.js",
  "./manifest.json"
];

/* =========================
   INSTALL
   - Cache core files
   - Skip waiting so updates apply immediately
========================= */
self.addEventListener("install", event => {
  self.skipWaiting();

  event.waitUntil(
    caches.open(STATIC_CACHE).then(cache => {
      return cache.addAll(PRECACHE_ASSETS);
    })
  );
});

/* =========================
   ACTIVATE
   - Remove old caches
   - Take control immediately
========================= */
self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.map(key => {
          if (!key.startsWith(CACHE_VERSION)) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

/* =========================
   FETCH
   Strategy:
   - Network-first for API
   - Cache-first for static files
========================= */
self.addEventListener("fetch", event => {
  const req = event.request;
  const url = new URL(req.url);

  /* 🌍 Open-Meteo API: always network-first */
  if (url.origin.includes("open-meteo.com")) {
    event.respondWith(
      fetch(req)
        .then(res => {
          const clone = res.clone();
          caches.open(RUNTIME_CACHE).then(cache => cache.put(req, clone));
          return res;
        })
        .catch(() => caches.match(req))
    );
    return;
  }

  /* 🧠 Everything else: cache-first */
  event.respondWith(
    caches.match(req).then(cached => {
      return cached || fetch(req).then(res => {
        const clone = res.clone();
        caches.open(RUNTIME_CACHE).then(cache => cache.put(req, clone));
        return res;
      });
    })
  );
});
