import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { Document, Paragraph, TextRun, HeadingLevel, AlignmentType, Packer } from 'docx';
import { saveAs } from 'file-saver';
import { ClientDebt, AnalysisResult } from '@/types/debt';

export class ExportService {
  static async exportToExcel(debts: ClientDebt[], analysis?: AnalysisResult): Promise<void> {
    const workbook = XLSX.utils.book_new();

    // Feuille des créances
    const debtsData = debts.map(debt => ({
      'Code Client': debt.clientCode,
      'Nom Client': debt.clientName,
      'Téléphone': debt.clientPhone || '',
      'N° Pièce': debt.documentNumber,
      'Description': debt.description,
      'Date Document': new Date(debt.documentDate).toLocaleDateString('fr-FR'),
      'Date Échéance': new Date(debt.dueDate).toLocaleDateString('fr-FR'),
      'Montant': debt.amount,
      'Règlement': debt.settlement,
      'Solde': debt.balance,
      'Âge (jours)': debt.age,
      'Jours de Paiement': debt.paymentDays,
      'Niveau Risque': this.getRiskLabel(debt.riskLevel),
      'Fichier Source': debt.sourceFile
    }));

    const debtsSheet = XLSX.utils.json_to_sheet(debtsData);
    XLSX.utils.book_append_sheet(workbook, debtsSheet, 'Créances');

    // Feuille d'analyse si disponible
    if (analysis) {
      const analysisData = [
        { 'Indicateur': 'Total Créances', 'Valeur': analysis.totalDebts.toFixed(2) + ' TND' },
        { 'Indicateur': 'Total Payé', 'Valeur': analysis.totalPaid.toFixed(2) + ' TND' },
        { 'Indicateur': 'Solde Restant', 'Valeur': analysis.totalBalance.toFixed(2) + ' TND' },
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

  static async exportFilteredToPDF(debts: ClientDebt[], title: string = "Rapport des Créances", activeFilters?: string): Promise<void> {
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pageWidth = 210;
    const pageHeight = 297;
    const margin = 15;
    let currentY = 20;

    // Helper pour le formatage monétaire (Éviter les slashs dus aux espaces insécables)
    const formatCurrency = (val: number) => {
      return val.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, " ");
    };

    const addHeader = (pageNum: number) => {
      // 1. Logo
      try {
        // Tentative de chargement du logo
        pdf.addImage('/logo.png', 'PNG', margin, 15, 35, 15);
      } catch (e) {
        pdf.setFontSize(14);
        pdf.setFont('helvetica', 'bold');
        pdf.text("MG GROUP", margin, 20);
      }

      // 2. Infos Rapport (Droite)
      pdf.setFontSize(8);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(100, 100, 100);
      const dateStr = `Généré le : ${new Date().toLocaleDateString('fr-FR')} ${new Date().toLocaleTimeString('fr-FR')}`;
      pdf.text(dateStr, pageWidth - margin - pdf.getTextWidth(dateStr), 15);
      pdf.text(`Page ${pageNum}`, pageWidth - margin - pdf.getTextWidth(`Page ${pageNum}`), 20);

      pdf.setDrawColor(200, 200, 200);
      pdf.line(margin, 32, pageWidth - margin, 32);
      return 38;
    };

    let pageNum = 1;
    currentY = addHeader(pageNum);

    // 3. Titre et Filtres
    pdf.setFontSize(16);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(44, 62, 80);
    pdf.text(title, margin, currentY);
    currentY += 8;

    if (activeFilters) {
      pdf.setFontSize(9);
      pdf.setFont('helvetica', 'italic');
      pdf.setTextColor(52, 73, 94);
      pdf.text(`Filtres actifs : ${activeFilters}`, margin, currentY);
      currentY += 6;
    }

    const totalBalance = debts.reduce((sum, d) => sum + d.balance, 0);
    pdf.setFontSize(11);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(0, 0, 0);
    pdf.text(`Total : ${formatCurrency(totalBalance)} TND (${debts.length} lignes)`, margin, currentY);
    currentY += 12;

    // 4. Tableau
    const cols = [
      { h: 'Client', x: margin, w: 55 },
      { h: 'N° Pièce', x: margin + 55, w: 30 },
      { h: 'Date', x: margin + 85, w: 22 },
      { h: 'Échéance', x: margin + 107, w: 22 },
      { h: 'Montant', x: margin + 129, w: 28, align: 'right' },
      { h: 'Solde', x: margin + 157, w: 23, align: 'right' }
    ];

    // Header Tableau
    pdf.setFillColor(44, 62, 80); // Bleu foncé pro
    pdf.rect(margin, currentY - 5, pageWidth - (2 * margin), 8, 'F');
    pdf.setFontSize(9);
    pdf.setTextColor(255, 255, 255);
    pdf.setFont('helvetica', 'bold');
    cols.forEach(col => {
      if (col.align === 'right') {
        pdf.text(col.h, col.x + col.w, currentY, { align: 'right' });
      } else {
        pdf.text(col.h, col.x, currentY);
      }
    });
    currentY += 8;

    // Lignes
    pdf.setFontSize(8);
    pdf.setFont('helvetica', 'normal');
    
    debts.forEach((debt, index) => {
      // Saut de page si nécessaire
      if (currentY > 275) {
        pdf.addPage();
        pageNum++;
        currentY = addHeader(pageNum);
        
        // Ré-afficher le header du tableau sur la nouvelle page
        pdf.setFillColor(44, 62, 80);
        pdf.rect(margin, currentY - 5, pageWidth - (2 * margin), 8, 'F');
        pdf.setTextColor(255, 255, 255);
        pdf.setFont('helvetica', 'bold');
        cols.forEach(col => {
          if (col.align === 'right') {
            pdf.text(col.h, col.x + col.w, currentY, { align: 'right' });
          } else {
            pdf.text(col.h, col.x, currentY);
          }
        });
        currentY += 8;
        pdf.setFontSize(8);
        pdf.setFont('helvetica', 'normal');
      }

      // Alternance de couleur
      if (index % 2 === 0) {
        pdf.setFillColor(249, 250, 251);
        pdf.rect(margin, currentY - 5, pageWidth - (2 * margin), 7, 'F');
      }

      pdf.setTextColor(40, 40, 40);
      const clientText = `${debt.clientCode} - ${debt.clientName.substring(0, 24)}`;
      pdf.text(clientText, margin, currentY);
      pdf.text(debt.documentNumber, margin + 55, currentY);
      pdf.text(new Date(debt.documentDate).toLocaleDateString('fr-FR'), margin + 85, currentY);
      pdf.text(new Date(debt.dueDate).toLocaleDateString('fr-FR'), margin + 107, currentY);
      
      // Montants alignés à droite
      pdf.text(formatCurrency(debt.amount), margin + 129 + 28, currentY, { align: 'right' });
      pdf.setTextColor(debt.balance > 0 ? 192 : 40, debt.balance > 0 ? 57 : 40, debt.balance > 0 ? 43 : 40); // Rouge si solde > 0
      pdf.text(formatCurrency(debt.balance), margin + 157 + 23, currentY, { align: 'right' });
      
      currentY += 7;
    });

    // 5. Ligne de Total final
    if (currentY > 280) {
      pdf.addPage();
      currentY = addHeader(++pageNum);
    }
    
    pdf.setFillColor(236, 240, 241);
    pdf.rect(margin, currentY - 5, pageWidth - (2 * margin), 8, 'F');
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(0, 0, 0);
    pdf.text("TOTAL GÉNÉRAL", margin, currentY);
    
    const totalAmount = debts.reduce((sum, d) => sum + d.amount, 0);
    pdf.text(formatCurrency(totalAmount), margin + 125 + 30, currentY, { align: 'right' });
    pdf.text(formatCurrency(totalBalance), margin + 155 + 25, currentY, { align: 'right' });

    const fileName = `Rapport_Creances_${new Date().toISOString().split('T')[0]}.pdf`;
    pdf.save(fileName);
  }

  static generateReport(debts: ClientDebt[], analysis: AnalysisResult): string {
    const reportDate = new Date().toLocaleDateString('fr-FR');
    
    let report = `
RAPPORT D'ANALYSE DES CRÉANCES CLIENTS
Généré le: ${reportDate}

=====================================
RÉSUMÉ EXÉCUTIF
=====================================
Total des créances: ${analysis.totalDebts.toFixed(2)} TND
Total payé: ${analysis.totalPaid.toFixed(2)} TND
Solde restant: ${analysis.totalBalance.toFixed(2)} TND
Taux de recouvrement: ${analysis.recoveryRate.toFixed(1)}%
Nombre de clients: ${analysis.clientBreakdown.length}

=====================================
RÉPARTITION PAR ANCIENNETÉ
=====================================
`;
    
    analysis.agingBreakdown.forEach(range => {
      report += `${range.range}: ${range.count} créances pour ${range.amount.toFixed(2)} TND (${range.percentage.toFixed(1)}%)\n`;
    });

    report += `
=====================================
TOP CLIENTS À RISQUE
=====================================
`;
    
    analysis.topRiskClients.slice(0, 10).forEach((client, index) => {
      report += `${index + 1}. ${client.clientName} - ${client.balance.toFixed(2)} TND (${client.age} jours)\n`;
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
Pièce: ${debt.documentNumber} - Date: ${new Date(debt.documentDate).toLocaleDateString('fr-FR')} - Échéance: ${new Date(debt.dueDate).toLocaleDateString('fr-FR')}
Description: ${debt.description}
Montant: ${debt.amount.toFixed(2)} TND | Règlement: ${debt.settlement.toFixed(2)} TND | Solde: ${debt.balance.toFixed(2)} TND
Âge: ${debt.age} jours | J.P: ${debt.paymentDays} | Risque: ${this.getRiskLabel(debt.riskLevel)}
Source: ${debt.sourceFile}
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

  // Sauvegarder l'analyse complète dans un fichier JSON
  static saveAnalysis(debts: ClientDebt[], analysis: AnalysisResult, fileName?: string): void {
    const analysisData = {
      exportDate: new Date().toISOString(),
      exportDateFormatted: new Date().toLocaleDateString('fr-FR'),
      summary: {
        totalDebts: analysis.totalDebts,
        totalPaid: analysis.totalPaid,
        totalBalance: analysis.totalBalance,
        recoveryRate: analysis.recoveryRate,
        clientCount: analysis.clientBreakdown.length,
        debtsCount: debts.length
      },
      debts: debts,
      analysis: analysis
    };

    const jsonContent = JSON.stringify(analysisData, null, 2);
    const defaultFileName = fileName || `analyse-creances-${new Date().toISOString().split('T')[0]}.json`;
    
    this.downloadTextFile(jsonContent, defaultFileName);
    console.log(`Analyse sauvegardée: ${defaultFileName}`);
  }

  // Export de la liste des clients en Excel
  static async exportClientsToExcel(clients: any[]): Promise<void> {
    const workbook = XLSX.utils.book_new();
    const data = clients.map(c => ({
      'Code Client': c.clientCode,
      'Nom Client': c.clientName,
      'Commercial': c.commercialName,
      'Fichier Source': c.sourceFile,
      'Nombre de Factures': c.debtCount,
      'Solde Total (TND)': c.totalBalance,
      'Délai Moyen (jours)': Math.round(c.averagePaymentDelay)
    }));
    
    const sheet = XLSX.utils.json_to_sheet(data);
    XLSX.utils.book_append_sheet(workbook, sheet, 'Portefeuille Clients');
    XLSX.writeFile(workbook, `portefeuille-clients-${new Date().toISOString().split('T')[0]}.xlsx`);
  }

  // Export de la liste des clients en PDF
  static async exportClientsToPDF(clients: any[]): Promise<void> {
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pageWidth = 210;
    const margin = 15;
    let currentY = 20;

    const formatCurrency = (val: number) => {
      return val.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, " ");
    };

    const addHeader = (pageNum: number) => {
      try { pdf.addImage('/logo.png', 'PNG', margin, 15, 35, 15); } catch (e) {}
      pdf.setFontSize(8);
      pdf.setTextColor(100, 100, 100);
      pdf.text(`Généré le : ${new Date().toLocaleDateString('fr-FR')}`, pageWidth - margin - 40, 15);
      pdf.text(`Page ${pageNum}`, pageWidth - margin - 40, 20);
      pdf.line(margin, 32, pageWidth - margin, 32);
      return 38;
    };

    let pageNum = 1;
    currentY = addHeader(pageNum);

    pdf.setFontSize(16);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(44, 62, 80);
    pdf.text("Portefeuille Clients", margin, currentY);
    currentY += 12;

    const cols = [
      { h: 'Code', x: margin, w: 20 },
      { h: 'Nom Client', x: margin + 20, w: 60 },
      { h: 'Commercial', x: margin + 80, w: 30 },
      { h: 'Source', x: margin + 110, w: 25 },
      { h: 'Docs', x: margin + 135, w: 10 },
      { h: 'Délai', x: margin + 145, w: 15 },
      { h: 'Solde Total', x: margin + 160, w: 35, align: 'right' }
    ];

    pdf.setFillColor(44, 62, 80);
    pdf.rect(margin, currentY - 5, pageWidth - (2 * margin), 8, 'F');
    pdf.setFontSize(9);
    pdf.setTextColor(255, 255, 255);
    cols.forEach(col => {
      if (col.align === 'right') pdf.text(col.h, col.x + col.w, currentY, { align: 'right' });
      else pdf.text(col.h, col.x, currentY);
    });
    currentY += 8;

    pdf.setFontSize(8);
    pdf.setTextColor(40, 40, 40);
    pdf.setFont('helvetica', 'normal');

    clients.forEach((c, index) => {
      if (currentY > 275) {
        pdf.addPage();
        currentY = addHeader(++pageNum);
        currentY += 8; // Espace pour le header tableau (simplifié)
      }

      if (index % 2 === 0) {
        pdf.setFillColor(249, 250, 251);
        pdf.rect(margin, currentY - 5, pageWidth - (2 * margin), 7, 'F');
      }

      pdf.text(c.clientCode || '?', margin, currentY);
      pdf.text((c.clientName || 'Inconnu').substring(0, 35), margin + 20, currentY);
      pdf.text((c.commercialName || '').substring(0, 18), margin + 80, currentY);
      pdf.text((c.sourceFile || '').substring(0, 15), margin + 110, currentY);
      pdf.text(String(c.debtCount), margin + 135, currentY);
      pdf.text(`${Math.round(c.averagePaymentDelay)}j`, margin + 145, currentY);
      pdf.text(formatCurrency(c.totalBalance), margin + 160 + 35, currentY, { align: 'right' });
      currentY += 7;
    });

    pdf.save(`portefeuille-clients-${new Date().toISOString().split('T')[0]}.pdf`);
  }

  // Export Excel par Commercial avec résumé contentieux/non-contentieux
  static async exportToExcelByCommercial(debts: ClientDebt[]): Promise<void> {
    const workbook = XLSX.utils.book_new();
    
    // Grouper par commercial
    const commercialGroups = new Map<string, ClientDebt[]>();
    debts.forEach(debt => {
      const commercial = debt.commercialName || 'Non assigné';
      if (!commercialGroups.has(commercial)) {
        commercialGroups.set(commercial, []);
      }
      commercialGroups.get(commercial)?.push(debt);
    });
    
    // Feuille récapitulative
    const summaryData = Array.from(commercialGroups.entries()).map(([commercial, commercialDebts]) => {
      const contentieuxDebts = commercialDebts.filter(d => d.isContentieux);
      const nonContentieuxDebts = commercialDebts.filter(d => !d.isContentieux);
      const uniqueClients = new Set(commercialDebts.map(d => d.clientCode)).size;
      
      return {
        'Représentant Commercial': commercial,
        'Nombre de Clients': uniqueClients,
        'Nombre de Documents': commercialDebts.length,
        'Total Créances (TND)': commercialDebts.reduce((sum, d) => sum + d.balance, 0),
        'Contentieux (TND)': contentieuxDebts.reduce((sum, d) => sum + d.balance, 0),
        'Non-Contentieux (TND)': nonContentieuxDebts.reduce((sum, d) => sum + d.balance, 0),
        'Nb Contentieux': contentieuxDebts.length,
        'Nb Non-Contentieux': nonContentieuxDebts.length,
        'Âge Moyen (jours)': Math.round(commercialDebts.reduce((sum, d) => sum + d.age, 0) / commercialDebts.length) || 0
      };
    }).sort((a, b) => b['Total Créances (TND)'] - a['Total Créances (TND)']);
    
    const summarySheet = XLSX.utils.json_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(workbook, summarySheet, 'Résumé par Commercial');
    
    // Feuilles détaillées par commercial
    commercialGroups.forEach((commercialDebts, commercial) => {
      const sheetName = commercial.substring(0, 30).replace(/[\\/*?:\[\]]/g, '-');
      
      const detailData = commercialDebts.map(debt => ({
        'N° Pièce': debt.documentNumber,
        'Code Client': debt.clientCode,
        'Nom Client': debt.clientName,
        'Téléphone': debt.clientPhone || '',
        'Date Document': new Date(debt.documentDate).toLocaleDateString('fr-FR'),
        'Date Échéance': new Date(debt.dueDate).toLocaleDateString('fr-FR'),
        'Montant (TND)': debt.amount,
        'Solde (TND)': debt.balance,
        'Âge (jours)': debt.age,
        'Contentieux': debt.isContentieux ? 'Oui' : 'Non',
        'Niveau Risque': this.getRiskLabel(debt.riskLevel),
        'Description': debt.description
      }));
      
      const detailSheet = XLSX.utils.json_to_sheet(detailData);
      XLSX.utils.book_append_sheet(workbook, detailSheet, sheetName);
    });
    
    const fileName = `rapport-commercial-${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(workbook, fileName);
  }

  // Analyse IA simulée pour le rapport Word
  private static generateAIAnalysis(debt: ClientDebt): string {
    const analyses = [
      `Le document ${debt.documentNumber} présente un solde de ${debt.balance.toFixed(2)} TND avec un âge de ${debt.age} jours. `,
      debt.age > 90 ? `Cette créance est fortement en retard et nécessite une attention immédiate. ` : 
      debt.age > 60 ? `Le délai de paiement dépasse la norme recommandée. ` : 
      `Le délai de paiement est dans les limites acceptables. `,
      debt.isContentieux ? `Le statut contentieux indique des difficultés de recouvrement. ` : ``,
      debt.riskLevel === 'critical' ? `Le niveau de risque critique suggère une procédure de recouvrement renforcée.` :
      debt.riskLevel === 'overdue' ? `Le statut en retard nécessite un suivi rapproché.` :
      debt.riskLevel === 'monitoring' ? `Une surveillance régulière est recommandée.` :
      `Le client présente un bon historique de paiement.`
    ];
    return analyses.join('');
  }

  private static generateGlobalInsights(debts: ClientDebt[]): string {
    const criticalCount = debts.filter(d => d.riskLevel === 'critical').length;
    const overdueCount = debts.filter(d => d.riskLevel === 'overdue').length;
    const totalBalance = debts.reduce((sum, d) => sum + d.balance, 0);
    const avgAge = Math.round(debts.reduce((sum, d) => sum + d.age, 0) / debts.length);
    
    return `ANALYSE GLOBALE DES CRÉANCES\n\n` +
      `Sur un total de ${debts.length} documents représentant ${totalBalance.toFixed(2)} TND, ` +
      `l'analyse révèle ${criticalCount} créances critiques et ${overdueCount} créances en retard. ` +
      `L'âge moyen des créances est de ${avgAge} jours. ` +
      (criticalCount > 0 ? `\n\nPRIORITÉS D'ACTION :\n` +
        `1. Traiter en priorité les ${criticalCount} créances critiques\n` +
        `2. Mettre en place un suivi renforcé pour les créances dépassant 90 jours\n` +
        `3. Envisager des actions contentieuses si nécessaire` : 
        `\n\nLa situation globale est sous contrôle avec un niveau de risque modéré.`);
  }

  // Générer rapport Word avec analyse IA
  static async generateWordReportWithAI(debts: ClientDebt[], analysis?: AnalysisResult): Promise<void> {
    const reportDate = new Date().toLocaleDateString('fr-FR', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    
    // Groupes par température de recouvrement
    const zoneVerte = debts.filter(d => d.age < 30 && !d.isContentieux);
    const zoneOrange = debts.filter(d => d.age >= 30 && d.age <= 90 && !d.isContentieux);
    const zoneRouge = debts.filter(d => d.age > 90 || d.isContentieux);

    // Calcul des totaux par zone
    const totalVerte = zoneVerte.reduce((sum, d) => sum + d.balance, 0);
    const totalOrange = zoneOrange.reduce((sum, d) => sum + d.balance, 0);
    const totalRouge = zoneRouge.reduce((sum, d) => sum + d.balance, 0);
    
    // Créer le document
    const doc = new Document({
      sections: [{
        properties: {},
        children: [
          // Titre
          new Paragraph({
            text: 'RAPPORT STRATÉGIQUE D\'AUDIT DES CRÉANCES',
            heading: HeadingLevel.TITLE,
            alignment: AlignmentType.CENTER,
            spacing: { after: 400 }
          }),
          
          // Date
          new Paragraph({
            text: `Généré le ${reportDate}`,
            alignment: AlignmentType.CENTER,
            spacing: { after: 600 }
          }),
          
          // 1. Synthèse globale
          new Paragraph({
            text: '1. SYNTHÈSE GLOBALE ET PERFORMANCE',
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 400, after: 200 }
          }),
          
          new Paragraph({
            children: [
              new TextRun({ text: 'État de la Trésorerie : ', bold: true }),
              new TextRun({ text: `${(totalVerte + totalOrange + totalRouge).toLocaleString('fr-FR')} TND en attente de recouvrement.\n` }),
            ],
            spacing: { after: 200 }
          }),

          // Point 5: Comparaison Performance (Simulée ou basée sur analysis si présent)
          ...(analysis ? [
            new Paragraph({
              text: 'Indicateurs de Performance :',
              heading: HeadingLevel.HEADING_2,
              spacing: { before: 200, after: 100 }
            }),
            new Paragraph({
              children: [
                new TextRun({ text: `• Taux de Recouvrement Global : `, bold: true }),
                new TextRun({ text: `${analysis.recoveryRate.toFixed(1)}%\n` }),
                new TextRun({ text: `• Taux de Recouvrement (Hors Contentieux) : `, bold: true }),
                new TextRun({ text: `${analysis.recoveryRateNoContentieux.toFixed(1)}%\n` }),
                new TextRun({ text: `• Nombre de clients audités : `, bold: true }),
                new TextRun({ text: `${analysis.clientBreakdown.length}\n` }),
              ],
              spacing: { after: 200 }
            })
          ] : []),

          // Point 3: Température de Recouvrement
          new Paragraph({
            text: '2. TEMPÉRATURE DE RECOUVREMENT (ZONAGE)',
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 400, after: 200 }
          }),

          // Zone Rouge
          new Paragraph({
            text: '🔴 ZONE ROUGE : RISQUES ÉLEVÉS ET CONTENTIEUX',
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 200, after: 100 }
          }),
          new Paragraph({
            children: [
              new TextRun({ text: `Montant Total : `, bold: true }),
              new TextRun({ text: `${totalRouge.toLocaleString('fr-FR')} TND\n`, color: 'FF0000', bold: true }),
              new TextRun({ text: `Impact : Créances de plus de 90 jours ou en statut contentieux. Nécessite une intervention immédiate, voire juridique.` }),
            ],
            spacing: { after: 200 }
          }),

          // Zone Orange
          new Paragraph({
            text: '🟠 ZONE ORANGE : ALERTES ET SURVEILLANCE',
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 200, after: 100 }
          }),
          new Paragraph({
            children: [
              new TextRun({ text: `Montant Total : `, bold: true }),
              new TextRun({ text: `${totalOrange.toLocaleString('fr-FR')} TND\n`, color: 'FF8C00', bold: true }),
              new TextRun({ text: `Impact : Créances entre 30 et 90 jours. Risque de bascule vers le contentieux si non traitées rapidement.` }),
            ],
            spacing: { after: 200 }
          }),

          // Zone Verte
          new Paragraph({
            text: '🟢 ZONE VERTE : FLUX DE TRÉSORERIE SAIN',
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 200, after: 100 }
          }),
          new Paragraph({
            children: [
              new TextRun({ text: `Montant Total : `, bold: true }),
              new TextRun({ text: `${totalVerte.toLocaleString('fr-FR')} TND\n`, color: '008000', bold: true }),
              new TextRun({ text: `Impact : Créances récentes (< 30 jours). Flux normal à sécuriser pour maintenir la liquidité.` }),
            ],
            spacing: { after: 200 }
          }),
          
          // Analyse par document (Top 15 critiques)
          new Paragraph({
            text: '3. ANALYSE DÉTAILLÉE DES PRIORITÉS',
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 600, after: 200 }
          }),
          
          ...zoneRouge.slice(0, 15).flatMap((debt, index) => [
            new Paragraph({
              text: `Priorité ${index + 1} : ${debt.clientName} (${debt.documentNumber})`,
              heading: HeadingLevel.HEADING_3,
              spacing: { before: 300, after: 100 }
            }),
            new Paragraph({
              children: [
                new TextRun({ text: 'Solde : ', bold: true }),
                new TextRun({ text: `${debt.balance.toFixed(2)} TND | ` }),
                new TextRun({ text: 'Âge : ', bold: true }),
                new TextRun({ text: `${debt.age} jours\n` }),
                new TextRun({ text: 'Analyse IA : ', bold: true, italic: true }),
                new TextRun({ text: this.generateAIAnalysis(debt), italic: true }),
              ],
              spacing: { after: 200 }
            })
          ]),
          
          // Recommandations
          new Paragraph({
            text: '4. RECOMMANDATIONS STRATÉGIQUES',
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 600, after: 200 }
          }),
          new Paragraph({
            children: [
              new TextRun({ text: '• Action Prioritaire : ', bold: true }),
              new TextRun({ text: `Focaliser les relances sur les ${zoneRouge.length} créances de la Zone Rouge.\n` }),
              new TextRun({ text: '• Flux Futur : ', bold: true }),
              new TextRun({ text: `Sécuriser l'encaissement de la Zone Verte (${totalVerte.toLocaleString('fr-FR')} TND) pour couvrir les charges fixes.\n` }),
              new TextRun({ text: '• Stratégie : ', bold: true }),
              new TextRun({ text: `Pour la Zone Orange, proposer des échéanciers de paiement pour éviter le blocage total.` }),
            ],
            spacing: { after: 200 }
          }),
          
          // Conclusion
          new Paragraph({
            text: '5. CONCLUSION',
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 600, after: 200 }
          }),
          new Paragraph({
            text: `Ce rapport d'audit met en évidence une concentration de ${(totalRouge / (totalVerte + totalOrange + totalRouge) * 100).toFixed(1)}% de la dette en zone critique. ` +
                  `Une action coordonnée entre les commerciaux et la comptabilité est impérative pour assainir le portefeuille.`,
            spacing: { after: 200 }
          })
        ]
      }]
    });
    
    // Générer et télécharger
    const blob = await Packer.toBlob(doc);
    const fileName = `rapport-ia-documents-${new Date().toISOString().split('T')[0]}.docx`;
    saveAs(blob, fileName);
  }
}
