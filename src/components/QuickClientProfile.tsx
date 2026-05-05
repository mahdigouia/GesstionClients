'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { 
  X, 
  Phone, 
  FileText, 
  TrendingUp, 
  TrendingDown, 
  Clock, 
  AlertTriangle,
  History,
  ExternalLink,
  ChevronRight
} from 'lucide-react';
import { ClientDebt } from '@/types/debt';
import { AnalysisService } from '@/lib/analysis';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer 
} from 'recharts';

interface QuickClientProfileProps {
  clientName: string;
  debts: ClientDebt[];
  onClose: () => void;
}

export function QuickClientProfile({ clientName, debts, onClose }: QuickClientProfileProps) {
  // Sort debts by date for the chart and list
  const sortedDebts = [...debts].sort((a, b) => 
    new Date(a.documentDate).getTime() - new Date(b.documentDate).getTime()
  );

  const totalBalance = debts.reduce((sum, d) => sum + d.balance, 0);
  const totalAmount = debts.reduce((sum, d) => sum + d.amount, 0);
  const clientCode = debts[0]?.clientCode || '?';
  const clientPhone = debts[0]?.clientPhone;
  const commercialName = debts[0]?.commercialName;

  // Calculate health score (0 to 100)
  const healthScore = totalAmount > 0 ? Math.max(0, 100 - (totalBalance / totalAmount * 100)) : 100;
  
  // Data for the sparkline chart (evolution of balance over time)
  let runningBalance = 0;
  const chartData = sortedDebts.map(d => {
    runningBalance += d.balance;
    return {
      date: new Date(d.documentDate).toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' }),
      balance: runningBalance,
      fullDate: d.documentDate
    };
  });

  // Calculate trend
  const isTrendingUp = chartData.length > 1 && 
    chartData[chartData.length - 1].balance > chartData[chartData.length - 2].balance;

  const initials = clientName
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .substring(0, 2);

  return (
    <Card className="border-2 border-blue-100 shadow-2xl animate-in slide-in-from-top-4 duration-500 overflow-hidden bg-white/95 backdrop-blur-xl">
      <div className="absolute top-0 right-0 p-2 z-10">
        <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full hover:bg-slate-100">
          <X className="h-5 w-5 text-slate-500" />
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3">
        {/* Left Column: Client Identity */}
        <div className="p-6 bg-gradient-to-br from-slate-50 to-blue-50/30 border-r border-slate-100">
          <div className="flex flex-col items-center text-center space-y-4">
            <Avatar className="h-20 w-20 border-4 border-white shadow-xl">
              <AvatarFallback className="bg-gradient-to-br from-blue-600 to-indigo-600 text-white text-2xl font-bold">
                {initials}
              </AvatarFallback>
            </Avatar>
            
            <div>
              <h3 className="text-xl font-black text-slate-900 leading-tight">{clientName}</h3>
              <p className="text-sm font-bold text-blue-600 uppercase tracking-tighter mt-1">Code: {clientCode}</p>
            </div>

            <div className="w-full space-y-2 pt-4">
              {clientPhone && (
                <a href={`tel:${clientPhone}`} className="flex items-center justify-center gap-2 p-3 bg-white rounded-xl shadow-sm hover:shadow-md transition-all text-blue-700 font-bold border border-blue-50">
                  <Phone className="h-4 w-4" />
                  {clientPhone}
                </a>
              )}
              <div className="flex flex-col p-3 bg-white rounded-xl shadow-sm border border-slate-50">
                <span className="text-[10px] text-slate-400 font-bold uppercase">Représentant</span>
                <span className="text-sm font-semibold text-slate-700">{commercialName || 'Non assigné'}</span>
              </div>
            </div>

            <div className="pt-4 w-full">
              <div className="flex justify-between text-xs font-bold mb-1">
                <span className="text-slate-500">SCORE DE SANTÉ</span>
                <span className={healthScore > 70 ? 'text-emerald-600' : 'text-amber-600'}>{Math.round(healthScore)}%</span>
              </div>
              <div className="h-2 w-full bg-slate-200 rounded-full overflow-hidden">
                <div 
                  className={`h-full transition-all duration-1000 ${healthScore > 70 ? 'bg-emerald-500' : 'bg-amber-500'}`}
                  style={{ width: `${healthScore}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Middle Column: Financials & Trend */}
        <div className="p-6 col-span-1 md:col-span-2 space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 rounded-2xl bg-slate-900 text-white shadow-lg relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:scale-125 transition-transform">
                <FileText className="h-12 w-12" />
              </div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Solde Total Du</span>
              <div className="text-2xl font-black mt-1">
                {totalBalance.toLocaleString('fr-FR')} <span className="text-xs font-normal opacity-70">TND</span>
              </div>
              <div className="flex items-center gap-1 mt-2 text-[10px] font-bold text-emerald-400">
                <Badge variant="outline" className="text-[9px] border-emerald-500/50 text-emerald-400 h-4">
                  {debts.length} Factures
                </Badge>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-white border border-slate-100 shadow-sm relative overflow-hidden group">
               <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Tendance Recouvrement</span>
               <div className="flex items-center gap-2 mt-1">
                 {isTrendingUp ? (
                   <TrendingUp className="h-6 w-6 text-red-500" />
                 ) : (
                   <TrendingDown className="h-6 w-6 text-emerald-500" />
                 )}
                 <div className="text-xl font-black text-slate-800">
                   {isTrendingUp ? 'En Hausse' : 'En Baisse'}
                 </div>
               </div>
               <p className="text-[10px] text-slate-500 mt-2 font-medium">Evolution du solde sur les {debts.length} dernières pièces</p>
            </div>
          </div>

          {/* Sparkline Chart */}
          <div className="h-40 w-full bg-slate-50/50 rounded-2xl p-2 border border-slate-100">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorBalance" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis 
                  dataKey="date" 
                  hide={false} 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{fontSize: 9, fill: '#94a3b8'}} 
                />
                <Tooltip 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  formatter={(value: any) => [`${value.toLocaleString('fr-FR')} TND`, 'Solde Cumulé']}
                />
                <Area 
                  type="monotone" 
                  dataKey="balance" 
                  stroke="#3b82f6" 
                  strokeWidth={3}
                  fillOpacity={1} 
                  fill="url(#colorBalance)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Invoice List (Mini Grand Livre) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-black text-slate-800 flex items-center gap-2 uppercase tracking-wider">
                <History className="h-3 w-3 text-blue-500" />
                Historique des Pièces
              </h4>
              <span className="text-[10px] text-slate-400 font-bold uppercase">Trié par date</span>
            </div>
            
            <div className="max-h-48 overflow-y-auto space-y-2 pr-2 scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent">
              {[...sortedDebts].reverse().map((debt) => (
                <div key={debt.id} className="flex items-center justify-between p-3 bg-white border border-slate-100 rounded-xl hover:border-blue-200 transition-colors group">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${
                      debt.riskLevel === 'critical' ? 'bg-red-50 text-red-600' :
                      debt.riskLevel === 'overdue' ? 'bg-orange-50 text-orange-600' :
                      'bg-emerald-50 text-emerald-600'
                    }`}>
                      <FileText className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="text-sm font-bold text-slate-800 group-hover:text-blue-700 transition-colors">{debt.documentNumber}</div>
                      <div className="text-[10px] text-slate-400 font-medium">
                        {new Date(debt.documentDate).toLocaleDateString('fr-FR')} • {debt.age} jours
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-black text-slate-900">{debt.balance.toLocaleString('fr-FR')} TND</div>
                    <Badge variant="outline" className="text-[8px] h-3 px-1 border-slate-200 text-slate-500 leading-none">
                      {AnalysisService.getRiskLabel(debt.riskLevel)}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}
