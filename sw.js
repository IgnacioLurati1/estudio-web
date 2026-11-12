// Service worker del panel: notificaciones push y nada de caché (los datos siempre son en vivo).
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

// La dirección que abre una notificación: solo del panel (dentro del alcance del service worker). Una
// dirección de otro sitio, aunque sea del mismo github.io, abre el panel.
const direccionPropia = (url, base) => {
  try {
    const u = new URL(String(url || '/admin').replace(/^\//, ''), base);
    if (u.href.startsWith(base)) return u.href;
  } catch {
    // una dirección rota también abre el panel
  }
  return new URL('admin', base).href;
};

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: 'Panel de control', body: event.data?.text() ?? '' };
  }
  const base = self.registration.scope;
  event.waitUntil(
    self.registration.showNotification(data.title || 'Panel de control', {
      body: data.body || '',
      tag: data.tag || 'panel',
      renotify: true,
      icon: `${base}panel-192.png`,
      badge: `${base}panel-192.png`,
      data: { url: direccionPropia(data.url, base) },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || self.registration.scope;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if ('focus' in c) {
          c.navigate(url);
          return c.focus();
        }
      }
      return self.clients.openWindow(url);
    }),
  );
});
