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
    // badge : icône monochrome MDS Group affichée dans la barre de statut Android (à côté batterie)
    badge: '/badge-96x96.png',
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
  console.log('[SW] Click notif | action:', event.action, '| data:', event.notification.data);
  event.notification.close();

  // Clic sur "Fermer" → rien
  if (event.action === 'close') return;

  var notifData = event.notification.data || {};
  var relativePath = notifData.url || '/clients';
  // URL absolue (requis pour clients.openWindow sur Android)
  var absoluteUrl = self.location.origin + relativePath;

  console.log('[SW] URL cible:', absoluteUrl);

  var promiseChain = clients.matchAll({ type: 'window', includeUncontrolled: true })
    .then(function(windowClients) {
      console.log('[SW] Fenetres ouvertes:', windowClients.length);

      // Trouver une fenetre de notre domaine
      var appWindow = null;
      for (var i = 0; i < windowClients.length; i++) {
        var c = windowClients[i];
        if (c.url && c.url.indexOf(self.location.origin) === 0) {
          appWindow = c;
          break;
        }
      }

      if (appWindow) {
        // ✅ App deja ouverte en arriere-plan :
        // Envoyer un message postMessage pour naviguer via Next.js router
        // (beaucoup plus fiable que client.navigate() sur Android)
        console.log('[SW] App trouvee → postMessage SW_NAVIGATE + focus');
        appWindow.postMessage({
          type: 'SW_NAVIGATE',
          url: relativePath
        });
        return appWindow.focus();
      }

      // ✅ App fermee : ouvrir directement sur la page du client
      console.log('[SW] App fermee → openWindow', absoluteUrl);
      return clients.openWindow(absoluteUrl);
    })
    .catch(function(err) {
      console.error('[SW] Erreur click notif:', err);
      // Fallback absolu : ouvrir l'app sur /clients sans parametres
      return clients.openWindow(self.location.origin + '/clients');
    });

  event.waitUntil(promiseChain);
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
