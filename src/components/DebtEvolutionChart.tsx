'use client';

import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Legend
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { HistoryPoint } from '@/lib/DebtContext';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { TrendingUp, TrendingDown, Activity } from 'lucide-react';

interface DebtEvolutionChartProps {
  history: HistoryPoint[];
}

export function DebtEvolutionChart({ history }: DebtEvolutionChartProps) {
  if (!history || history.length < 2) {
    return (
      <Card className="w-full h-full min-h-[400px] flex items-center justify-center bg-white/50 backdrop-blur-sm border-dashed">
        <div className="text-center p-8">
          <div className="bg-blue-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
            <Activity className="h-8 w-8 text-blue-500 animate-pulse" />
          </div>
          <h3 className="text-lg font-bold text-gray-800">Collecte des données en cours</h3>
          <p className="text-sm text-gray-500 max-w-xs mx-auto mt-2">
            L'historique d'évolution se construit au fur et à mesure de vos mises à jour de fichiers.
          </p>
        </div>
      </Card>
    );
  }

  // Format data for chart
  const chartData = history.map(point => ({
    ...point,
    formattedDate: format(parseISO(point.date), 'dd MMM HH:mm', { locale: fr }),
    displayBalance: point.totalBalance,
    displayPaid: point.totalPaid
  }));

  const lastPoint = history[history.length - 1];
  const prevPoint = history[history.length - 2];
  const balanceDiff = lastPoint.totalBalance - prevPoint.totalBalance;
  const isUp = balanceDiff > 0;

  return (
    <Card className="w-full border-0 shadow-2xl bg-white overflow-hidden group">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div>
          <CardTitle className="text-xl font-black text-slate-800 flex items-center gap-2">
            Historique d'Évolution des Créances
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 uppercase tracking-widest">Live</span>
          </CardTitle>
          <p className="text-xs text-slate-500 font-medium mt-1">Analyse comparative des créances vs règlements cumulés</p>
        </div>
        <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold text-xs ${isUp ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'}`}>
          {isUp ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
          {Math.abs(balanceDiff).toLocaleString('fr-FR')} TND
          <span className="opacity-70 font-normal">depuis dernier import</span>
        </div>
      </CardHeader>
      <CardContent className="pt-4">
        <div className="h-[350px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={chartData}
              margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
            >
              <defs>
                <linearGradient id="colorBalance" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="colorPaid" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis 
                dataKey="formattedDate" 
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 600 }}
                dy={10}
              />
              <YAxis 
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 600 }}
                tickFormatter={(val) => `${(val / 1000).toFixed(0)}k`}
              />
              <Tooltip 
                contentStyle={{ 
                  borderRadius: '16px', 
                  border: 'none', 
                  boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)',
                  padding: '12px'
                }}
                formatter={(value: any) => [`${Number(value).toLocaleString('fr-FR')} TND`, '']}
              />
              <Legend 
                verticalAlign="top" 
                align="right" 
                height={36}
                iconType="circle"
                wrapperStyle={{ fontSize: '11px', fontWeight: 700, paddingBottom: '20px' }}
              />
              <Area 
                name="Total Créances"
                type="monotone" 
                dataKey="displayBalance" 
                stroke="#3b82f6" 
                strokeWidth={3}
                fillOpacity={1} 
                fill="url(#colorBalance)" 
                animationDuration={1500}
              />
              <Area 
                name="Total Règlements"
                type="monotone" 
                dataKey="displayPaid" 
                stroke="#10b981" 
                strokeWidth={3}
                fillOpacity={1} 
                fill="url(#colorPaid)" 
                animationDuration={1500}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
