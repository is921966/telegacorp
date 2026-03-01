/// <reference lib="webworker" />

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

// Cache static assets
const CACHE_NAME = "tg-corp-v1";
const STATIC_ASSETS = ["/", "/manifest.json"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

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
