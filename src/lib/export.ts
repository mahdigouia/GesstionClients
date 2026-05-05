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
      { h: 'Client', x: margin, w: 70 },
      { h: 'N° Pièce', x: margin + 70, w: 30 },
      { h: 'Date', x: margin + 100, w: 25 },
      { h: 'Montant', x: margin + 125, w: 30, align: 'right' },
      { h: 'Solde', x: margin + 155, w: 25, align: 'right' }
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
      const clientText = `${debt.clientCode} - ${debt.clientName.substring(0, 32)}`;
      pdf.text(clientText, margin, currentY);
      pdf.text(debt.documentNumber, margin + 70, currentY);
      pdf.text(new Date(debt.documentDate).toLocaleDateString('fr-FR'), margin + 100, currentY);
      
      // Montants alignés à droite
      pdf.text(formatCurrency(debt.amount), margin + 125 + 30, currentY, { align: 'right' });
      pdf.setTextColor(debt.balance > 0 ? 192 : 40, debt.balance > 0 ? 57 : 40, debt.balance > 0 ? 43 : 40); // Rouge si solde > 0
      pdf.text(formatCurrency(debt.balance), margin + 155 + 25, currentY, { align: 'right' });
      
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
  static async generateWordReportWithAI(debts: ClientDebt[]): Promise<void> {
    const reportDate = new Date().toLocaleDateString('fr-FR', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    
    // Trier par risque (critique d'abord)
    const sortedDebts = [...debts].sort((a, b) => {
      const riskOrder = { critical: 0, overdue: 1, monitoring: 2, healthy: 3 };
      return riskOrder[a.riskLevel] - riskOrder[b.riskLevel];
    });
    
    const criticalDebts = sortedDebts.filter(d => d.riskLevel === 'critical');
    
    // Créer le document
    const doc = new Document({
      sections: [{
        properties: {},
        children: [
          // Titre
          new Paragraph({
            text: 'RAPPORT D\'ANALYSE DES CRÉANCES',
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
          
          // Synthèse globale avec IA
          new Paragraph({
            text: '1. SYNTHÈSE GLOBALE',
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 400, after: 200 }
          }),
          ...this.generateGlobalInsights(debts).split('\n\n').map(para => 
            new Paragraph({
              children: [new TextRun({ text: para, size: 22 })],
              spacing: { after: 200 }
            })
          ),
          
          // Analyse par document
          new Paragraph({
            text: '2. ANALYSE DÉTAILLÉE PAR DOCUMENT',
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 600, after: 200 }
          }),
          
          // Documents critiques
          ...(criticalDebts.length > 0 ? [
            new Paragraph({
              text: '2.1 DOCUMENTS À RISQUE CRITIQUE',
              heading: HeadingLevel.HEADING_2,
              spacing: { before: 400, after: 200 }
            }),
            ...criticalDebts.flatMap((debt, index) => [
              new Paragraph({
                text: `Document ${index + 1} : ${debt.documentNumber}`,
                heading: HeadingLevel.HEADING_3,
                spacing: { before: 300, after: 100 }
              }),
              new Paragraph({
                children: [
                  new TextRun({ text: 'Client : ', bold: true }),
                  new TextRun({ text: `${debt.clientName} (${debt.clientCode})\n` }),
                  new TextRun({ text: 'Solde : ', bold: true }),
                  new TextRun({ text: `${debt.balance.toFixed(2)} TND\n` }),
                  new TextRun({ text: 'Âge : ', bold: true }),
                  new TextRun({ text: `${debt.age} jours\n` }),
                  new TextRun({ text: 'Contentieux : ', bold: true }),
                  new TextRun({ text: `${debt.isContentieux ? 'Oui' : 'Non'}\n\n` }),
                ],
                spacing: { after: 100 }
              }),
              new Paragraph({
                text: 'Analyse IA :',
                spacing: { before: 100, after: 100 },
                border: { bottom: { color: 'CCCCCC', size: 1, style: 'single' } }
              }),
              new Paragraph({
                text: this.generateAIAnalysis(debt),
                spacing: { after: 300 },
                shading: { fill: 'F5F5F5' }
              })
            ])
          ] : [new Paragraph({ text: 'Aucun document à risque critique identifié.', spacing: { after: 200 } })]),
          
          // Recommandations
          new Paragraph({
            text: '3. RECOMMANDATIONS STRATÉGIQUES',
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 600, after: 200 }
          }),
          new Paragraph({
            children: [
              new TextRun({ 
                text: `Basé sur l'analyse de ${debts.length} documents, les actions suivantes sont recommandées :\n\n`,
                size: 22
              }),
              new TextRun({ text: '• ', size: 22 }),
              new TextRun({ 
                text: `Prioriser le recouvrement des ${criticalDebts.length} créances critiques\n`,
                size: 22
              }),
              new TextRun({ text: '• ', size: 22 }),
              new TextRun({ 
                text: 'Mettre en place un suivi hebdomadaire des créances dépassant 60 jours\n',
                size: 22
              }),
              new TextRun({ text: '• ', size: 22 }),
              new TextRun({ 
                text: 'Évaluer la nécessité de passer en contentieux pour les créances > 120 jours\n',
                size: 22
              }),
              new TextRun({ text: '• ', size: 22 }),
              new TextRun({ 
                text: 'Renforcer la relation client avec les débiteurs à risque élevé',
                size: 22
              })
            ],
            spacing: { after: 200 }
          }),
          
          // Conclusion
          new Paragraph({
            text: '4. CONCLUSION',
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 600, after: 200 }
          }),
          new Paragraph({
            text: `Ce rapport, généré avec assistance IA, identifie les priorités de recouvrement et propose des actions ciblées. ` +
                  `Un suivi régulier est essentiel pour maintenir la santé financière du portefeuille client.`,
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
