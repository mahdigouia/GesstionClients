'use client';

import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  CalendarDays, 
  TrendingUp, 
  Clock, 
  User, 
  ArrowUpRight,
  CheckCircle2,
  AlertCircle,
  BarChart3
} from 'lucide-react';
import { useDebtContext } from '@/lib/DebtContext';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Cell
} from 'recharts';

export function RecoveryForecast() {
  const { clientRemarks } = useDebtContext();

  const forecastData = useMemo(() => {
    const allRemarks = Object.values(clientRemarks).flat();
    const futurePromises = allRemarks
      .filter(r => r.promiseDate && r.promiseAmount)
      .sort((a, b) => new Date(a.promiseDate!).getTime() - new Date(b.promiseDate!).getTime());

    const totalPromised = futurePromises.reduce((sum, r) => sum + (r.promiseAmount || 0), 0);
    
    // Group by week for the chart
    const groupedByDate: Record<string, number> = {};
    futurePromises.forEach(r => {
      const date = new Date(r.promiseDate!).toLocaleDateString('fr-FR', { day: '2D', month: '2D' });
      groupedByDate[date] = (groupedByDate[date] || 0) + (r.promiseAmount || 0);
    });

    const chartData = Object.entries(groupedByDate).map(([date, amount]) => ({
      date,
      amount
    })).slice(0, 10); // Show next 10 dates with promises

    return {
      futurePromises,
      totalPromised,
      chartData
    };
  }, [clientRemarks]);

  const { futurePromises, totalPromised, chartData } = forecastData;

  if (futurePromises.length === 0) return null;

  return (
    <Card className="border-0 shadow-xl bg-white overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-700">
      <CardHeader className="border-b border-gray-50 bg-gradient-to-r from-emerald-50 to-teal-50 flex flex-row items-center justify-between py-6">
        <div>
          <CardTitle className="text-xl font-black text-emerald-900 flex items-center gap-3">
            <div className="p-2 bg-emerald-600 rounded-xl shadow-lg shadow-emerald-200">
              <TrendingUp className="h-6 w-6 text-white" />
            </div>
            Prévisions de Trésorerie (Pipeline)
          </CardTitle>
          <p className="text-sm text-emerald-700 font-medium mt-1">Encaissements prévus basés sur les promesses de règlement</p>
        </div>
        <div className="text-right">
          <div className="text-[10px] font-black uppercase tracking-widest text-emerald-600 mb-1">Total Promis</div>
          <div className="text-2xl font-black text-emerald-700">
            {totalPromised.toLocaleString('fr-FR')} <span className="text-xs">TND</span>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="p-0">
        <div className="grid grid-cols-1 lg:grid-cols-3">
          {/* Chart Section */}
          <div className="lg:col-span-2 p-6 border-r border-gray-50">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-sm font-black text-slate-800 uppercase tracking-tight flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-emerald-600" /> 
                Calendrier des encaissements
              </h3>
              <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-100 font-bold">
                {futurePromises.length} Promesses
              </Badge>
            </div>
            
            <div className="h-[250px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis 
                    dataKey="date" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 10, fontWeight: 700, fill: '#64748b' }}
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 10, fontWeight: 700, fill: '#64748b' }}
                    tickFormatter={(value) => `${value >= 1000 ? value/1000 + 'k' : value}`}
                  />
                  <Tooltip 
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                    cursor={{ fill: '#f8fafc' }}
                    formatter={(value: number) => [`${value.toLocaleString('fr-FR')} TND`, 'Montant Promis']}
                  />
                  <Bar dataKey="amount" radius={[6, 6, 0, 0]}>
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={index === 0 ? '#059669' : '#10b981'} fillOpacity={0.8} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* List Section */}
          <div className="bg-slate-50/50 flex flex-col h-full overflow-hidden">
            <div className="p-4 border-b border-gray-100 bg-white/50 backdrop-blur-sm sticky top-0 z-10">
              <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                <Clock className="h-3 w-3" /> Prochaines échéances
              </h3>
            </div>
            
            <ScrollArea className="flex-1 max-h-[300px] lg:max-h-none">
              <div className="p-4 space-y-3">
                {futurePromises.map((promise, i) => {
                  const isPast = new Date(promise.promiseDate!) < new Date(new Date().setHours(0,0,0,0));
                  return (
                    <div 
                      key={promise.id} 
                      className="bg-white p-3 rounded-xl shadow-sm border border-slate-100 hover:border-emerald-200 transition-all group"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div className={`p-1.5 rounded-lg ${isPast ? 'bg-amber-50 text-amber-600' : 'bg-blue-50 text-blue-600'}`}>
                            <CalendarDays className="h-3.5 w-3.5" />
                          </div>
                          <span className="text-xs font-black text-slate-700">
                            {new Date(promise.promiseDate!).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                          </span>
                        </div>
                        <Badge className={`${isPast ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'} border-0 text-[9px] font-black`}>
                          {isPast ? 'RETARD' : 'À VENIR'}
                        </Badge>
                      </div>
                      
                      <div className="space-y-1">
                        <div className="text-[11px] font-bold text-slate-900 group-hover:text-emerald-700 transition-colors truncate">
                          {promise.clientName}
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-medium">
                            <User className="h-3 w-3" /> {promise.user.split('@')[0]}
                          </div>
                          <div className="text-sm font-black text-emerald-600">
                            {promise.promiseAmount?.toLocaleString('fr-FR')} TND
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
            
            <div className="p-4 mt-auto border-t border-gray-100 bg-white/50">
              <Button variant="ghost" className="w-full justify-between text-emerald-700 hover:bg-emerald-50 font-bold text-xs h-8 rounded-lg group">
                Voir tout le planning
                <ArrowUpRight className="h-4 w-4 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
