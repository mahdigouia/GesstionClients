import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { collection, doc, getDoc, getDocs, addDoc } from 'firebase/firestore';
import webpush from 'web-push';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { clientName, content, promiseAmount, user, type = 'payment' } = body;

    if (!clientName || !content) {
      return NextResponse.json({ error: 'Le nom du client et le contenu sont requis.' }, { status: 400 });
    }

    const userShort = user ? user.split('@')[0] : 'Un utilisateur';

    // Construire le message et le payload de la notification selon le type
    let pushTitle: string;
    let pushBody: string;
    let pushUrl: string;
    let webhookMessage: string;

    if (type === 'conflit') {
      pushTitle = '⚠️ ALERTE CONFLIT CLIENT !';
      pushBody = `${userShort} a signalé un CONFLIT avec le client ${clientName}. Action requise immédiatement !`;
      pushUrl = `/clients?search=${encodeURIComponent(clientName)}&open=remark`;
      webhookMessage = `⚠️ **CONFLIT** : **${userShort}** a signalé un conflit avec le client **${clientName}**.\n📝 *Détails : ${content}*`;
    } else {
      // type === 'payment'
      const amountStr = promiseAmount && promiseAmount > 0
        ? `${Number(promiseAmount).toLocaleString('fr-TN', { minimumFractionDigits: 3 })} TND`
        : 'Solde total';
      
      const invoiceMatch = content.match(/facture\s+([A-Z0-9_\-\/]+)/i);
      const invoiceDetails = invoiceMatch ? ` (Facture n° ${invoiceMatch[1]})` : '';

      pushTitle = '💰 Nouveau Paiement Recouvré !';
      pushBody = `${userShort} a marqué le client ${clientName} comme PAYÉ${invoiceDetails} (${amountStr}).`;
      pushUrl = `/clients?search=${encodeURIComponent(clientName)}&open=remark`;
      webhookMessage = `💰 **${userShort}** a marqué **${clientName}** comme **PAYÉ**${invoiceDetails} (Règlement de ${amountStr}).\n📝 *Remarque : ${content}*`;
    }

    // 1. Envoyer le webhook (Discord/Slack) si configuré
    const webhookUrl = process.env.PAYMENT_WEBHOOK_URL;
    if (webhookUrl) {
      try {
        await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: webhookMessage, content: webhookMessage })
        });
      } catch (webhookErr) {
        console.error('[Web Push Notify] Webhook trigger failed:', webhookErr);
      }
    }

    // 2. Charger les clés VAPID (variables d'environnement en priorité)
    let publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    let privateKey = process.env.VAPID_PRIVATE_KEY;
    const subject = process.env.VAPID_SUBJECT || 'mailto:moslem.gouia@gmail.com';

    if (!publicKey || !privateKey) {
      console.log('[Web Push Notify] VAPID Env vars missing. Falling back to Firestore.');
      try {
        const vapidDocRef = doc(db, 'config', 'vapid');
        const vapidDocSnap = await getDoc(vapidDocRef);
        if (vapidDocSnap.exists()) {
          const firestoreData = vapidDocSnap.data();
          publicKey = firestoreData.publicKey;
          privateKey = firestoreData.privateKey;
        }
      } catch (vapidDbErr) {
        console.error('[Web Push Notify] Failed to fetch VAPID keys from Firestore:', vapidDbErr);
      }
    }

    if (!publicKey || !privateKey) {
      console.warn('[Web Push Notify] No VAPID keys available. Push not sent.');
      return NextResponse.json({
        success: true,
        message: 'Événement enregistré, mais les notifications push ne sont pas configurées.'
      });
    }

    // 3. Configurer web-push avec les clés VAPID
    try {
      webpush.setVapidDetails(subject, publicKey, privateKey);
    } catch (vapidErr: any) {
      console.error('[Web Push Notify] Failed to set VAPID details:', vapidErr);
      return NextResponse.json({
        error: `Configuration VAPID invalide: ${vapidErr.message}`
      }, { status: 500 });
    }

    // 4. Récupérer les abonnements
    // Priorité : abonnements passés dans le body (côté client authentifié)
    // Fallback : tenter de lire Firestore (peut échouer si non authentifié côté serveur)
    let subscriptions = body.subscriptions;

    if (!subscriptions || subscriptions.length === 0) {
      console.log('[Web Push Notify] No subscriptions in body. Attempting Firestore fallback.');
      try {
        const subsSnapshot = await getDocs(collection(db, 'push_subscriptions'));
        if (!subsSnapshot.empty) {
          subscriptions = subsSnapshot.docs.map(subDoc => ({
            id: subDoc.id,
            subscription: subDoc.data().subscription
          }));
        }
      } catch (dbErr) {
        console.warn('[Web Push Notify] Firestore subscriptions read failed (permissions):', dbErr);
        subscriptions = [];
      }
    }

    if (!subscriptions || subscriptions.length === 0) {
      console.log('[Web Push Notify] No subscriptions found. Push not sent.');
      return NextResponse.json({ success: true, message: 'Aucun abonnement push enregistré.' });
    }

    // 5. Construire le payload push avec le type pour le service worker
    const pushPayload = JSON.stringify({
      title: pushTitle,
      body: pushBody,
      icon: '/icon-192x192.png',
      // Badge monochrome MDS Group (affiché dans la barre de statut Android)
      badge: '/badge-96x96.png',
      url: pushUrl,
      type,
      clientName,
      vibrate: type === 'conflit' ? [300, 100, 300, 100, 300, 100, 300] : [200, 100, 200],
      tag: `gc-${type}-${clientName}-${Date.now()}`,
      timestamp: Date.now()
    });

    console.log(`[Web Push Notify] Envoi de ${subscriptions.length} notification(s) de type "${type}" pour le client "${clientName}"`);

    // 6. Envoyer les notifications à tous les abonnés
    const pushPromises = subscriptions.map((subItem: any) => {
      const subscription = subItem.subscription;
      const subId = subItem.id;

      if (!subscription || !subscription.endpoint) {
        console.warn(`[Web Push Notify] Abonnement invalide ignoré:`, subItem);
        return Promise.resolve();
      }

      return webpush.sendNotification(subscription, pushPayload)
        .then(() => {
          console.log(`[Web Push Notify] ✅ Push envoyé à ${subId || 'inconnu'}`);
        })
        .catch(async (err: any) => {
          console.error(`[Web Push Notify] ❌ Échec envoi push à ${subId || 'inconnu'}:`, err.statusCode, err.message);

          // Supprimer l'abonnement expiré ou invalide (404 ou 410)
          if (subId && (err.statusCode === 404 || err.statusCode === 410)) {
            console.log(`[Web Push Notify] Suppression abonnement expiré: ${subId}`);
            try {
              const { deleteDoc } = await import('firebase/firestore');
              await deleteDoc(doc(db, 'push_subscriptions', subId));
            } catch (pruneErr) {
              console.error(`[Web Push Notify] Échec suppression abonnement:`, pruneErr);
            }
          }
        });
    });

    await Promise.all(pushPromises);

    return NextResponse.json({
      success: true,
      message: `Notification push "${type}" diffusée à ${subscriptions.length} abonné(s).`
    });

  } catch (error: any) {
    console.error('[Web Push Notify] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
