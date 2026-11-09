const root = self.registration.scope;
const cachePrefix = `ems-dispatch-app:${root}:`;
const cacheName = `${cachePrefix}v5`;
const home = new URL('index.html', root).href;
const assets = [
    'board.css?v=5', 'board.js?v=5', 'dispatch.svg', 'manifest.webmanifest', 'dispatch-192.png', 'dispatch-512.png'
].map(path => new URL(path, root).href);

self.addEventListener('install', event => {
    event.waitUntil((async () => {
        const cache = await caches.open(cacheName);
        await cache.addAll([home, ...assets].map(url => new Request(url, { cache: 'reload', redirect: 'error' })));
    })());
});

self.addEventListener('activate', event => {
    event.waitUntil((async () => {
        const keys = await caches.keys();
        await Promise.all(keys.filter(key => key.startsWith(cachePrefix) && key !== cacheName).map(key => caches.delete(key)));
        await self.clients.claim();
    })());
});

self.addEventListener('fetch', event => {
    const request = event.request;
    if (request.method !== 'GET') return;
    if (request.mode === 'navigate' && [root, home].includes(request.url)) {
        event.respondWith(fetch(request).catch(async () => {
            const cache = await caches.open(cacheName);
            return await cache.match(home) || Response.error();
        }));
    } else if (assets.includes(request.url)) {
        event.respondWith((async () => {
            const cache = await caches.open(cacheName);
            return await cache.match(request) || fetch(request);
        })());
    }
});
