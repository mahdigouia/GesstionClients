import { NextResponse } from 'next/server';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

export async function POST(req: Request) {
  try {
    const { text, clientNames } = await req.json();

    if (!text) {
      return NextResponse.json({ error: "Texte manquant" }, { status: 400 });
    }

    if (!GEMINI_API_KEY) {
      // Indique au client qu'il faut utiliser le fallback (expressions régulières)
      return NextResponse.json({ error: "Clé API Gemini non configurée", useFallback: true }, { status: 503 });
    }

    const systemPrompt = `Tu es un assistant vocal intelligent pour un logiciel CRM de recouvrement de créances en Tunisie.
L'utilisateur te parle via une reconnaissance vocale (Speech-to-Text) qui peut faire des erreurs de transcription.
L'utilisateur peut parler en français, en arabe, ou en dialecte tunisien (Darja / Arabizi comme "3tini les factures", "chkoune 3andou retard").

Ta mission est d'analyser le texte de l'utilisateur et d'extraire son intention et les entités (ex: nom du client).

Voici la liste des clients actuels dans la base de données :
[${(clientNames || []).join(', ')}]

Fais de ton mieux pour corriger phonétiquement un nom mal prononcé et le faire correspondre à l'un de ces clients. Si tu es sûr, renvoie le nom exact de la liste.

Réponds UNIQUEMENT avec un objet JSON valide suivant exactement cette structure :
{
  "intent": "le_type_d_intention",
  "entities": {
    "client": "le nom du client corrigé s'il y en a un, sinon une chaine vide",
    "documentNumber": "le numéro de facture s'il y en a un, sinon une chaine vide"
  },
  "confidence": 0.95
}

Types d'intentions (intent) possibles :
- "GET_UNPAID_INVOICES_BY_CLIENT" (Ex: "factures de X", "chnouwa ysalou X", "chfama 3and X", "factures l'amen")
- "GET_TOTAL_DEBTS" (Ex: "total des créances", "9adech ysalou lkol fi lkol", "somme totale")
- "GET_CRITICAL_ALERTS" (Ex: "alertes critiques", "chkoune fih mochkla", "les dossiers rouges")
- "GET_CLIENT_BALANCE" (Ex: "solde de X", "9adech ysal X", "balance de X")
- "GET_OVERDUE_INVOICES" (Ex: "factures en retard", "elli retardé lkol", "les retards")
- "UNKNOWN" (si tu ne comprends absolument pas la demande)
`;

    // Fusionner le prompt système et le texte pour éviter les erreurs de schéma REST (systemInstruction)
    const combinedText = systemPrompt + "\n\nTexte de l'utilisateur : " + text;

    // Utilisation native de fetch pour éviter d'ajouter de nouvelles dépendances npm
    // Utilisation de gemini-1.5-flash-8b car il est plus léger et subit moins d'erreurs 503 sur le niveau gratuit
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-8b:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [{ 
            role: "user",
            parts: [{ text: combinedText }] 
          }],
          generationConfig: {
            temperature: 0.1, // Très bas pour être déterministe et précis
            responseMimeType: "application/json", // Force Gemini à répondre en JSON
          },
        }),
      }
    );

    if (!response.ok) {
      console.error("Erreur API Gemini HTTP:", await response.text());
      return NextResponse.json({ error: "Erreur Gemini", useFallback: true }, { status: 500 });
    }

    const data = await response.json();
    const candidateText = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!candidateText) {
      return NextResponse.json({ error: "Réponse vide de Gemini", useFallback: true }, { status: 500 });
    }

    // Nettoyage robuste : extraire uniquement l'objet JSON avec une expression régulière
    const jsonMatch = candidateText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error("Impossible de trouver du JSON dans la réponse:", candidateText);
      return NextResponse.json({ error: "Format invalide de Gemini", useFallback: true }, { status: 500 });
    }

    const jsonResult = JSON.parse(jsonMatch[0]);
    return NextResponse.json(jsonResult);
    
  } catch (error) {
    console.error("Erreur route voice-nlp:", error);
    return NextResponse.json({ error: "Erreur interne serveur", useFallback: true }, { status: 500 });
  }
}
