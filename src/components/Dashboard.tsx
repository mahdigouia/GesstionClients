'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
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
  Cell
} from 'recharts';
import { AlertTriangle, TrendingUp, Users, DollarSign } from 'lucide-react';
import { AnalysisResult } from '@/types/debt';
import { AnalysisService } from '@/lib/analysis';

interface DashboardProps {
  analysis: AnalysisResult;
}

export function Dashboard({ analysis }: DashboardProps) {
  const riskColors = {
    healthy: '#10b981',
    monitoring: '#f59e0b',
    overdue: '#f97316',
    critical: '#ef4444'
  };

  const pieColors = ['#10b981', '#f59e0b', '#f97316', '#ef4444'];

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Créances</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {analysis.totalDebts.toFixed(2)} TND
            </div>
            <p className="text-xs text-muted-foreground">
              {analysis.totalBalance.toFixed(2)} TND en attente
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Taux Recouvrement</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isNaN(analysis.recoveryRate) ? '0.0' : analysis.recoveryRate.toFixed(1)}%
            </div>
            <Progress value={isNaN(analysis.recoveryRate) ? 0 : Math.min(analysis.recoveryRate, 100)} className="mt-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Clients Actifs</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {analysis.clientBreakdown.length}
            </div>
            <p className="text-xs text-muted-foreground">
              {analysis.clientBreakdown.filter(c => c.totalBalance > 0).length} avec solde
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Alertes Critiques</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {analysis.alerts.filter(a => a.severity === 'high').length}
            </div>
            <p className="text-xs text-muted-foreground">
              {analysis.alerts.length} alertes totales
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Aging Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Répartition par Ancienneté</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={analysis.agingBreakdown}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="range" />
                <YAxis />
                <Tooltip 
                  formatter={(value: any, name: any) => [
                    typeof value === 'number' ? value.toFixed(2) + '€' : value,
                    name === 'amount' ? 'Montant' : 'Nombre'
                  ]}
                />
                <Bar dataKey="amount" fill="#8884d8" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Risk Distribution Pie Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Répartition par Risque</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={analysis.agingBreakdown}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ range, percentage }) => `${range}: ${percentage.toFixed(1)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="amount"
                >
                  {analysis.agingBreakdown.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={pieColors[index % pieColors.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: any) => [typeof value === 'number' ? value.toFixed(2) + '€' : value, 'Montant']} />
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
              <div key={client.id} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex-1">
                  <div className="font-medium">{client.clientName}</div>
                  <div className="text-sm text-gray-500">
                    Facture {client.invoiceNumber} • {client.agingDays} jours
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-lg">
                    {client.balance.toFixed(2)}€
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

      {/* Alerts Section */}
      {analysis.alerts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Alertes et Recommandations</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {analysis.alerts.slice(0, 5).map((alert) => (
                <Alert key={alert.id} className={
                  alert.severity === 'high' ? 'border-red-200 bg-red-50' :
                  alert.severity === 'medium' ? 'border-yellow-200 bg-yellow-50' :
                  'border-blue-200 bg-blue-50'
                }>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    <div className="font-medium">{alert.clientName}</div>
                    <div className="text-sm">{alert.message}</div>
                    <div className="text-sm font-medium mt-1">
                      💡 {alert.recommendation}
                    </div>
                  </AlertDescription>
                </Alert>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
