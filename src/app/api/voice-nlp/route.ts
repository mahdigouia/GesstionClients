import { NextResponse } from 'next/server';

const GROQ_API_KEY = process.env.GROQ_API_KEY;

export async function POST(req: Request) {
  try {
    const { text, clientNames } = await req.json();

    if (!text) {
      return NextResponse.json({ error: "Texte manquant" }, { status: 400 });
    }

    if (!GROQ_API_KEY) {
      // Indique au client qu'il faut utiliser le fallback (expressions régulières)
      return NextResponse.json({ error: "Clé API Groq non configurée", useFallback: true }, { status: 503 });
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

    // Utilisation native de fetch vers l'API Groq (OpenAI compatible)
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${GROQ_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "llama3-70b-8192", // Modèle ultra-rapide et puissant
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: text }
        ],
        temperature: 0.1,
        response_format: { type: "json_object" } // Force Groq à répondre en pur JSON
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

    // Le format JSON est garanti par Groq via response_format: { type: "json_object" }
    const jsonResult = JSON.parse(candidateText);
    return NextResponse.json(jsonResult);
    
  } catch (error) {
    console.error("Erreur route voice-nlp:", error);
    return NextResponse.json({ error: "Erreur interne serveur", useFallback: true }, { status: 500 });
  }
}
