// Receives phone alerts for Afra Super Admin. Shows the short title only.
self.addEventListener('push', (event) => {
  let d = {}; try { d = event.data ? event.data.json() : {}; } catch (e) { d = {}; }
  event.waitUntil(self.registration.showNotification(String(d.title || 'Afra').slice(0, 80), { body: String(d.body || '').slice(0, 140), icon: undefined, tag: 'afra-decision', data: { url: '/' } }));
});
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(self.clients.matchAll({ type: 'window' }).then((list) => (list.length ? list[0].focus() : self.clients.openWindow('/'))));
});
