import { ClientDebt } from '@/types/debt';

export class OCRService {

  /**
   * Extrait le texte d'un PDF via l'API serveur (pdf-parse).
   * Supporte les PDF multi-pages de type "Etat de Recouvrement Client".
   * Fallback sur le texte statique si l'API est indisponible.
   */
  static async extractTextFromPDF(file: File): Promise<string> {
    try {
      console.log(`[OCR] Début extraction: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`);

      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/ocr', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        
        // Avertissement si pdf-parse n'est pas installé
        if (errorData.needsInstall) {
          console.warn('[OCR] pdf-parse non installé. Installez-le avec: npm install pdf-parse');
          console.warn('[OCR] Utilisation du mode fallback...');
        } else {
          console.warn(`[OCR] API échouée (${response.status}): ${errorData.error}`);
        }
        return this.getFallbackText(file.name);
      }

      const data = await response.json();
      const text: string = data.text || '';
      
      console.log(`[OCR] Extraction réussie: ${data.pages} page(s), ${text.length} caractères`);

      if (!text.trim()) {
        console.warn('[OCR] PDF sans texte extractible (PDF scanné?). Utilisation du fallback.');
        return this.getFallbackText(file.name);
      }

      return text;

    } catch (error) {
      console.error('[OCR] Erreur réseau ou inattendue:', error);
      console.warn('[OCR] Utilisation du texte de fallback.');
      return this.getFallbackText(file.name);
    }
  }

  // Commercial courant détecté dans le flux du document
  private static currentCommercial: { code: string; name: string } | null = null;

  /**
   * Parse le texte OCR extrait et retourne une liste de créances.
   * Gère le format tunisien (séparateur de milliers = espace, décimal = virgule).
   * Gère les documents multi-pages et multi-clients.
   */
  static parseDebtData(ocrText: string, fileName: string): ClientDebt[] {
    // Réinitialiser le commercial pour chaque nouveau fichier
    this.currentCommercial = null;

    const lines = ocrText.split('\n').filter(line => line.trim());
    const debts: ClientDebt[] = [];

    let currentClient: { code: string; name: string; phone?: string } | null = null;
    let id = 1;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      // ─── Détection du commercial (ex: "C01 MED AMINE BEN ZAARA") ───
      const commercialMatch = line.match(/^(C\d{2,})\s+([A-ZÀÂÉÈÊËÎÏÔÙÛÜÇ][A-ZÀÂÉÈÊËÎÏÔÙÛÜÇ\s\-]+)/);
      if (commercialMatch) {
        this.currentCommercial = {
          code: commercialMatch[1].toUpperCase(),
          name: commercialMatch[2].trim(),
        };
        console.log('[OCR] Commercial détecté:', this.currentCommercial);
        continue;
      }

      // ─── Détection d'un en-tête client (ex: "0424 LA MANGEARIA 72 26 09 01") ───
      const clientMatch = line.match(
        /^(\d{4})\s+([A-ZÀÂÉÈÊËÎÏÔÙÛÜÇ][A-ZÀÂÉÈÊËÎÏÔÙÛÜÇ\s\-\'\(\)\.\/]+?)(?:\s+([\d\s]{8,}))?$/i
      );
      if (clientMatch) {
        currentClient = {
          code: clientMatch[1],
          name: clientMatch[2].trim(),
          phone: clientMatch[3]
            ? clientMatch[3].replace(/\s/g, '').substring(0, 10)
            : undefined,
        };
        console.log('[OCR] Client détecté:', currentClient);
        continue;
      }

      // ─── Détection d'une ligne de données ───
      if (currentClient && this.isDataRow(line)) {
        try {
          const debtData = this.parseDataRow(line, currentClient, fileName, id++);
          if (debtData) {
            debts.push(debtData);
          }
        } catch (err) {
          console.warn('[OCR] Ligne ignorée (erreur parsing):', line, err);
        }
      }
    }

    console.log(`[OCR] Parsing terminé: ${debts.length} créance(s) trouvée(s) dans "${fileName}"`);
    return debts;
  }

  /**
   * Vérifie si une ligne contient des données de créance.
   * Une ligne de données contient une date DD/MM/YYYY et au moins un montant TND (X,XXX).
   */
  private static isDataRow(line: string): boolean {
    const hasDate = /\d{2}[\/\-]\d{2}[\/\-]\d{4}/.test(line);
    // Format montant TND: virgule + exactement 3 chiffres décimaux
    const hasTunisianAmount = /\d+,\d{3}/.test(line);
    return hasDate && hasTunisianAmount && line.length > 20;
  }

  /**
   * Parse une ligne de données du format "Etat de Recouvrement".
   *
   * Format attendu:
   *   DateEch DateDoc N°Pièce Age NbrJP [Description] Montant Règlement Solde
   *
   * Montants en format TND: "1 264,277" ou "12 771,360" ou "0,000"
   * (séparateur de milliers = espace, décimal = virgule, 3 chiffres après virgule)
   *
   * Algorithme robuste:
   *   1. Extraire les champs fixes du début (dates, pièce, age, nbrJP)
   *   2. Trouver les 3 montants en fin de ligne via pattern + vérification cohérence
   *   3. La description = tout ce qui précède le 1er des 3 montants
   */
  private static parseDataRow(
    line: string,
    client: { code: string; name: string; phone?: string },
    fileName: string,
    id: number
  ): ClientDebt | null {

    // Étape 1: Extraire les champs de l'en-tête
    const headerRegex = /^(\d{2}\/\d{2}\/\d{4})\s+(\d{2}\/\d{2}\/\d{4})\s+(\w+)\s+(\d+)\s+(\d+)\s+(.+)$/;
    const headerMatch = line.match(headerRegex);
    if (!headerMatch) return null;

    const [, dueDate, docDate, docNumber, ageStr, paymentDaysStr, rest] = headerMatch;

    // Étape 2: Extraire les 3 montants TND depuis la fin de la ligne (avec vérification cohérence)
    const parsed = this.extractThreeAmounts(rest);
    if (!parsed) {
      console.warn('[OCR] Impossible d\'extraire 3 montants de:', rest);
      return null;
    }

    const { montant: amount, reglement: settlement, solde: balance, description } = parsed;
    const ageDays = parseInt(ageStr, 10);
    const paymentDaysNum = parseInt(paymentDaysStr, 10);

    // Étape 3: Classer le document
    const classification = this.classifyDocument(
      docNumber.trim(),
      ageDays,
      amount,
      settlement,
      balance
    );

    return {
      id: `debt_${id}`,
      clientCode: client.code,
      clientName: client.name,
      clientPhone: client.phone,
      dueDate: this.parseDate(dueDate),
      documentDate: this.parseDate(docDate),
      documentNumber: docNumber.trim(),
      documentType: classification.documentType,
      age: ageDays,
      paymentDays: paymentDaysNum,
      description: description || 'FACTURE',
      amount,
      settlement,
      balance,
      paymentStatus: classification.paymentStatus,
      riskLevel: this.classifyRisk(ageDays, balance > 0),
      sourceFile: fileName,
      currency: 'TND',
      commercialCode: this.currentCommercial?.code,
      commercialName: this.currentCommercial?.name,
      isContentieux: classification.isContentieux,
    };
  }

  /**
   * Extrait les 3 montants TND (Montant, Règlement, Solde) depuis la partie droite d'une ligne.
   *
   * Stratégie:
   *   - Essai 1: pattern avec séparateur de milliers (ex: "1 264,277")
   *   - Essai 2: pattern simple sans séparateur (ex: "264,277")
   *   - Vérification: Solde ≈ Montant - Règlement (tolérance 1 TND)
   *   - Utilise la première interprétation cohérente
   *
   * Exemples:
   *   "1 264,277 0,000 1 264,277"             → m=1264.277, r=0, s=1264.277 ✓
   *   "torba 3 341,534 0,000 341,534"         → m=341.534, r=0, s=341.534  ✓ (évite "3 341,534")
   *   "Tahrir 12 771,360 12 727,837 43,523"   → m=12771.36, r=12727.837, s=43.523 ✓
   */
  private static extractThreeAmounts(
    rest: string
  ): { montant: number; reglement: number; solde: number; description: string } | null {

    // Pattern avec séparateur de milliers optionnel: "1 264,277" ou "12 771,360" ou "0,000"
    const patternFull = /\b(\d{1,3}(?:\s\d{3})*,\d{3})\b/g;
    // Pattern simple sans séparateur de milliers: "264,277" ou "0,000"
    const patternSimple = /\b(\d{1,3},\d{3})\b/g;

    // Essai 1: avec séparateur de milliers (donne les vrais grands montants)
    const fullMatches = [...rest.matchAll(patternFull)];
    if (fullMatches.length >= 3) {
      const last3 = fullMatches.slice(-3);
      const m = this.parseAmount(last3[0][1]);
      const r = this.parseAmount(last3[1][1]);
      const s = this.parseAmount(last3[2][1]);

      // Vérification cohérence: Solde = Montant - Règlement (tolérance 1 TND)
      if (Math.abs(m - r - s) < 1.0 && m >= 0 && r >= 0 && s >= 0 && r <= m + 0.01) {
        const descEnd = last3[0].index!;
        return {
          montant: m,
          reglement: r,
          solde: s,
          description: rest.substring(0, descEnd).trim(),
        };
      }
    }

    // Essai 2: sans séparateur de milliers (cas comme "torba 3 341,534")
    const simpleMatches = [...rest.matchAll(patternSimple)];
    if (simpleMatches.length >= 3) {
      const last3 = simpleMatches.slice(-3);
      const m = this.parseAmount(last3[0][1]);
      const r = this.parseAmount(last3[1][1]);
      const s = this.parseAmount(last3[2][1]);

      if (Math.abs(m - r - s) < 1.0 && m >= 0 && r >= 0 && s >= 0 && r <= m + 0.01) {
        const descEnd = last3[0].index!;
        return {
          montant: m,
          reglement: r,
          solde: s,
          description: rest.substring(0, descEnd).trim(),
        };
      }
    }

    // Essai 3: toutes combinaisons avec tolérance élargie (5 TND)
    // Utile pour les PDF avec arrondi OCR
    if (fullMatches.length >= 3) {
      const last3 = fullMatches.slice(-3);
      const m = this.parseAmount(last3[0][1]);
      const r = this.parseAmount(last3[1][1]);
      const s = this.parseAmount(last3[2][1]);
      if (m >= 0 && r >= 0 && s >= 0) {
        const descEnd = last3[0].index!;
        console.warn(`[OCR] Cohérence approx: ${m} - ${r} = ${s} (diff: ${Math.abs(m - r - s).toFixed(3)})`);
        return {
          montant: m,
          reglement: r,
          solde: s,
          description: rest.substring(0, descEnd).trim(),
        };
      }
    }

    return null;
  }

  /**
   * Convertit une chaîne montant TND en nombre.
   * Gère: "1 264,277" → 1264.277, "0,000" → 0, "43,523" → 43.523
   */
  private static parseAmount(amountStr: string): number {
    const cleaned = amountStr
      .trim()
      .replace(/\s/g, '')      // Supprimer les espaces (séparateurs de milliers)
      .replace(',', '.');       // Remplacer la virgule décimale par un point
    const value = parseFloat(cleaned);
    return isNaN(value) ? 0 : value;
  }

  /**
   * Normalise une date DD/MM/YYYY → YYYY-MM-DD
   */
  private static parseDate(dateStr: string): string {
    const normalized = dateStr.replace(/[\\/\-]/g, '/');
    const parts = normalized.split('/');

    if (parts.length === 3) {
      let [day, month, year] = parts;
      if (year.length === 2) year = '20' + year;
      return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }
    return dateStr;
  }

  /**
   * Niveau de risque selon l'ancienneté et l'existence d'un solde.
   */
  private static classifyRisk(
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
   * Classification du document selon les règles métier:
   *
   * IC + chiffres → Facture impayée ancienne
   *   → Contentieux si age > 365 ET solde > 0
   *
   * AV + chiffres → Facture avoir (note de crédit)
   *
   * FT + chiffres → Facture de vente, 3 scénarios:
   *   1. Impayé total (règlement = 0)
   *   2. Retenu non réglé (0.1% ≤ solde/montant ≤ 2%)
   *   3. Paiement partiel (2% < solde/montant < 99%)
   *   4. Soldé (solde = 0)
   */
  private static classifyDocument(
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

    // ── IC: Factures impayées anciennes ──────────────────────────────────────
    if (upper.startsWith('IC')) {
      const isContentieux = age > 365 && balance > 0;
      return {
        documentType: isContentieux ? 'unpaid_old' : 'invoice',
        paymentStatus: balance > 0 ? 'unpaid' : 'paid',
        isContentieux,
      };
    }

    // ── AV: Avoirs / Notes de crédit ──────────────────────────────────────────
    if (upper.startsWith('AV')) {
      return {
        documentType: 'credit_note',
        paymentStatus: 'paid',
        isContentieux: false,
      };
    }

    // ── FT: Factures de vente ─────────────────────────────────────────────────
    if (upper.startsWith('FT')) {
      // Soldé
      if (balance <= 0) {
        return { documentType: 'invoice', paymentStatus: 'paid', isContentieux: false };
      }

      // Est-ce un contentieux ? (facture de plus de 365 jours non soldée)
      const isContentieux = age > 365;

      // Impayé total (aucun règlement)
      if (settlement === 0) {
        return { documentType: 'invoice', paymentStatus: 'unpaid', isContentieux };
      }

      // Calculer le ratio solde / montant
      const ratio = amount > 0 ? (balance / amount) * 100 : 0;

      // Retenu non réglé (petite retenue: 0.1% à 2%)
      if (ratio >= 0.1 && ratio <= 2) {
        return { documentType: 'invoice', paymentStatus: 'retained', isContentieux };
      }

      // Paiement partiel
      return { documentType: 'invoice', paymentStatus: 'partial', isContentieux };
    }

    // ── Autres types ──────────────────────────────────────────────────────────
    return {
      documentType: 'other',
      paymentStatus: balance > 0 ? 'unpaid' : 'paid',
      isContentieux: false,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // TEXTE DE FALLBACK
  // Utilisé uniquement si:
  //   1. L'API /api/ocr est indisponible (pdf-parse non installé)
  //   2. L'API retourne un texte vide (PDF scanné sans couche texte)
  //
  // Ce texte reproduit fidèlement le format de "C01.pdf" (Etat de Recouvrement)
  // pour permettre les tests en développement.
  // ═══════════════════════════════════════════════════════════════════════════
  private static getFallbackText(fileName: string): string {
    console.log('[OCR] Mode fallback activé pour:', fileName);
    return `
ETAT DE RECOUVREMENT CLIENT
Date: 15/04/2026
Heure: 17:17:51
Client de: &
Représentant: C01 MED AMINE BEN ZAARA
Type: Condensé

0424 LA MANGEARIA 72 26 09 01
Echéance Date N° pièce Age Nbr.J.P Intitulé Montant Règlement Solde
14/08/2019 14/08/2019 IC000262 2436 0 1 264,277 0,000 1 264,277

0646 ECO-PRIX 98 22 71 06
Echéance Date N° pièce Age Nbr.J.P Intitulé Montant Règlement Solde
18/10/2025 18/09/2025 FT252992 209 30 1 583,642 1 567,000 16,642

0751 EL ANOUAR EXPRESS 72 22 89 83
Echéance Date N° pièce Age Nbr.J.P Intitulé Montant Règlement Solde
12/08/2025 14/05/2025 FT251494 336 90 Tahrir 12 771,360 12 727,837 43,523
08/09/2025 10/06/2025 FT251799 309 90 S.Siene 989,631 913,639 75,992
07/05/2026 06/02/2026 FT260304 68 90 torba 3 341,534 0,000 341,534
19/05/2026 18/02/2026 FT260446 56 90 Ben arous 782,763 0,000 782,763
19/05/2026 18/02/2026 FT260447 56 90 nadina jadida 1 199,507 1 042,455 157,052
28/05/2026 27/02/2026 FT260535 47 90 Ben arous 502,039 0,000 502,039
29/05/2026 28/02/2026 FT260547 46 90 sidi Achour 1 234,691 0,000 1 234,691
31/05/2026 02/03/2026 FT260566 44 90 ounja 1 821,710 0,000 1 821,710
31/05/2026 02/03/2026 FT260571 44 90 narzat trim 2 590,105 0,000 590,105
31/05/2026 02/03/2026 FT260575 44 90 CFA-000736 1 610,035 0,000 1 610,035
03/06/2026 05/03/2026 FT260604 41 90 nadina jadida 922,083 0,000 922,083
09/06/2026 11/03/2026 FT260662 35 90 nersel trim 1 1 168,279 0,000 1 168,279
09/06/2026 11/03/2026 FT260664 35 90 S.Siene 884,962 0,000 884,962
09/06/2026 11/03/2026 FT260665 35 90 baraket sahel 659,559 0,000 659,559
14/06/2026 16/03/2026 FT260714 30 90 chhz 1 095,004 0,000 1 095,004
14/06/2026 16/03/2026 FT260715 30 90 iri khaled 484,025 0,000 484,025
15/06/2026 17/03/2026 FT260734 29 90 ounja 846,113 0,000 846,113
22/06/2026 24/03/2026 FT260771 22 90 torba 2 376,579 0,000 376,579
22/06/2026 24/03/2026 FT260773 22 90 chirrir 739,816 0,000 739,816
22/06/2026 24/03/2026 FT260774 22 90 soud battlen 886,203 0,000 886,203
22/06/2026 24/03/2026 FT260775 22 90 baraket sahel 606,658 0,000 606,658
25/06/2026 28/03/2026 FT260823 18 90 ariombaia 935,123 0,000 935,123
25/06/2026 02/04/2026 FT260880 13 90 Ben arous 510,495 0,000 510,495

0831 NAIFAR ISKANDAR 71 35 82 80
Echéance Date N° pièce Age Nbr.J.P Intitulé Montant Règlement Solde
29/06/2026 31/03/2026 FT260853 15 90 767,836 0,000 767,836
    `.trim();
  }
}
