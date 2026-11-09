// Service Worker: hält die App-Dateien offline bereit.
// Strategie "erst Netz, dann Cache": Änderungen (z. B. an config.js) kommen sofort an,
// ohne Netz startet die App trotzdem. Supabase-Anfragen laufen nie über den Cache.
const CACHE = "bargeld-v1";
const SHELL = [
  "./",
  "index.html",
  "styles.css",
  "app.js",
  "config.js",
  "manifest.webmanifest",
  "icons/icon-192.png",
  "icons/apple-touch-icon.png",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  const url = new URL(req.url);
  const isOwn = url.origin === self.location.origin;
  const isLib = url.hostname === "cdn.jsdelivr.net";
  if (req.method !== "GET" || !(isOwn || isLib)) return;

  e.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      })
      .catch(() => caches.match(req).then((hit) => hit || caches.match("index.html"))),
  );
});
