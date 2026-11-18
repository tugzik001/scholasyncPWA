/* ScholaSync — sw.js */
const CACHE_VERSION = 'v10';
const CACHE = 'scholasync-' + CACHE_VERSION;

const CORE = [
  './',
  'index.html',
  'manifest.json',
  'css/styles.css',
  'js/theme.js',
  'js/db.js',
  'js/supabase.js',
  'js/auth.js',
  'js/app.js',
  'js/signup.js',
  'js/login.js',
  'js/student.js',
  'js/sms.js',
  'js/admin.js',
  'js/school-portal.js',
  'pages/signup.html',
  'pages/login.html',
  'pages/student-dashboard.html',
  'pages/admin.html'
];

/* We comment these out for now so we don't get 404 errors before submission */
const OPTIONAL = [
  // 'assets/icons/icon-192.png',
  // 'assets/icons/icon-512.png',
  // 'assets/guides/science/mathematics.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then(async (cache) => {
      await cache.addAll(CORE);
      await Promise.all(OPTIONAL.map((url) => cache.add(url).catch(() => null)));
      return self.skipWaiting();
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('scholasync-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  event.respondWith(respond(event, req));
});

async function respond(event, req) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(req, { ignoreSearch: true });
  
  const refresh = fetch(req)
    .then((res) => {
      if (res && res.ok && res.type === 'basic') cache.put(req, res.clone());
      return res;
    })
    .catch(() => null);

  if (cached) {
    event.waitUntil(refresh);
    return cached;
  }
  
  const res = await refresh;
  if (res) return res;

  if (req.mode === 'navigate') {
    const home = await cache.match('index.html');
    if (home) return home;
  }
  return new Response('Offline', { status: 503, statusText: 'Offline' });
}