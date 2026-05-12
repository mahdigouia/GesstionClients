'use client';

import React, { useState, useMemo } from 'react';
import { 
  Calculator, 
  Search, 
  TrendingUp, 
  ShieldCheck, 
  ArrowRight, 
  X,
  Plus,
  Percent,
  Wallet
} from 'lucide-react';
import { 
  Popover, 
  PopoverContent, 
  PopoverTrigger 
} from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useDebtContext } from '@/lib/DebtContext';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Card, CardContent } from '@/components/ui/card';

export function SmartCalculator() {
  const { debts, analysis } = useDebtContext();
  const [isOpen, setIsOpen] = useState(false);
  
  // States for simulators
  const [simulatedAmount, setSimulatedAmount] = useState<string>('');
  const [retentionBase, setRetentionBase] = useState<string>('');
  const [clientSearch, setClientSearch] = useState<string>('');
  
  // 1. Simulator Logic
  const simulationResult = useMemo(() => {
    if (!analysis || !simulatedAmount || isNaN(parseFloat(simulatedAmount))) return null;
    
    const amount = parseFloat(simulatedAmount);
    const newTotalPaid = analysis.totalPaid + amount;
    const newTotalBalance = analysis.totalBalance - amount;
    const newRecoveryRate = (newTotalPaid / analysis.totalDebts) * 100;
    
    return {
      newBalance: Math.max(0, newTotalBalance),
      newRate: Math.min(100, newRecoveryRate),
      improvement: newRecoveryRate - analysis.recoveryRate
    };
  }, [analysis, simulatedAmount]);

  // 2. Retention Logic (1.5%)
  const retentionResult = useMemo(() => {
    if (!retentionBase || isNaN(parseFloat(retentionBase))) return null;
    return parseFloat(retentionBase) * 0.015;
  }, [retentionBase]);

  // 3. Client Impact Logic
  const filteredClients = useMemo(() => {
    if (!analysis?.clientBreakdown || clientSearch.length < 2) return [];
    return analysis.clientBreakdown
      .filter(c => c.clientName.toLowerCase().includes(clientSearch.toLowerCase()))
      .slice(0, 3);
  }, [analysis, clientSearch]);

  const getClientImpact = (clientBalance: number) => {
    if (!analysis) return 0;
    const newTotalPaid = analysis.totalPaid + clientBalance;
    const newRate = (newTotalPaid / analysis.totalDebts) * 100;
    return newRate - analysis.recoveryRate;
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('fr-TN', { style: 'currency', currency: 'TND' }).format(val);
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button 
          variant="outline" 
          size="icon" 
          className="h-10 w-10 rounded-full bg-white shadow-sm hover:bg-blue-50 border-blue-100 text-blue-600 transition-all hover:scale-110 active:scale-95"
          title="Calculatrice Intelligente"
        >
          <Calculator className="h-5 w-5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 md:w-96 p-0 overflow-hidden border-none shadow-2xl rounded-2xl" align="end">
        <div className="bg-gradient-to-br from-blue-600 to-indigo-700 p-4 text-white">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-white/20 rounded-lg">
                <Calculator className="h-5 w-5 text-white" />
              </div>
              <h3 className="font-bold text-lg">Calculatrice Intelligente</h3>
            </div>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-8 w-8 text-white/70 hover:text-white hover:bg-white/10"
              onClick={() => setIsOpen(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-blue-100 text-xs">Simulez l'impact de vos actions en temps réel</p>
        </div>

        <div className="p-4 bg-white space-y-5 max-h-[80vh] overflow-y-auto">
          {/* Section 1: Simulateur de Recouvrement */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-slate-800 font-semibold text-sm">
              <TrendingUp className="h-4 w-4 text-blue-500" />
              <h4>Simulateur de Recouvrement</h4>
            </div>
            <div className="relative">
              <Wallet className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Montant à encaisser (TND)"
                className="pl-9 bg-slate-50 border-slate-200 focus:ring-blue-500 rounded-xl"
                value={simulatedAmount}
                onChange={(e) => setSimulatedAmount(e.target.value)}
                type="number"
              />
            </div>
            {simulationResult && (
              <Card className="bg-blue-50 border-blue-100 border-dashed">
                <CardContent className="p-3 space-y-2">
                  <div className="flex justify-between text-xs text-slate-600">
                    <span>Nouveau Taux:</span>
                    <span className="font-bold text-blue-700">{simulationResult.newRate.toFixed(2)}%</span>
                  </div>
                  <div className="flex justify-between text-xs text-slate-600">
                    <span>Amélioration:</span>
                    <Badge variant="outline" className="bg-green-100 text-green-700 border-green-200 text-[10px] h-5 py-0">
                      +{simulationResult.improvement.toFixed(2)} pts
                    </Badge>
                  </div>
                  <div className="flex justify-between text-xs text-slate-600 pt-1 border-t border-blue-200/50">
                    <span>Nouveau Solde:</span>
                    <span className="font-bold">{formatCurrency(simulationResult.newBalance)}</span>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          <Separator className="bg-slate-100" />

          {/* Section 2: Calculateur de Retenus */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-slate-800 font-semibold text-sm">
              <ShieldCheck className="h-4 w-4 text-amber-500" />
              <h4>Calculateur de Retenu (1.5%)</h4>
            </div>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Percent className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Base de calcul"
                  className="pl-9 bg-slate-50 border-slate-200 focus:ring-amber-500 rounded-xl"
                  value={retentionBase}
                  onChange={(e) => setRetentionBase(e.target.value)}
                  type="number"
                />
              </div>
              {retentionResult !== null && (
                <div className="flex items-center justify-center bg-amber-50 text-amber-700 font-bold px-3 rounded-xl border border-amber-100 min-w-[80px]">
                  {retentionResult.toFixed(3)}
                </div>
              )}
            </div>
          </div>

          <Separator className="bg-slate-100" />

          {/* Section 3: Impact Client */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-slate-800 font-semibold text-sm">
              <Search className="h-4 w-4 text-indigo-500" />
              <h4>Impact par Client</h4>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Rechercher un client..."
                className="pl-9 bg-slate-50 border-slate-200 focus:ring-indigo-500 rounded-xl"
                value={clientSearch}
                onChange={(e) => setClientSearch(e.target.value)}
              />
            </div>
            
            {filteredClients.length > 0 && (
              <div className="space-y-2 mt-2">
                {filteredClients.map((client, idx) => (
                  <div 
                    key={idx} 
                    className="flex flex-col p-2.5 bg-slate-50 rounded-xl border border-slate-100 hover:border-indigo-200 transition-colors cursor-default"
                  >
                    <div className="flex justify-between items-start">
                      <span className="text-xs font-bold text-slate-700 truncate max-w-[180px]">
                        {client.clientName}
                      </span>
                      <Badge className="bg-indigo-100 text-indigo-700 hover:bg-indigo-100 border-none text-[10px]">
                        {client.riskLevel}
                      </Badge>
                    </div>
                    <div className="flex justify-between items-center mt-2">
                      <span className="text-[10px] text-slate-500">Solde: {formatCurrency(client.totalBalance)}</span>
                      <div className="flex items-center gap-1 text-green-600 font-bold text-[10px]">
                        <Plus className="h-3 w-3" />
                        {getClientImpact(client.totalBalance).toFixed(2)} pts
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="p-3 bg-slate-50 border-t border-slate-100 flex justify-center">
          <p className="text-[10px] text-slate-400 italic">
            Basé sur {debts.length} factures extraites
          </p>
        </div>
      </PopoverContent>
    </Popover>
  );
}
