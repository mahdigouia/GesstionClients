import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// URL du service Python sur Render
const PYTHON_SERVICE_URL = process.env.PDF_SERVICE_URL || 'https://pdf-extractor-zcni.onrender.com';

// Types pour la réponse
interface ExtractedTable {
  page: number;
  table_index: number;
  data: string[][];
  bbox?: number[];
  parsing_method: string;
}

interface PythonExtractResponse {
  success: boolean;
  tables: ExtractedTable[];
  total_pages: number;
  method_used: string;
  extracted_text?: string;
}

interface PythonDebtsResponse {
  success: boolean;
  debts: Array<{
    client_code: string;
    client_name: string;
    client_phone?: string;
    due_date: string;
    document_date: string;
    document_number: string;
    age: number;
    description: string;
    amount: number;
    settlement: number;
    balance: number;
    commercial_code?: string;
    commercial_name?: string;
  }>;
  count: number;
  commercial?: {
    code: string;
    name: string;
  };
}

/**
 * POST /api/pdf-extract
 * 
 * Extrait les créances d'un PDF en utilisant le microservice Python (pdfplumber/Camelot).
 * Si le service Python est indisponible, fallback sur l'extraction legacy.
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json(
        { error: 'Aucun fichier fourni' },
        { status: 400 }
      );
    }

    if (!file.name.toLowerCase().endsWith('.pdf')) {
      return NextResponse.json(
        { error: 'Format non supporté. Utilisez un fichier PDF.' },
        { status: 400 }
      );
    }

    console.log(`[PDF Extract] Traitement: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`);

    // Essayer d'abord l'endpoint optimisé /extract-debts
    let result = await tryExtractDebts(file);
    
    if (!result.success) {
      // Fallback sur l'extraction legacy
      console.warn('[PDF Extract] Service Python indisponible, fallback sur extraction legacy');
      return fallbackToLegacy(request, file);
    }

    const duration = Date.now() - startTime;
    console.log(`[PDF Extract] Succès: ${result.debts?.length || 0} créances en ${duration}ms`);

    return NextResponse.json({
      success: true,
      debts: result.debts || [],
      count: result.debts?.length || 0,
      method: 'pdfplumber-python',
      duration_ms: duration,
      fileName: file.name,
      commercial: result.commercial
    });

  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erreur inconnue';
    console.error('[PDF Extract] Erreur:', message);
    
    return NextResponse.json(
      { 
        error: `Extraction échouée: ${message}`,
        success: false
      },
      { status: 500 }
    );
  }
}

/**
 * Essaie d'extraire les créances via l'endpoint optimisé du service Python
 */
async function tryExtractDebts(file: File): Promise<PythonDebtsResponse & { success: boolean }> {
  try {
    console.log(`[PDF Extract] Appel service Python: ${PYTHON_SERVICE_URL}/extract-debts`);
    
    const pythonForm = new FormData();
    pythonForm.append('file', file);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60000);

    const response = await fetch(`${PYTHON_SERVICE_URL}/extract-debts`, {
      method: 'POST',
      body: pythonForm,
      signal: controller.signal
    });

    clearTimeout(timeout);

    console.log(`[PDF Extract] Réponse service Python: HTTP ${response.status}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[PDF Extract] Service Python erreur HTTP ${response.status}:`, errorText);
      return { success: false, debts: [], count: 0 };
    }

    const data: PythonDebtsResponse = await response.json();
    console.log(`[PDF Extract] Succès: ${data.debts?.length || 0} créances extraites`);
    return { ...data, success: true };

  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.error('[PDF Extract] Timeout service Python (60s)');
    } else {
      console.error('[PDF Extract] Erreur appel service Python:', error);
    }
    return { success: false, debts: [], count: 0 };
  }
}

/**
 * Fallback sur l'extraction legacy via l'API OCR existante
 */
async function fallbackToLegacy(request: NextRequest, file: File): Promise<Response> {
  try {
    // Recréer le FormData pour l'appel interne
    const legacyForm = new FormData();
    legacyForm.append('file', file);

    // Appeler la route legacy /api/ocr
    const ocrResponse = await fetch(new URL('/api/ocr', request.url), {
      method: 'POST',
      body: legacyForm,
    });

    if (!ocrResponse.ok) {
      throw new Error(`OCR API failed: ${ocrResponse.status}`);
    }

    const ocrData = await ocrResponse.json();

    // Le parsing sera fait côté client via OCRService.parseDebtData
    return NextResponse.json({
      success: true,
      text: ocrData.text,
      pages: ocrData.pages,
      method: 'pdf-parse-legacy',
      fallback: true,
      fileName: file.name
    });

  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erreur inconnue';
    console.error('[PDF Extract] Fallback legacy échoué:', message);
    
    return NextResponse.json(
      { 
        error: `Aucune méthode d'extraction disponible: ${message}`,
        success: false
      },
      { status: 503 }
    );
  }
}

/**
 * GET /api/pdf-extract/health
 * 
 * Vérifie la santé du service Python
 */
export async function GET() {
  try {
    console.log(`[PDF Extract Health] Vérification service Python: ${PYTHON_SERVICE_URL}/health`);
    
    const response = await fetch(`${PYTHON_SERVICE_URL}/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(60000) // 60s pour cold start Render
    });
    
    console.log(`[PDF Extract Health] Réponse: HTTP ${response.status}`);

    if (response.ok) {
      const data = await response.json();
      return NextResponse.json({
        python_service: 'connected',
        ...data
      });
    }

    return NextResponse.json(
      { 
        python_service: 'unavailable',
        status: response.status
      },
      { status: 503 }
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue';
    console.error('[PDF Extract Health] Erreur:', errorMessage);
    
    return NextResponse.json(
      { 
        python_service: 'disconnected',
        error: 'Service Python non accessible',
        details: errorMessage
      },
      { status: 503 }
    );
  }
}
