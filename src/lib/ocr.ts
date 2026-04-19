import Tesseract from 'tesseract.js';
import { ClientDebt } from '@/types/debt';

export class OCRService {
  static async extractTextFromPDF(file: File): Promise<string> {
    try {
      const result = await Tesseract.recognize(
        file,
        'fra',
        {
          logger: (m) => console.log(m),
        }
      );
      return result.data.text;
    } catch (error) {
      console.error('OCR Error:', error);
      throw new Error('Erreur lors de l\'extraction OCR du fichier');
    }
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
