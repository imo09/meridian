/* Meridian - service worker generato da tools/build.py: cache dell'app per l'uso offline */
const VERSION = 'meridian-025f16108f';
const ASSETS = [
  'index.html',
  'css/app.css',
  'fonts/BarlowCondensed-500-latin-ext.woff2',
  'fonts/BarlowCondensed-500-latin.woff2',
  'fonts/BarlowCondensed-600-latin-ext.woff2',
  'fonts/BarlowCondensed-600-latin.woff2',
  'fonts/BarlowCondensed-700-latin-ext.woff2',
  'fonts/BarlowCondensed-700-latin.woff2',
  'fonts/IBMPlexMono-400-latin-ext.woff2',
  'fonts/IBMPlexMono-400-latin.woff2',
  'fonts/IBMPlexMono-500-latin-ext.woff2',
  'fonts/IBMPlexMono-500-latin.woff2',
  'fonts/IBMPlexMono-600-latin-ext.woff2',
  'fonts/IBMPlexMono-600-latin.woff2',
  'fonts/SourceSans3-400-latin-ext.woff2',
  'fonts/SourceSans3-400-latin.woff2',
  'fonts/SourceSans3-400i-latin-ext.woff2',
  'fonts/SourceSans3-400i-latin.woff2',
  'fonts/fonts.css',
  'guida/index.html',
  'img/apple-touch-icon.png',
  'img/favicon-32.png',
  'img/favicon.svg',
  'img/icon-192.png',
  'img/icon-512.png',
  'img/icon-maskable-512.png',
  'img/logo.svg',
  'img/maskable.svg',
  'js/app.js',
  'js/calendar.js',
  'js/costs.js',
  'js/cpm.js',
  'js/demo.js',
  'js/exchange.js',
  'js/info.js',
  'js/store.js',
  'js/ui.js',
  'js/util.js',
  'js/views/admin.js',
  'js/views/attivita.js',
  'js/views/avanzamento.js',
  'js/views/common.js',
  'js/views/controllo.js',
  'js/views/costi.js',
  'js/views/detail.js',
  'js/views/mobile.js',
  'js/views/portafoglio.js',
  'js/views/reticolo.js',
  'js/views/risorse.js',
  'js/views/scambio.js',
  'js/views/schedula.js',
  'js/views/struttura.js',
  'js/zip.js',
  'manifest.webmanifest'
];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(VERSION).then((c) => c.addAll(ASSETS.map((a) => './' + a))).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return;
  if (e.request.mode === 'navigate') {
    e.respondWith(fetch(e.request).then((r) => { const c = r.clone(); caches.open(VERSION).then((x) => x.put(e.request, c)); return r; }).catch(() => caches.match(e.request).then((r) => r || caches.match('./index.html'))));
    return;
  }
  e.respondWith(caches.match(e.request).then((r) => r || fetch(e.request).then((resp) => { if (resp.ok) { const c = resp.clone(); caches.open(VERSION).then((x) => x.put(e.request, c)); } return resp; })));
});
