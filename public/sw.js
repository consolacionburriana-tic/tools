// Service worker mínimo de Tools Consolación. Hecho a mano a propósito (las librerías
// PWA van justas con el App Router), y con una regla que NO se negocia:
//
//   NUNCA se cachea HTML de páginas ni respuestas de /api.
//
// Los iPads del claustro son compartidos: dejar en caché una pantalla con datos de
// alumnado sería servirle a la siguiente persona información que no le toca. Aquí solo
// se guardan cosas públicas y sin datos: los estáticos con hash de Next, los iconos y la
// página de cortesía `/offline.html` (HTML plano con estilos en línea, para que no dependa
// del CSS con hash de Next: si no estuviera en caché, saldría sin estilos).
//
// Lo que aporta: si abres la app instalada sin conexión, en vez de la pantalla blanca de
// Safari sale una página del colegio explicando qué pasa. Nada de offline real.

const VERSION = 'v1';
const CACHE = `tools-${VERSION}`;
const OFFLINE = '/offline.html';

// Lo mínimo para que la página de sin conexión se vea decente sin red.
const PRECACHE = [OFFLINE, '/logobur.png', '/icons/icon-192.png', '/manifest.json'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      // `reload` para no precachear una versión ya rancia del navegador.
      await cache.addAll(PRECACHE.map((url) => new Request(url, { cache: 'reload' })));
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // Fuera las cachés de versiones anteriores: un deploy no debe dejar la app zombie.
      const nombres = await caches.keys();
      await Promise.all(nombres.filter((n) => n.startsWith('tools-') && n !== CACHE).map((n) => caches.delete(n)));
      await self.clients.claim();
    })(),
  );
});

// Permite que la app fuerce la actualización del worker sin cerrarla.
self.addEventListener('message', (event) => {
  if (event.data === 'saltar-espera') self.skipWaiting();
});

/** ¿Es un estático inmutable que se puede guardar sin riesgo? */
function esEstatico(url) {
  return (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/icons/') ||
    url.pathname === '/logobur.png' ||
    url.pathname === '/manifest.json' ||
    /\.(?:woff2?|ttf|otf|png|jpg|jpeg|svg|webp|ico)$/.test(url.pathname)
  );
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) return; // jamás

  // Navegación: red primero y, si no hay red, la página de cortesía.
  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          return await fetch(request);
        } catch {
          const cache = await caches.open(CACHE);
          return (await cache.match(OFFLINE)) ?? new Response('Sin conexión', { status: 503 });
        }
      })(),
    );
    return;
  }

  // Estáticos: caché primero y refresco en segundo plano.
  if (esEstatico(url)) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE);
        const guardado = await cache.match(request);
        const red = fetch(request)
          .then((res) => {
            if (res.ok) cache.put(request, res.clone());
            return res;
          })
          .catch(() => null);
        return guardado ?? (await red) ?? new Response('', { status: 504 });
      })(),
    );
  }
});
