const CACHE_VERSION = "felinoterapia-v1";
const PRECACHE_URLS = [
  "/",
  "/index.html",
  "/styles.css",
  "/pwa.js",
  "/manifest.webmanifest",
  "/app/",
  "/app/index.html",
  "/app/biblioteca/",
  "/app/biblioteca/index.html",
  "/app/progresso/",
  "/app/progresso/index.html",
  "/app/config/",
  "/app/config/index.html",
  "/app/app.css",
  "/app/app.js",
  "/src/data/atividades.json"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(PRECACHE_URLS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_VERSION)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") {
    return;
  }

  const isSameOrigin = new URL(request.url).origin === self.location.origin;
  if (!isSameOrigin) {
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) {
        return cached;
      }
      return fetch(request).then((response) => {
        const responseClone = response.clone();
        caches.open(CACHE_VERSION).then((cache) => {
          cache.put(request, responseClone);
        });
        return response;
      });
    })
  );
});
