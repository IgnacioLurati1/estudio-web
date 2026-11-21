// El Santo Resumen without internet. Only the subjects a student saved («Guardar para leer sin internet») are kept, each
// in its own cache (utn-mat-<subject>-<version>). With a connection everything comes from the network as always and what
// was saved is refreshed on the way; without one, or with one that does not answer, it comes from what was saved.
// Nothing else is cached, and nothing outside /utn/ or from another origin goes through here.
const PREFIJO = 'utn-mat-';
const ESPERA = 4000;

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

const guardadas = async () => (await caches.keys()).filter((k) => k.startsWith(PREFIJO));
// A folder is its index.html, as the server answers it.
const sinBusqueda = (u) => `${u.origin}${u.pathname.endsWith('/') ? `${u.pathname}index.html` : u.pathname}`;
const buscar = async (u) => {
  const clave = sinBusqueda(u);
  for (const k of await guardadas()) {
    const r = await (await caches.open(k)).match(clave);
    if (r) return { r, clave };
  }
  return null;
};
const refrescar = async (clave, res) => {
  for (const k of await guardadas()) {
    const c = await caches.open(k);
    if (await c.match(clave)) await c.put(clave, res.clone());
  }
};
const conPlazo = (req) => {
  const corte = new AbortController();
  const t = setTimeout(() => corte.abort(), ESPERA);
  return fetch(req, { signal: corte.signal }).finally(() => clearTimeout(t));
};
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
// A page that was not saved, with no connection: says so plainly, with no script.
const sinGuardar = (scope) =>
  new Response(
    `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex"><title>Sin internet: El Santo Resumen</title>
<style>body{margin:0;font:400 1.05rem/1.6 Georgia,serif;color:#1d2438;background:#f8fafd}main{max-width:36rem;margin:0 auto;padding:3rem 1.2rem}h1{font:800 2rem/1.1 'Segoe UI',system-ui,sans-serif;color:#1f3a9e}a{color:#1f3a9e}@media (prefers-color-scheme:dark){body{color:#fff;background:#06122b}h1,a{color:#fff}}</style></head>
<body><main><h1>Sin internet</h1><p>Esta página no está guardada en este dispositivo. Sin internet se leen solo las materias que guardaste.</p><p><a href="${esc(scope)}materias.html">Ir a Todas las materias</a></p></main></body></html>`,
    { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } },
  );

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const u = new URL(req.url);
  const scope = new URL(self.registration.scope);
  if (u.origin !== scope.origin || !u.pathname.startsWith(scope.pathname)) return;
  e.respondWith(
    (async () => {
      const hay = await buscar(u);
      if (!hay) {
        try {
          return await fetch(req);
        } catch (err) {
          if (req.mode === 'navigate') return sinGuardar(scope.pathname);
          throw err;
        }
      }
      try {
        const res = await conPlazo(req);
        if (res.ok && res.type === 'basic') e.waitUntil(refrescar(hay.clave, res.clone()));
        return res;
      } catch {
        return hay.r;
      }
    })(),
  );
});
