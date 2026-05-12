'use client';

import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Legend,
  BarChart,
  Bar,
  Cell
} from 'recharts';
import { 
  Users, 
  TrendingUp, 
  TrendingDown, 
  Minus, 
  Clock, 
  ChevronRight,
  FileText,
  UserCheck
} from 'lucide-react';
import { AnalysisResult, CommercialStats } from '@/types/debt';
import { HistoryPoint } from '@/lib/DebtContext';

interface CommercialAnalysisProps {
  analysis: AnalysisResult;
  history: HistoryPoint[];
}

export function CommercialAnalysis({ analysis, history }: CommercialAnalysisProps) {
  // 1. Chart Data: Recovery Rate Evolution per Commercial
  const chartData = useMemo(() => {
    // We need at least 2 points to show evolution
    if (!history || history.length < 1) return [];

    return history.map(point => {
      const date = new Date(point.date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
      const stats: any = { date };
      
      if (point.commercialStats) {
        point.commercialStats.forEach(comm => {
          stats[comm.code] = parseFloat(comm.recoveryRate.toFixed(1));
        });
      }
      return stats;
    });
  }, [history]);

  // Get unique commercial codes for chart lines
  const commercialCodes = useMemo(() => {
    const codes = new Set<string>();
    history.forEach(p => {
      if (p.commercialStats) {
        p.commercialStats.forEach(c => codes.add(c.code));
      }
    });
    return Array.from(codes);
  }, [history]);

  // Colors for commercials
  const colors = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'];

  // 2. Evolution Analysis: Compare latest with previous
  const performanceTable = useMemo(() => {
    if (!analysis.commercialBreakdown) return [];

    const latestStats = analysis.commercialBreakdown;
    const previousPoint = history.length > 1 ? history[history.length - 2] : null;
    const previousStats = previousPoint?.commercialStats || [];

    return latestStats.map(current => {
      const prev = previousStats.find(p => p.code === current.code);
      
      let rateDelta = 0;
      let balanceDelta = 0;

      if (prev) {
        rateDelta = current.recoveryRate - prev.recoveryRate;
        balanceDelta = current.totalBalance - prev.totalBalance;
      }

      return {
        ...current,
        rateDelta,
        balanceDelta
      };
    });
  }, [analysis, history]);

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('fr-TN', { style: 'currency', currency: 'TND', maximumFractionDigits: 0 }).format(val);
  };

  return (
    <div className="space-y-6">
      {/* Chart: Evolution comparing commercials */}
      <Card className="border-0 shadow-xl bg-white overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-slate-800 to-slate-900 text-white border-b-0">
          <div className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-indigo-400" />
                Performance Comparative des Commerciaux
              </CardTitle>
              <p className="text-xs text-slate-300 mt-1">Évolution du taux de recouvrement par code commercial</p>
            </div>
            <Badge className="bg-white/10 text-white border-white/20">
              Historique 30 jours
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey="date" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fill: '#64748b' }} 
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fill: '#64748b' }} 
                  unit="%" 
                  domain={[0, 100]}
                />
                <Tooltip 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                />
                <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px', fontSize: '11px' }} />
                {commercialCodes.map((code, index) => (
                  <Line
                    key={code}
                    type="monotone"
                    dataKey={code}
                    name={code}
                    stroke={colors[index % colors.length]}
                    strokeWidth={3}
                    dot={{ r: 4, strokeWidth: 2, fill: '#fff' }}
                    activeDot={{ r: 6, strokeWidth: 0 }}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Table: Performance & Evolution */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <Card className="xl:col-span-2 border-0 shadow-xl bg-white overflow-hidden">
          <CardHeader className="border-b border-slate-50 flex flex-row items-center justify-between">
            <CardTitle className="text-base font-bold text-slate-800 flex items-center gap-2">
              <Users className="h-5 w-5 text-indigo-500" />
              État de Performance par Commercial
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500 font-bold">
                  <tr>
                    <th className="px-4 py-3">Commercial</th>
                    <th className="px-4 py-3">Solde Attendu</th>
                    <th className="px-4 py-3">Taux Rec.</th>
                    <th className="px-4 py-3">Évolution</th>
                    <th className="px-4 py-3 text-right">Détails</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {performanceTable.map((comm) => (
                    <tr key={comm.code} className="hover:bg-slate-50/50 transition-colors group">
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600 font-bold text-xs">
                            {comm.code}
                          </div>
                          <div>
                            <div className="text-xs font-bold text-slate-800">{comm.name}</div>
                            <div className="text-[10px] text-slate-500">{comm.clientCount} clients • {comm.debtCount} factures</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="text-xs font-bold text-slate-700">{formatCurrency(comm.totalBalance)}</div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2">
                          <div className="w-12 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-indigo-500 rounded-full" 
                              style={{ width: `${comm.recoveryRate}%` }}
                            />
                          </div>
                          <span className="text-[10px] font-bold text-slate-600">{comm.recoveryRate.toFixed(1)}%</span>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        {comm.rateDelta !== 0 ? (
                          <div className={`flex items-center gap-1 text-[10px] font-bold ${comm.rateDelta > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                            {comm.rateDelta > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                            {comm.rateDelta > 0 ? '+' : ''}{comm.rateDelta.toFixed(1)}%
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 text-[10px] text-slate-400">
                            <Minus className="h-3 w-3" /> 0%
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-4 text-right">
                        <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-indigo-500 transition-colors ml-auto" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Focus Insight: Top Evolution */}
        <div className="space-y-6">
           <Card className="border-0 shadow-xl bg-indigo-600 text-white overflow-hidden relative">
            <div className="absolute right-[-20px] top-[-20px] opacity-10">
              <UserCheck className="h-24 w-24" />
            </div>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-bold text-indigo-100 flex items-center gap-2 uppercase tracking-widest">
                <TrendingUp className="h-4 w-4" />
                Meilleure Progression
              </CardTitle>
            </CardHeader>
            <CardContent>
              {performanceTable.filter(c => c.rateDelta > 0).sort((a, b) => b.rateDelta - a.rateDelta)[0] ? (
                <div className="space-y-4">
                  <div>
                    <h4 className="text-2xl font-black">{performanceTable.filter(c => c.rateDelta > 0).sort((a, b) => b.rateDelta - a.rateDelta)[0].name}</h4>
                    <p className="text-xs text-indigo-100 opacity-80">Depuis le dernier import de données</p>
                  </div>
                  <div className="flex items-center gap-4 bg-white/10 p-3 rounded-xl border border-white/10">
                    <div className="flex-1">
                      <p className="text-[10px] text-indigo-200 font-bold uppercase">Gain de taux</p>
                      <p className="text-xl font-black text-emerald-300">+{performanceTable.filter(c => c.rateDelta > 0).sort((a, b) => b.rateDelta - a.rateDelta)[0].rateDelta.toFixed(1)} pts</p>
                    </div>
                    <div className="w-px h-8 bg-white/10" />
                    <div className="flex-1">
                      <p className="text-[10px] text-indigo-200 font-bold uppercase">Dette réduite</p>
                      <p className="text-xl font-black">
                        {Math.abs(performanceTable.filter(c => c.rateDelta > 0).sort((a, b) => b.rateDelta - a.rateDelta)[0].balanceDelta).toLocaleString('fr-FR')} 
                        <span className="text-xs"> TND</span>
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-xs italic text-indigo-100">Aucune progression notable sur ce cycle d'import.</p>
              )}
            </CardContent>
          </Card>

          <Card className="border-0 shadow-xl bg-white overflow-hidden">
            <CardHeader className="pb-2 border-b border-slate-50">
              <CardTitle className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Dernières Activités
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
               <div className="divide-y divide-slate-50">
                  {history.slice(-3).reverse().map((point, i) => (
                    <div key={i} className="p-3 flex justify-between items-center hover:bg-slate-50 transition-colors">
                      <div>
                        <div className="text-[10px] font-bold text-slate-800">Mise à jour globale</div>
                        <div className="text-[10px] text-slate-400">{new Date(point.date).toLocaleString('fr-FR')}</div>
                      </div>
                      <Badge variant="outline" className="text-[10px] text-indigo-600 border-indigo-100 bg-indigo-50/50">
                         {point.commercialStats?.length || 0} fichiers
                      </Badge>
                    </div>
                  ))}
               </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
