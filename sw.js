/* Offline shell: the app files are cached; product lookups always go to the network. */
const CACHE = 'kakvo-v0.1.1';
const SHELL = ['./', 'index.html', 'css/app.css', 'js/config.js', 'js/engine.js', 'js/app.js', 'data/library.json', 'manifest.webmanifest', 'icons/icon-192.png', 'vendor/zxing-browser.min.js'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  e.respondWith(caches.match(e.request).then(hit => hit || fetch(e.request).then(res => {
    if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); }
    return res;
  }).catch(() => caches.match('index.html'))));
});
