/// <reference lib="webworker" />

const CACHE_NAME = "tg-corp-v4";
const OFFLINE_URL = "/offline.html";

// Static assets to pre-cache on install
const PRECACHE_ASSETS = [
  "/",
  "/manifest.json",
  OFFLINE_URL,
];

// ----- Install: pre-cache shell -----
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_ASSETS))
  );
  self.skipWaiting();
});

// ----- Activate: clean old caches -----
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(
        names
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      )
    )
  );
  self.clients.claim();
});

// ----- Fetch: stale-while-revalidate for assets, network-first for pages -----
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET and cross-origin requests
  if (request.method !== "GET" || url.origin !== self.location.origin) return;

  // Skip API/data routes, WebSocket upgrades, and RSC payloads
  if (
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/_next/webpack-hmr") ||
    url.searchParams.has("_rsc")
  ) return;

  // Static assets: split strategy by mutability
  // Immutable hashed assets (media files with content hash): cache-first
  if (
    url.pathname.startsWith("/_next/static/media/") ||
    url.pathname.startsWith("/icons/")
  ) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        });
      })
    );
    return;
  }

  // Mutable assets (JS chunks, CSS): stale-while-revalidate
  // Serve cached version instantly but always fetch fresh copy for next time
  if (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.match(/\.(js|css|woff2?|ttf)$/)
  ) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const fetchPromise = fetch(request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        });
        return cached || fetchPromise;
      })
    );
    return;
  }

  // Pages: network-first, fallback to cache, then offline page
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return response;
      })
      .catch(() =>
        caches.match(request).then((cached) =>
          cached || caches.match(OFFLINE_URL)
        )
      )
  );
});

// ----- Push notifications -----
self.addEventListener("push", (event) => {
  const data = event.data?.json?.() || {};

  const options = {
    body: data.body || "You have a new Telegram message",
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    data: { chatId: data.chatId },
    tag: data.chatId || "default",
    renotify: true,
  };

  event.waitUntil(
    self.registration.showNotification(
      data.title || "New Message",
      options
    )
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const chatId = event.notification.data?.chatId;

  event.waitUntil(
    self.clients.matchAll({ type: "window" }).then((windowClients) => {
      for (const wc of windowClients) {
        if ("focus" in wc) {
          return wc.focus();
        }
      }
      const url = chatId ? `/chat/${chatId}` : "/chat";
      return self.clients.openWindow(url);
    })
  );
});
