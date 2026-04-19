'use client';

import { useDebtContext } from '@/lib/DebtContext';
import { Sidebar } from '@/components/Sidebar';
import { BarChart3, TrendingUp, AlertTriangle, DollarSign, Users, Clock, Shield, Activity } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

const COLORS = ['#10b981', '#f59e0b', '#f97316', '#ef4444', '#8b5cf6'];

export default function AnalysisPage() {
  const { debts, analysis } = useDebtContext();

  if (!analysis) {
    return (
      <div className="flex h-screen bg-gray-50">
        <Sidebar />
        <div className="flex-1 overflow-y-auto">
          <header className="bg-white border-b border-gray-200 px-6 py-4">
            <div className="flex items-center space-x-4">
              <BarChart3 className="h-6 w-6 text-blue-600" />
              <h1 className="text-xl font-semibold text-gray-900">Analyse</h1>
            </div>
          </header>
          <main className="p-6">
            <Card>
              <CardContent className="p-12 text-center">
                <BarChart3 className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">Aucune analyse disponible</h3>
                <p className="text-sm text-gray-600">Importez des fichiers depuis le Dashboard pour générer une analyse</p>
              </CardContent>
            </Card>
          </main>
        </div>
      </div>
    );
  }

  const riskData = [
    { name: 'Sain', value: analysis.riskDistribution.healthy, color: '#10b981' },
    { name: 'À surveiller', value: analysis.riskDistribution.monitoring, color: '#f59e0b' },
    { name: 'En retard', value: analysis.riskDistribution.overdue, color: '#f97316' },
    { name: 'Critique', value: analysis.riskDistribution.critical, color: '#ef4444' },
  ].filter(d => d.value > 0);

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      <div className="flex-1 overflow-y-auto">
        <header className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center space-x-4">
            <BarChart3 className="h-6 w-6 text-blue-600" />
            <h1 className="text-xl font-semibold text-gray-900">Analyse Approfondie</h1>
            <span className="text-sm text-gray-500">{debts.length} créances analysées</span>
          </div>
        </header>

        <main className="p-6 space-y-6">
          {/* Métriques avancées */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Montant Moyen</CardTitle>
                <DollarSign className="h-4 w-4 text-blue-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{analysis.averageDebtAmount.toLocaleString('fr-FR', {maximumFractionDigits: 0})} TND</div>
                <p className="text-xs text-gray-500">Médiane: {analysis.medianDebtAmount.toLocaleString('fr-FR', {maximumFractionDigits: 0})} TND</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Délai Moyen Paiement</CardTitle>
                <Clock className="h-4 w-4 text-orange-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{analysis.averagePaymentDelay.toFixed(0)} jours</div>
                <p className="text-xs text-gray-500">Sur les créances réglées</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Prévision Trésorerie</CardTitle>
                <TrendingUp className="h-4 w-4 text-green-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">{analysis.projectedMonthlyCashflow.toLocaleString('fr-FR', {maximumFractionDigits: 0})} TND</div>
                <p className="text-xs text-gray-500">Moyenne mensuelle</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Statut Paiement</CardTitle>
                <Activity className="h-4 w-4 text-purple-600" />
              </CardHeader>
              <CardContent>
                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-green-600">Payé: {analysis.fullyPaidPercentage.toFixed(0)}%</span>
                    <span className="text-yellow-600">Partiel: {analysis.partiallyPaidPercentage.toFixed(0)}%</span>
                    <span className="text-red-600">Impayé: {analysis.unpaidPercentage.toFixed(0)}%</span>
                  </div>
                  <div className="flex h-2 rounded-full overflow-hidden">
                    <div className="bg-green-500" style={{width: `${analysis.fullyPaidPercentage}%`}} />
                    <div className="bg-yellow-500" style={{width: `${analysis.partiallyPaidPercentage}%`}} />
                    <div className="bg-red-500" style={{width: `${analysis.unpaidPercentage}%`}} />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Graphiques */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Ancienneté */}
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
                    <Tooltip formatter={(value: any) => [typeof value === 'number' ? value.toLocaleString('fr-FR') + ' TND' : value]} />
                    <Bar dataKey="amount" fill="#3b82f6" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Distribution des risques */}
            <Card>
              <CardHeader>
                <CardTitle>Distribution des Risques</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={riskData}
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      dataKey="value"
                      label={({ name, value }) => `${name}: ${value}`}
                    >
                      {riskData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Tranches de montant */}
            <Card>
              <CardHeader>
                <CardTitle>Répartition par Montant</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={analysis.amountRanges}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="range" />
                    <YAxis />
                    <Tooltip formatter={(value: any) => [typeof value === 'number' ? value.toLocaleString('fr-FR') + ' TND' : value]} />
                    <Bar dataKey="amount" fill="#8b5cf6" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Statistiques détaillées */}
            <Card>
              <CardHeader>
                <CardTitle>Statistiques Détaillées</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 bg-blue-50 rounded-lg">
                    <div className="text-xs text-blue-600 font-medium">Montant Max</div>
                    <div className="text-lg font-bold">{analysis.maxDebtAmount.toLocaleString('fr-FR', {maximumFractionDigits: 0})} TND</div>
                  </div>
                  <div className="p-3 bg-green-50 rounded-lg">
                    <div className="text-xs text-green-600 font-medium">Montant Min</div>
                    <div className="text-lg font-bold">{analysis.minDebtAmount.toLocaleString('fr-FR', {maximumFractionDigits: 0})} TND</div>
                  </div>
                  <div className="p-3 bg-orange-50 rounded-lg">
                    <div className="text-xs text-orange-600 font-medium">Total Créances</div>
                    <div className="text-lg font-bold">{analysis.totalDebts.toLocaleString('fr-FR', {maximumFractionDigits: 0})} TND</div>
                  </div>
                  <div className="p-3 bg-red-50 rounded-lg">
                    <div className="text-xs text-red-600 font-medium">Solde Restant</div>
                    <div className="text-lg font-bold">{analysis.totalBalance.toLocaleString('fr-FR', {maximumFractionDigits: 0})} TND</div>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>Taux de recouvrement</span>
                    <span className="font-medium">{isNaN(analysis.recoveryRate) ? '0.0' : analysis.recoveryRate.toFixed(1)}%</span>
                  </div>
                  <Progress value={isNaN(analysis.recoveryRate) ? 0 : Math.min(analysis.recoveryRate, 100)} />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Alertes */}
          {analysis.alerts.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <AlertTriangle className="h-5 w-5 text-red-600" />
                  <span>Alertes ({analysis.alerts.length})</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {analysis.alerts.map((alert) => (
                  <div key={alert.id} className={`p-3 rounded-lg border ${
                    alert.severity === 'high' ? 'border-red-200 bg-red-50' : 'border-yellow-200 bg-yellow-50'
                  }`}>
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-medium text-sm">{alert.clientName}</span>
                        <p className="text-sm text-gray-700 mt-1">{alert.message}</p>
                      </div>
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        alert.severity === 'high' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {alert.severity === 'high' ? 'Haute' : 'Moyenne'}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-2">💡 {alert.recommendation}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </main>
      </div>
    </div>
  );
}
