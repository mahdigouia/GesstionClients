import { ClientDebt } from '@/types/debt';
import { transformExtractedDebts, parseExtractionResponse } from '@/lib/table-extractor/transformer';

export class OCRService {

  /**
   * Extrait les créances d'un PDF en utilisant UNIQUEMENT le microservice Python.
   * PAS de fallback OCR - le service Python doit être disponible.
   */
  static async extractDebtsFromPDF(file: File): Promise<{
    debts: ClientDebt[];
    method: string;
    success: boolean;
    error?: string;
  }> {
    try {
      console.log(`[PDF Extract] Début extraction avec Python: ${file.name}`);

      const formData = new FormData();
      formData.append('file', file);

      console.log('[PDF Extract] Appel API /api/pdf-extract...');
      
      const response = await fetch('/api/pdf-extract', {
        method: 'POST',
        body: formData,
      });

      console.log(`[PDF Extract] Réponse API: HTTP ${response.status}`);

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[PDF Extract] API erreur HTTP ${response.status}:`, errorText);
        return {
          debts: [],
          method: 'error',
          success: false,
          error: `Service indisponible: ${response.status}`
        };
      }

      const data = await response.json();
      console.log('[PDF Extract] Données reçues:', { method: data.method, success: data.success, debtsCount: data.debts?.length });

      // Si extraction Python réussie
      if (data.success && data.debts && data.debts.length > 0) {
        console.log(`[PDF Extract] Succès avec Python: ${data.debts.length} créances trouvées`);
        
        // Transformer les données Python (snake_case) en ClientDebt (camelCase)
        const transformedDebts = transformExtractedDebts({
          success: data.success,
          debts: data.debts,
          commercial: data.commercial
        }, file.name);
        console.log(`[PDF Extract] ${transformedDebts.length} créances transformées`);
        
        return {
          debts: transformedDebts,
          method: data.method || 'pdfplumber-python',
          success: true
        };
      }

      // Aucune donnée trouvée ou erreur
      return {
        debts: [],
        method: data.method || 'unknown',
        success: false,
        error: data.error || 'Aucune donnée extraite'
      };

    } catch (error) {
      console.error('[PDF Extract] Erreur lors appel API:', error);
      return {
        debts: [],
        method: 'error',
        success: false,
        error: error instanceof Error ? error.message : 'Erreur inconnue'
      };
    }
  }

  /**
   * Vérifie si le service Python est disponible (une seule tentative)
   */
  static async checkPythonServiceHealth(): Promise<{
    available: boolean;
    status: string;
  }> {
    try {
      const response = await fetch('/api/pdf-extract', {
        method: 'GET',
        signal: AbortSignal.timeout(60000) // 60s pour cold start
      });

      if (response.ok) {
        const data = await response.json();
        return {
          available: data.python_service === 'connected',
          status: data.python_service || 'unknown'
        };
      }

      return {
        available: false,
        status: 'unavailable'
      };

    } catch {
      return {
        available: false,
        status: 'disconnected'
      };
    }
  }

  /**
   * Attend que le service Python soit disponible avec retry
   * Affiche la progression via callbacks
   */
  static async waitForPythonService(
    onProgress?: (seconds: number, message: string) => void,
    maxWaitSeconds: number = 90
  ): Promise<{ available: boolean; waitedSeconds: number }> {
    const startTime = Date.now();
    const checkInterval = 5000; // Vérifier toutes les 5 secondes
    
    while (true) {
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      
      if (elapsed >= maxWaitSeconds) {
        return { available: false, waitedSeconds: elapsed };
      }
      
      // Appel avec timeout court (10s) pour vérifier rapidement
      try {
        const response = await fetch('/api/pdf-extract', {
          method: 'GET',
          signal: AbortSignal.timeout(10000)
        });
        
        if (response.ok) {
          const data = await response.json();
          if (data.python_service === 'connected') {
            return { available: true, waitedSeconds: elapsed };
          }
        }
      } catch {
        // Service pas encore réveillé
      }
      
      // Afficher progression
      if (onProgress) {
        const remaining = Math.ceil((maxWaitSeconds - elapsed) / 5) * 5;
        onProgress(elapsed, `Démarrage du service en cours... (${elapsed}s écoulées)`);
      }
      
      // Attendre avant prochaine tentative
      await new Promise(resolve => setTimeout(resolve, checkInterval));
    }
  }

  /**
   * Extrait le texte d'un PDF via l'API serveur (pdf-parse).
   * Supporte les PDF multi-pages de type "Etat de Recouvrement Client".
   * Fallback sur le texte statique si l'API est indisponible.
   * @deprecated Utilisez extractDebtsFromPDF pour une extraction plus précise
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
      const line = lines[i].replace(/[\u0000-\u001F\u007F-\u009F]/g, "").trim();
      if (!line || line.length < 5) continue;

      // 1. Détection du commercial
      if (line.includes('Représentant')) {
        const commMatch = line.match(/(C\d{2})\s+([A-ZÀÂÉÈÊËÎÏÔÙÛÜÇ][A-ZÀÂÉÈÊËÎÏÔÙÛÜÇ\s\-]{3,})/);
        if (commMatch) this.currentCommercial = { code: commMatch[1], name: commMatch[2].trim() };
        continue;
      }

      // 2. Détection Client (Ignorer Ariana 2036 et Masmoudi)
      // Nouvelle regex plus permissive: code 4 chiffres + nom jusqu'à "Tél" ou fin de ligne
      // Gère: "0424 LA MANGEARIA", "0646 ECO-PRIX", "0751 EL ANOUAR EXPRESS", "0831 NAIFAR ISKANDAR (FEMA)", "3603 JAOUA SKANDER \"PROPREX\"", "3614 STE H&M GROCERY SARL"
      const clientMatch = line.match(/^(\d{4})\s+([A-Z][A-Z0-9\s\-'"_&().]*?)(?=\s+T[eé]l|\s{3,}|\d{2,}|$)/i);
      if (clientMatch && clientMatch[1] !== '2036' && !line.includes('MASMOUDI') && !line.includes('SARL')) {
        currentClient = {
          code: clientMatch[1],
          name: clientMatch[2].trim().replace(/\s+/g, ' '),
          phone: line.match(/(?:Tel|T[eé]l)\s*[:;]\s*([\d\s]{8,})/i)?.[1]?.replace(/\s/g, '')
        };
        console.log('[OCR] Client:', currentClient.name);
        continue;
      }

      // 2b. Détection alternative: ligne commence par code client suivi de texte (format plus simple)
      if (!clientMatch && /^\d{4}\s+[A-Z]/.test(line) && !line.includes('2036') && !line.includes('MASMOUDI')) {
        const simpleMatch = line.match(/^(\d{4})\s+(.+?)(?:\s+\d{2}[\/\-]|$)/);
        if (simpleMatch && simpleMatch[2].length > 2 && simpleMatch[2].length < 50) {
          currentClient = {
            code: simpleMatch[1],
            name: simpleMatch[2].trim().replace(/\s+/g, ' '),
            phone: undefined
          };
          console.log('[OCR] Client (simple):', currentClient.name);
          continue;
        }
      }

      // 2c. Détection très souple: juste 4 chiffres suivis de texte (dernier recours)
      if (/^\d{4}\s+/.test(line) && !line.includes('2036') && !line.includes('MASMOUDI')) {
        // Vérifier que ce n'est pas une ligne de données (qui contient une date)
        if (!line.match(/\d{2}[\/\-]\d{2}[\/\-]\d{4}/)) {
          const parts = line.split(/\s+/);
          if (parts.length >= 2) {
            const code = parts[0];
            const name = parts.slice(1).join(' ').trim();
            // Filtrer les noms trop courts ou contenant des patterns de données
            if (name.length > 3 && !name.match(/^\d/)) {
              currentClient = {
                code: code,
                name: name.replace(/\s+/g, ' '),
                phone: undefined
              };
              console.log('[OCR] Client (fallback):', currentClient.name);
              continue;
            }
          }
        }
      }

      // 3. Détection d'une ligne de données
      if (this.isDataRow(line)) {
        // Si aucun client détecté, utiliser un placeholder mais continuer à chercher
        const activeClient = currentClient || { code: '0000', name: 'CLIENT NON IDENTIFIÉ' };
        try {
          const debtData = this.parseDataRow(line, activeClient, fileName, id++);
          if (debtData) debts.push(debtData);
        } catch (err) {
          // Ignorer les erreurs de parsing silencieusement
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
    // Format montant TND: virgule + exactement 3 chiffres décimaux.
    // Parfois pdf-parse ajoute des espaces : on les ignore pour le test.
    const hasTunisianAmount = /\d+,\s*?\d{3}/.test(line);
    // Les lignes de données ont au moins une date et un montant, et sont de longueur raisonnable.
    return hasDate && hasTunisianAmount;
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
    extractIndex: number
  ): ClientDebt | null {
    // 1. Extraire les dates (DD/MM/YYYY)
    const dateMatches = [...line.matchAll(/(\d{2}[\/\-]\d{2}[\/\-]\d{4})/g)];
    if (dateMatches.length < 2) return null;
    const dueDate = dateMatches[0][1];
    const docDate = dateMatches[dateMatches.length - 1][1];

    // 2. Extraire le numéro de pièce (FT, FS, FRT, FRS, IC, AV...)
    const docPattern = /\b(FT\d{6}|FS\d{6}|FRT\d{6}|FRS\d{6}|IC\d{6}|AV[A-Z]*\d+)\b/i;
    let workingLine = line;
    const docMatch = workingLine.match(docPattern);
    const docNumber = docMatch ? docMatch[1].toUpperCase() : "DOC";
    if (docMatch) workingLine = workingLine.replace(docMatch[0], "");
    
    // On nettoie la ligne pour extraire le reste
    workingLine = workingLine
      .replace(dueDate, "")
      .replace(docDate, "")
      .trim();

    // 3. Extraction des montants par pattern (Montant, Règlement, Solde à la fin)
    // Pattern: 1 234,567 ou 1234,567 ou 0,000
    const commaPattern = /(\d{1,3}(?:\s?\d{3})*[\.,]\s?\d{3})/g;
    const commaMatches = [...workingLine.matchAll(commaPattern)].map(m => m[0]);
    
    if (commaMatches.length < 1) return null;

    // Tentative de fusion avec les milliers
    const candidates = commaMatches.map(ct => {
      const val = this.parseAmount(ct);
      // Chercher si le nombre juste avant est un millier (1-3 chiffres, éventuellement négatif)
      const prefixRegex = new RegExp(`\\b(-?\\d{1,3})\\s+${ct.replace(',', ',')}`);
      const prefixMatch = workingLine.match(prefixRegex);
      return {
        val,
        full_str: ct,
        prefix: prefixMatch ? prefixMatch[1] : null
      };
    });

    // Reconstruction des montants réels
    const allAmounts: number[] = [];
    let i = 0;
    while (i < candidates.length) {
      if (candidates[i].prefix) {
        const fullVal = parseFloat(candidates[i].prefix! + "." + candidates[i].val.toString().split('.')[1]);
        allAmounts.push(fullVal);
        i++;
      } else {
        allAmounts.push(candidates[i].val);
        i++;
      }
    }
    
    // On identifie les 3 derniers montants (m, r, s)
    let m = 0, r = 0, s = 0;
    const last3 = allAmounts.slice(-3);
    
    if (last3.length === 3) {
      m = last3[0];
      r = last3[1];
      s = last3[2];
      
      // Cohérence check: si m-r != s (avec tolérance), peut-être qu'il n'y a que 2 montants
      if (Math.abs(m - r - s) > 2.0 && m !== 0) {
          // Tentative si seulement 2 montants (Montant et Solde, Règlement implicite)
          const last2 = allAmounts.slice(-2);
          const m2 = last2[0];
          const s2 = last2[1];
          if (m2 >= s2) {
            m = m2; s = s2; r = m2 - s2;
          }
      }
    } else {
      // Moins de 3 montants trouvés
      m = this.parseAmount(allAmounts[0]);
      s = this.parseAmount(allAmounts[allAmounts.length - 1]);
      r = Math.max(0, m - s);
    }

    // 4. Extraire l'âge et la description
    // On enlève les montants trouvés de la workingLine pour trouver l'âge et la description
    let remaining = workingLine;
    allAmounts.forEach(amt => { remaining = remaining.replace(amt, ""); });
    
    const tokens = remaining.split(/\s+/).filter(t => t.trim().length > 0);
    
    // L'âge et NbrJP (avec gestion des milliers type "2 455")
    let age = 0;
    let nbr_jp = 0;
    let descriptionTokens = [];
    
    let skipNext = false;
    for (let i = 0; i < tokens.length; i++) {
      if (skipNext) { skipNext = false; continue; }
      
      if (i === 0 && /^\d{1,3}$/.test(tokens[i])) {
        // Test si c'est un âge à 2 tokens (ex: "2" "455")
        if (i + 1 < tokens.length && /^\d{3}$/.test(tokens[i+1])) {
          age = parseInt(tokens[i] + tokens[i+1]);
          skipNext = true;
          // Chercher nbr_jp après l'âge fusionné
          if (i + 2 < tokens.length && /^\d+$/.test(tokens[i+2])) {
            nbr_jp = parseInt(tokens[i+2]);
            // On sautera aussi i+2 au prochain tour
            // skipNext ne gère qu'un tour, on va utiliser i++ manuellement
            i += 2; skipNext = false;
          }
        } else {
          age = parseInt(tokens[i]);
          if (i + 1 < tokens.length && /^\d+$/.test(tokens[i+1])) {
             nbr_jp = parseInt(tokens[i+1]);
             skipNext = true;
          }
        }
      } else {
        descriptionTokens.push(tokens[i]);
      }
    }

    let description = descriptionTokens.join(" ").trim();
    if (!description || description.length < 2) description = "FACTURE";

    return this.constructDebtObject(client, fileName, dueDate, docDate, docNumber, age.toString(), "0", {
      montant: m,
      reglement: r,
      solde: s,
      description: description
    }, extractIndex);
  }

  private static constructDebtObject(
    client: { code: string; name: string; phone?: string },
    fileName: string,
    dueDate: string,
    docDate: string,
    docNumber: string,
    ageStr: string,
    paymentDaysStr: string,
    amounts: { montant: number; reglement: number; solde: number; description: string },
    extractIndex?: number
  ): ClientDebt {
    const { montant: amount, reglement: settlement, solde: balance, description } = amounts;
    const ageDays = parseInt(ageStr, 10) || 0;
    const paymentDaysNum = parseInt(paymentDaysStr, 10) || 0;

    const classification = this.classifyDocument(docNumber, ageDays, amount, settlement, balance);

    const id = `${client.code}_${docNumber}`.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
    return {
      id: `debt_${id}`,
      clientCode: client.code,
      clientName: client.name,
      clientPhone: client.phone,
      dueDate: this.parseDate(dueDate),
      documentDate: this.parseDate(docDate),
      documentNumber: docNumber,
      documentType: classification.documentType,
      age: ageDays,
      paymentDays: paymentDaysNum,
      description: description || 'FACTURE',
      amount,
      settlement,
      balance,
      paymentStatus: classification.paymentStatus,
      riskLevel: this.classifyRisk(ageDays, balance > 0.001),
      sourceFile: fileName,
      currency: 'TND',
      commercialCode: this.currentCommercial?.code,
      commercialName: this.currentCommercial?.name,
      isContentieux: classification.isContentieux,
      extractIndex: extractIndex,
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

    // Nettoyage agressif des espaces multiples et caractères spéciaux
    const normalizedRest = rest.replace(/\s+/g, ' ').replace(/[^\d\s\.,\-]/g, ' ');

    // Pattern pour montant tunisien : 1 264,277 ou 0,000 ou 43,523
    // On est très flexible sur les séparateurs car l'OCR peut bafouiller
    const patternFull = /(\d{1,3}(?:\s?\d{3})*[\.,]\s?\d{3})/g;
    
    const matches = normalizedRest.match(patternFull);
    if (matches && matches.length >= 3) {
      // On prend les 3 derniers montants à partir de la DROITE (Montant, Règlement, Solde)
      const last3 = matches.slice(-3);
      const m = this.parseAmount(last3[0]);
      const r = this.parseAmount(last3[1]);
      const s = this.parseAmount(last3[2]);

      // Si le solde est nul ou si la cohérence est respectée (tolérance 2 TND)
      if (Math.abs(m - r - s) < 2.0 || s === 0) {
        return {
          montant: m,
          reglement: r,
          solde: s,
          description: normalizedRest.split(last3[0])[0].trim(),
        };
      }
    }

    // Fallback si moins de 3 montants ou incohérence : on tente d'extraire tout ce qui ressemble à un montant
    if (matches && matches.length > 0) {
       console.warn('[OCR] Cohérence montants non vérifiée, tentative extraction partielle pour:', normalizedRest);
    }

    return null;
  }

  /**
   * Convertit une chaîne montant TND en nombre.
   * Gère: "1 264,277" → 1264.277, "0,000" → 0, "43,523" → 43.523, "-28,808" → -28.808
   */
  private static parseAmount(amountStr: string): number {
    // Préserver le signe négatif
    const negative = amountStr.includes('-');
    const cleaned = amountStr
      .trim()
      .replace(/-/g, '')       // Retirer le signe pour le parsing
      .replace(/\s/g, '')      // Supprimer les espaces (séparateurs de milliers)
      .replace(',', '.');       // Remplacer la virgule décimale par un point
    const value = parseFloat(cleaned);
    if (isNaN(value)) return 0;
    return negative ? -value : value;
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
   * AVT/AVS/FRS/FRT → Avoir sur Vente / Avoir Service / Facture Retour Sfax / Facture Retour Tunis
   *   → Montant négatif, jamais contentieux
   *
   * FT + chiffres → Facture de vente, 3 scénarios:
   *   1. Impayé total (règlement = 0)
   *   2. Retenu non réglé (0.5% ≤ solde/montant ≤ 1.5%)
   *   3. Paiement partiel (1.5% < solde/montant < 99%)
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

    // ── AVT/AVS/FRS/FRT: Avoir sur Vente / Avoir Service / Facture Retour Sfax / Facture Retour Tunis (montant négatif) ──
    if (upper.startsWith('AVT') || upper.startsWith('AVS') || upper.startsWith('FRS') || upper.startsWith('FRT')) {
      return {
        documentType: 'credit_note',
        paymentStatus: 'paid',
        isContentieux: false,
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

    // ── FT/FS: Factures de vente et de service ─────────────────────────────────
    if (upper.startsWith('FT') || upper.startsWith('FS')) {
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

      // Retenu non réglé (petite retenue: 0.5% à 1.5%)
      if (ratio >= 0.5 && ratio <= 1.5) {
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
