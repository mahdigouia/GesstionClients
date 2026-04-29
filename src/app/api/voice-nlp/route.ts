import { NextResponse } from 'next/server';

const GROQ_API_KEY = process.env.GROQ_API_KEY;

export async function POST(req: Request) {
  try {
    const { text, clientNames, history = [] } = await req.json();

    if (!text) {
      return NextResponse.json({ error: "Texte manquant" }, { status: 400 });
    }

    if (!GROQ_API_KEY) {
      // Indique au client qu'il faut utiliser le fallback (expressions régulières)
      return NextResponse.json({ error: "Clé API Groq non configurée", useFallback: true }, { status: 503 });
    }

    const systemPrompt = `Tu es un assistant vocal intelligent pour un logiciel CRM de recouvrement de créances en Tunisie.
L'utilisateur te parle via une reconnaissance vocale qui peut faire des erreurs.
Tu peux recevoir des messages en français, arabe, ou dialecte tunisien.

CONSIGNE DE CONTEXTE : 
- Si l'utilisateur pose une question sans mentionner de client mais qu'un client a été mentionné dans l'historique récent des messages, utilise ce client par défaut.
- Résous les pronoms (lui, son, ses, l'autre, etc.) en fonction de l'historique.

Voici la liste des clients actuels dans la base de données :
[${(clientNames || []).join(', ')}]

Fais de ton mieux pour corriger phonétiquement un nom mal prononcé et le faire correspondre à l'un de ces clients.

Réponds UNIQUEMENT avec un objet JSON valide suivant exactement cette structure :
{
  "intent": "le_type_d_intention",
  "entities": {
    "client": "le nom du client corrigé s'il y en a un, sinon une chaine vide",
    "documentNumber": "le numéro de facture s'il y en a un, sinon une chaine vide"
  }
}

Types d'intentions (intent) possibles :
- "GET_UNPAID_INVOICES_BY_CLIENT" (Ex: "factures de X", "chnouwa ysalou X", "أعطيني الفاتورات إلي مش خالصة متع X")
- "GET_TOTAL_DEBTS" (Ex: "total des créances", "9adech ysalou lkol", "قداش يسالوني الكل")
- "GET_CRITICAL_ALERTS" (Ex: "alertes critiques", "شفمة مشكلة توة")
- "GET_CLIENT_BALANCE" (Ex: "solde de X", "قداش يسال X")
- "GET_OVERDUE_INVOICES" (Ex: "factures en retard", "les retards")
- "GET_RETAINED_INVOICES" (Ex: "les retenues", "retenues à la source de X", "قداش رتنوات")
- "GET_RETAINED_HISTORY" (Ex: "historique des retenues de X", "évolution des retenues", "المنحنى متاع الرتنوات")
- "GET_CREDIT_NOTES" (Ex: "les avoirs", "factures avoir de X", "الأبوار")
- "GET_INVOICE_AGE" (Ex: "âge de la facture X", "عمر الفاتورة X")
- "GET_CLIENT_PHONE" (Ex: "numéro de téléphone de X", "أعطيني نيمرو X")
- "UNKNOWN" (si tu ne comprends pas)
`;

    // Préparation des messages incluant l'historique
    const groqMessages = [
      { role: "system", content: systemPrompt },
      ...history,
      { role: "user", content: text }
    ];

    // Utilisation native de fetch vers l'API Groq (OpenAI compatible)
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${GROQ_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: groqMessages,
        temperature: 0.1,
        response_format: { type: "json_object" }
      }),
    });

    if (!response.ok) {
      console.error("Erreur API Groq HTTP:", await response.text());
      return NextResponse.json({ error: "Erreur Groq", useFallback: true }, { status: 500 });
    }

    const data = await response.json();
    const candidateText = data.choices?.[0]?.message?.content;

    if (!candidateText) {
      return NextResponse.json({ error: "Réponse vide de Groq", useFallback: true }, { status: 500 });
    }

    const jsonResult = JSON.parse(candidateText);
    return NextResponse.json(jsonResult);
    
  } catch (error) {
    console.error("Erreur route voice-nlp:", error);
    return NextResponse.json({ error: "Erreur interne serveur", useFallback: true }, { status: 500 });
  }
}
