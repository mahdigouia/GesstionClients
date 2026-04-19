export interface ClientDebt {
  id: string;
  clientCode: string;
  clientName: string;
  clientPhone?: string;
  dueDate: string;
  documentDate: string;
  documentNumber: string;
  age: number;
  paymentDays: number;
  description: string;
  amount: number;
  settlement: number;
  balance: number;
  riskLevel: 'healthy' | 'monitoring' | 'overdue' | 'critical';
  sourceFile: string;
  currency?: 'EUR' | 'TND' | 'USD';
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
  }[];
  agingBreakdown: {
    range: string;
    count: number;
    amount: number;
    percentage: number;
  }[];
  topRiskClients: ClientDebt[];
  alerts: Alert[];
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
