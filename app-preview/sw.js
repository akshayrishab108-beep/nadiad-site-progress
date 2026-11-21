// Nadiad Site Progress service worker.
// Network-first for page navigations (fresh index.html when online, cached
// copy offline); cache-first for same-origin static assets (Vite hashes make
// them immutable). Cross-origin requests (Supabase API/auth) pass through.
const CACHE = 'spt-v1';
const PRECACHE = ['./', './index.html', './manifest.webmanifest'];

self.addEventListener('install', (e) => {
    e.waitUntil(caches.open(CACHE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
    e.waitUntil(
        caches.keys()
            .then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
            .then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (e) => {
    const u = new URL(e.request.url);
    if (e.request.method !== 'GET' || u.origin !== location.origin) return;
    if (e.request.mode === 'navigate') {
        e.respondWith(
            fetch(e.request)
                .then((r) => {
                    const cp = r.clone();
                    caches.open(CACHE).then((c) => c.put('./index.html', cp));
                    return r;
                })
                .catch(() => caches.match('./index.html').then((m) => m || caches.match('./')))
        );
        return;
    }
    e.respondWith(
        caches.match(e.request).then((m) => m || fetch(e.request).then((r) => {
            if (r.ok) {
                const cp = r.clone();
                caches.open(CACHE).then((c) => c.put(e.request, cp));
            }
            return r;
        }))
    );
});
