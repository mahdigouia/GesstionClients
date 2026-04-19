import Tesseract from 'tesseract.js';
import { ClientDebt } from '@/types/debt';

declare global {
  interface Window {
    pdf2pic: any;
  }
}

export class OCRService {
  static async extractTextFromPDF(file: File): Promise<string> {
    try {
      console.log('Début OCR pour:', file.name, 'Type:', file.type, 'Taille:', (file.size / 1024 / 1024).toFixed(2), 'MB');
      
      // Vérifier si c'est un PDF
      if (file.type === 'application/pdf') {
        return await this.extractFromPDF(file);
      } else {
        // Pour les images, utiliser Tesseract directement
        return await this.extractFromImage(file);
      }
    } catch (error) {
      console.error('OCR Error:', error);
      throw new Error(`Erreur lors de l'extraction OCR du fichier ${file.name}: ${error instanceof Error ? error.message : 'Erreur inconnue'}`);
    }
  }

  private static async extractFromPDF(file: File): Promise<string> {
    try {
      console.log('Traitement du PDF multi-pages avec Tesseract...');
      console.log('Fichier:', file.name, 'Taille:', (file.size / 1024 / 1024).toFixed(2), 'MB');
      
      // Utiliser Tesseract directement sur le PDF avec gestion multi-pages
      const reader = new FileReader();
      
      return new Promise((resolve, reject) => {
        reader.onload = async () => {
          try {
            const typedArray = new Uint8Array(reader.result as ArrayBuffer);
            
            // Paramètres optimisés pour les documents financiers multi-pages
            const ocrOptions = {
              logger: (m: any) => {
                if (m.status === 'recognizing text') {
                  const progress = Math.round(m.progress * 100);
                  console.log(`Progression OCR ${file.name}: ${progress}%`);
                  
                  // Afficher des détails sur la progression pour les documents longs
                  if (m.jobId) {
                    console.log(`Job ID: ${m.jobId}, Status: ${m.status}`);
                  }
                } else if (m.status === 'loading tesseract core') {
                  console.log('Chargement du moteur OCR...');
                } else if (m.status === 'initializing tesseract') {
                  console.log('Initialisation de Tesseract...');
                }
              },
              // Paramètres optimisés pour les documents financiers français
              tessedit_ocr_engine_mode: '3', // LSTM OCR Engine
              tessedit_pageseg_mode: '6', // Mode segmentation de page
              preserve_interword_spaces: '1',
              tessedit_char_whitelist: '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyzàâäéèêëïîôöùûçÀÂÄÄÉÈÊËÏÎÔÖÙÛÇ%.,/-()',
              tessedit_language: 'fra',
              // Paramètres pour améliorer la reconnaissance de tableaux et nombres
              tessedit_create_hocr: '0',
              tessedit_create_tsv: '0',
              tessedit_create_box: '0',
              tessedit_create_unlv: '0',
              tessedit_create_txt: '1',
              // Optimisation pour les documents de grande taille
              tessedit_zero_rejection: '0',
              tessedit_zero_rejection_mode: '0',
              // Paramètres pour les nombres et montants
              tessedit_number_mode: '1',
              tessedit_reject_mode: '0',
            };
            
            console.log('Démarrage de l\'OCR pour le document multi-pages...');
            const startTime = Date.now();
            
            const result = await Tesseract.recognize(
              typedArray,
              'fra',
              ocrOptions
            );
            
            const endTime = Date.now();
            const processingTime = ((endTime - startTime) / 1000).toFixed(2);
            
            console.log(`OCR terminé en ${processingTime}s`);
            console.log('Texte extrait du PDF:', result.data.text.length, 'caractères');
            
            // Analyser la qualité de l'extraction
            const lines = result.data.text.split('\n').filter(line => line.trim().length > 0);
            console.log('Nombre de lignes extraites:', lines.length);
            
            // Si trop peu de texte, essayer avec des paramètres alternatifs
            if (lines.length < 10) {
              console.log('Texte trop court, tentative avec paramètres alternatifs...');
              
              const altResult = await Tesseract.recognize(
                typedArray,
                'fra',
                {
                  ...ocrOptions,
                  tessedit_pageseg_mode: '11', // Mode sparse text
                  tessedit_ocr_engine_mode: '1', // Legacy engine
                }
              );
              
              if (altResult.data.text.length > result.data.text.length) {
                console.log('Meilleur résultat avec paramètres alternatifs');
                resolve(altResult.data.text);
                return;
              }
            }
            
            resolve(result.data.text);
            
          } catch (ocrError) {
            console.error('Erreur OCR PDF:', ocrError);
            console.error('Détails de l\'erreur:', ocrError);
            
            // Fallback: retourner un texte de test pour le développement
            if (typeof window !== 'undefined' && window.process?.env?.NODE_ENV === 'development') {
              const fallbackText = this.getFallbackText(file.name);
              console.log('Utilisation du fallback texte pour le développement');
              resolve(fallbackText);
            } else {
              reject(ocrError);
            }
          }
        };
        
        reader.onerror = () => {
          console.error('Erreur lecture fichier PDF');
          reject(new Error('Erreur lecture fichier PDF'));
        };
        reader.readAsArrayBuffer(file);
      });
      
    } catch (error) {
      console.error('Erreur extraction PDF:', error);
      // Fallback: retourner un texte de test pour le développement
      if (typeof window !== 'undefined' && window.process?.env?.NODE_ENV === 'development') {
        return this.getFallbackText(file.name);
      }
      throw error;
    }
  }

  private static async convertPDFToImages(file: File): Promise<ImageData[]> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = async () => {
        try {
          const typedArray = new Uint8Array(reader.result as ArrayBuffer);
          
          // Solution alternative : utiliser directement Tesseract sur le PDF
          // Tesseract.js peut maintenant traiter les PDF directement
          console.log('Traitement direct du PDF avec Tesseract...');
          
          try {
            const result = await Tesseract.recognize(
              typedArray,
              'fra',
              {
                logger: (m: any) => {
                  if (m.status === 'recognizing text') {
                    console.log('Progression OCR PDF direct:', Math.round(m.progress * 100), '%');
                  }
                },
                // Paramètres optimisés pour les PDF
                tessedit_ocr_engine_mode: '3', // LSTM OCR Engine
                tessedit_pageseg_mode: '6', // Mode segmentation de page
                preserve_interword_spaces: '1',
                tessedit_char_whitelist: '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyzàâääéèêëïîôöùûçÀÂÄÄÉÈÊËÏÎÔÖÙÛÇ%.,/-()',
              }
            );
            
            console.log('Texte extrait directement du PDF:', result.data.text.length, 'caractères');
            
            // Retourner le texte extrait directement
            resolve([{
              data: result.data.text,
              width: 1000,
              height: 1000
            }]);
            
          } catch (ocrError) {
            console.error('Erreur OCR direct:', ocrError);
            // Fallback: retourner un texte de test pour le développement
            if (typeof window !== 'undefined' && window.process?.env?.NODE_ENV === 'development') {
              const fallbackText = this.getFallbackText(file.name);
              console.log('Utilisation du fallback texte');
              resolve([{
                data: fallbackText,
                width: 1000,
                height: 1000
              }]);
            } else {
              reject(ocrError);
            }
          }
          
        } catch (error) {
          reject(error);
        }
      };
      
      reader.onerror = () => reject(new Error('Erreur lecture fichier'));
      reader.readAsArrayBuffer(file);
    });
  }

  private static async extractFromImage(file: File): Promise<string> {
    try {
      const result = await Tesseract.recognize(
        file,
        'fra',
        {
          logger: (m) => {
            if (m.status === 'recognizing text') {
              console.log('Progression OCR Image:', Math.round(m.progress * 100), '%');
            }
          },
        }
      );
      
      console.log('Texte extrait de l\'image:', result.data.text.length, 'caractères');
      return result.data.text;
    } catch (error) {
      console.error('Erreur extraction image:', error);
      if (process.env.NODE_ENV === 'development') {
        return this.getFallbackText(file.name);
      }
      throw error;
    }
  }

  // Texte de fallback pour le développement et les tests (simulant un document de 9 pages)
  private static getFallbackText(fileName: string): string {
    console.log('Utilisation du texte de fallback pour:', fileName);
    return `
ETAT DE RECOUVREMENT CLIENT
Date: 15/03/2024
Période: 01/01/2024 - 31/03/2024

0424 LA MANGEARIA 06 12 34 56 78
15/01/2024 15/01/2024 FC001 30 15 FACTURE VENTE MATERIEL 1500.00 500.00 1000.00
15/02/2024 15/02/2024 FC002 45 20 FACTURE CONSULTATION 800.00 200.00 600.00
15/03/2024 15/03/2024 FC003 60 30 FACTURE MAINTENANCE 1200.00 400.00 800.00

0646 ECO-PRIX 06 98 76 54
20/01/2024 20/01/2024 FC004 90 45 FACTURE PRODUITS 2000.00 800.00 1200.00
10/02/2024 10/02/2024 FC005 120 60 FACTURE SERVICES 1800.00 600.00 1200.00
05/03/2024 05/03/2024 FC006 150 75 FACTURE EQUIPEMENT 2500.00 1000.00 1500.00

0751 EL ANOUAR EXPRESS 07 120 90 180
25/01/2024 25/01/2024 FC007 180 90 FACTURE LIVRAISON 3500.00 1000.00 2500.00
05/02/2024 05/02/2024 FC008 210 105 FACTURE TRANSPORT 800.00 300.00 500.00
10/03/2024 10/03/2024 FC009 240 120 FACTURE LOGISTIQUE 1500.00 500.00 1000.00

0831 NAIFAR ISKANDAR (FEMA) 07 234 567 890
01/02/2024 01/02/2024 FC010 270 135 FACTURE IMPORT 5000.00 2000.00 3000.00
15/02/2024 15/02/2024 FC011 300 150 FACTURE DOUANE 1200.00 400.00 800.00
01/03/2024 01/03/2024 FC012 330 165 FACTURE STOCKAGE 800.00 200.00 600.00

0992 STE SOCIETE GENERALE 07 345 678 901
10/01/2024 10/01/2024 FC013 360 180 FACTURE BANCAIRE 3000.00 1500.00 1500.00
20/02/2024 20/02/2024 FC014 390 195 FACTURE COMMISSION 800.00 400.00 400.00
15/03/2024 15/03/2024 FC015 420 210 FACTURE FRAIS 600.00 300.00 300.00

1123 MONOPRIX 07 456 789 012
05/01/2024 05/01/2024 FC016 450 225 FACTURE APPROVISIONNEMENT 8000.00 4000.00 4000.00
25/01/2024 25/01/2024 FC017 480 240 FACTURE LIVRAISON 2000.00 1000.00 1000.00
20/02/2024 20/02/2024 FC018 510 255 FACTURE STOCK 3000.00 1500.00 1500.00

1456 CARREFOUR 07 567 890 123
12/01/2024 12/01/2024 FC019 540 270 FACTURE HYPERMARCHE 12000.00 6000.00 6000.00
15/02/2024 15/02/2024 FC020 570 285 FACTURE PROMOTION 3000.00 1500.00 1500.00
10/03/2024 10/03/2024 FC021 600 300 FACTURE MARKETING 1500.00 500.00 1000.00

1789 AFRICAN LEADER 07 678 901 234
18/01/2024 18/01/2024 FC022 630 315 FACTURE TRANSPORT AERIEN 15000.00 5000.00 10000.00
22/02/2024 22/02/2024 FC023 660 330 FACTURE FRET 8000.00 3000.00 5000.00
05/03/2024 05/03/2024 FC024 690 345 FACTURE LOGISTIQUE 4000.00 2000.00 2000.00

2010 STE TUNISIE TELECOM 07 789 012 345
08/01/2024 08/01/2024 FC025 720 360 FACTURE TELECOMMUNICATION 2000.00 1000.00 1000.00
28/01/2024 28/01/2024 FC026 750 375 FACTURE INTERNET 800.00 400.00 400.00
18/02/2024 18/02/2024 FC027 780 390 FACTURE MOBILE 1200.00 600.00 600.00

TOTAL GENERAL: 24 créances
Montant total: 95,400.00
Montant payé: 38,200.00
Solde restant: 57,200.00
    `.trim();
  }

  static parseDebtData(ocrText: string, fileName: string): ClientDebt[] {
    const lines = ocrText.split('\n').filter(line => line.trim());
    const debts: ClientDebt[] = [];
    
    // Détecter les sections clients avec le pattern: CODE NOM
    const clientHeaderPattern = /^(\d{4})\s+([A-Z\s\-\']+)(?:\s+(\d{2,}\s*\d{2,}\s*\d{2,}\s*\d{2,}))?/gm;
    
    let currentClient: { code: string; name: string; phone?: string } | null = null;
    let id = 1;
    
    // Parcourir les lignes pour identifier les clients et leurs données
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Vérifier si c'est un en-tête de client
      const clientMatch = line.match(/^(\d{4})\s+([A-Z\s\-\']+)(?:\s+(\d{2,}\s*\d{2,}\s*\d{2,}\s*\d{2,}))?/);
      if (clientMatch) {
        currentClient = {
          code: clientMatch[1],
          name: clientMatch[2].trim(),
          phone: clientMatch[3] ? clientMatch[3].replace(/\s/g, '') : undefined
        };
        continue;
      }
      
      // Vérifier si c'est une ligne de données (contient des dates et montants)
      if (currentClient && this.isDataRow(line)) {
        try {
          const debtData = this.parseDataRow(line, currentClient, fileName, id++);
          if (debtData) {
            debts.push(debtData);
          }
        } catch (error) {
          console.warn('Erreur lors du parsing d\'une ligne:', line, error);
        }
      }
    }
    
    return debts;
  }

  private static isDataRow(line: string): boolean {
    // Une ligne de données contient généralement une date et des montants
    return /\d{2}[\/\-]\d{2}[\/\-]\d{2,4}/.test(line) && 
           /\d+,\d{2}/.test(line) &&
           line.length > 20;
  }

  private static parseDataRow(line: string, client: any, fileName: string, id: number): ClientDebt | null {
    // Pattern plus flexible pour capturer les colonnes: Echéance | Date | N° pièce | Age | Nbr.J.P | Intitulé | Montant | Règlement | Solde
    const patterns = [
      // Pattern principal
      /(\d{2}[\/\-]\d{2}[\/\-]\d{2,4})\s+(\d{2}[\/\-]\d{2}[\/\-]\d{2,4})\s+(\w+)\s+(\d+)\s+(\d+)\s+([A-Z0-9\s\-\(\)\.\/]+?)\s+([\d\s,\.]+)\s+([\d\s,\.]+)\s+([\d\s,\.]+)/i,
      // Pattern alternatif si le premier échoue
      /(\d{2}[\/\-]\d{2}[\/\-]\d{2,4})\s+(\d{2}[\/\-]\d{2}[\/\-]\d{2,4})\s+(\w+)\s+(\d+)\s+([\d\s,\.]+?)\s+([A-Z0-9\s\-\(\)\.\/]+?)\s+([\d\s,\.]+)\s+([\d\s,\.]+)\s+([\d\s,\.]+)/i
    ];

    for (const pattern of patterns) {
      const match = line.match(pattern);
      if (match) {
        const [, dueDate, docDate, docNumber, age, paymentDays, description, amountStr, settlementStr, balanceStr] = match;
        
        const amount = this.parseAmount(amountStr);
        const settlement = this.parseAmount(settlementStr);
        const balance = this.parseAmount(balanceStr);
        const ageDays = parseInt(age);
        const paymentDaysNum = parseInt(paymentDays);
        
        return {
          id: `debt_${id}`,
          clientCode: client.code,
          clientName: client.name,
          clientPhone: client.phone,
          dueDate: this.parseDate(dueDate),
          documentDate: this.parseDate(docDate),
          documentNumber: docNumber.trim(),
          age: ageDays,
          paymentDays: paymentDaysNum,
          description: description.trim(),
          amount,
          settlement,
          balance,
          riskLevel: this.classifyRisk(ageDays, balance > 0),
          sourceFile: fileName
        };
      }
    }
    
    return null;
  }

  private static parseAmount(amountStr: string): number {
    return parseFloat(amountStr.replace(/\s/g, '').replace(',', '.'));
  }

  private static parseDate(dateStr: string): string {
    // Normaliser différents formats de date
    const normalized = dateStr.replace(/[\/\-]/g, '/');
    const parts = normalized.split('/');
    
    if (parts.length === 3) {
      // Tenter de déterminer le format (DD/MM/YYYY ou MM/DD/YYYY)
      const day = parseInt(parts[0]);
      const month = parseInt(parts[1]);
      const year = parseInt(parts[2]);
      
      // Si le jour > 12, c'est probablement DD/MM/YYYY
      if (day > 12) {
        return `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
      } else {
        // Sinon, supposer MM/DD/YYYY
        return `${year}-${day.toString().padStart(2, '0')}-${month.toString().padStart(2, '0')}`;
      }
    }
    
    return dateStr;
  }

  private static classifyRisk(agingDays: number, hasBalance: boolean): 'healthy' | 'monitoring' | 'overdue' | 'critical' {
    if (!hasBalance) return 'healthy';
    
    if (agingDays <= 30) return 'healthy';
    if (agingDays <= 90) return 'monitoring';
    if (agingDays <= 365) return 'overdue';
    return 'critical';
  }
}
