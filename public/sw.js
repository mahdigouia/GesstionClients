// =========================================================
// Service Worker - Gestion Clients - Web Push Notifications
// Version 2.0 - Vraies notifications background
// =========================================================

// Force l'activation immédiate du nouveau SW sans attendre la fermeture des onglets
self.addEventListener('install', function(event) {
  console.log('[SW] Install event - skipWaiting activé');
  event.waitUntil(self.skipWaiting());
});

// Prend le contrôle immédiat de tous les onglets ouverts
self.addEventListener('activate', function(event) {
  console.log('[SW] Activate event - clients.claim() activé');
  event.waitUntil(self.clients.claim());
});

// ============================================
// Gestionnaire d'événement PUSH (cœur du système)
// ============================================
self.addEventListener('push', function(event) {
  console.log('[SW] Push Event Received!', event);

  if (!event.data) {
    console.warn('[SW] Push event sans données - notification générique affichée');
    event.waitUntil(
      self.registration.showNotification('Gestion Clients', {
        body: 'Vous avez une nouvelle notification.',
        icon: '/icon-192x192.png',
        badge: '/icon-192x192.png',
      })
    );
    return;
  }

  let data = {};
  try {
    data = event.data.json();
  } catch (err) {
    console.warn('[SW] Push data non-JSON, traité comme texte.');
    data = {
      title: 'Gestion Clients',
      body: event.data.text(),
      type: 'generic'
    };
  }

  const notifType = data.type || 'generic';
  const title = data.title || 'Gestion Clients';

  // Options de base de la notification
  const options = {
    body: data.body || '',
    icon: data.icon || '/icon-192x192.png',
    badge: data.badge || '/icon-192x192.png',
    vibrate: data.vibrate || [200, 100, 200, 100, 200],
    // requireInteraction: la notification reste visible jusqu'à ce que l'utilisateur interagisse
    requireInteraction: true,
    // tag: évite les notifications en double pour le même événement
    tag: data.tag || `gc-${notifType}-${Date.now()}`,
    // renotify: force la vibration même si le tag est le même
    renotify: false,
    // Données passées au gestionnaire de clic
    data: {
      url: data.url || '/',
      type: notifType,
      clientName: data.clientName || ''
    },
    // Actions rapides selon le type
    actions: notifType === 'conflit'
      ? [
          { action: 'view', title: '⚠️ Voir le client', icon: '/icon-192x192.png' },
          { action: 'close', title: 'Fermer' }
        ]
      : notifType === 'payment'
      ? [
          { action: 'view', title: '💰 Voir les clients', icon: '/icon-192x192.png' },
          { action: 'close', title: 'Fermer' }
        ]
      : (data.actions || []),
    // Timestamp de la notification
    timestamp: data.timestamp || Date.now()
  };

  console.log('[SW] Affichage notification:', title, options);

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// ============================================
// Gestionnaire de clic sur la notification
// ============================================
self.addEventListener('notificationclick', function(event) {
  console.log('[SW] Notification clicked. Action:', event.action, 'Data:', event.notification.data);
  event.notification.close();

  // Si l'utilisateur clique sur "Fermer", on ne fait rien
  if (event.action === 'close') {
    return;
  }

  // URL cible : toujours utiliser l'origin pour former une URL absolue valide
  const notifData = event.notification.data || {};
  const relativePath = notifData.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(function(windowClients) {
        // Chercher si un onglet de l'app est déjà ouvert
        for (let i = 0; i < windowClients.length; i++) {
          const client = windowClients[i];
          // Comparer uniquement l'origin pour retrouver n'importe quel onglet de l'app
          const clientUrl = new URL(client.url);
          const swUrl = new URL(self.location.origin);
          if (clientUrl.origin === swUrl.origin && 'focus' in client) {
            // Naviguer vers la page cible et donner le focus
            client.navigate(relativePath);
            return client.focus();
          }
        }
        // Aucun onglet ouvert → ouvrir un nouveau
        if (clients.openWindow) {
          return clients.openWindow(relativePath);
        }
      })
  );
});

// ============================================
// Gestionnaire de fermeture de notification
// ============================================
self.addEventListener('notificationclose', function(event) {
  console.log('[SW] Notification fermée:', event.notification.tag);
});

// ============================================
// Fetch handler minimal (requis pour certains navigateurs)
// pour que le SW soit reconnu comme service worker actif
// ============================================
self.addEventListener('fetch', function(event) {
  // Laisser passer toutes les requêtes sans interception
  // (on ne fait pas de cache ici, uniquement push notifications)
  return;
});
