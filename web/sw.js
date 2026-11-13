// Offline-first service worker. VERSION is kept equal to version.json by scripts/bump-version.mjs (a unit test enforces it).
const VERSION = '0.1.0';
const CACHE = `distance-analyzer-${VERSION}`;
const SHELL = ['./', 'index.html', 'manifest.webmanifest', 'version.json', 'icon.svg', 'css/app.css',
  'js/app.js', 'js/theme-boot.js', 'js/util.js', 'js/i18n.js', 'js/native.js', 'js/ui/home.js', 'js/ui/settings.js',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png'];

self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin) return; // never touch cross-origin
  // version.json: network first so the app can notice updates; everything else: cache first, refresh in background.
  if (url.pathname.endsWith('/version.json')) {
    e.respondWith(fetch(req).then((r) => { const c = r.clone(); caches.open(CACHE).then((x) => x.put(req, c)); return r; }).catch(() => caches.match(req)));
    return;
  }
  e.respondWith(caches.match(req, { ignoreSearch: true }).then((hit) => hit || fetch(req).then((r) => {
    if (r.ok) { const c = r.clone(); caches.open(CACHE).then((x) => x.put(req, c)); }
    return r;
  })).catch(() => caches.match('index.html')));
});
