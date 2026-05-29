import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { doc, setDoc, deleteDoc, collection, query, where, getDocs } from 'firebase/firestore';
import crypto from 'crypto';

// Helper to hash endpoint for unique document ID
function hashEndpoint(endpoint: string): string {
  return crypto.createHash('sha256').update(endpoint).digest('hex');
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { subscription, userId, action, deviceName } = body;

    if (!subscription || !subscription.endpoint) {
      return NextResponse.json({ error: 'Un abonnement (subscription) valide est requis.' }, { status: 400 });
    }

    const docId = hashEndpoint(subscription.endpoint);
    const docRef = doc(db, 'push_subscriptions', docId);

    if (action === 'unsubscribe') {
      await deleteDoc(docRef);
      console.log(`[Web Push] Subscription deleted for user: ${userId}`);
      return NextResponse.json({ success: true, message: 'Désabonnement réussi.' });
    }

    if (!userId) {
      return NextResponse.json({ error: 'Un identifiant utilisateur (userId) est requis pour l\'abonnement.' }, { status: 400 });
    }

    // Save subscription
    await setDoc(docRef, {
      subscription,
      userId,
      deviceName: deviceName || 'Navigateur',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    console.log(`[Web Push] Subscription saved/updated for user: ${userId}`);
    return NextResponse.json({ success: true, message: 'Abonnement enregistré avec succès.' });
  } catch (error: any) {
    console.error('[Web Push Subscribe] Error saving subscription:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
