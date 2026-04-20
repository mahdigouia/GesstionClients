import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'Aucun fichier fourni' }, { status: 400 });
    }

    if (!file.name.toLowerCase().endsWith('.pdf')) {
      return NextResponse.json({ error: 'Format non supporté. Utilisez un fichier PDF.' }, { status: 400 });
    }

    // Lire le fichier comme buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Importer pdf-parse dynamiquement (évite les erreurs de bundling côté client)
    const pdfParseModule = await import('pdf-parse');
    const pdfParse = pdfParseModule.default || pdfParseModule;
    
    const pdfData = await pdfParse(buffer, {
      // Options pour préserver la structure du texte
      normalizeWhitespace: false,
    });

    const extractedText: string = pdfData.text || '';
    const numPages: number = pdfData.numpages || 1;

    console.log(`[OCR API] PDF traité: ${file.name}, Pages: ${numPages}, Texte extrait: ${extractedText.length} caractères`);

    return NextResponse.json({
      text: extractedText,
      pages: numPages,
      fileName: file.name,
    });

  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erreur inconnue';
    console.error('[OCR API] Erreur:', message);
    
    // Si pdf-parse n'est pas installé, retourner message explicite
    if (message.includes('Cannot find module')) {
      return NextResponse.json({ 
        error: 'Module pdf-parse non installé. Lancez: npm install pdf-parse',
        needsInstall: true
      }, { status: 503 });
    }
    
    return NextResponse.json({ error: `Extraction PDF échouée: ${message}` }, { status: 500 });
  }
}
