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
  console.log('[SW] Notification cliquée. Action:', event.action, '| Data:', event.notification.data);
  event.notification.close();

  // Clic sur "Fermer" → rien
  if (event.action === 'close') return;

  const notifData = event.notification.data || {};
  const relativePath = notifData.url || '/clients';

  // URL absolue obligatoire pour clients.openWindow() et navigate()
  // self.location.origin = ex: https://gesstion-clients.vercel.app
  const absoluteUrl = self.location.origin + relativePath;
  console.log('[SW] Redirection vers:', absoluteUrl);

  event.waitUntil(
    (async () => {
      try {
        const windowClients = await clients.matchAll({
          type: 'window',
          includeUncontrolled: true
        });

        // Chercher un onglet/fenêtre déjà ouvert sur notre domaine
        const appClient = windowClients.find(c => {
          try {
            return new URL(c.url).origin === self.location.origin;
          } catch (e) {
            return false;
          }
        });

        if (appClient) {
          // ✅ Onglet existant : on le navigue puis on le met au premier plan
          console.log('[SW] Onglet existant trouvé → navigate + focus');
          try {
            // navigate() retourne un WindowClient, on le focus ensuite
            const navigated = await appClient.navigate(absoluteUrl);
            if (navigated) {
              await navigated.focus();
            } else {
              await appClient.focus();
            }
          } catch (navErr) {
            // Si navigate échoue (certains Android), on focus uniquement
            console.warn('[SW] navigate() échoué, tentative focus:', navErr);
            try { await appClient.focus(); } catch (e) {}
          }
        } else {
          // ✅ App fermée ou en arrière-plan : ouvrir un nouveau onglet
          console.log('[SW] Aucun onglet trouvé → openWindow');
          await clients.openWindow(absoluteUrl);
        }
      } catch (err) {
        // Fallback ultime si tout échoue
        console.error('[SW] Erreur ouverture app:', err);
        try {
          await clients.openWindow(self.location.origin + '/clients');
        } catch (e2) {}
      }
    })()
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
