import { ClientDebt } from '@/types/debt';

/**
 * Transforme les données extraites par pdfplumber/Camelot en objets ClientDebt
 * Cette version est beaucoup plus robuste que le parsing texte brut
 */

interface ExtractedDebt {
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
}

interface ExtractionResult {
  success: boolean;
  debts: ClientDebt[];
  count: number;
  method: string;
  commercial?: {
    code: string;
    name: string;
  };
}

/**
 * Transforme les données Python en ClientDebt[]
 */
export function transformExtractedDebts(
  extractedData: {
    debts?: ExtractedDebt[];
    commercial?: { code: string; name: string };
    success: boolean;
  },
  fileName: string
): ClientDebt[] {
  if (!extractedData.success || !extractedData.debts) {
    return [];
  }

  const debts: ClientDebt[] = [];
  let id = 1;

  for (const data of extractedData.debts) {
    const debt = createClientDebt(data, fileName, id++, extractedData.commercial);
    if (debt) {
      debts.push(debt);
    }
  }

  return debts;
}

/**
 * Crée un objet ClientDebt à partir des données extraites
 */
function createClientDebt(
  data: ExtractedDebt,
  fileName: string,
  id: number,
  commercial?: { code: string; name: string }
): ClientDebt | null {
  try {
    // Classification du document
    const classification = classifyDocument(
      data.document_number,
      data.age,
      data.amount,
      data.settlement,
      data.balance
    );

    // Niveau de risque
    const riskLevel = classifyRisk(data.age, data.balance > 0);

    // Valider et formater les dates
    const formatDate = (dateStr: string): string => {
      if (!dateStr) return '';
      // Si déjà au format YYYY-MM-DD, retourner tel quel
      if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
      // Si au format DD/MM/YYYY, convertir
      if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateStr)) {
        const [day, month, year] = dateStr.split('/');
        return `${year}-${month}-${day}`;
      }
      return dateStr;
    };

    return {
      id: `debt_${id}`,
      clientCode: data.client_code,
      clientName: data.client_name,
      clientPhone: data.client_phone,
      dueDate: formatDate(data.due_date),
      documentDate: formatDate(data.document_date),
      documentNumber: data.document_number,
      documentType: classification.documentType,
      age: data.age,
      paymentDays: 0, // Sera calculé si nécessaire
      description: data.description || 'FACTURE',
      amount: data.amount,
      settlement: data.settlement,
      balance: data.balance,
      paymentStatus: classification.paymentStatus,
      riskLevel: riskLevel,
      sourceFile: fileName,
      currency: 'TND',
      commercialCode: data.commercial_code || commercial?.code,
      commercialName: data.commercial_name || commercial?.name,
      isContentieux: classification.isContentieux,
    };

  } catch (error) {
    console.error('[Transformer] Erreur création ClientDebt:', error);
    return null;
  }
}

/**
 * Classification du document selon les règles métier
 */
function classifyDocument(
  docNumber: string,
  age: number,
  amount: number,
  settlement: number,
  balance: number
): {
  documentType: 'invoice' | 'credit_note' | 'unpaid_old' | 'other';
  paymentStatus: 'unpaid' | 'retained' | 'partial' | 'paid';
  isContentieux: boolean;
} {
  const upper = docNumber.toUpperCase();

  // IC: Factures impayées anciennes
  if (upper.startsWith('IC')) {
    const isContentieux = age > 365 && balance > 0;
    return {
      documentType: isContentieux ? 'unpaid_old' : 'invoice',
      paymentStatus: balance > 0 ? 'unpaid' : 'paid',
      isContentieux,
    };
  }

  // AV: Avoirs / Notes de crédit
  if (upper.startsWith('AV')) {
    return {
      documentType: 'credit_note',
      paymentStatus: 'paid',
      isContentieux: false,
    };
  }

  // FT: Factures de vente
  if (upper.startsWith('FT')) {
    // Soldé
    if (balance <= 0.001) {
      return { documentType: 'invoice', paymentStatus: 'paid', isContentieux: false };
    }

    const isContentieux = age > 365;

    // Impayé total
    if (settlement <= 0.001) {
      return { documentType: 'invoice', paymentStatus: 'unpaid', isContentieux };
    }

    // Calculer le ratio
    const ratio = amount > 0 ? (balance / amount) * 100 : 0;

    // Retenu non réglé (0.1% à 2%)
    if (ratio >= 0.1 && ratio <= 2) {
      return { documentType: 'invoice', paymentStatus: 'retained', isContentieux };
    }

    // Paiement partiel
    return { documentType: 'invoice', paymentStatus: 'partial', isContentieux };
  }

  // Autres
  return {
    documentType: 'other',
    paymentStatus: balance > 0 ? 'unpaid' : 'paid',
    isContentieux: false,
  };
}

/**
 * Classification du risque
 */
function classifyRisk(
  agingDays: number,
  hasBalance: boolean
): 'healthy' | 'monitoring' | 'overdue' | 'critical' {
  if (!hasBalance) return 'healthy';
  if (agingDays > 365) return 'critical';
  if (agingDays > 90) return 'overdue';
  if (agingDays > 30) return 'monitoring';
  return 'healthy';
}

/**
 * Parse une réponse API en ExtractionResult
 */
export function parseExtractionResponse(response: unknown): ExtractionResult {
  const res = response as {
    success?: boolean;
    debts?: ExtractedDebt[];
    count?: number;
    method?: string;
    commercial?: { code: string; name: string };
    fileName?: string;
  };

  if (!res.success || !res.debts) {
    return {
      success: false,
      debts: [],
      count: 0,
      method: res.method || 'unknown'
    };
  }

  const debts = transformExtractedDebts(
    { debts: res.debts, commercial: res.commercial, success: true },
    res.fileName || 'unknown.pdf'
  );

  return {
    success: true,
    debts,
    count: debts.length,
    method: res.method || 'unknown',
    commercial: res.commercial
  };
}
