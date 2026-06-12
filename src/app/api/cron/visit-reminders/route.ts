import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { collection, query, getDocs, updateDoc, doc, addDoc, getDoc, setDoc, deleteDoc } from 'firebase/firestore';
import webpush from 'web-push';

export async function GET(request: Request) {
  // Verify Vercel Cron authorization header
  const authHeader = request.headers.get('authorization');
  if (process.env.NODE_ENV === 'production' && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  try {
    // 1. Calculate tomorrow's date string in Africa/Tunis timezone (YYYY-MM-DD)
    const now = new Date();
    const tzString = now.toLocaleString('en-US', { timeZone: 'Africa/Tunis' });
    const tunisDate = new Date(tzString);
    tunisDate.setDate(tunisDate.getDate() + 1);

    const year = tunisDate.getFullYear();
    const month = String(tunisDate.getMonth() + 1).padStart(2, '0');
    const day = String(tunisDate.getDate()).padStart(2, '0');
    const tomorrowStr = `${year}-${month}-${day}`;

    console.log(`[Visit Reminders Cron] Scanning for visits scheduled on: ${tomorrowStr}`);

    // 2. Fetch client remarks from shared_data/current_debts
    const sharedDocRef = doc(db, 'shared_data', 'current_debts');
    const sharedDocSnap = await getDoc(sharedDocRef);
    
    if (!sharedDocSnap.exists()) {
      return NextResponse.json({ message: 'Aucune donnée partagée trouvée dans Firestore.' });
    }

    const sharedData = sharedDocSnap.data();
    const clientRemarks: Record<string, any[]> = sharedData.clientRemarks || {};

    // 3. Scan all remarks for postponed visits tomorrow
    const pendingReminders: any[] = [];
    
    for (const [clientName, remarks] of Object.entries(clientRemarks)) {
      for (const remark of remarks) {
        // We look for remarks where:
        // - promiseDate is tomorrow
        // - content contains 'reporté' (case-insensitive) or status was 'reporte'
        if (
          remark.promiseDate === tomorrowStr &&
          remark.content &&
          remark.content.toLowerCase().includes('reporté')
        ) {
          pendingReminders.push(remark);
        }
      }
    }

    if (pendingReminders.length === 0) {
      return NextResponse.json({ message: `Aucun rappel de visite pour demain (${tomorrowStr}).` });
    }

    // 4. Fetch already notified visits to prevent duplicates
    const sentSnapshot = await getDocs(collection(db, 'sent_visit_notifications'));
    const sentIds = new Set(sentSnapshot.docs.map(doc => doc.id));

    // Filter out already sent reminders
    const remindersToSend = pendingReminders.filter(r => !sentIds.has(r.id));

    if (remindersToSend.length === 0) {
      return NextResponse.json({ message: 'Tous les rappels de visite pour demain ont déjà été envoyés.' });
    }

    // 5. Fetch all users from Firestore to identify Admins and Gestionnaires
    const usersSnapshot = await getDocs(collection(db, 'users'));
    const adminOrGestionnaireEmails = new Set<string>();

    // Add fallback admins
    adminOrGestionnaireEmails.add('moslem.gouia@gmail.com');
    adminOrGestionnaireEmails.add('mahdigouia@gmail.com');

    usersSnapshot.forEach(userDoc => {
      const userData = userDoc.data();
      const role = userData.role;
      const email = userData.email;
      if (email && (role === 'admin' || role === 'gestionnaire')) {
        adminOrGestionnaireEmails.add(email.toLowerCase().trim());
      }
    });

    // 6. Retrieve Web Push credentials
    let publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    let privateKey = process.env.VAPID_PRIVATE_KEY;
    const subject = process.env.VAPID_SUBJECT || 'mailto:moslem.gouia@gmail.com';

    if (!publicKey || !privateKey) {
      console.log('[Visit Reminders Cron] VAPID Env vars missing. Falling back to Firestore.');
      const vapidDocRef = doc(db, 'config', 'vapid');
      const vapidDocSnap = await getDoc(vapidDocRef);
      
      if (vapidDocSnap.exists()) {
        const firestoreData = vapidDocSnap.data();
        publicKey = firestoreData.publicKey;
        privateKey = firestoreData.privateKey;
      }
    }

    const hasVapid = !!(publicKey && privateKey);
    if (hasVapid) {
      webpush.setVapidDetails(subject, publicKey!, privateKey!);
    } else {
      console.warn('[Visit Reminders Cron] VAPID config is missing. Web Push will be skipped.');
    }

    // Fetch all active push subscriptions
    const subsSnapshot = await getDocs(collection(db, 'push_subscriptions'));
    const allSubscriptions: any[] = [];
    subsSnapshot.forEach(subDoc => {
      allSubscriptions.push({
        id: subDoc.id,
        email: subDoc.data().email?.toLowerCase().trim(),
        subscription: subDoc.data().subscription
      });
    });

    const results: any[] = [];

    // Process each reminder
    for (const remark of remindersToSend) {
      const { clientName, user: creatorEmail, id: remarkId, content } = remark;
      const creatorEmailClean = creatorEmail?.toLowerCase().trim();
      const userShort = creatorEmail ? creatorEmail.split('@')[0] : 'Un utilisateur';

      // Recipient list: creator + admins + gestionnaires
      const recipients = new Set<string>(adminOrGestionnaireEmails);
      if (creatorEmailClean && creatorEmailClean !== 'utilisateur inconnu') {
        recipients.add(creatorEmailClean);
      }

      const messageText = `⏰ Rappel de visite pour demain chez ${clientName} (planifiée par ${userShort}).`;

      // A. Create In-App collaborative notification
      await addDoc(collection(db, 'notifications'), {
        type: 'visit_reminder',
        message: messageText,
        severity: 'medium',
        createdAt: new Date().toISOString(),
        status: 'pending',
        metadata: { clientName, remarkId }
      }).catch(e => console.error('[Visit Reminders Cron] In-app notification error:', e));

      // B. Send Webhook Notification (Discord/Slack)
      const webhookUrl = process.env.PAYMENT_WEBHOOK_URL;
      if (webhookUrl) {
        try {
          const webhookMessage = `⏰ **Rappel Visite Demain** : Visite planifiée chez **${clientName}** par **${userShort}**.\n📝 *Notes : ${content}*`;
          await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: webhookMessage, content: webhookMessage })
          });
        } catch (webhookErr) {
          console.error('[Visit Reminders Cron] Webhook error:', webhookErr);
        }
      }

      // C. Broadcast Web Push notifications to targeted subscriptions
      if (hasVapid && allSubscriptions.length > 0) {
        const pushPayload = JSON.stringify({
          title: '⏰ Rappel de Visite Demain !',
          body: messageText,
          icon: '/icon-192x192.png',
          badge: '/badge-96x96.png',
          url: `/clients?search=${encodeURIComponent(clientName)}&open=remark`,
          type: 'visit_reminder',
          clientName,
          tag: `gc-visit-${remarkId}`
        });

        const targetSubs = allSubscriptions.filter(sub => sub.email && recipients.has(sub.email));

        for (const subItem of targetSubs) {
          try {
            await webpush.sendNotification(subItem.subscription, pushPayload);
            console.log(`[Visit Reminders Cron] Web push sent to: ${subItem.email}`);
          } catch (err: any) {
            console.error(`[Visit Reminders Cron] Web push failed for ${subItem.email}:`, err.statusCode);
            // Prune invalid subscription
            if (err.statusCode === 404 || err.statusCode === 410) {
              await deleteDoc(doc(db, 'push_subscriptions', subItem.id))
                .catch(pruneErr => console.error('[Visit Reminders Cron] Prune error:', pruneErr));
            }
          }
        }
      }

      // D. Mark as notified in sent_visit_notifications to avoid repeating
      await setDoc(doc(db, 'sent_visit_notifications', remarkId), {
        clientName,
        sentAt: new Date().toISOString(),
        promiseDate: remark.promiseDate
      });

      results.push({
        remarkId,
        clientName,
        creator: creatorEmail
      });
    }

    return NextResponse.json({
      message: 'Rappels de visite envoyés avec succès.',
      notifiedVisitsCount: results.length,
      visits: results
    });

  } catch (error: any) {
    console.error('[Visit Reminders Cron] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
