export interface ClientDebt {
  id: string;
  clientCode: string;
  clientName: string;
  invoiceNumber: string;
  invoiceDate: string;
  amount: number;
  paid: number;
  balance: number;
  agingDays: number;
  riskLevel: 'healthy' | 'monitoring' | 'overdue' | 'critical';
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
