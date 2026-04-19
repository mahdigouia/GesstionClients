import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { ClientDebt, AnalysisResult } from '@/types/debt';

export class ExportService {
  static async exportToExcel(debts: ClientDebt[], analysis?: AnalysisResult): Promise<void> {
    const workbook = XLSX.utils.book_new();

    // Feuille des créances
    const debtsData = debts.map(debt => ({
      'Code Client': debt.clientCode,
      'Nom Client': debt.clientName,
      'Numéro Facture': debt.invoiceNumber,
      'Date Facture': new Date(debt.invoiceDate).toLocaleDateString('fr-FR'),
      'Montant Facture': debt.amount,
      'Montant Payé': debt.paid,
      'Solde Restant': debt.balance,
      'Âge Créance (jours)': debt.agingDays,
      'Niveau Risque': this.getRiskLabel(debt.riskLevel)
    }));

    const debtsSheet = XLSX.utils.json_to_sheet(debtsData);
    XLSX.utils.book_append_sheet(workbook, debtsSheet, 'Créances');

    // Feuille d'analyse si disponible
    if (analysis) {
      const analysisData = [
        { 'Indicateur': 'Total Créances', 'Valeur': analysis.totalDebts.toFixed(2) + '€' },
        { 'Indicateur': 'Total Payé', 'Valeur': analysis.totalPaid.toFixed(2) + '€' },
        { 'Indicateur': 'Solde Restant', 'Valeur': analysis.totalBalance.toFixed(2) + '€' },
        { 'Indicateur': 'Taux Recouvrement', 'Valeur': analysis.recoveryRate.toFixed(1) + '%' },
        { 'Indicateur': 'Nombre de Clients', 'Valeur': analysis.clientBreakdown.length },
        { 'Indicateur': 'Alertes Critiques', 'Valeur': analysis.alerts.filter(a => a.severity === 'high').length }
      ];

      const analysisSheet = XLSX.utils.json_to_sheet(analysisData);
      XLSX.utils.book_append_sheet(workbook, analysisSheet, 'Analyse');

      // Feuille des alertes
      if (analysis.alerts.length > 0) {
        const alertsData = analysis.alerts.map(alert => ({
          'Client': alert.clientName,
          'Type': this.getAlertTypeLabel(alert.type),
          'Message': alert.message,
          'Sévérité': alert.severity,
          'Recommandation': alert.recommendation
        }));

        const alertsSheet = XLSX.utils.json_to_sheet(alertsData);
        XLSX.utils.book_append_sheet(workbook, alertsSheet, 'Alertes');
      }
    }

    // Générer et télécharger le fichier
    const fileName = `gestion-creances-${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(workbook, fileName);
  }

  static async exportToPDF(elementId: string, fileName?: string): Promise<void> {
    const element = document.getElementById(elementId);
    if (!element) {
      throw new Error('Élément non trouvé pour l\'export PDF');
    }

    const canvas = await html2canvas(element, {
      scale: 2,
      useCORS: true,
      allowTaint: true
    });

    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF('p', 'mm', 'a4');
    
    const imgWidth = 210; // A4 width in mm
    const pageHeight = 297; // A4 height in mm
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    let heightLeft = imgHeight;
    let position = 0;

    // Add first page
    pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;

    // Add additional pages if needed
    while (heightLeft >= 0) {
      position = heightLeft - imgHeight;
      pdf.addPage();
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
    }

    const defaultFileName = `rapport-creances-${new Date().toISOString().split('T')[0]}.pdf`;
    pdf.save(fileName || defaultFileName);
  }

  static generateReport(debts: ClientDebt[], analysis: AnalysisResult): string {
    const reportDate = new Date().toLocaleDateString('fr-FR');
    
    let report = `
RAPPORT D'ANALYSE DES CRÉANCES CLIENTS
Généré le: ${reportDate}

=====================================
RÉSUMÉ EXÉCUTIF
=====================================
Total des créances: ${analysis.totalDebts.toFixed(2)}€
Total payé: ${analysis.totalPaid.toFixed(2)}€
Solde restant: ${analysis.totalBalance.toFixed(2)}€
Taux de recouvrement: ${analysis.recoveryRate.toFixed(1)}%
Nombre de clients: ${analysis.clientBreakdown.length}

=====================================
RÉPARTITION PAR ANCIENNETÉ
=====================================
`;
    
    analysis.agingBreakdown.forEach(range => {
      report += `${range.range}: ${range.count} créances pour ${range.amount.toFixed(2)}€ (${range.percentage.toFixed(1)}%)\n`;
    });

    report += `
=====================================
TOP CLIENTS À RISQUE
=====================================
`;
    
    analysis.topRiskClients.slice(0, 10).forEach((client, index) => {
      report += `${index + 1}. ${client.clientName} - ${client.balance.toFixed(2)}€ (${client.agingDays} jours)\n`;
    });

    report += `
=====================================
ALERTES CRITIQUES
=====================================
`;
    
    const criticalAlerts = analysis.alerts.filter(a => a.severity === 'high');
    if (criticalAlerts.length > 0) {
      criticalAlerts.forEach(alert => {
        report += `⚠️ ${alert.clientName}: ${alert.message}\n`;
        report += `   Recommandation: ${alert.recommendation}\n\n`;
      });
    } else {
      report += 'Aucune alerte critique\n';
    }

    report += `
=====================================
DÉTAIL DES CRÉANCES
=====================================
`;

    debts.forEach(debt => {
      report += `
${debt.clientName} (${debt.clientCode})
Facture: ${debt.invoiceNumber} - Date: ${new Date(debt.invoiceDate).toLocaleDateString('fr-FR')}
Montant: ${debt.amount.toFixed(2)}€ | Payé: ${debt.paid.toFixed(2)}€ | Solde: ${debt.balance.toFixed(2)}€
Âge: ${debt.agingDays} jours | Risque: ${this.getRiskLabel(debt.riskLevel)}
---`;
    });

    return report;
  }

  static downloadTextFile(content: string, fileName: string): void {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', fileName);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  private static getRiskLabel(riskLevel: string): string {
    switch (riskLevel) {
      case 'healthy': return 'Sain';
      case 'monitoring': return 'À surveiller';
      case 'overdue': return 'En retard';
      case 'critical': return 'Critique';
      default: return 'Inconnu';
    }
  }

  private static getAlertTypeLabel(type: string): string {
    switch (type) {
      case 'critical_debt': return 'Créance critique';
      case 'frequent_delays': return 'Retards fréquents';
      case 'old_debt': return 'Créance ancienne';
      case 'partial_payment': return 'Paiement partiel';
      default: return 'Autre';
    }
  }
}
