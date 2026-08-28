// Service worker do Argos Approval — só cuida de push notification.
// Não faz cache de assets de propósito (evita servir versão velha do app).

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', () => {
  // passthrough — não intercepta nem cacheia, só existe pra ajudar o Chrome a considerar o app instalável.
});

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (err) {
    data = { title: 'Argos', body: event.data ? event.data.text() : 'Nova notificação' };
  }

  const title = data.title || 'Argos';
  const options = {
    body: data.body || '',
    icon: 'https://wzgdpfjsyxlxiapbuknp.supabase.co/storage/v1/object/public/avatars/system/favicon/a66ab9e2-e1b5-47cc-88d0-5d75c637ca50.png',
    badge: 'https://wzgdpfjsyxlxiapbuknp.supabase.co/storage/v1/object/public/avatars/system/favicon/a66ab9e2-e1b5-47cc-88d0-5d75c637ca50.png',
    tag: data.taskId ? `argos-task-${data.taskId}` : undefined,
    data: { url: data.url || '/' },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(targetUrl);
    })
  );
});
