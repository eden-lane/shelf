const CACHE_NAME = "shelf-app-v1";
const APP_SHELL_URLS = [
  "/",
  "/index.html",
  "/manifest.webmanifest",
  "/apple-touch-icon.png",
  "/favicon-transparent-20260620.ico",
  "/shelf-favicon-transparent-20260620.png",
  "/pwa-icon-192.png",
  "/pwa-icon-512.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) =>
        Promise.all(cacheNames.filter((cacheName) => cacheName !== CACHE_NAME).map((cacheName) => caches.delete(cacheName)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  if (request.method !== "GET") {
    return;
  }

  const url = new URL(request.url);

  if (url.origin !== self.location.origin) {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() => caches.match("/index.html").then((response) => response || Response.error()))
    );
    return;
  }

  if (url.pathname.startsWith("/assets/")) {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        const cachedResponse = await cache.match(request);

        if (cachedResponse) {
          return cachedResponse;
        }

        const networkResponse = await fetch(request);
        cache.put(request, networkResponse.clone());

        return networkResponse;
      })
    );
  }
});

self.addEventListener("message", (event) => {
  if (!event.data || event.data.type !== "CACHE_URLS" || !Array.isArray(event.data.urls)) {
    return;
  }

  const urls = event.data.urls
    .filter((url) => typeof url === "string")
    .filter((url) => {
      const parsedUrl = new URL(url, self.location.origin);

      return parsedUrl.origin === self.location.origin && parsedUrl.pathname.startsWith("/assets/");
    });

  if (urls.length === 0) {
    return;
  }

  const cacheUrls = caches.open(CACHE_NAME).then((cache) => cache.addAll(urls));

  if ("waitUntil" in event) {
    event.waitUntil(cacheUrls);
  }
});
