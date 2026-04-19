export interface ClientDebt {
  id: string;
  clientCode: string;
  clientName: string;
  clientPhone?: string;
  dueDate: string;
  documentDate: string;
  documentNumber: string;
  documentType: 'invoice' | 'credit_note' | 'unpaid_old' | 'other';
  age: number;
  paymentDays: number;
  description: string;
  amount: number;
  settlement: number;
  balance: number;
  paymentStatus: 'unpaid' | 'retained' | 'partial' | 'paid';
  riskLevel: 'healthy' | 'monitoring' | 'overdue' | 'critical';
  sourceFile: string;
  currency?: 'EUR' | 'TND' | 'USD';
  // Commercial information
  commercialCode?: string;
  commercialName?: string;
  // Contentieux flag
  isContentieux?: boolean;
}

export interface AnalysisResult {
  totalDebts: number;
  totalPaid: number;
  totalBalance: number;
  recoveryRate: number;
  clientBreakdown: {
    clientName: string;
    totalAmount: number;
    totalBalance: number;
    riskLevel: string;
    averagePaymentDelay: number;
    debtCount: number;
  }[];
  agingBreakdown: {
    range: string;
    count: number;
    amount: number;
    percentage: number;
  }[];
  amountRanges: {
    range: string;
    count: number;
    amount: number;
    percentage: number;
  }[];
  topRiskClients: ClientDebt[];
  alerts: Alert[];
  // Métriques avancées
  averageDebtAmount: number;
  averagePaymentDelay: number;
  medianDebtAmount: number;
  maxDebtAmount: number;
  minDebtAmount: number;
  fullyPaidPercentage: number;
  partiallyPaidPercentage: number;
  unpaidPercentage: number;
  projectedMonthlyCashflow: number;
  riskDistribution: {
    healthy: number;
    monitoring: number;
    overdue: number;
    critical: number;
  };
}

export interface Alert {
  id: string;
  type: 'critical_debt' | 'frequent_delays' | 'old_debt' | 'partial_payment';
  clientName: string;
  message: string;
  severity: 'high' | 'medium' | 'low';
  recommendation: string;
}

export interface ProcessingResult {
  success: boolean;
  data?: ClientDebt[];
  analysis?: AnalysisResult;
  error?: string;
  processingTime?: number;
}
