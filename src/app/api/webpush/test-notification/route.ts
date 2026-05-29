import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import webpush from 'web-push';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { subscription } = body;

    if (!subscription || !subscription.endpoint) {
      return NextResponse.json({ error: 'Un objet d\'abonnement valide (subscription) est requis.' }, { status: 400 });
    }

    // Load VAPID keys from Firestore config
    const docRef = doc(db, 'config', 'vapid');
    const docSnap = await getDoc(docRef);
    
    if (!docSnap.exists()) {
      return NextResponse.json({ 
        error: 'Les clés VAPID ne sont pas configurées. Veuillez d\'abord charger l\'API des clés.' 
      }, { status: 500 });
    }

    const { publicKey, privateKey } = docSnap.data();
    
    webpush.setVapidDetails(
      'mailto:moslem.gouia@gmail.com',
      publicKey,
      privateKey
    );

    const payload = JSON.stringify({
      title: 'Notification de Test 🔔',
      body: 'Félicitations ! Vos notifications en arrière-plan fonctionnent correctement même en veille.',
      icon: '/logo.png',
      badge: '/logo.png',
      url: '/settings',
      vibrate: [100, 50, 100]
    });

    await webpush.sendNotification(subscription, payload);

    return NextResponse.json({ 
      success: true, 
      message: 'Notification de test envoyée avec succès.' 
    });
  } catch (error: any) {
    console.error('[Web Push Test] Error sending test notification:', error);
    
    // Check if subscription expired/revoked
    const statusCode = error.statusCode || 500;
    return NextResponse.json({ 
      error: error.message,
      statusCode
    }, { status: statusCode });
  }
}
