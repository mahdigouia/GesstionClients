'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  Legend
} from 'recharts';
import { 
  AlertTriangle, 
  TrendingUp, 
  Users, 
  DollarSign, 
  ArrowUpRight,
  ArrowDownRight,
  Calendar,
  FileText,
  Bell,
  Eye,
  Download,
  Zap,
  ChevronRight
} from 'lucide-react';
import { AnalysisResult } from '@/types/debt';
import { AnalysisService } from '@/lib/analysis';
import { useState } from 'react';
import { DebtEvolutionChart } from './DebtEvolutionChart';
import { useDebtContext } from '@/lib/DebtContext';

interface DashboardProps {
  analysis: AnalysisResult;
  onViewDetail?: () => void;
  onClientClick?: (clientName: string) => void;
}

export function Dashboard({ analysis, onViewDetail, onClientClick }: DashboardProps) {
  const { history } = useDebtContext();
  const [selectedRisk, setSelectedRisk] = useState<string | null>(null);
  const [showNotifications, setShowNotifications] = useState(false);

  const riskColors = {
    healthy: '#10b981',
    monitoring: '#f59e0b',
    overdue: '#f97316',
    critical: '#ef4444'
  };

  const pieColors = ['#10b981', '#f59e0b', '#f97316', '#ef4444'];

  // Logic for Potential Liquidity Opportunities (< 90 days, > 10k TND cumul per client)
  const liquidityOpportunities = (() => {
    if (!analysis.processedDebts) return [];

    const clientOpportunities = new Map<string, {
      clientName: string;
      totalRecentBalance: number;
      debtCount: number;
    }>();

    analysis.processedDebts.forEach(debt => {
      // Criteria: age < 90, not contentieux, balance > 0
      if (debt.age < 90 && !debt.isContentieux && debt.balance > 0) {
        const existing = clientOpportunities.get(debt.clientName) || {
          clientName: debt.clientName,
          totalRecentBalance: 0,
          debtCount: 0
        };
        
        existing.totalRecentBalance += debt.balance;
        existing.debtCount += 1;
        clientOpportunities.set(debt.clientName, existing);
      }
    });

    return Array.from(clientOpportunities.values())
      .filter(opp => opp.totalRecentBalance > 10000)
      .sort((a, b) => b.totalRecentBalance - a.totalRecentBalance);
  })();

  return (
    <div className="space-y-6">
      {/* KPI Cards avec design moderne */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white border-0 shadow-lg hover:shadow-xl transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-blue-100">Total Créances</CardTitle>
            <div className="p-2 bg-white/20 rounded-lg">
              <DollarSign className="h-4 w-4 text-white" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {Number(analysis.totalDebts || 0).toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} <span className="text-lg">TND</span>
            </div>
            <div className="text-[10px] opacity-80 font-normal mt-0.5">(Total facturé)</div>
            <div className="flex items-center gap-1 mt-2 text-blue-100 text-sm">
              <ArrowUpRight className="h-4 w-4" />
              <span>{Number(analysis.totalBalance || 0).toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} TND en attente</span>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-emerald-500 to-emerald-600 text-white border-0 shadow-lg hover:shadow-xl transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-emerald-100 leading-tight">
              Taux d'Impayés Global <br />
              <span className="text-[10px] font-normal opacity-80">(Formule: Σ Solde / Σ Montant)</span>
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-emerald-200" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {Number(analysis.globalUnpaidRate || 0).toFixed(1)}%
            </div>
            <div className="mt-3">
              <div className="h-2 bg-white/30 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-white rounded-full transition-all duration-500"
                  style={{ width: `${Math.max(0, 100 - Number(analysis.globalUnpaidRate || 0))}%` }}
                />
              </div>
            </div>
          </CardContent>
        </Card>


        <Card className="bg-gradient-to-br from-violet-500 to-violet-600 text-white border-0 shadow-lg hover:shadow-xl transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-violet-100">Clients Actifs</CardTitle>
            <div className="p-2 bg-white/20 rounded-lg">
              <Users className="h-4 w-4 text-white" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {analysis.clientBreakdown?.length || 0}
            </div>
            <div className="flex items-center gap-1 mt-2 text-violet-100 text-sm">
              <span>{analysis.clientBreakdown?.filter(c => c.totalBalance > 0).length || 0} avec solde impayé</span>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-red-500 to-red-600 text-white border-0 shadow-lg hover:shadow-xl transition-shadow cursor-pointer"
              onClick={() => setShowNotifications(!showNotifications)}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-red-100">Alertes Critiques</CardTitle>
            <div className="p-2 bg-white/20 rounded-lg relative">
              <Bell className="h-4 w-4 text-white" />
              {(analysis.alerts?.filter(a => a.severity === 'high').length || 0) > 0 && (
                <span className="absolute -top-1 -right-1 w-3 h-3 bg-yellow-400 rounded-full animate-pulse" />
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {analysis.alerts?.filter(a => a.severity === 'high').length || 0}
            </div>
            <div className="flex items-center gap-1 mt-2 text-red-100 text-sm">
              <AlertTriangle className="h-4 w-4" />
              <span>{analysis.alerts?.length || 0} alertes totales - Cliquez pour voir</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Historique d'Évolution (Pro) */}
      <DebtEvolutionChart history={history} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Potential Liquidity Opportunities */}
        <Card className="border-0 shadow-xl bg-white overflow-hidden">
          <CardHeader className="border-b border-gray-50 bg-gradient-to-r from-blue-50 to-indigo-50 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-lg font-bold text-blue-900 flex items-center gap-2">
                <Zap className="h-5 w-5 text-blue-600 fill-blue-600" />
                Opportunités de Liquidité Rapide
              </CardTitle>
              <p className="text-xs text-blue-700 font-medium mt-1">Clients &lt; 90 jours avec solde &gt; 10k TND</p>
            </div>
            <Badge className="bg-blue-600 text-white border-0">
              {liquidityOpportunities.length} opportunités
            </Badge>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-gray-100">
              {liquidityOpportunities.length > 0 ? (
                liquidityOpportunities.map((opp, index) => (
                  <div 
                    key={index}
                    className="flex items-center justify-between p-4 hover:bg-blue-50/50 transition-colors cursor-pointer group"
                    onClick={() => onClientClick?.(opp.clientName)}
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center text-blue-600 font-bold shadow-sm group-hover:scale-110 transition-transform">
                        {index + 1}
                      </div>
                      <div>
                        <div className="font-bold text-slate-800 group-hover:text-blue-700 transition-colors">{opp.clientName}</div>
                        <div className="text-xs text-slate-500 font-medium">{opp.debtCount} facture{opp.debtCount > 1 ? 's' : ''} récente{opp.debtCount > 1 ? 's' : ''}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <div className="text-lg font-black text-blue-700">
                          {opp.totalRecentBalance.toLocaleString('fr-FR')} <span className="text-[10px] font-bold">TND</span>
                        </div>
                        <div className="text-[10px] text-emerald-600 font-bold uppercase tracking-wider">Potentiel Immédiat</div>
                      </div>
                      <ChevronRight className="h-5 w-5 text-slate-300 group-hover:text-blue-500 transition-colors" />
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-8 text-center">
                  <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-slate-100 text-slate-400 mb-3">
                    <Zap className="h-6 w-6" />
                  </div>
                  <p className="text-slate-500 text-sm font-medium">Aucune opportunité de liquidité &gt; 10k TND détectée actuellement.</p>
                </div>
              )}
            </div>
            {liquidityOpportunities.length > 0 && (
              <div className="p-3 bg-blue-50/30 border-t border-gray-100 text-center">
                <p className="text-[11px] text-blue-600 font-bold">
                  Total potentiel : {liquidityOpportunities.reduce((sum, o) => sum + o.totalRecentBalance, 0).toLocaleString('fr-FR')} TND
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Top Risk Clients */}
        <Card className="border-0 shadow-xl bg-white overflow-hidden">
          <CardHeader className="border-b border-gray-50 bg-gradient-to-r from-red-50 to-orange-50">
            <CardTitle className="text-lg font-bold text-red-900 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-600" />
              Clients à Risque Élevé
            </CardTitle>
            <p className="text-xs text-red-700 font-medium mt-1">Factures critiques nécessitant une attention</p>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-gray-100">
              {analysis.topRiskClients.slice(0, 6).map((client) => (
                <div 
                  key={client.id} 
                  className="flex items-center justify-between p-4 hover:bg-red-50/50 transition-colors cursor-pointer group"
                  onClick={() => onClientClick?.(client.clientName)}
                >
                  <div className="flex-1">
                    <div className="font-bold text-slate-800 group-hover:text-red-700 transition-colors">{client.clientName}</div>
                    <div className="text-xs text-slate-500 font-medium">
                      Facture {client.documentNumber} • {client.age} jours
                    </div>
                  </div>
                  <div className="text-right flex items-center gap-4">
                    <div>
                      <div className="font-bold text-lg text-slate-900">
                        {client.balance.toLocaleString('fr-FR')} <span className="text-[10px]">TND</span>
                      </div>
                      <Badge 
                        variant="outline" 
                        className="text-[9px] h-4 py-0 font-bold border-0"
                        style={{ 
                          backgroundColor: riskColors[client.riskLevel] + '20',
                          color: riskColors[client.riskLevel]
                        }}
                      >
                        {AnalysisService.getRiskLabel(client.riskLevel)}
                      </Badge>
                    </div>
                    <ChevronRight className="h-5 w-5 text-slate-300 group-hover:text-red-500 transition-colors" />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Notifications Panel */}
      {showNotifications && analysis.alerts.length > 0 && (
        <Card className="border-2 border-red-200 shadow-lg animate-in slide-in-from-top-2">
          <CardHeader className="flex flex-row items-center justify-between bg-red-50">
            <div className="flex items-center gap-2">
              <Bell className="h-5 w-5 text-red-600" />
              <CardTitle className="text-red-800">Notifications et Alertes</CardTitle>
            </div>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => setShowNotifications(false)}
              className="text-red-600 hover:text-red-800"
            >
              Fermer
            </Button>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="space-y-3">
              {analysis.alerts.slice(0, 5).map((alert) => (
                <Alert key={alert.id} className={
                  alert.severity === 'high' ? 'border-red-300 bg-red-50 shadow-sm' :
                  alert.severity === 'medium' ? 'border-yellow-300 bg-yellow-50 shadow-sm' :
                  'border-blue-300 bg-blue-50 shadow-sm'
                }>
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-full ${
                      alert.severity === 'high' ? 'bg-red-200 text-red-700' :
                      alert.severity === 'medium' ? 'bg-yellow-200 text-yellow-700' :
                      'bg-blue-200 text-blue-700'
                    }`}>
                      <AlertTriangle className="h-4 w-4" />
                    </div>
                    <AlertDescription className="flex-1">
                      <div className="font-semibold text-gray-900">{alert.clientName}</div>
                      <div className="text-sm text-gray-600 mt-1">{alert.message}</div>
                      <div className="text-sm font-medium mt-2 p-2 bg-white/50 rounded-lg">
                        💡 {alert.recommendation}
                      </div>
                    </AlertDescription>
                  </div>
                </Alert>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
