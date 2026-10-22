/* CATJEE Teach Desk — service worker (v4: also shows phone notifications).
   Everything from our own site (the page, manifest.json, icons) is fetched fresh when online,
   so a new upload shows up at once; the saved copy is used only when there is no internet.
   Firebase and other servers are never touched here. */
const CACHE = 'catjee-teachdesk-v4';
const SHELL = ['./', './manifest.json', './icon-192.png', './icon-512.png', './icon-maskable-512.png', './apple-touch-icon.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => Promise.all(SHELL.map((u) => fetch(u + (u.indexOf('?') === -1 ? '?' : '&') + 'fresh=' + Date.now(), { cache: 'no-store' }).then((r) => (r && r.ok ? c.put(u, r) : null)).catch(() => null)))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  // remove every older saved copy (the old one kept a red manifest.json)
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  const isPage = req.mode === 'navigate' || url.pathname.endsWith('/') || url.pathname.endsWith('.html');
  const key = isPage ? './' : url.pathname;
  e.respondWith(
    fetch(new Request(url.origin + url.pathname + '?fresh=' + Date.now(), { cache: 'no-store', credentials: 'same-origin' }))
      .then((res) => {
        if (res && res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(isPage ? './' : req, copy)); }
        return res;
      })
      .catch(() => caches.match(isPage ? './' : req).then((r) => r || caches.match(key)))
  );
});

// Phone notifications: the Worker sends {title, body, tag, url}; this shows it even when the app is closed.
self.addEventListener('push', (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (err) { d = { body: e.data ? e.data.text() : '' }; }
  const opts = { body: d.body || '', icon: 'icon-192.png', data: { url: d.url || './' } };
  if (d.tag) { opts.tag = d.tag; opts.renotify = true; }
  e.waitUntil(self.registration.showNotification(d.title || 'CATJEE Teach Desk', opts));
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = new URL((e.notification.data && e.notification.data.url) || './', self.registration.scope).href;
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
    for (const c of list) { if ('focus' in c) return c.focus(); }
    return self.clients.openWindow(url);
  }));
});
