/* CATJEE Teach Desk — service worker.
   The app page is always fetched fresh when online (so a new index.html shows up at once)
   and kept in the cache so the app still opens with a weak or no connection.
   Firebase and other servers are never cached here. */
const CACHE = 'catjee-teachdesk-v2';
const SHELL = ['./', './manifest.json', './icon-192.png', './icon-512.png', './icon-maskable-512.png', './apple-touch-icon.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => Promise.all(SHELL.map((u) => c.add(u).catch(() => null)))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  const isPage = req.mode === 'navigate' || url.pathname.endsWith('/') || url.pathname.endsWith('.html');
  if (isPage) {
    // network first: newest version when online, saved copy when offline
    e.respondWith(
      // the "?fresh=" part makes GitHub's servers hand over the newest upload, not a copy kept for a few minutes
      fetch(new Request(url.origin + url.pathname + '?fresh=' + Date.now(), { cache: 'no-store', credentials: 'same-origin' })).then((res) => {
        if (res && res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put('./', copy)); }
        return res;
      }).catch(() => caches.match('./').then((r) => r || caches.match(req)))
    );
    return;
  }
  // icons and the manifest: saved copy first
  e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => {
    if (res && res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
    return res;
  })));
});
