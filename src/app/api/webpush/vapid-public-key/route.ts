import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import webpush from 'web-push';

export async function GET() {
  try {
    // 1. Prioritize environment variable from Vercel
    const envPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (envPublicKey) {
      console.log('[Web Push] Public VAPID key loaded from Environment Variables.');
      return NextResponse.json({ publicKey: envPublicKey });
    }

    // 2. Fallback to Firestore
    console.log('[Web Push] VAPID Env Var missing, falling back to Firestore...');
    const docRef = doc(db, 'config', 'vapid');
    const docSnap = await getDoc(docRef);
    let publicKey = '';

    if (docSnap.exists()) {
      publicKey = docSnap.data().publicKey;
    } else {
      console.log('[Web Push] No VAPID keys found in Firestore. Generating new ones...');
      const keys = webpush.generateVAPIDKeys();
      
      await setDoc(docRef, {
        publicKey: keys.publicKey,
        privateKey: keys.privateKey,
        createdAt: new Date().toISOString()
      });
      
      publicKey = keys.publicKey;
      console.log('[Web Push] New VAPID keys generated and stored in Firestore.');
    }

    return NextResponse.json({ publicKey });
  } catch (error: any) {
    console.error('[Web Push] Error fetching VAPID public key:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
