import { ClientDebt, AnalysisResult, Alert } from '@/types/debt';

// Fonctions utilitaires sorties de la classe pour éviter les erreurs de minification
function generateAlerts(debts: ClientDebt[]): Alert[] {
  const alerts: Alert[] = [];
  try {
    let alertId = 1;
    debts.filter(d => Number(d.balance || 0) > 10000).forEach(d => {
      alerts.push({
        id: `a${alertId++}`,
        type: 'critical_debt',
        clientName: d.clientName,
        message: `Solde important: ${Number(d.balance).toFixed(2)}`,
        severity: 'high',
        recommendation: 'Suivi requis'
      });
    });
  } catch (e) {
    console.error('Alert error:', e);
  }
  return alerts;
}

export const AnalysisService = {
  analyzeDebts(debts: ClientDebt[]): AnalysisResult {
    try {
      const processedDebts = debts.map(d => ({
        ...d,
        amount: Number(d.amount || 0),
        settlement: Number(d.settlement || 0),
        balance: Number(d.balance || 0),
        age: Number(d.age || 0),
        isContentieux: Number(d.age || 0) > 365
      }));

      const totalDebts = processedDebts.reduce((sum, debt) => sum + debt.amount, 0);
      const totalPaid = processedDebts.reduce((sum, debt) => sum + debt.settlement, 0);
      const totalBalance = processedDebts.reduce((sum, debt) => sum + debt.balance, 0);
      
      const recoveryRate = totalDebts > 0 ? (totalPaid / totalDebts) * 100 : 0;
      const globalUnpaidRate = totalDebts > 0 ? (totalBalance / totalDebts) * 100 : 0;

      const nonContentieuxDebts = processedDebts.filter(d => !d.isContentieux);
      const totalNonContentieuxAmount = nonContentieuxDebts.reduce((sum, d) => sum + d.amount, 0);
      const totalNonContentieuxPaid = nonContentieuxDebts.reduce((sum, d) => sum + d.settlement, 0);
      
      const unpaidRateNoContentieux = totalNonContentieuxAmount > 0 
        ? ((totalNonContentieuxAmount - totalNonContentieuxPaid) / totalNonContentieuxAmount) * 100 
        : 0;

      const recoveryRateNoContentieux = totalNonContentieuxAmount > 0
        ? (totalNonContentieuxPaid / totalNonContentieuxAmount) * 100
        : 0;

      // Analyse par client simplifiée pour stabilité
      const clientMap = new Map<string, any>();
      processedDebts.forEach(debt => {
        if (!clientMap.has(debt.clientName)) {
          clientMap.set(debt.clientName, {
            clientName: debt.clientName,
            clientCode: debt.clientCode || '?',
            commercialName: debt.commercialName || 'Non assigné',
            commercialCode: debt.commercialCode || '?',
            sourceFile: debt.sourceFile || '?',
            totalAmount: 0,
            totalBalance: 0,
            totalPaid: 0,
            riskLevel: 'healthy',
            debtCount: 0
          });
        }
        const client = clientMap.get(debt.clientName);
        client.totalAmount += debt.amount;
        client.totalBalance += debt.balance;
        client.totalPaid += debt.settlement;
        client.debtCount++;
        
        // Mise à jour du commercial et source si non renseignés
        if (client.commercialName === 'Non assigné' && debt.commercialName) client.commercialName = debt.commercialName;
        if (client.commercialCode === '?' && debt.commercialCode) client.commercialCode = debt.commercialCode;
        if (client.sourceFile === '?' && debt.sourceFile) client.sourceFile = debt.sourceFile;
        
        if (debt.riskLevel === 'critical' || client.riskLevel === 'critical') client.riskLevel = 'critical';
      });

      const clientBreakdown = Array.from(clientMap.values())
        .map(c => ({ ...c, averagePaymentDelay: 0 }))
        .sort((a, b) => b.totalBalance - a.totalBalance);

      // Aging
      const agingRanges = [
        { range: '0-30 jours', min: 0, max: 30, amount: 0 },
        { range: '31-90 jours', min: 31, max: 90, amount: 0 },
        { range: '91-365 jours', min: 91, max: 365, amount: 0 },
        { range: '>365 jours', min: 366, max: Infinity, amount: 0 }
      ];

      processedDebts.forEach(debt => {
        if (debt.balance > 0) {
          const range = agingRanges.find(r => debt.age >= r.min && debt.age <= r.max);
          if (range) range.amount += debt.balance;
        }
      });

      const agingBreakdown = agingRanges.map(range => ({
        range: range.range,
        count: 0,
        amount: range.amount,
        percentage: totalBalance > 0 ? (range.amount / totalBalance) * 100 : 0
      }));

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
        amountRanges: [],
        topRiskClients: processedDebts.filter(d => d.balance > 0).slice(0, 10),
        alerts: generateAlerts(processedDebts),
        averageDebtAmount: totalDebts / (processedDebts.length || 1),
        averagePaymentDelay: 0,
        medianDebtAmount: 0,
        maxDebtAmount: 0,
        minDebtAmount: 0,
        fullyPaidPercentage: 0,
        partiallyPaidPercentage: 0,
        unpaidPercentage: 0,
        projectedMonthlyCashflow: 0,
        riskDistribution: { healthy: 0, monitoring: 0, overdue: 0, critical: 0 },
        processedDebts
      };
    } catch (error) {
      console.error('Analyze error:', error);
      throw error;
    }
  },

  getRiskColor(riskLevel: string): string {
    switch (riskLevel) {
      case 'healthy': return '#10b981';
      case 'monitoring': return '#f59e0b';
      case 'overdue': return '#f97316';
      case 'critical': return '#ef4444';
      default: return '#6b7280';
    }
  },

  getRiskLabel(riskLevel: string): string {
    switch (riskLevel) {
      case 'healthy': return 'Sain';
      case 'monitoring': return 'À surveiller';
      case 'overdue': return 'En retard';
      case 'critical': return 'Critique';
      default: return 'Inconnu';
    }
  }
};
