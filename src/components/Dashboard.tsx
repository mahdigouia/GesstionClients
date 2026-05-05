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
  Area
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
  Download
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
        {/* Aging Chart */}
        <Card className="border-0 shadow-xl bg-white overflow-hidden">
          <CardHeader className="border-b border-gray-50 bg-gray-50/30">
            <CardTitle className="text-lg font-bold text-slate-800">Répartition par Ancienneté</CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={analysis.agingBreakdown} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#6366f1" stopOpacity={1} />
                    <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0.8} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey="range" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#64748b', fontSize: 11, fontWeight: 500 }}
                  dy={10}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#64748b', fontSize: 11, fontWeight: 500 }}
                  tickFormatter={(val) => `${(val / 1000).toFixed(0)}k`}
                />
                <Tooltip 
                  cursor={{ fill: '#f8fafc' }}
                  contentStyle={{ 
                    borderRadius: '12px', 
                    border: 'none', 
                    boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                    padding: '12px'
                  }}
                  formatter={(value: any) => [`${Number(value).toLocaleString('fr-FR')} TND`, 'Montant']}
                />
                <Bar 
                  dataKey="amount" 
                  fill="url(#barGradient)" 
                  radius={[6, 6, 0, 0]} 
                  barSize={40}
                />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Risk Distribution Pie Chart - Donut style */}
        <Card className="border-0 shadow-xl bg-white overflow-hidden">
          <CardHeader className="border-b border-gray-50 bg-gray-50/30">
            <CardTitle className="text-lg font-bold text-slate-800">Répartition par Risque</CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={analysis.agingBreakdown}
                  cx="50%"
                  cy="50%"
                  innerRadius={70}
                  outerRadius={100}
                  paddingAngle={5}
                  dataKey="amount"
                >
                  {analysis.agingBreakdown.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={pieColors[index % pieColors.length]} 
                      stroke="none"
                    />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ 
                    borderRadius: '12px', 
                    border: 'none', 
                    boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' 
                  }}
                  formatter={(value: any, name: any, props: any) => [
                    `${Number(value).toLocaleString('fr-FR')} TND`, 
                    props.payload.range
                  ]}
                />
                <Legend 
                  verticalAlign="bottom" 
                  height={36}
                  iconType="circle"
                  formatter={(value, entry: any) => (
                    <span className="text-xs font-semibold text-slate-600">
                      {entry.payload.range}
                    </span>
                  )}
                />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Top Risk Clients */}
      <Card>
        <CardHeader>
          <CardTitle>Clients à Risque Élevé</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {analysis.topRiskClients.slice(0, 5).map((client) => (
              <div 
                key={client.id} 
                className="flex items-center justify-between p-3 border rounded-lg hover:bg-slate-50 cursor-pointer transition-colors group"
                onClick={() => onClientClick?.(client.clientName)}
              >
                <div className="flex-1">
                  <div className="font-medium group-hover:text-blue-600 transition-colors">{client.clientName}</div>
                  <div className="text-sm text-gray-500">
                    Facture {client.documentNumber} • {client.age} jours
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-lg">
                    {client.balance.toFixed(2)} TND
                  </div>
                  <Badge 
                    variant="outline" 
                    style={{ 
                      backgroundColor: riskColors[client.riskLevel] + '20',
                      borderColor: riskColors[client.riskLevel],
                      color: riskColors[client.riskLevel]
                    }}
                  >
                    {AnalysisService.getRiskLabel(client.riskLevel)}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

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
