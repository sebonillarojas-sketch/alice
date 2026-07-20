// Service worker mínimo del cuerpo. Existe sobre todo para que Android considere
// la página instalable, pero también hace que el shell abra sin red.
//
// REGLA: nunca tocar /api. Cachear un turno de voz sería servirle a Alicia una
// respuesta vieja como si fuera nueva — peor que un error.
const CACHE = "alicia-body-v1";
const SHELL = ["/body.html", "/alicia-192.png", "/alicia-512.png", "/alicia.webmanifest"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);
  // Todo lo dinámico va directo a la red, sin caché ni fallback.
  if (url.pathname.startsWith("/api/") || e.request.method !== "GET") return;
  // El shell: red primero (para tomar cambios al toque), caché si no hay red.
  e.respondWith(
    fetch(e.request)
      .then(r => {
        const copy = r.clone();
        caches.open(CACHE).then(c => c.put(e.request, copy)).catch(() => {});
        return r;
      })
      .catch(() => caches.match(e.request))
  );
});
