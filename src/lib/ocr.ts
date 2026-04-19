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

  static parseDebtData(ocrText: string): ClientDebt[] {
    const lines = ocrText.split('\n').filter(line => line.trim());
    const debts: ClientDebt[] = [];
    
    // Pattern pour détecter les lignes de données clients
    // Format attendu: Code Client | Nom Client | N° Facture | Date | Montant | Payé | Solde | Âge
    const dataPattern = /([A-Z0-9]{3,10})\s+([A-Za-z\s]+)\s+(\d{6,10})\s+(\d{2}[\/\-]\d{2}[\/\-]\d{2,4})\s+([\d\s,\.]+)\s+([\d\s,\.]+)\s+([\d\s,\.]+)\s+(\d+)/gi;
    
    let match;
    let id = 1;
    
    while ((match = dataPattern.exec(ocrText)) !== null) {
      try {
        const [, clientCode, clientName, invoiceNumber, invoiceDate, amountStr, paidStr, balanceStr, agingStr] = match;
        
        // Nettoyage et conversion des nombres
        const amount = this.parseAmount(amountStr);
        const paid = this.parseAmount(paidStr);
        const balance = this.parseAmount(balanceStr);
        const agingDays = parseInt(agingStr);
        
        // Validation de la cohérence
        const calculatedBalance = amount - paid;
        const finalBalance = Math.abs(balance - calculatedBalance) < 0.01 ? calculatedBalance : balance;
        
        const debt: ClientDebt = {
          id: `debt_${id++}`,
          clientCode: clientCode.trim(),
          clientName: clientName.trim(),
          invoiceNumber: invoiceNumber.trim(),
          invoiceDate: this.parseDate(invoiceDate),
          amount,
          paid,
          balance: finalBalance,
          agingDays,
          riskLevel: this.classifyRisk(agingDays, finalBalance > 0)
        };
        
        debts.push(debt);
      } catch (error) {
        console.warn('Erreur lors du parsing d\'une ligne:', match[0], error);
      }
    }
    
    return debts;
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
