// The interactive user guide: an ordered tour of the app (also searchable). Each step: id, title/text string keys (g_<id>_t / g_<id>_x), the screen to open ("Try it"),
// and whether it has a screenshot (art/guide/<lang>-<id>.jpg, taken from the real app by tests/e2e/journey.mjs with GUIDE_DIR).
export const GUIDE = [
  { id: 'welcome', href: '#/', shot: true }, { id: 'start', href: '#/workout/walk', shot: true }, { id: 'running', href: '#/workout/run', shot: true }, { id: 'tools', href: '#/workout/run', shot: true },
  { id: 'finish', href: '#/workout/walk', shot: true }, { id: 'records', href: '#/history', shot: true }, { id: 'history', href: '#/history', shot: true }, { id: 'detail', href: '#/history', shot: true },
  { id: 'dashboard', href: '#/', shot: true }, { id: 'drill', href: '#/d/effort', shot: true }, { id: 'routes', href: '#/routes', shot: true }, { id: 'map', href: '#/map', shot: true }, { id: 'routeplan', href: '#/routeplan', shot: true }, { id: 'plan', href: '#/plan', shot: true }, { id: 'reco', href: '#/reco', shot: true },
  { id: 'alerts', href: '#/alerts', shot: true }, { id: 'search', href: '#/search', shot: true }, { id: 'settings', href: '#/settings', shot: true }, { id: 'backup', href: '#/settings/s-backup', shot: true },
  { id: 'widgets', href: '#/guide/widgets', shot: false },
];
export const guideIndex = (id) => GUIDE.findIndex((g) => g.id === id);
export const stepKeys = (id) => [`g_${id}_t`, `g_${id}_x`];
