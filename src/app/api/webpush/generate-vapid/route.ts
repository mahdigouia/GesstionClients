import { NextResponse } from 'next/server';
import webpush from 'web-push';

export async function GET() {
  try {
    const vapidKeys = webpush.generateVAPIDKeys();
    return NextResponse.json({
      success: true,
      publicKey: vapidKeys.publicKey,
      privateKey: vapidKeys.privateKey,
      instructions: "Veuillez copier ces clés dans vos variables d'environnement Vercel: NEXT_PUBLIC_VAPID_PUBLIC_KEY et VAPID_PRIVATE_KEY."
    });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message || 'Une erreur est survenue lors de la génération des clés.'
    }, { status: 500 });
  }
}
