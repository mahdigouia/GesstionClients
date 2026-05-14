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
        // Logo plus petit
        pdf.addImage('/logo.png', 'PNG', margin, 10, 25, 10);
      } catch (e) {
        pdf.setFontSize(12);
        pdf.setFont('helvetica', 'bold');
        pdf.text("MDS GROUP", margin, 15);
      }

      // 2. Infos Rapport (Droite)
      pdf.setFontSize(7);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(100, 100, 100);
      const dateStr = `Généré le : ${new Date().toLocaleDateString('fr-FR')} ${new Date().toLocaleTimeString('fr-FR')}`;
      pdf.text(dateStr, pageWidth - margin - pdf.getTextWidth(dateStr), 12);
      pdf.text(`Page ${pageNum}`, pageWidth - margin - pdf.getTextWidth(`Page ${pageNum}`), 16);

      pdf.setDrawColor(200, 200, 200);
      pdf.line(margin, 22, pageWidth - margin, 22);
      return 28; // En-tête plus compact (au lieu de 38)
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

  // Export de la liste des clients en Excel (Détaillé)
  static async exportClientsToExcel(clients: any[], clientRemarks: Record<string, any[]>, activeFilters?: string): Promise<void> {
    const rows: any[] = [];
    const columns = [
      { header: 'N°', key: 'n', width: 40 },
      { header: 'Code Client', key: 'code', width: 80 },
      { header: 'Nom Client', key: 'name', width: 250 },
      { header: 'Rep. (Source)', key: 'rep', width: 80 },
      { header: 'N° Pièce', key: 'doc', width: 100 },
      { header: 'Date', key: 'date', width: 90 },
      { header: 'Échéance', key: 'due', width: 90 },
      { header: 'Âge (j)', key: 'age', width: 60, type: 'number', bold: true },
      { header: 'Montant (TND)', key: 'amount', width: 110, type: 'number' },
      { header: 'Règlement (TND)', key: 'settlement', width: 110, type: 'number' },
      { header: 'Solde (TND)', key: 'balance', width: 110, type: 'number', bold: true },
      { header: 'Remarque', key: 'remark', width: 200 }
    ];
    let globalCounter = 1;
    clients.forEach(client => {
      const rowCount = client.filteredDebts.length;
      client.filteredDebts.forEach((debt: ClientDebt, index: number) => {
        rows.push({
          n: globalCounter++,
          code: client.clientCode,
          name: client.clientName,
          rep: debt.commercialCode || client.commercialCode || '?',
          doc: debt.documentNumber,
          date: new Date(debt.documentDate).toLocaleDateString('fr-FR'),
          due: new Date(debt.dueDate).toLocaleDateString('fr-FR'),
          age: debt.age,
           amount: debt.amount.toFixed(3),
          settlement: (debt.settlement || 0).toFixed(3),
          balance: debt.balance.toFixed(3),
          remark: (() => {
            const r = clientRemarks[client.clientName]?.[0];
            if (!r) return '';
            let text = r.content;
            const entryDate = new Date(r.date).toLocaleDateString('fr-FR');
            const promiseDateText = r.promiseDate ? ` | Promesse: ${new Date(r.promiseDate).toLocaleDateString('fr-FR')}` : '';
            return `${text}\n[Saisi le: ${entryDate}${promiseDateText}]`;
          })(),
          isFirstInGroup: index === 0,
          groupSize: rowCount
        });
      });
    });

    this.saveStyledExcel(
      rows, 
      columns, 
      `Creances_Clients_Detaille_${new Date().toISOString().split('T')[0]}.xls`,
      `CRÉANCES CLIENTS - ${new Date().toLocaleDateString('fr-FR')}`
    );
  }

  // Helper pour générer un Excel stylisé via HTML (Supporté par Excel avec couleurs)
  private static saveStyledExcel(data: any[], columns: any[], fileName: string, title?: string) {
    const headerColor = "#2c3e50";
    const headerTextColor = "#ffffff";
    const evenRowColor = "#f8fafc";
    
    let html = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <meta charset="utf-8">
        <style>
          .title { font-size: 16pt; font-weight: bold; color: ${headerColor}; font-family: sans-serif; }
          .legend { font-size: 8pt; color: #64748b; font-style: italic; margin-bottom: 10px; }
          .header { background-color: ${headerColor}; color: ${headerTextColor}; font-weight: bold; text-align: center; border: 0.5pt solid #000; font-family: sans-serif; }
          .cell { border: 0.5pt solid #cbd5e1; font-family: sans-serif; font-size: 10pt; text-align: center; vertical-align: middle; }
          .number { text-align: center; }
          .bold { font-weight: bold; }
          .row-even { background-color: ${evenRowColor}; }
          .critical { color: #b91c1c; font-weight: bold; }
          .settled { color: #059669; }
          .age-0-15 { color: #059669; font-weight: bold; }
          .age-16-30 { color: #2563eb; font-weight: bold; }
          .age-31-45 { color: #d97706; font-weight: bold; }
          .age-46-60 { color: #ea580c; font-weight: bold; }
          .age-61-plus { color: #dc2626; font-weight: bold; }
        </style>
      </head>
      <body>
    `;

    if (title) {
      html += `<div class="title">${title}</div>`;
      html += `<div class="legend">Légende Âge : 0-15j Vert | 16-30j Bleu | 31-45j Jaune | 46-60j Orange | 61j+ Rouge</div><br>`;
    }

    html += `<table border="1"><thead><tr>`;
    columns.forEach(col => {
      html += `<th class="header" style="width: ${col.width || 100}px">${col.header}</th>`;
    });
    html += `</tr></thead><tbody>`;

    data.forEach((row, idx) => {
      const rowClass = idx % 2 === 0 ? 'row-even' : '';
      html += `<tr class="${rowClass}">`;
      columns.forEach(col => {
        // Fusionner uniquement la colonne Remarque
        if (col.key === 'remark' && !row.isFirstInGroup) {
          return;
        }

        let val = row[col.key];
        let cellClass = "cell";
        let inlineStyle = "";
        if (col.bold) cellClass += " bold";
        
        // Coloration par âge via styles en ligne (plus fiable pour Excel)
        if (col.key === 'age') {
          const age = parseInt(val);
          if (age <= 15) inlineStyle = "color: #059669; font-weight: bold;";
          else if (age <= 30) inlineStyle = "color: #2563eb; font-weight: bold;";
          else if (age <= 45) inlineStyle = "color: #d97706; font-weight: bold;";
          else if (age <= 60) inlineStyle = "color: #ea580c; font-weight: bold;";
          else inlineStyle = "color: #dc2626; font-weight: bold;";
        }

        // Style conditionnel pour le solde
        if (col.key === 'balance' && parseFloat(val) > 0) {
          inlineStyle += " color: #b91c1c; font-weight: bold;";
        }

        const rowspanAttr = (col.key === 'remark' && row.isFirstInGroup && row.groupSize > 1) ? ` rowspan="${row.groupSize}"` : '';
        
        // Style spécial pour les remarques (effet manuscrit)
        if (col.key === 'remark' && val) {
          inlineStyle += " font-family: 'Courier New', cursive; color: #1e40af; font-style: italic; text-align: left; padding: 5px;";
        }

        html += `<td class="${cellClass}" style="${inlineStyle}"${rowspanAttr}>${val ?? ''}</td>`;
      });
      html += `</tr>`;
    });

    html += `</tbody></table></body></html>`;

    const blob = new Blob([html], { type: 'application/vnd.ms-excel' });
    saveAs(blob, fileName);
  }

  // Export de la liste des clients en PDF (Détaillé & Embelli)
  static async exportClientsToPDF(clients: any[], clientRemarks: Record<string, any[]>, activeFilters?: string): Promise<void> {
    const pdf = new jsPDF('l', 'mm', 'a4'); // Mode paysage pour plus d'espace
    const pageWidth = 297;
    const pageHeight = 210;
    const margin = 12;
    let currentY = 20;

    const formatCurrency = (val: number) => {
      return (val ?? 0).toFixed(3).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, " ");
    };

    // Calculer les totaux à l'avance pour le header
    let totalInvoices = 0;
    clients.forEach(c => totalInvoices += (c.filteredDebts || []).length);
    const totalClientsCount = clients.length;

    const addHeader = (pageNum: number) => {
      // Background Header réduit
      pdf.setFillColor(248, 250, 252);
      pdf.rect(margin, margin, pageWidth - (margin * 2), 25, 'F');
      
      // Logo (Placeholder simple)
      pdf.setFontSize(24);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(30, 41, 59);
      pdf.text("MDS", margin + 5, margin + 12);
      pdf.setFontSize(8);
      pdf.text("G R O U P", margin + 5, margin + 15);
      
      pdf.setFontSize(18);
      pdf.text("CRÉANCES CLIENTS", margin + 45, margin + 12);
      
      // Légende
      pdf.setFontSize(7);
      pdf.setTextColor(100, 116, 139);
      pdf.text("Âge : 0-15j Vert | 16-30j Bleu | 31-45j Jaune | 46-60j Orange | 61j+ Rouge", margin + pageWidth - margin - 10, margin + 12, { align: 'right' });
      
      // Meta info
      pdf.setFontSize(7);
      pdf.text(`Généré le : ${new Date().toLocaleString('fr-FR')}`, margin + pageWidth - margin - 10, margin + 6, { align: 'right' });
      pdf.text(`Page ${pageNum}`, margin + pageWidth - margin - 10, margin + 10, { align: 'right' });

      // Filtres et Statistiques
      pdf.setFontSize(9);
      pdf.setTextColor(100, 116, 139);
      const statsText = `Filtres actifs : ${activeFilters || 'Aucun'}  |  Clients : ${totalClientsCount}  |  Lignes : ${totalInvoices}`;
      pdf.text(statsText, margin + 5, margin + 22);

      return margin + 30;
    };

    let pageNum = 1;
    currentY = addHeader(pageNum);

    // Définition des colonnes (Paysage)
    const cols = [
      { h: 'N°', x: margin, w: 8, align: 'center' },
      { h: 'Code', x: margin + 8, w: 18, align: 'center' },
      { h: 'Client', x: margin + 26, w: 52, align: 'center' },
      { h: 'Rep.', x: margin + 78, w: 14, align: 'center' },
      { h: 'N° Pièce', x: margin + 92, w: 30, align: 'center' },
      { h: 'Date', x: margin + 122, w: 22, align: 'center' },
      { h: 'Échéance', x: margin + 144, w: 22, align: 'center' },
      { h: 'Âge', x: margin + 166, w: 12, align: 'center' },
      { h: 'Montant', x: margin + 178, w: 30, align: 'center' },
      { h: 'Solde', x: margin + 208, w: 30, align: 'center' },
      { h: 'Remarque', x: margin + 238, w: 35, align: 'center' }
    ];

    // Header Tableau
    const drawTableHeader = (y: number) => {
      pdf.setFillColor(51, 65, 85);
      pdf.rect(margin, y - 5, pageWidth - (2 * margin), 8, 'F');
      pdf.setFontSize(9);
      pdf.setTextColor(255, 255, 255);
      pdf.setFont('helvetica', 'bold');
      cols.forEach(col => {
        pdf.text(col.h, col.x + (col.w / 2), y, { align: 'center' });
      });
    };

    drawTableHeader(currentY);
    currentY += 8;

    let globalIndex = 1;
    pdf.setFontSize(8);
    pdf.setFont('helvetica', 'normal');

    clients.forEach((client) => {
      const debts = client.filteredDebts || [];
      
      debts.forEach((debt: ClientDebt, i: number) => {
        if (currentY > 185) {
          pdf.addPage();
          currentY = addHeader(++pageNum);
          drawTableHeader(currentY);
          currentY += 8;
          pdf.setFontSize(8);
        }

        if (globalIndex % 2 === 0) {
          pdf.setFillColor(248, 250, 252);
          pdf.rect(margin, currentY - 5, pageWidth - (2 * margin), 7, 'F');
        }

        pdf.setTextColor(30, 41, 59);
        pdf.setFont('helvetica', 'normal');
        
        // Répétition des informations client sur chaque ligne pour éviter le vide
        pdf.text(client.clientCode || '?', margin + 8 + 9, currentY, { align: 'center' });
        pdf.text((client.clientName || '').substring(0, 32), margin + 26 + 26, currentY, { align: 'center' });
        
        pdf.setFont('helvetica', 'bold');
        pdf.text(debt.commercialCode || client.commercialCode || '?', margin + 78 + 7, currentY, { align: 'center' });
        pdf.setFont('helvetica', 'normal');

        pdf.text(String(globalIndex), margin + 4, currentY, { align: 'center' });
        pdf.text(debt.documentNumber, margin + 92 + 15, currentY, { align: 'center' });
        pdf.text(new Date(debt.documentDate).toLocaleDateString('fr-FR'), margin + 122 + 11, currentY, { align: 'center' });
        pdf.text(new Date(debt.dueDate).toLocaleDateString('fr-FR'), margin + 144 + 11, currentY, { align: 'center' });
        
        // Âge avec couleur
        pdf.setFont('helvetica', 'bold');
        const age = debt.age;
        if (age <= 15) pdf.setTextColor(5, 150, 105);
        else if (age <= 30) pdf.setTextColor(37, 99, 235);
        else if (age <= 45) pdf.setTextColor(217, 119, 6);
        else if (age <= 60) pdf.setTextColor(234, 88, 12);
        else pdf.setTextColor(220, 38, 38);
        pdf.text(`${age} j`, margin + 166 + 6, currentY, { align: 'center' });
        
        pdf.setTextColor(30, 41, 59);
        pdf.setFont('helvetica', 'normal');
        pdf.text(formatCurrency(debt.amount), margin + 178 + 15, currentY, { align: 'center' });
        
        pdf.setFont('helvetica', 'bold');
        if (debt.balance > 0) pdf.setTextColor(185, 28, 28);
        pdf.text(formatCurrency(debt.balance), margin + 208 + 15, currentY, { align: 'center' });
        
        pdf.setTextColor(30, 41, 59);
        pdf.setFont('helvetica', 'normal');
        // Remarque fusionnée visuellement (affichée une seule fois par groupe)
        if (i === 0) {
          const r = clientRemarks[client.clientName]?.[0];
          if (r) {
            // Texte principal
            pdf.setFont('courier', 'italic');
            pdf.setTextColor(30, 64, 175); // Bleu "encre"
            pdf.setFontSize(7);
            const splitRemark = pdf.splitTextToSize(r.content, 33);
            pdf.text(splitRemark, margin + 238 + 1, currentY - 2.5);
            
            // Dates en tout petit
            pdf.setFont('helvetica', 'normal');
            pdf.setTextColor(100, 116, 139); // Gris ardoise
            pdf.setFontSize(4.5);
            const entryDate = new Date(r.date).toLocaleDateString('fr-FR');
            let dateInfo = `Saisi le: ${entryDate}`;
            if (r.promiseDate) {
              dateInfo += ` | Promesse: ${new Date(r.promiseDate).toLocaleDateString('fr-FR')}`;
            }
            pdf.text(dateInfo, margin + 238 + 1, currentY + 3);

            pdf.setFont('helvetica', 'normal');
            pdf.setFontSize(8);
          }
        }

        currentY += 7;
        globalIndex++;
      });

      pdf.setDrawColor(226, 232, 240);
      pdf.line(margin, currentY - 4, pageWidth - margin, currentY - 4);
    });

    const totalBalance = clients.reduce((sum, c) => sum + (c.totalBalance || 0), 0);
    const totalAmount = clients.reduce((sum, c) => {
      return sum + (c.filteredDebts || []).reduce((s: number, d: any) => s + (d.amount || 0), 0);
    }, 0);

    if (currentY > 180) { pdf.addPage(); currentY = addHeader(++pageNum); }
    currentY += 5;
    pdf.setFillColor(51, 65, 85);
    pdf.rect(margin, currentY - 6, pageWidth - (2 * margin), 12, 'F');
    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(11);
    pdf.setFont('helvetica', 'bold');
    pdf.text("TOTAL GÉNÉRAL", margin + 5, currentY + 1.5);
    
    pdf.setTextColor(255, 255, 255);
    pdf.text(formatCurrency(totalAmount), margin + 178 + 15, currentY + 1.5, { align: 'center' });
    pdf.text(formatCurrency(totalBalance), margin + 208 + 15, currentY + 1.5, { align: 'center' });

    pdf.save(`Rapport_Portefeuille_Detaille_${new Date().toISOString().split('T')[0]}.pdf`);
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
