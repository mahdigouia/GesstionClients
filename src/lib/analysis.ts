import { ClientDebt, AnalysisResult, Alert } from '@/types/debt';
import { format, differenceInDays } from 'date-fns';

export class AnalysisService {
  static analyzeDebts(debts: ClientDebt[]): AnalysisResult {
    // S'assurer que chaque ligne a son statut contentieux à jour selon l'âge (> 365 jours)
    const processedDebts = debts.map(d => ({
      ...d,
      isContentieux: Number(d.age) > 365
    }));

    const totalDebts = processedDebts.reduce((sum, debt) => sum + Number(debt.amount || 0), 0);
    const totalPaid = processedDebts.reduce((sum, debt) => sum + Number(debt.settlement || 0), 0);
    // Calculer le solde total comme la différence pour éviter les erreurs d'extraction
    const totalBalance = totalDebts - totalPaid;
    
    // Taux de recouvrement = (Somme des Règlements / Somme des Montants Initiaux)
    const recoveryRate = totalDebts > 0 ? (totalPaid / totalDebts) * 100 : 0;

    // Taux d'impayé GLOBAL (Formule: Σ(Montant-Règlement) / Σ Montant)
    const globalUnpaidRate = totalDebts > 0 ? ((totalDebts - totalPaid) / totalDebts) * 100 : 0;

    // Taux impayés hors contentieux
    const nonContentieuxDebts = processedDebts.filter(d => !d.isContentieux);
    const totalNonContentieuxAmount = nonContentieuxDebts.reduce((sum, d) => sum + Number(d.amount || 0), 0);
    const totalNonContentieuxPaid = nonContentieuxDebts.reduce((sum, d) => sum + Number(d.settlement || 0), 0);
    const totalNonContentieuxBalance = nonContentieuxDebts.reduce((sum, d) => sum + Number(d.balance || 0), 0);
    
    const unpaidRateNoContentieux = totalNonContentieuxAmount > 0 
      ? ((totalNonContentieuxAmount - totalNonContentieuxPaid) / totalNonContentieuxAmount) * 100 
      : 0;

    const recoveryRateNoContentieux = totalNonContentieuxAmount > 0
      ? (totalNonContentieuxPaid / totalNonContentieuxAmount) * 100
      : 0;

    // Analyse par client avancée
    const clientMap = new Map<string, any>();
    debts.forEach(debt => {
      if (!clientMap.has(debt.clientName)) {
        clientMap.set(debt.clientName, {
          clientName: debt.clientName,
          totalAmount: 0,
          totalBalance: 0,
          totalPaid: 0,
          riskLevel: 'healthy',
          paymentDelays: [] as number[],
          debtCount: 0
        });
      }
      const client = clientMap.get(debt.clientName);
      client.totalAmount += debt.amount;
      client.totalBalance += debt.balance;
      client.totalPaid += debt.settlement;
      client.paymentDelays.push(debt.paymentDays);
      client.debtCount++;
      
      // Déterminer le niveau de risque le plus élevé pour ce client
      if (debt.riskLevel === 'critical' || client.riskLevel === 'critical') {
        client.riskLevel = 'critical';
      } else if (debt.riskLevel === 'overdue' || client.riskLevel === 'overdue') {
        client.riskLevel = 'overdue';
      } else if (debt.riskLevel === 'monitoring' || client.riskLevel === 'monitoring') {
        client.riskLevel = 'monitoring';
      }
    });

    // Calculer les délais moyens pour chaque client
    const clientBreakdown = Array.from(clientMap.values())
      .map(client => ({
        ...client,
        averagePaymentDelay: client.paymentDelays.length > 0 
          ? client.paymentDelays.reduce((a: number, b: number) => a + b, 0) / client.paymentDelays.length 
          : 0
      }))
      .sort((a, b) => b.totalBalance - a.totalBalance);

    // Analyse par ancienneté
    const agingRanges = [
      { range: '0-30 jours', min: 0, max: 30, count: 0, amount: 0 },
      { range: '31-90 jours', min: 31, max: 90, count: 0, amount: 0 },
      { range: '91-365 jours', min: 91, max: 365, count: 0, amount: 0 },
      { range: '>365 jours', min: 366, max: Infinity, count: 0, amount: 0 }
    ];

    debts.forEach(debt => {
      if (debt.balance > 0) {
        const range = agingRanges.find(r => debt.age >= r.min && debt.age <= r.max);
        if (range) {
          range.count++;
          range.amount += debt.balance;
        }
      }
    });

    const agingBreakdown = agingRanges.map(range => ({
      range: range.range,
      count: range.count,
      amount: range.amount,
      percentage: totalBalance > 0 ? (range.amount / totalBalance) * 100 : 0
    }));

    // Analyse par tranches de montant
    const amountRanges = [
      { range: '< 1,000 TND', min: 0, max: 1000, count: 0, amount: 0 },
      { range: '1,000 - 5,000 TND', min: 1001, max: 5000, count: 0, amount: 0 },
      { range: '5,001 - 10,000 TND', min: 5001, max: 10000, count: 0, amount: 0 },
      { range: '10,001 - 50,000 TND', min: 10001, max: 50000, count: 0, amount: 0 },
      { range: '> 50,000 TND', min: 50001, max: Infinity, count: 0, amount: 0 }
    ];

    debts.forEach(debt => {
      if (debt.balance > 0) {
        const range = amountRanges.find(r => debt.balance >= r.min && debt.balance <= r.max);
        if (range) {
          range.count++;
          range.amount += debt.balance;
        }
      }
    });

    const amountRangesResult = amountRanges.map(range => ({
      range: range.range,
      count: range.count,
      amount: range.amount,
      percentage: totalBalance > 0 ? (range.amount / totalBalance) * 100 : 0
    }));

    // Top clients à risque
    const topRiskClients = debts
      .filter(debt => debt.balance > 0 && (debt.riskLevel === 'critical' || debt.riskLevel === 'overdue'))
      .sort((a, b) => b.balance - a.balance)
      .slice(0, 10);

    // Génération des alertes
    const alerts = this.generateAlerts(debts, clientBreakdown);

    // Statistiques avancées
    const allAges = debts.map(d => d.age);
    const allAmounts = debts.map(d => d.balance);
    const paymentDelays = debts.filter(d => d.settlement > 0).map(d => d.paymentDays);

    const averageDebtAmount = debts.length > 0 ? allAmounts.reduce((a, b) => a + b, 0) / debts.length : 0;
    const averagePaymentDelay = paymentDelays.length > 0 
      ? paymentDelays.reduce((a, b) => a + b, 0) / paymentDelays.length 
      : 0;
    
    // Calculer la médiane
    const sortedAmounts = [...allAmounts].sort((a, b) => a - b);
    const medianDebtAmount = sortedAmounts.length > 0 
      ? sortedAmounts[Math.floor(sortedAmounts.length / 2)] 
      : 0;

    const maxDebtAmount = allAmounts.length > 0 ? Math.max(...allAmounts) : 0;
    const minDebtAmount = allAmounts.length > 0 ? Math.min(...allAmounts) : 0;

    // Statut de paiement
    const fullyPaidCount = debts.filter(d => d.balance === 0 && d.settlement > 0).length;
    const partiallyPaidCount = debts.filter(d => d.balance > 0 && d.settlement > 0).length;
    const unpaidCount = debts.filter(d => d.settlement === 0).length;

    const fullyPaidPercentage = debts.length > 0 ? (fullyPaidCount / debts.length) * 100 : 0;
    const partiallyPaidPercentage = debts.length > 0 ? (partiallyPaidCount / debts.length) * 100 : 0;
    const unpaidPercentage = debts.length > 0 ? (unpaidCount / debts.length) * 100 : 0;

    // Prévision de trésorerie (moyenne mensuelle basée sur les 3 derniers mois)
    const projectedMonthlyCashflow = totalPaid / 3;

    // Distribution des risques
    const riskDistribution = {
      healthy: processedDebts.filter(d => d.riskLevel === 'healthy').length,
      monitoring: processedDebts.filter(d => d.riskLevel === 'monitoring').length,
      overdue: processedDebts.filter(d => d.riskLevel === 'overdue').length,
      critical: processedDebts.filter(d => d.riskLevel === 'critical').length
    };

    return {
      totalDebts,
      totalPaid,
      totalBalance,
      recoveryRate,
      recoveryRateNoContentieux,
      unpaidRateNoContentieux,
      globalUnpaidRate,
      clientBreakdown,
      agingBreakdown,
      amountRanges: amountRangesResult,
      topRiskClients,
      alerts,
      // Métriques avancées
      averageDebtAmount,
      averagePaymentDelay,
      medianDebtAmount,
      maxDebtAmount,
      minDebtAmount,
      fullyPaidPercentage,
      partiallyPaidPercentage,
      unpaidPercentage,
      projectedMonthlyCashflow,
      riskDistribution
    };
  }

  private static generateAlerts(debts: ClientDebt[], clientBreakdown: any[]): Alert[] {
    const alerts: Alert[] = [];
    let alertId = 1;

    // Alertes pour créances critiques
    debts
      .filter(debt => debt.riskLevel === 'critical' && debt.balance > 0)
      .forEach(debt => {
        alerts.push({
          id: `alert_${alertId++}`,
          type: 'critical_debt',
          clientName: debt.clientName,
          message: `Créance critique de ${debt.balance.toFixed(2)} TND (${debt.age} jours)`,
          severity: 'high',
          recommendation: 'Action immédiate requise - Contact téléphonique et mise en demeure'
        });
      });

    // Alertes pour retards fréquents
    clientBreakdown
      .filter(client => client.riskLevel === 'critical' || client.riskLevel === 'overdue')
      .forEach(client => {
        const clientDebts = debts.filter(d => d.clientName === client.clientName && d.balance > 0);
        if (clientDebts.length > 1) {
          alerts.push({
            id: `alert_${alertId++}`,
            type: 'frequent_delays',
            clientName: client.clientName,
            message: `${clientDebts.length} factures en retard pour un total de ${client.totalBalance.toFixed(2)} TND`,
            severity: 'high',
            recommendation: 'Suspendre les livraisons et négocier un plan de paiement'
          });
        }
      });

    // Alertes pour créances anciennes
    debts
      .filter(debt => debt.age > 730 && debt.balance > 0) // Plus de 2 ans
      .forEach(debt => {
        alerts.push({
          id: `alert_${alertId++}`,
          type: 'old_debt',
          clientName: debt.clientName,
          message: `Créance très ancienne (${Math.floor(debt.age / 365)} ans) de ${debt.balance.toFixed(2)} TND`,
          severity: 'medium',
          recommendation: 'Évaluer la possibilité de recouvrement juridique ou provision'
        });
      });

    // Alertes pour paiements partiels
    debts
      .filter(debt => debt.settlement > 0 && debt.settlement < debt.amount && debt.balance > 0)
      .forEach(debt => {
        const paymentRate = (debt.settlement / debt.amount) * 100;
        if (paymentRate < 50) {
          alerts.push({
            id: `alert_${alertId++}`,
            type: 'partial_payment',
            clientName: debt.clientName,
            message: `Paiement partiel de ${paymentRate.toFixed(1)}% (${debt.settlement.toFixed(2)} TND/${debt.amount.toFixed(2)} TND)`,
            severity: 'medium',
            recommendation: 'Contacter le client pour comprendre les raisons du paiement partiel'
          });
        }
      });

    return alerts.sort((a, b) => {
      const severityOrder = { high: 3, medium: 2, low: 1 };
      return severityOrder[b.severity] - severityOrder[a.severity];
    });
  }

  static getRiskColor(riskLevel: string): string {
    switch (riskLevel) {
      case 'healthy': return '#10b981'; // vert
      case 'monitoring': return '#f59e0b'; // jaune
      case 'overdue': return '#f97316'; // orange
      case 'critical': return '#ef4444'; // rouge
      default: return '#6b7280'; // gris
    }
  }

  static getRiskLabel(riskLevel: string): string {
    switch (riskLevel) {
      case 'healthy': return 'Sain';
      case 'monitoring': return 'À surveiller';
      case 'overdue': return 'En retard';
      case 'critical': return 'Critique';
      default: return 'Inconnu';
    }
  }
}
