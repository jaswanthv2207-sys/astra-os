/**
 * Astra OS service worker — an offline shell, nothing more.
 *
 * Strategy:
 *   • navigations   → network-first (fresh HTML when online, cached page
 *                     when offline — deploys never serve stale shells),
 *   • /_next/static → cache-first (content-hashed & immutable),
 *   • same-origin static assets (icons, manifest, images) → stale-while-
 *                     revalidate,
 *   • cross-origin (AI providers, api.github.com) → untouched, pass through.
 *
 * Bump CACHE when the precached shell list changes.
 */
const CACHE = "astra-shell-v1";
const SHELL = ["/", "/universes", "/universe", "/shortcuts", "/manifest.json"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(SHELL))
      .catch(() => undefined) // one 404 shouldn't block install
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // never touch APIs

  /* Navigations: network-first, cached page as the offline fallback. */
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(async () => {
          const cached =
            (await caches.match(request)) ||
            (await caches.match(new URL(request.url).pathname)) ||
            (await caches.match("/"));
          return cached ?? Response.error();
        }),
    );
    return;
  }

  /* Hashed build assets: cache-first. */
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ??
          fetch(request).then((response) => {
            if (response.ok) {
              const copy = response.clone();
              caches.open(CACHE).then((cache) => cache.put(request, copy));
            }
            return response;
          }),
      ),
    );
    return;
  }

  /* Same-origin static files: stale-while-revalidate. */
  if (
    url.pathname.startsWith("/icons/") ||
    url.pathname.startsWith("/images/") ||
    url.pathname === "/manifest.json" ||
    /\.(png|jpg|jpeg|webp|svg|ico|woff2?)$/.test(url.pathname)
  ) {
    event.respondWith(
      caches.open(CACHE).then(async (cache) => {
        const cached = await cache.match(request);
        const network = fetch(request)
          .then((response) => {
            if (response.ok) cache.put(request, response.clone());
            return response;
          })
          .catch(() => cached);
        return cached ?? network;
      }),
    );
  }
});
