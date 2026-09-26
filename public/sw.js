/// <reference lib="webworker" />
const CACHE = "simplechat-v2";
// O lint tipa este arquivo como página; em runtime `self` é o escopo do worker.
// oxlint-disable-next-line typescript/no-unsafe-type-assertion
const sw = /** @type {ServiceWorkerGlobalScope} */ (/** @type {unknown} */ (self));

self.addEventListener("install", (/** @type {ExtendableEvent} */ event) => {
  event.waitUntil(sw.skipWaiting());
});

self.addEventListener("activate", (/** @type {ExtendableEvent} */ event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (/** @type {FetchEvent} */ event) => {
  const request = event.request;
  if (request.method !== "GET") {
    return;
  }

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) {
    return;
  }
  if (url.pathname.startsWith("/_vercel/")) {
    return;
  }

  // Assets com hash mudam a cada deploy: network-only evita acumular
  // entradas velhas dentro do mesmo nome de cache.
  const hashedAsset = /^\/assets\/[^/]+\.[^/]+$/.test(url.pathname);
  if (hashedAsset) {
    event.respondWith(fetch(request));
    return;
  }

  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) {
          const copy = response.clone();
          event.waitUntil(
            caches.open(CACHE).then((cache) => cache.put(request, copy)),
          );
        }
        return response;
      })
      .catch(async () => {
        const cached = await caches.match(request);
        if (cached) {
          return cached;
        }
        if (request.mode === "navigate") {
          const fallback = await caches.match("/");
          if (fallback) {
            return fallback;
          }
        }
        return Response.error();
      }),
  );
});
