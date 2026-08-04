const CACHE_NAME = 'paytracker-v5';
const ASSETS = [
  './',
  './index.html',
  './login.html',
  './logout.html',
  './auth.js',
  './app.js',
  './manifest.json',
  './database/supabase_setup.sql',
  './src/config/database.js',
  './src/services/auth.service.js',
  './src/services/transaction.service.js',
  './src/services/ipo.service.js',
  './src/services/budget.service.js',
  './src/services/audit.service.js'
];

self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  e.respondWith(
    fetch(e.request).catch(() => caches.match(e.request))
  );
});
