// Service Worker for Web Push Notifications

self.addEventListener('push', function(event) {
  console.log('[Service Worker] Push Event Received.');

  if (!event.data) {
    console.warn('[Service Worker] Push event contains no data.');
    return;
  }

  let data = {};
  try {
    data = event.data.json();
  } catch (err) {
    console.log('[Service Worker] Push data is not JSON, treating as text.');
    data = {
      title: 'Gestion Clients',
      body: event.data.text()
    };
  }

  const title = data.title || 'Notification';
  const options = {
    body: data.body || '',
    icon: data.icon || '/logo.png',
    badge: data.badge || '/logo.png',
    vibrate: data.vibrate || [100, 50, 100],
    data: {
      url: data.url || '/'
    },
    actions: data.actions || []
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

self.addEventListener('notificationclick', function(event) {
  console.log('[Service Worker] Notification clicked.');
  event.notification.close();

  const targetUrl = event.notification.data?.url || '/';

  // Wait until the window is opened/focused
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(function(windowClients) {
        // Check if there is already a window open with the same URL and focus it
        for (let i = 0; i < windowClients.length; i++) {
          const client = windowClients[i];
          if (client.url === targetUrl && 'focus' in client) {
            return client.focus();
          }
        }
        // If not, open a new window
        if (clients.openWindow) {
          return clients.openWindow(targetUrl);
        }
      })
  );
});
