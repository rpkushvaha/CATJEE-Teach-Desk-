/* CATJEE Teach Desk — service worker (v5: also shows phone notifications, the number on the app icon, and buzzes the phone).
   Everything from our own site (the page, manifest.json, icons) is fetched fresh when online,
   so a new upload shows up at once; the saved copy is used only when there is no internet.
   Firebase and other servers are never touched here. */
const CACHE = 'catjee-teachdesk-v5';
const BADGE = 'catjee-badge'; // keeps the number shown on the app icon (how many alerts came while the app was closed)
const SHELL = ['./', './manifest.json', './icon-192.png', './icon-512.png', './icon-maskable-512.png', './apple-touch-icon.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => Promise.all(SHELL.map((u) => fetch(u + (u.indexOf('?') === -1 ? '?' : '&') + 'fresh=' + Date.now(), { cache: 'no-store' }).then((r) => (r && r.ok ? c.put(u, r) : null)).catch(() => null)))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  // remove every older saved copy (the old one kept a red manifest.json)
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE && k !== BADGE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
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

// The number on the app icon: +1 for each alert that arrives; the app sets it to the real unread count when it is opened
const badgeGet = () => caches.open(BADGE).then((c) => c.match('./__badge')).then((r) => (r ? r.text() : '0')).then((t) => Math.max(0, parseInt(t, 10) || 0)).catch(() => 0);
const badgeSet = (n) => caches.open(BADGE).then((c) => c.put('./__badge', new Response(String(n)))).then(() => { try { const nv = self.navigator; if (nv && nv.setAppBadge) return n > 0 ? nv.setAppBadge(n) : nv.clearAppBadge(); } catch (err) { /* the phone cannot show it: fine */ } }).catch(() => {});
self.addEventListener('message', (e) => { const d = e.data; if (d && d.type === 'badge') e.waitUntil(badgeSet(Math.max(0, Number(d.n) || 0))); });

// Phone notifications: the Worker sends {title, body, tag, url}; this shows it even when the app is closed.
self.addEventListener('push', (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (err) { d = { body: e.data ? e.data.text() : '' }; }
  // the phone buzzes with the alert: a long pattern for a class reminder, a short double buzz for everything else
  const opts = { body: d.body || '', icon: 'icon-192.png', data: { url: d.url || './' }, vibrate: String(d.tag || '').indexOf('cls-') === 0 ? [300, 150, 300, 150, 600] : [200, 100, 200] };
  if (d.tag) { opts.tag = d.tag; opts.renotify = true; }
  e.waitUntil(self.registration.showNotification(d.title || 'CATJEE Teach Desk', opts).then(() => badgeGet()).then((n) => badgeSet(n + 1)));
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = new URL((e.notification.data && e.notification.data.url) || './', self.registration.scope).href;
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
    for (const c of list) { if ('focus' in c) return c.focus(); }
    return self.clients.openWindow(url);
  }));
});
