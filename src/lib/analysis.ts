import { ClientDebt, AnalysisResult, Alert } from '@/types/debt';
import { format, differenceInDays } from 'date-fns';

export class AnalysisService {
  static analyzeDebts(debts: ClientDebt[]): AnalysisResult {
    const totalDebts = debts.reduce((sum, debt) => sum + debt.amount, 0);
    const totalPaid = debts.reduce((sum, debt) => sum + debt.paid, 0);
    const totalBalance = debts.reduce((sum, debt) => sum + debt.balance, 0);
    const recoveryRate = totalDebts > 0 ? (totalPaid / totalDebts) * 100 : 0;

    // Analyse par client
    const clientMap = new Map<string, any>();
    debts.forEach(debt => {
      if (!clientMap.has(debt.clientName)) {
        clientMap.set(debt.clientName, {
          clientName: debt.clientName,
          totalAmount: 0,
          totalBalance: 0,
          riskLevel: 'healthy'
        });
      }
      const client = clientMap.get(debt.clientName);
      client.totalAmount += debt.amount;
      client.totalBalance += debt.balance;
      
      // Déterminer le niveau de risque le plus élevé pour ce client
      if (debt.riskLevel === 'critical' || client.riskLevel === 'critical') {
        client.riskLevel = 'critical';
      } else if (debt.riskLevel === 'overdue' || client.riskLevel === 'overdue') {
        client.riskLevel = 'overdue';
      } else if (debt.riskLevel === 'monitoring' || client.riskLevel === 'monitoring') {
        client.riskLevel = 'monitoring';
      }
    });

    const clientBreakdown = Array.from(clientMap.values())
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
        const range = agingRanges.find(r => debt.agingDays >= r.min && debt.agingDays <= r.max);
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

    // Top clients à risque
    const topRiskClients = debts
      .filter(debt => debt.balance > 0 && (debt.riskLevel === 'critical' || debt.riskLevel === 'overdue'))
      .sort((a, b) => b.balance - a.balance)
      .slice(0, 10);

    // Génération des alertes
    const alerts = this.generateAlerts(debts, clientBreakdown);

    return {
      totalDebts,
      totalPaid,
      totalBalance,
      recoveryRate,
      clientBreakdown,
      agingBreakdown,
      topRiskClients,
      alerts
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
          message: `Créance critique de ${debt.balance.toFixed(2)}€ (${debt.agingDays} jours)`,
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
            message: `${clientDebts.length} factures en retard pour un total de ${client.totalBalance.toFixed(2)}€`,
            severity: 'high',
            recommendation: 'Suspendre les livraisons et négocier un plan de paiement'
          });
        }
      });

    // Alertes pour créances anciennes
    debts
      .filter(debt => debt.agingDays > 730 && debt.balance > 0) // Plus de 2 ans
      .forEach(debt => {
        alerts.push({
          id: `alert_${alertId++}`,
          type: 'old_debt',
          clientName: debt.clientName,
          message: `Créance très ancienne (${Math.floor(debt.agingDays / 365)} ans) de ${debt.balance.toFixed(2)}€`,
          severity: 'medium',
          recommendation: 'Évaluer la possibilité de recouvrement juridique ou provision'
        });
      });

    // Alertes pour paiements partiels
    debts
      .filter(debt => debt.paid > 0 && debt.paid < debt.amount && debt.balance > 0)
      .forEach(debt => {
        const paymentRate = (debt.paid / debt.amount) * 100;
        if (paymentRate < 50) {
          alerts.push({
            id: `alert_${alertId++}`,
            type: 'partial_payment',
            clientName: debt.clientName,
            message: `Paiement partiel de ${paymentRate.toFixed(1)}% (${debt.paid.toFixed(2)}€/${debt.amount.toFixed(2)}€)`,
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
