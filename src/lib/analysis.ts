import { ClientDebt, AnalysisResult, Alert } from '@/types/debt';

// Fonctions utilitaires sorties de la classe pour éviter les erreurs de minification
function generateAlerts(debts: ClientDebt[]): Alert[] {
  const alerts: Alert[] = [];
  try {
    let alertId = 1;
    debts.filter(d => Number(d.balance || 0) > 10000).forEach(d => {
      alerts.push({
        id: `critical_${d.clientName}_${d.balance}`,
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
  analyzeDebts(debts: ClientDebt[], config?: { contentiousAgeDays: number, retentionMin: number, retentionMax: number }): AnalysisResult {
    const contentiousThreshold = config?.contentiousAgeDays || 365;
    const minRet = config?.retentionMin !== undefined ? config.retentionMin : 0.5;
    const maxRet = config?.retentionMax !== undefined ? config.retentionMax : 1.5;

    try {
      const processedDebts = debts.map(d => {
        const amount = Number(d.amount || 0);
        const balance = Number(d.balance || 0);
        const age = Number(d.age || 0);
        
        // Calcul de la retenue : si le solde est dans l'intervalle défini
        const ratio = amount > 0 ? (balance / amount) * 100 : 0;
        const isRetention = ratio >= minRet && ratio <= maxRet;

        return {
          ...d,
          amount,
          settlement: Number(d.settlement || 0),
          balance,
          age,
          isContentieux: age > contentiousThreshold,
          isRetention
        };
      });

      const totalDebts = processedDebts.reduce((sum, debt) => sum + debt.amount, 0);
      const totalPaid = processedDebts.reduce((sum, debt) => sum + debt.settlement, 0);
      const totalBalance = processedDebts.reduce((sum, debt) => sum + debt.balance, 0);
      const totalRetainedAmount = processedDebts.filter(d => d.isRetention).reduce((sum, d) => sum + d.balance, 0);
      
      const recoveryRate = totalDebts > 0 ? (totalPaid / totalDebts) * 100 : 0;
      const globalUnpaidRate = totalDebts > 0 ? (totalBalance / totalDebts) * 100 : 0;

      const nonContentieuxDebts = processedDebts.filter(d => !d.isContentieux);
      const totalNonContentieuxAmount = nonContentieuxDebts.reduce((sum, d) => sum + d.amount, 0);
      const totalNonContentieuxPaid = nonContentieuxDebts.reduce((sum, d) => sum + d.settlement, 0);
      const totalBalanceNoContentieux = nonContentieuxDebts.reduce((sum, d) => sum + d.balance, 0);
      
      const unpaidRateNoContentieux = totalNonContentieuxAmount > 0 
        ? ((totalNonContentieuxAmount - totalNonContentieuxPaid) / totalNonContentieuxAmount) * 100 
        : 0;

      const recoveryRateNoContentieux = totalNonContentieuxAmount > 0
        ? (totalNonContentieuxPaid / totalNonContentieuxAmount) * 100
        : 0;

      // Stats de montant
      const amounts = processedDebts.map(d => d.amount).sort((a, b) => a - b);
      const medianDebtAmount = amounts.length > 0 ? amounts[Math.floor(amounts.length / 2)] : 0;
      const minDebtAmount = amounts.length > 0 ? Math.min(...amounts) : 0;

      // Statut de paiement
      const fullyPaidCount = processedDebts.filter(d => d.balance <= 0 && d.amount > 0).length;
      const partiallyPaidCount = processedDebts.filter(d => d.balance > 0 && d.settlement > 0).length;
      const unpaidCount = processedDebts.filter(d => d.settlement <= 0 && d.amount > 0).length;
      const totalCount = processedDebts.filter(d => d.amount > 0).length || 1;

      const fullyPaidPercentage = (fullyPaidCount / totalCount) * 100;
      const partiallyPaidPercentage = (partiallyPaidCount / totalCount) * 100;
      const unpaidPercentage = (unpaidCount / totalCount) * 100;

      // Distribution des risques
      const riskDistribution = { healthy: 0, monitoring: 0, overdue: 0, critical: 0 };
      processedDebts.forEach(d => {
        if (d.riskLevel in riskDistribution) {
          riskDistribution[d.riskLevel as keyof typeof riskDistribution]++;
        }
      });

      // Tranches de montant
      const amountBrackets = [
        { range: '0 - 1k', min: 0, max: 1000, amount: 0 },
        { range: '1k - 5k', min: 1001, max: 5000, amount: 0 },
        { range: '5k - 20k', min: 5001, max: 20000, amount: 0 },
        { range: '> 20k', min: 20001, max: Infinity, amount: 0 }
      ];

      processedDebts.forEach(d => {
        const bracket = amountBrackets.find(b => d.amount >= b.min && d.amount <= b.max);
        if (bracket) bracket.amount += d.amount;
      });

      const amountRanges = amountBrackets.map(b => ({ range: b.range, amount: b.amount }));
 
      // Analyse par commercial
      const commercialMap = new Map<string, any>();
      processedDebts.forEach(debt => {
        const commCode = debt.commercialCode || 'N/A';
        const commName = debt.commercialName || 'Non assigné';
        
        if (!commercialMap.has(commCode)) {
          commercialMap.set(commCode, {
            code: commCode,
            name: commName,
            totalAmount: 0,
            totalBalance: 0,
            totalPaid: 0,
            debtCount: 0,
            clients: new Set<string>()
          });
        }
        const comm = commercialMap.get(commCode);
        comm.totalAmount += debt.amount;
        comm.totalBalance += debt.balance;
        comm.totalPaid += debt.settlement;
        comm.debtCount++;
        comm.clients.add(debt.clientName);
      });

      const commercialBreakdown = Array.from(commercialMap.values()).map(c => ({
        code: c.code,
        name: c.name,
        totalAmount: c.totalAmount,
        totalBalance: c.totalBalance,
        totalPaid: c.totalPaid,
        recoveryRate: c.totalAmount > 0 ? (c.totalPaid / c.totalAmount) * 100 : 0,
        debtCount: c.debtCount,
        clientCount: c.clients.size
      })).sort((a, b) => b.totalBalance - a.totalBalance);

      // Délai moyen et prévision
      const debtsWithDelay = processedDebts.filter(d => (d.paymentDays || 0) > 0);
      const averagePaymentDelay = debtsWithDelay.length > 0 
        ? debtsWithDelay.reduce((sum, d) => sum + (d.paymentDays || 0), 0) / debtsWithDelay.length 
        : processedDebts.reduce((sum, d) => sum + d.age, 0) / (processedDebts.length || 1);

      // DSO No Contentieux
      const ncWithDelay = nonContentieuxDebts.filter(d => (d.paymentDays || 0) > 0);
      const averagePaymentDelayNoContentieux = ncWithDelay.length > 0
        ? ncWithDelay.reduce((sum, d) => sum + (d.paymentDays || 0), 0) / ncWithDelay.length
        : nonContentieuxDebts.reduce((sum, d) => sum + d.age, 0) / (nonContentieuxDebts.length || 1);

      const projectedMonthlyCashflow = totalBalance * (recoveryRate / 100);
      const projectedMonthlyCashflowNoContentieux = totalBalanceNoContentieux * (recoveryRateNoContentieux / 100);

      // Analyse par client
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
            debtCount: 0,
            minExtractIndex: debt.extractIndex ?? 999999
          });
        }
        const client = clientMap.get(debt.clientName);
        client.totalAmount += debt.amount;
        client.totalBalance += debt.balance;
        client.totalPaid += debt.settlement;
        client.debtCount++;
        
        if (debt.extractIndex !== undefined && debt.extractIndex < client.minExtractIndex) {
          client.minExtractIndex = debt.extractIndex;
        }

        if (client.commercialName === 'Non assigné' && debt.commercialName) client.commercialName = debt.commercialName;
        
        // Risque client max
        const riskPriority = { healthy: 0, monitoring: 1, overdue: 2, critical: 3 };
        const currentRisk = riskPriority[debt.riskLevel as keyof typeof riskPriority] || 0;
        const clientRisk = riskPriority[client.riskLevel as keyof typeof riskPriority] || 0;
        if (currentRisk > clientRisk) {
          client.riskLevel = debt.riskLevel;
        }
      });

      const clientBreakdown = Array.from(clientMap.values())
        .map(c => ({ ...c, averagePaymentDelay: 0 }))
        .sort((a, b) => {
          const fileComp = (a.sourceFile || '').localeCompare(b.sourceFile || '');
          if (fileComp !== 0) return fileComp;
          return (a.minExtractIndex || 0) - (b.minExtractIndex || 0);
        });

      // Aging
      const agingRanges = [
        { range: '0-15 jours', min: 0, max: 15, amount: 0, clients: new Map<string, number>() },
        { range: '16-30 jours', min: 16, max: 30, amount: 0, clients: new Map<string, number>() },
        { range: '31-90 jours', min: 31, max: 90, amount: 0, clients: new Map<string, number>() },
        { range: '91-365 jours', min: 91, max: 365, amount: 0, clients: new Map<string, number>() },
        { range: '>365 jours', min: 366, max: Infinity, amount: 0, clients: new Map<string, number>() }
      ];

      processedDebts.forEach(debt => {
        if (debt.balance > 0) {
          const range = agingRanges.find(r => debt.age >= r.min && debt.age <= r.max);
          if (range) {
            range.amount += debt.balance;
            const current = range.clients.get(debt.clientName) || 0;
            range.clients.set(debt.clientName, current + debt.balance);
          }
        }
      });

      const agingBreakdown = agingRanges.map(range => ({
        range: range.range,
        count: 0,
        amount: range.amount,
        percentage: totalBalance > 0 ? (range.amount / totalBalance) * 100 : 0,
        topClients: Array.from(range.clients.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 2)
          .map(([clientName, totalBalance]) => ({ clientName, totalBalance }))
      }));

      return {
        totalDebts,
        totalPaid,
        totalBalance,
        totalBalanceNoContentieux,
        recoveryRate,
        recoveryRateNoContentieux,
        unpaidRateNoContentieux,
        globalUnpaidRate,
        clientBreakdown,
        commercialBreakdown,
        agingBreakdown,
        amountRanges,
        topRiskClients: Array.from(clientMap.values())
          .filter(c => c.totalBalance > 0)
          .sort((a, b) => b.totalBalance - a.totalBalance)
          .slice(0, 10),
        alerts: generateAlerts(processedDebts),
        averageDebtAmount: totalDebts / (processedDebts.length || 1),
        averageDebtAmountNoContentieux: totalNonContentieuxAmount / (nonContentieuxDebts.length || 1),
        averagePaymentDelay,
        averagePaymentDelayNoContentieux,
        medianDebtAmount,
        maxDebtAmount: Math.max(...Array.from(clientMap.values()).map(c => c.totalBalance), 0),
        minDebtAmount,
        fullyPaidPercentage,
        partiallyPaidPercentage,
        unpaidPercentage,
        projectedMonthlyCashflow,
        projectedMonthlyCashflowNoContentieux,
        riskDistribution,
        totalRetainedAmount,
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
