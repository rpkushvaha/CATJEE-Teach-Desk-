/* CATJEE Teach Desk — service worker (v3).
   Everything from our own site (the page, manifest.json, icons) is fetched fresh when online,
   so a new upload shows up at once; the saved copy is used only when there is no internet.
   Firebase and other servers are never touched here. */
const CACHE = 'catjee-teachdesk-v3';
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
