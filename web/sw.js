// Offline-first service worker. VERSION is kept equal to version.json by scripts/bump-version.mjs (a unit test enforces it).
const VERSION = '0.11.0';
const CACHE = `stepup-${VERSION}`;
const SHELL = ['./', 'index.html', 'manifest.webmanifest', 'version.json', 'icon.svg', 'css/packs.css', 'css/app.css',
  'js/app.js', 'js/theme-boot.js', 'js/util.js', 'js/i18n.js', 'js/native.js', 'js/icons.js', 'js/brand.js', 'js/brandData.js', 'js/iconData.js', 'js/geo.js', 'js/workout.js', 'js/metronome.js', 'js/cadence.js', 'js/audio.js', 'js/format.js', 'js/store.js', 'js/ui/home.js', 'js/plan.js', 'js/indicators.js', 'js/appVersion.js', 'js/art.js', 'art/badges/almost-distance-dark.svg', 'art/badges/almost-distance-light.svg', 'art/badges/almost-record-dark.svg', 'art/badges/almost-record-light.svg', 'art/badges/faster-last-dark.svg', 'art/badges/faster-last-light.svg', 'art/badges/fastest-km-dark.svg', 'art/badges/fastest-km-light.svg', 'art/badges/new-record-dark.svg', 'art/badges/new-record-light.svg', 'art/badges/passed-distance-dark.svg', 'art/badges/passed-distance-light.svg', 'art/onboarding/caught-up-dark.svg', 'art/onboarding/caught-up-light.svg', 'art/onboarding/no-plan-dark.svg', 'art/onboarding/no-plan-light.svg', 'art/onboarding/no-routes-dark.svg', 'art/onboarding/no-routes-light.svg', 'art/onboarding/no-workouts-dark.svg', 'art/onboarding/no-workouts-light.svg', 'art/onboarding/offline-dark.svg', 'art/onboarding/offline-light.svg', 'art/onboarding/welcome-dark.svg', 'art/onboarding/welcome-light.svg', 'art/weather/clear-dark.svg', 'art/weather/clear-light.svg', 'art/weather/cloudy-dark.svg', 'art/weather/cloudy-light.svg', 'art/weather/cold-dark.svg', 'art/weather/cold-light.svg', 'art/weather/hot-dark.svg', 'art/weather/hot-light.svg', 'art/weather/rain-dark.svg', 'art/weather/rain-light.svg', 'art/weather/windy-dark.svg', 'art/weather/windy-light.svg', 'js/update.js', 'js/strings07.js', 'js/ui/about.js', 'js/strings06.js', 'js/ui/plan.js', 'js/schedule.js', 'js/widgetData.js', 'js/syncNative.js', 'js/strings05.js', 'js/route.js', 'js/routeReco.js', 'js/strings04.js', 'js/ui/routes.js', 'js/ui/livemap.js', 'js/forecast.js', 'js/reco.js', 'js/weatherApi.js', 'js/strings03.js', 'js/ui/reco.js', 'js/stats.js', 'js/steps.js', 'js/effort.js', 'js/reminders.js', 'js/alerts.js', 'js/search.js', 'js/charts.js', 'js/reminderLoop.js', 'js/strings02.js', 'js/ui/dashboard.js', 'js/ui/alerts.js', 'js/ui/search.js', 'js/ui/notify.js', 'js/ui/settings.js', 'js/ui/history.js', 'js/ui/workout.js', 'js/ui/rhythm.js',
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
