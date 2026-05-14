'use client';

import { useDebtContext } from '@/lib/DebtContext';
import { Sidebar } from '@/components/Sidebar';
import { AnalysisService } from '@/lib/analysis';
import { BarChart3, TrendingUp, AlertTriangle, DollarSign, Users, Clock, Shield, Activity, Crown, Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Line, ComposedChart, Area } from 'recharts';
import { useState } from 'react';
import { FilteredResultsModal } from '@/components/FilteredResultsModal';
import { useRouter } from 'next/navigation';

const COLORS = ['#10b981', '#f59e0b', '#f97316', '#ef4444', '#8b5cf6'];

export default function AnalysisPage() {
  const { debts, analysis } = useDebtContext();
  const router = useRouter();
  const [selectedRiskFilter, setSelectedRiskFilter] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  if (!analysis) {
    return (
      <div className="flex h-screen bg-gray-50">
        <Sidebar mobileOpen={sidebarOpen} onMobileClose={() => setSidebarOpen(false)} />
        <div className="flex-1 overflow-y-auto">
          <header className="bg-white border-b border-gray-200 px-4 md:px-6 py-4">
            <div className="flex items-center space-x-3 md:space-x-4">
              <Button
                variant="ghost"
                size="sm"
                className="md:hidden p-2 -ml-2"
                onClick={() => setSidebarOpen(true)}
              >
                <Menu className="h-5 w-5" />
              </Button>
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

  // Génération automatique d'insights
  const generateInsights = () => {
    const insights = [];
    if (analysis.recoveryRate < 70) {
      insights.push({
        title: "Taux de recouvrement faible",
        text: `Votre taux de recouvrement global est de ${analysis.recoveryRate.toFixed(1)}%. Il est recommandé d'intensifier les relances sur les créances de 31-90 jours.`,
        type: 'warning'
      });
    }
    if (analysis.riskDistribution.critical > 0) {
      insights.push({
        title: "Alerte Risque Critique",
        text: `${analysis.riskDistribution.critical} créances sont classées en risque critique. Une action contentieuse pourrait être nécessaire.`,
        type: 'danger'
      });
    }
    if (analysis.averagePaymentDelay > 45) {
      insights.push({
        title: "Délai de paiement élevé",
        text: `Le délai moyen de paiement (${analysis.averagePaymentDelay.toFixed(0)} jours) dépasse la norme de 45 jours.`,
        type: 'info'
      });
    }
    return insights;
  };

  const insights = generateInsights();

  return (
    <div className="flex h-screen bg-slate-50">
      <Sidebar mobileOpen={sidebarOpen} onMobileClose={() => setSidebarOpen(false)} />
      <div className="flex-1 overflow-y-auto">
        <header className="bg-white border-b border-slate-200 px-4 md:px-8 py-4 md:py-6 sticky top-0 z-20">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="flex items-center space-x-3 md:space-x-4">
              <Button
                variant="ghost"
                size="sm"
                className="lg:hidden p-2 -ml-2"
                onClick={() => setSidebarOpen(true)}
              >
                <Menu className="h-5 w-5" />
              </Button>
              <div className="p-2 md:p-3 bg-blue-600 rounded-xl shadow-lg shadow-blue-200">
                <Activity className="h-5 w-5 md:h-6 md:w-6 text-white" />
              </div>
              <div>
                <h1 className="text-lg md:text-2xl font-bold text-slate-900 tracking-tight">Analyse Approfondie</h1>
                <p className="hidden md:block text-slate-500 text-sm">{debts.length} créances auditées en temps réel</p>
              </div>
            </div>
            
            <div className="flex items-center justify-between lg:justify-end gap-4 md:gap-6 bg-slate-50 p-3 md:p-4 rounded-2xl border border-slate-100">
              <div className="text-left md:text-right border-r border-slate-200 pr-4 md:pr-6">
                <div className="text-[9px] md:text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Solde Total</div>
                <div className="text-base md:text-lg font-black text-slate-900 whitespace-nowrap">{analysis.totalBalance?.toLocaleString('fr-FR') || '0'} <span className="text-[9px] md:text-[10px] font-normal">TND</span></div>
                <div className="hidden sm:block text-[9px] text-slate-400 font-medium">H.C: {analysis.totalBalanceNoContentieux?.toLocaleString('fr-FR') || '0'} TND</div>
              </div>
              <div className="text-right">
                <div className="text-[9px] md:text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Recouvrement</div>
                <div className="text-base md:text-lg font-black text-emerald-600">{analysis.recoveryRate.toFixed(1)}%</div>
                <div className="hidden sm:block text-[9px] text-emerald-600 font-bold">H.C: {analysis.recoveryRateNoContentieux.toFixed(1)}%</div>
              </div>
            </div>
          </div>
        </header>
          </div>
        </header>

        <main className="p-8 space-y-8 max-w-7xl mx-auto">
          {/* Métriques Clés avec Dualité */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card className="border-0 shadow-sm rounded-[24px] overflow-hidden">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-2 bg-blue-50 rounded-lg"><DollarSign className="h-5 w-5 text-blue-600" /></div>
                  <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-100 text-[10px]">MOYENNE</Badge>
                </div>
                <div className="text-2xl font-black text-slate-900">{analysis.averageDebtAmount?.toLocaleString('fr-FR', {maximumFractionDigits: 0}) || '0'} <span className="text-sm font-medium">TND</span></div>
                <p className="text-[11px] font-bold text-blue-600">H.C: {analysis.averageDebtAmountNoContentieux?.toLocaleString('fr-FR', {maximumFractionDigits: 0}) || '0'} TND</p>
                <p className="text-[10px] text-slate-400 mt-1 italic">Médiane: {analysis.medianDebtAmount?.toLocaleString('fr-FR', {maximumFractionDigits: 0}) || '0'} TND</p>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-sm rounded-[24px] overflow-hidden">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-2 bg-orange-50 rounded-lg"><Clock className="h-5 w-5 text-orange-600" /></div>
                  <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-100 text-[10px]" title="Délai Moyen de Règlement">DMP</Badge>
                </div>
                <div className="text-2xl font-black text-slate-900">{analysis.averagePaymentDelay.toFixed(0)} <span className="text-sm font-medium">jours</span></div>
                <p className="text-[11px] font-bold text-orange-600">H.C: {analysis.averagePaymentDelayNoContentieux.toFixed(0)} jours</p>
                <p className="text-[10px] text-slate-400 mt-1">Délai de règlement global</p>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-sm rounded-[24px] overflow-hidden">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-2 bg-emerald-50 rounded-lg"><TrendingUp className="h-5 w-5 text-emerald-600" /></div>
                  <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-100 text-[10px]">PRÉVISION</Badge>
                </div>
                <div className="text-2xl font-black text-emerald-600">{analysis.projectedMonthlyCashflow?.toLocaleString('fr-FR', {maximumFractionDigits: 0}) || '0'} <span className="text-sm font-medium">TND</span></div>
                <p className="text-[11px] font-bold text-emerald-600">H.C: {analysis.projectedMonthlyCashflowNoContentieux?.toLocaleString('fr-FR', {maximumFractionDigits: 0}) || '0'} TND</p>
                <p className="text-[10px] text-slate-400 mt-1">Cashflow mensuel estimé</p>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-sm rounded-[24px] overflow-hidden">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-2 bg-purple-50 rounded-lg"><Activity className="h-5 w-5 text-purple-600" /></div>
                  <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-100 text-[10px]">SANTÉ</Badge>
                </div>
                <div className="flex items-end gap-2">
                  <div className="text-2xl font-black text-slate-900">{analysis.fullyPaidPercentage.toFixed(0)}%</div>
                  <div className="text-[10px] text-slate-400 mb-1 font-bold uppercase tracking-tighter">Factures soldées</div>
                </div>
                <div className="mt-3 flex h-1.5 rounded-full overflow-hidden bg-slate-100">
                  <div className="bg-emerald-500" style={{width: `${analysis.fullyPaidPercentage}%`}} />
                  <div className="bg-amber-500" style={{width: `${analysis.partiallyPaidPercentage}%`}} />
                  <div className="bg-rose-500" style={{width: `${analysis.unpaidPercentage}%`}} />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Top 2 Exposition Individuelle */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="border-0 shadow-xl bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-[32px] overflow-hidden relative cursor-pointer hover:scale-[1.01] transition-transform"
                  onClick={() => router.push(`/clients?search=${analysis.topRiskClients[0]?.clientName}`)}>
              <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl" />
              <CardContent className="p-8">
                <div className="flex items-center justify-between mb-6">
                  <Badge className="bg-blue-600 text-white border-0 font-black">#1 PLUS GROSSE CRÉANCE</Badge>
                  <AlertTriangle className="h-6 w-6 text-rose-500" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-2xl font-black truncate">{analysis.topRiskClients[0]?.clientName}</h3>
                  <p className="text-slate-400 font-medium">{analysis.topRiskClients[0]?.clientCode}</p>
                </div>
                <div className="mt-8 flex items-end justify-between">
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Solde Actuel</p>
                    <p className="text-4xl font-black text-blue-400">{analysis.topRiskClients[0]?.totalBalance?.toLocaleString('fr-FR') || '0'} <span className="text-lg">TND</span></p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Risque</p>
                    <Badge variant="outline" className="bg-rose-500/20 text-rose-400 border-rose-500/30">
                      {AnalysisService.getRiskLabel(analysis.topRiskClients[0]?.riskLevel)}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-xl bg-white rounded-[32px] overflow-hidden border border-slate-100 relative cursor-pointer hover:scale-[1.01] transition-transform"
                  onClick={() => router.push(`/clients?search=${analysis.topRiskClients[1]?.clientName}`)}>
              <CardContent className="p-8">
                <div className="flex items-center justify-between mb-6">
                  <Badge variant="outline" className="border-slate-200 text-slate-500 font-black">#2 PLUS GROSSE CRÉANCE</Badge>
                </div>
                <div className="space-y-1">
                  <h3 className="text-2xl font-black text-slate-900 truncate">{analysis.topRiskClients[1]?.clientName}</h3>
                  <p className="text-slate-400 font-medium">{analysis.topRiskClients[1]?.clientCode}</p>
                </div>
                <div className="mt-8 flex items-end justify-between">
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Solde Actuel</p>
                    <p className="text-4xl font-black text-slate-900">{analysis.topRiskClients[1]?.totalBalance?.toLocaleString('fr-FR') || '0'} <span className="text-lg">TND</span></p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Risque</p>
                    <Badge variant="outline" className="bg-orange-100 text-orange-700 border-orange-200">
                      {AnalysisService.getRiskLabel(analysis.topRiskClients[1]?.riskLevel)}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Ancienneté - Design Moderne */}
            <Card className="lg:col-span-2 border-0 shadow-sm rounded-[32px] p-8 overflow-hidden relative">
              <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/5 rounded-full blur-3xl -mr-32 -mt-32" />
              <CardHeader className="px-0 pt-0 relative z-10">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg font-black text-slate-800">Âge des Créances (Aging Report)</CardTitle>
                    <p className="text-xs text-slate-400 font-medium">Répartition par tranches de maturité</p>
                  </div>
                  <div className="p-2 bg-slate-50 rounded-xl">
                    <BarChart3 className="h-5 w-5 text-blue-500" />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="px-0 relative z-10 pb-0">
                <ResponsiveContainer width="100%" height={280}>
                  <ComposedChart data={analysis.agingBreakdown}>
                    <defs>
                      <linearGradient id="modernBarGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.9} />
                        <stop offset="100%" stopColor="#1d4ed8" stopOpacity={1} />
                      </linearGradient>
                      <filter id="shadow" height="200%">
                        <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#3b82f6" floodOpacity="0.2" />
                      </filter>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis 
                      dataKey="range" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{fill: '#94a3b8', fontSize: 10, fontWeight: 600}} 
                      dy={10}
                    />
                    <YAxis 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{fill: '#94a3b8', fontSize: 10, fontWeight: 600}} 
                      tickFormatter={(val) => `${val/1000}k`} 
                    />
                    <Tooltip 
                      cursor={{fill: '#f8fafc', radius: 8}}
                      contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)', padding: '12px'}}
                      formatter={(value: any) => [`${value?.toLocaleString('fr-FR') || '0'} TND`, 'Volume']}
                    />
                    <Bar dataKey="amount" fill="url(#modernBarGradient)" radius={[8, 8, 0, 0]} barSize={40} filter="url(#shadow)" />
                    <Line type="monotone" dataKey="amount" stroke="#10b981" strokeWidth={3} dot={{ r: 4, fill: '#10b981', strokeWidth: 2, stroke: '#fff' }} />
                  </ComposedChart>
                </ResponsiveContainer>

                <div className="mt-8 grid grid-cols-1 md:grid-cols-5 gap-4 border-t border-slate-50 pt-6">
                  {analysis.agingBreakdown.map((range, idx) => (
                    <div key={idx} className="space-y-3">
                      <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{range.range}</div>
                      <div className="space-y-2">
                        {range.topClients?.map((client, cidx) => (
                          <div key={cidx} className="p-2 bg-slate-50 rounded-lg border border-slate-100 hover:border-blue-200 transition-colors cursor-pointer"
                               onClick={() => router.push(`/clients?search=${client.clientName}`)}>
                            <div className="text-[10px] font-bold text-slate-900 truncate" title={client.clientName}>{client.clientName}</div>
                            <div className="text-[9px] font-black text-blue-600">{client.totalBalance?.toLocaleString('fr-FR') || '0'} TND</div>
                          </div>
                        ))}
                        {(!range.topClients || range.topClients.length === 0) && (
                          <div className="text-[9px] text-slate-300 italic">Aucun client</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Distribution Risque - Design Moderne */}
            <Card className="border-0 shadow-sm rounded-[32px] p-8 bg-white relative overflow-hidden">
              <div className="absolute bottom-0 left-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-2xl -ml-16 -mb-16" />
              <CardHeader className="px-0 pt-0 relative z-10">
                <CardTitle className="text-lg font-black text-slate-800">Audit de Risque</CardTitle>
                <p className="text-xs text-slate-400 font-medium">Santé globale du portefeuille</p>
              </CardHeader>
              <CardContent className="px-0 flex flex-col items-center relative z-10">
                <div className="relative w-full h-[220px] cursor-pointer">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={riskData}
                        cx="50%"
                        cy="50%"
                        innerRadius={65}
                        outerRadius={85}
                        paddingAngle={10}
                        dataKey="value"
                        stroke="none"
                        onClick={(data) => {
                          const levelMap: any = { 'Sain': 'healthy', 'À surveiller': 'monitoring', 'En retard': 'overdue', 'Critique': 'critical' };
                          setSelectedRiskFilter(levelMap[data.name]);
                        }}
                      >
                        {riskData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} className="outline-none" />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-3xl font-black text-slate-900 leading-none">{debts.length}</span>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Total</span>
                  </div>
                </div>
                
                <div className="w-full mt-8 space-y-2">
                  {riskData.map((item, i) => (
                    <div key={i} className="flex items-center justify-between p-2 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer group"
                         onClick={() => {
                           const levelMap: any = { 'Sain': 'healthy', 'À surveiller': 'monitoring', 'En retard': 'overdue', 'Critique': 'critical' };
                           setSelectedRiskFilter(levelMap[item.name]);
                         }}>
                      <div className="flex items-center gap-3">
                        <div className="w-2.5 h-2.5 rounded-full shadow-sm group-hover:scale-125 transition-transform" style={{backgroundColor: item.color}} />
                        <span className="text-xs font-bold text-slate-600 group-hover:text-slate-900 transition-colors">{item.name}</span>
                      </div>
                      <span className="text-xs font-black text-slate-900">{item.value} <span className="text-[9px] text-slate-300 font-normal ml-1">Factures</span></span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Top 10 Clients Exposition */}
            <Card className="border-0 shadow-sm rounded-[32px] p-8 overflow-hidden relative">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 via-indigo-500 to-emerald-500" />
              <CardHeader className="px-0 pt-0">
                <CardTitle className="text-lg font-black text-slate-800">Top 10 Exposition Clients</CardTitle>
                <p className="text-xs text-slate-400 font-medium">Les plus gros soldes en attente</p>
              </CardHeader>
              <CardContent className="px-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="text-xs font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                        <th className="pb-4">Client</th>
                        <th className="pb-4 text-right">Solde</th>
                        <th className="pb-4 text-center">Risque</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {analysis.topRiskClients.slice(0, 10).map((client, i) => (
                        <tr key={i} className="group hover:bg-slate-50 transition-colors">
                          <td className="py-4">
                            <div className="flex flex-col">
                              <span className="text-sm font-bold text-slate-800">{client.clientName}</span>
                              <span className="text-[10px] text-slate-400 font-mono">{client.clientCode}</span>
                            </div>
                          </td>
                          <td className="py-4 text-right">
                            <span className="text-sm font-black text-slate-900">{client.totalBalance?.toLocaleString('fr-FR') || '0'} TND</span>
                          </td>
                          <td className="py-4 text-center">
                            <Badge className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-md ${
                              client.riskLevel === 'critical' ? 'bg-rose-100 text-rose-700' :
                              client.riskLevel === 'overdue' ? 'bg-amber-100 text-amber-700' :
                              'bg-emerald-100 text-emerald-700'
                            }`}>
                              {AnalysisService.getRiskLabel(client.riskLevel)}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            {/* Smart Insights & Alertes */}
            <div className="space-y-8">
              <Card className="border-0 shadow-sm rounded-[32px] p-8 bg-blue-900 text-white">
                <CardHeader className="px-0 pt-0">
                  <CardTitle className="text-lg font-bold flex items-center gap-2">
                    <Shield className="h-5 w-5 text-blue-400" />
                    Smart Insights (IA)
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-0 space-y-4">
                  {insights.map((insight, i) => (
                    <div key={i} className="p-4 rounded-2xl bg-white/10 backdrop-blur-sm border border-white/10">
                      <div className="flex items-center gap-2 mb-1">
                        {insight.type === 'danger' && <div className="w-2 h-2 rounded-full bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.5)]" />}
                        {insight.type === 'warning' && <div className="w-2 h-2 rounded-full bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.5)]" />}
                        <span className="text-sm font-black text-blue-100 uppercase tracking-wider">{insight.title}</span>
                      </div>
                      <p className="text-xs text-blue-200 leading-relaxed font-medium">{insight.text}</p>
                    </div>
                  ))}
                  {insights.length === 0 && (
                    <p className="text-sm text-blue-300 italic">Aucune anomalie détectée. La structure de votre portefeuille est saine.</p>
                  )}
                </CardContent>
              </Card>

              {/* Statistiques complémentaires */}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-6 bg-white rounded-[24px] shadow-sm border border-slate-100">
                  <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Plus grosse créance</div>
                  <div className="text-lg font-black text-slate-900">{analysis.maxDebtAmount?.toLocaleString('fr-FR') || '0'} TND</div>
                </div>
                <div className="p-6 bg-white rounded-[24px] shadow-sm border border-slate-100">
                  <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Nombre d'alertes</div>
                  <div className="text-lg font-black text-rose-600">{analysis.alerts.length} prioritaires</div>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>

      <FilteredResultsModal
        isOpen={!!selectedRiskFilter}
        onClose={() => setSelectedRiskFilter(null)}
        title={`Détail Risque: ${AnalysisService.getRiskLabel(selectedRiskFilter || '')}`}
        debts={debts.filter(d => d.riskLevel === selectedRiskFilter)}
      />
    </div>
  );
}
