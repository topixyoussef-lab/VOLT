const CACHE = 'volt-v2';
const URLS = [
  '/',
  '/index.html',
  '/login.html',
  '/admin.html',
  '/css/styles.css',
  '/css/admin.css',
  '/js/main.js',
  '/js/admin.js',
  '/manifest.json',
  '/images/favicon.png',
  '/images/icon-192x192.png'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(URLS)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))));
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request).catch(() => caches.match(e.request))
    );
  } else {
    e.respondWith(
      caches.match(e.request).then(r => r || fetch(e.request))
    );
  }
});
