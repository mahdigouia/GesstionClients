import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, updateDoc, doc, addDoc, getDoc, deleteDoc } from 'firebase/firestore';
import webpush from 'web-push';

export async function GET(request: Request) {
  // Verify Vercel Cron authorization header
  const authHeader = request.headers.get('authorization');
  if (process.env.NODE_ENV === 'production' && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  try {
    // 1. Fetch pending payment notifications from Firestore
    const q = query(
      collection(db, 'pending_payments'),
      where('status', '==', 'pending')
    );
    const snapshot = await getDocs(q);
    
    if (snapshot.empty) {
      return NextResponse.json({ message: 'Aucun paiement en attente de notification.' });
    }

    const notifications: any[] = [];
    const updatePromises: Promise<any>[] = [];

    snapshot.forEach((snapshotDoc) => {
      const data = snapshotDoc.data();
      notifications.push({ id: snapshotDoc.id, ...data });
      
      // Update status to 'sent'
      const docRef = doc(db, 'pending_payments', snapshotDoc.id);
      updatePromises.push(updateDoc(docRef, { status: 'sent', sentAt: new Date().toISOString() }));
    });

    // Wait for Firestore updates to finish
    await Promise.all(updatePromises);

    // 2. Format a brief summary message
    const messageLines = notifications.map(n => {
      const userShort = n.user.split('@')[0];
      const amountStr = n.promiseAmount > 0 
        ? `${n.promiseAmount.toLocaleString('fr-TN', { minimumFractionDigits: 3 })} TND`
        : 'Solde total';
      return `💰 **${userShort}** a marqué **${n.clientName}** comme **PAYÉ** (Règlement de ${amountStr}).`;
    });

    const summaryMessage = `🔔 **Notification de Recouvrement**\n\n${messageLines.join('\n')}`;

    // 3. Send Webhook API Notification
    const webhookUrl = process.env.PAYMENT_WEBHOOK_URL;
    if (webhookUrl) {
      try {
        const response = await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: summaryMessage,
            content: summaryMessage // Discord uses content, Slack uses text
          })
        });

        if (!response.ok) {
          console.error('[Web Push Cron] Webhook error:', await response.text());
        }
      } catch (webhookErr) {
        console.error('[Web Push Cron] Failed to send webhook:', webhookErr);
      }
    } else {
      console.warn('PAYMENT_WEBHOOK_URL non configuré.');
    }

    // 4. Create in-app collaborative notifications for all users in Firestore /notifications collection
    const appNotifPromises = notifications.map(n => {
      const userShort = n.user.split('@')[0];
      const amountStr = n.promiseAmount > 0 
        ? `${n.promiseAmount.toLocaleString('fr-TN', { minimumFractionDigits: 3 })} TND`
        : 'Solde total';
      
      return addDoc(collection(db, 'notifications'), {
        type: 'payment',
        message: `${userShort} a marqué le client ${n.clientName} comme PAYÉ (${amountStr}).`,
        severity: 'low',
        createdAt: new Date().toISOString(),
        status: 'pending', // Visible as notification in popover
        metadata: { clientName: n.clientName }
      });
    });
    
    await Promise.all(appNotifPromises);

    // 5. Broadcast Web Push notifications to all registered subscribers
    try {
      let publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      let privateKey = process.env.VAPID_PRIVATE_KEY;
      const subject = process.env.VAPID_SUBJECT || 'mailto:moslem.gouia@gmail.com';

      if (!publicKey || !privateKey) {
        console.log('[Web Push Cron] VAPID Env vars missing. Falling back to Firestore.');
        const vapidDocRef = doc(db, 'config', 'vapid');
        const vapidDocSnap = await getDoc(vapidDocRef);
        
        if (vapidDocSnap.exists()) {
          const firestoreData = vapidDocSnap.data();
          publicKey = firestoreData.publicKey;
          privateKey = firestoreData.privateKey;
        }
      }

      if (publicKey && privateKey) {
        webpush.setVapidDetails(
          subject,
          publicKey,
          privateKey
        );

        // Fetch all subscriptions
        const subsSnapshot = await getDocs(collection(db, 'push_subscriptions'));
        
        if (!subsSnapshot.empty) {
          const pushPromises: Promise<any>[] = [];
          
          subsSnapshot.forEach((subDoc) => {
            const subData = subDoc.data();
            const subscription = subData.subscription;
            
            // Send push notification for each payment event
            notifications.forEach(n => {
              const userShort = n.user.split('@')[0];
              const amountStr = n.promiseAmount > 0 
                ? `${n.promiseAmount.toLocaleString('fr-TN', { minimumFractionDigits: 3 })} TND`
                : 'Solde total';
                
              const pushPayload = JSON.stringify({
                title: 'Nouveau Paiement Recouvré ! 💰',
                body: `${userShort} a marqué le client ${n.clientName} comme PAYÉ (${amountStr}).`,
                icon: '/logo.png',
                badge: '/logo.png',
                url: '/clients'
              });

              const promise = webpush.sendNotification(subscription, pushPayload)
                .catch(async (err: any) => {
                  console.error(`[Web Push Cron] Error sending notification to subscription ${subDoc.id}:`, err);
                  
                  // Prune subscription if it has expired or is invalid (404 or 410)
                  if (err.statusCode === 404 || err.statusCode === 410) {
                    console.log(`[Web Push Cron] Pruning invalid/expired subscription: ${subDoc.id}`);
                    try {
                      await deleteDoc(doc(db, 'push_subscriptions', subDoc.id));
                    } catch (pruneErr) {
                      console.error(`[Web Push Cron] Error pruning subscription document ${subDoc.id}:`, pruneErr);
                    }
                  }
                });
              
              pushPromises.push(promise);
            });
          });
          
          await Promise.all(pushPromises);
        }
      } else {
        console.warn('[Web Push Cron] VAPID config is missing in Firestore. Cannot send Web Push.');
      }
    } catch (pushBlockErr) {
      console.error('[Web Push Cron] Error in Web Push broadcasting block:', pushBlockErr);
    }

    return NextResponse.json({ 
      message: 'Notifications envoyées avec succès.', 
      count: notifications.length 
    });

  } catch (error: any) {
    console.error('Cron job error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
