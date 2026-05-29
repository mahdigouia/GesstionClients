import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { collection, doc, getDoc, getDocs, addDoc } from 'firebase/firestore';
import webpush from 'web-push';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { clientName, content, promiseAmount, user } = body;

    if (!clientName || !content) {
      return NextResponse.json({ error: 'Le nom du client et le contenu sont requis.' }, { status: 400 });
    }

    const userShort = user ? user.split('@')[0] : 'Un utilisateur';
    const amountStr = promiseAmount > 0 
      ? `${promiseAmount.toLocaleString('fr-TN', { minimumFractionDigits: 3 })} TND`
      : 'Solde total';

    const messageText = `${userShort} a marqué le client ${clientName} comme PAYÉ (${amountStr}).`;

    // 1. Send webhook notification immediately
    const webhookUrl = process.env.PAYMENT_WEBHOOK_URL;
    if (webhookUrl) {
      try {
        const summaryMessage = `💰 **${userShort}** a marqué **${clientName}** comme **PAYÉ** (Règlement de ${amountStr}).\n📝 *Remarque : ${content}*`;
        await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: summaryMessage,
            content: summaryMessage
          })
        });
      } catch (webhookErr) {
        console.error('[Web Push Notify] Webhook trigger failed:', webhookErr);
      }
    }

    // 2. Add in-app collaborative notification
    try {
      await addDoc(collection(db, 'notifications'), {
        type: 'payment',
        message: messageText,
        severity: 'low',
        createdAt: new Date().toISOString(),
        status: 'pending',
        metadata: { clientName }
      });
    } catch (dbErr) {
      console.error('[Web Push Notify] Failed to save in-app notification:', dbErr);
    }

    // 3. Load VAPID keys (Vercel env vars prioritized)
    let publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    let privateKey = process.env.VAPID_PRIVATE_KEY;
    const subject = process.env.VAPID_SUBJECT || 'mailto:moslem.gouia@gmail.com';

    if (!publicKey || !privateKey) {
      console.log('[Web Push Notify] VAPID Env vars missing. Falling back to Firestore.');
      const vapidDocRef = doc(db, 'config', 'vapid');
      const vapidDocSnap = await getDoc(vapidDocRef);
      
      if (vapidDocSnap.exists()) {
        const firestoreData = vapidDocSnap.data();
        publicKey = firestoreData.publicKey;
        privateKey = firestoreData.privateKey;
      }
    }

    if (!publicKey || !privateKey) {
      return NextResponse.json({ 
        success: true, 
        message: 'Paiement enregistré, mais les notifications push ne sont pas configurées.' 
      });
    }

    // 4. Broadcast push notifications to all subscribers
    try {
      webpush.setVapidDetails(subject, publicKey, privateKey);
    } catch (vapidErr: any) {
      console.error('[Web Push Notify] Failed to set VAPID details:', vapidErr);
      return NextResponse.json({ 
        error: `Configuration VAPID invalide: ${vapidErr.message}` 
      }, { status: 500 });
    }

    const subsSnapshot = await getDocs(collection(db, 'push_subscriptions'));
    
    if (!subsSnapshot.empty) {
      const pushPayload = JSON.stringify({
        title: 'Nouveau Paiement Recouvré ! 💰',
        body: messageText,
        icon: '/logo.png',
        badge: '/logo.png',
        url: '/clients'
      });

      const pushPromises = subsSnapshot.docs.map(subDoc => {
        const subData = subDoc.data();
        const subscription = subData.subscription;

        if (!subscription || !subscription.endpoint) {
          console.warn(`[Web Push Notify] Skipping invalid subscription in doc: ${subDoc.id}`);
          return Promise.resolve();
        }

        return webpush.sendNotification(subscription, pushPayload)
          .catch(async (err: any) => {
            console.error(`[Web Push Notify] Error sending push to ${subDoc.id}:`, err);
            
            // Prune invalid or expired subscription (404 or 410)
            if (err.statusCode === 404 || err.statusCode === 410) {
              console.log(`[Web Push Notify] Pruning expired subscription: ${subDoc.id}`);
              try {
                const { deleteDoc } = await import('firebase/firestore');
                await deleteDoc(doc(db, 'push_subscriptions', subDoc.id));
              } catch (pruneErr) {
                console.error(`[Web Push Notify] Failed to prune subscription:`, pruneErr);
              }
            }
          });
      });

      await Promise.all(pushPromises);
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Notification push et webhook diffusés en temps réel.' 
    });

  } catch (error: any) {
    console.error('[Web Push Notify] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
