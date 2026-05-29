import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, updateDoc, doc, addDoc } from 'firebase/firestore';

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
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: summaryMessage,
          content: summaryMessage // Discord uses content, Slack uses text
        })
      });

      if (!response.ok) {
        console.error('Webhook error:', await response.text());
        return NextResponse.json({ 
          error: 'Erreur lors de l\'envoi du Webhook', 
          processedCount: notifications.length 
        }, { status: 500 });
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

    return NextResponse.json({ 
      message: 'Notifications envoyées avec succès.', 
      count: notifications.length 
    });

  } catch (error: any) {
    console.error('Cron job error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
