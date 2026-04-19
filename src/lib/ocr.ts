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
      console.log('Conversion du PDF en images...');
      
      // Convertir le PDF en images
      const images = await this.convertPDFToImages(file);
      console.log('PDF converti en', images.length, 'images');
      
      let allText = '';
      
      // Traiter chaque image avec OCR
      for (let i = 0; i < images.length; i++) {
        console.log(`Traitement de l'image ${i + 1}/${images.length}...`);
        
        try {
          const result = await Tesseract.recognize(
            images[i],
            'fra',
            {
              logger: (m: any) => {
                if (m.status === 'recognizing text') {
                  console.log(`Progression OCR Image ${i + 1}:`, Math.round(m.progress * 100), '%');
                }
              },
            }
          );
          
          const pageText = result.data.text;
          console.log(`Texte extrait de l'image ${i + 1}:`, pageText.length, 'caractères');
          allText += pageText + '\n';
          
        } catch (error) {
          console.error(`Erreur OCR image ${i + 1}:`, error);
          // Continuer avec les autres images même si une échoue
        }
      }
      
      console.log('Texte total extrait du PDF:', allText.length, 'caractères');
      return allText;
      
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
          
          // Utiliser pdf2pic pour convertir le PDF
          if (typeof window !== 'undefined' && window.pdf2pic) {
            window.pdf2pic(typedArray, {
              outputType: 'image',
              outputFormat: 'png',
              density: 200, // Qualité améliorée
              pages: 'all'
            }).then((images: any[]) => {
              console.log('PDF converti avec succès en', images.length, 'images');
              resolve(images.map(img => img.data));
            }).catch((error: any) => {
              console.error('Erreur conversion PDF:', error);
              reject(error);
            });
          } else {
            // Fallback si pdf2pic n'est pas disponible
            console.error('pdf2pic n\'est pas disponible');
            reject(new Error('pdf2pic library not available'));
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

  // Texte de fallback pour le développement et les tests
  private static getFallbackText(fileName: string): string {
    console.log('Utilisation du texte de fallback pour:', fileName);
    return `
0424 LA MANGEARIA 06 12 34 56 78
15/01/2024 15/01/2024 FC001 30 15 FACTURE VENTE MATERIEL 1500.00 500.00 1000.00
15/02/2024 15/02/2024 FC002 45 20 FACTURE CONSULTATION 800.00 200.00 600.00

0646 ECO-PRIX 06 98 76 54
20/01/2024 20/01/2024 FC003 60 30 FACTURE PRODUITS 2000.00 800.00 1200.00
10/02/2024 10/02/2024 FC004 90 45 FACTURE SERVICES 1200.00 400.00 800.00

0751 EL ANOUAR EXPRESS 07 120 90 180
25/01/2024 25/01/2024 FC005 180 90 FACTURE LIVRAISON 3500.00 1000.00 2500.00
05/02/2024 05/02/2024 FC006 210 105 FACTURE TRANSPORT 800.00 300.00 500.00
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
