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
  Wallet,
  ChevronLeft,
  User,
  Activity,
  CheckCircle2,
  AlertCircle
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
import { Slider } from '@/components/ui/slider';

export function SmartCalculator() {
  const { debts, analysis } = useDebtContext();
  const [isOpen, setIsOpen] = useState(false);
  
  // States for simulators
  const [simulatedAmount, setSimulatedAmount] = useState<string>('');
  const [retentionBase, setRetentionBase] = useState<string>('');
  const [clientSearch, setClientSearch] = useState<string>('');
  
  // State for specific client selection
  const [selectedClient, setSelectedClient] = useState<any | null>(null);
  const [clientSimAmount, setClientSimAmount] = useState<number>(0);
  
  // 1. Global Simulator Logic
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

  // 3. Client Search Logic
  const filteredClients = useMemo(() => {
    if (!analysis?.clientBreakdown || clientSearch.length < 2) return [];
    return analysis.clientBreakdown
      .filter(c => c.clientName.toLowerCase().includes(clientSearch.toLowerCase()))
      .slice(0, 5);
  }, [analysis, clientSearch]);

  // 4. Selected Client Impact Logic
  const clientSimulationResult = useMemo(() => {
    if (!analysis || !selectedClient) return null;
    
    const amount = clientSimAmount;
    const newTotalPaid = analysis.totalPaid + amount;
    const newGlobalRate = (newTotalPaid / analysis.totalDebts) * 100;
    
    return {
      newGlobalRate: Math.min(100, newGlobalRate),
      globalImprovement: newGlobalRate - analysis.recoveryRate,
      remainingClientBalance: Math.max(0, selectedClient.totalBalance - amount),
      paymentPercentage: (amount / selectedClient.totalBalance) * 100
    };
  }, [analysis, selectedClient, clientSimAmount]);

  const handleSelectClient = (client: any) => {
    setSelectedClient(client);
    setClientSimAmount(client.totalBalance); // Default to full recovery
    setClientSearch('');
  };

  const resetClientSim = () => {
    setSelectedClient(null);
    setClientSimAmount(0);
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
      <PopoverContent className="w-[380px] md:w-[450px] p-0 overflow-hidden border-none shadow-2xl rounded-2xl" align="end">
        {/* Header Section */}
        <div className="bg-gradient-to-br from-indigo-600 via-blue-600 to-blue-700 p-5 text-white">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-white/20 backdrop-blur-md rounded-xl shadow-inner">
                <Calculator className="h-6 w-6 text-white" />
              </div>
              <div>
                <h3 className="font-bold text-xl tracking-tight">Calculatrice Intelligente</h3>
                <p className="text-blue-100 text-[10px] uppercase font-medium tracking-wider">Simulations & Analyse d'Impact</p>
              </div>
            </div>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-8 w-8 text-white/70 hover:text-white hover:bg-white/10 rounded-full"
              onClick={() => setIsOpen(false)}
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
          
          {/* Quick Global Stats Summary */}
          {analysis && !selectedClient && (
            <div className="mt-4 flex gap-4 bg-white/10 rounded-xl p-3 border border-white/10 backdrop-blur-sm">
              <div className="flex-1">
                <p className="text-[10px] text-blue-100 mb-0.5">Recouvrement Global</p>
                <div className="flex items-end gap-1">
                  <span className="text-xl font-bold">{analysis.recoveryRate.toFixed(2)}%</span>
                </div>
              </div>
              <div className="flex-1 border-l border-white/10 pl-4">
                <p className="text-[10px] text-blue-100 mb-0.5">Solde à Recouvrer</p>
                <span className="text-xl font-bold">{formatCurrency(analysis.totalBalance).split(',')[0]}</span>
              </div>
            </div>
          )}
        </div>

        <div className="p-5 bg-white space-y-6 max-h-[80vh] overflow-y-auto">
          
          {selectedClient ? (
            /* CLIENT SPECIFIC VIEW */
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
              <div className="flex items-center gap-2">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={resetClientSim}
                  className="h-8 px-2 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 -ml-2"
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Retour
                </Button>
                <Badge className="bg-indigo-50 text-indigo-700 border-indigo-100 hover:bg-indigo-50">
                  Simulation Client
                </Badge>
              </div>

              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 relative overflow-hidden group">
                <div className="absolute right-[-10px] top-[-10px] opacity-5 group-hover:opacity-10 transition-opacity">
                  <User className="h-24 w-24" />
                </div>
                <h4 className="text-base font-bold text-slate-900 mb-1">{selectedClient.clientName}</h4>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xs text-slate-500">Solde total:</span>
                  <span className="text-sm font-bold text-slate-700">{formatCurrency(selectedClient.totalBalance)}</span>
                </div>
                
                <div className="flex gap-2">
                   <Badge variant="outline" className="text-[10px] bg-white border-slate-200">
                    {selectedClient.debtCount} factures
                  </Badge>
                  <Badge className={`text-[10px] border-none ${
                    selectedClient.riskLevel === 'critical' ? 'bg-red-100 text-red-700' : 
                    selectedClient.riskLevel === 'overdue' ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'
                  }`}>
                    Risque {selectedClient.riskLevel}
                  </Badge>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-tight">Montant à encaisser</label>
                  <span className="text-sm font-black text-indigo-600 bg-indigo-50 px-2 py-1 rounded-lg">
                    {formatCurrency(clientSimAmount)}
                  </span>
                </div>
                
                <Slider 
                  value={[clientSimAmount]} 
                  max={selectedClient.totalBalance} 
                  step={selectedClient.totalBalance / 100}
                  onValueChange={(val) => setClientSimAmount(val[0])}
                  className="py-4"
                />
                
                <div className="grid grid-cols-2 gap-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => setClientSimAmount(selectedClient.totalBalance / 2)}
                    className="text-[10px] h-8 rounded-lg"
                  >
                    Moitié (50%)
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => setClientSimAmount(selectedClient.totalBalance)}
                    className="text-[10px] h-8 rounded-lg"
                  >
                    Totalité (100%)
                  </Button>
                </div>
              </div>

              {clientSimulationResult && (
                <div className="p-4 bg-indigo-600 rounded-2xl text-white shadow-lg shadow-indigo-200 relative overflow-hidden">
                  <div className="absolute right-2 bottom-2 opacity-20">
                    <Activity className="h-12 w-12" />
                  </div>
                  <h5 className="text-[10px] font-bold uppercase tracking-widest mb-3 text-indigo-100 flex items-center gap-1">
                    <TrendingUp className="h-3 w-3" />
                    Impact Prévisionnel Global
                  </h5>
                  <div className="flex items-baseline gap-2 mb-1">
                    <span className="text-3xl font-black">{clientSimulationResult.newGlobalRate.toFixed(2)}%</span>
                    <span className="text-xs font-bold text-indigo-200">Nouveau Taux</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className="bg-white/20 text-white border-none text-[10px] h-6 flex items-center gap-1">
                      <Plus className="h-3 w-3" />
                      {clientSimulationResult.globalImprovement.toFixed(2)} pts
                    </Badge>
                    <span className="text-[10px] text-indigo-100">d'amélioration globale</span>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* SEARCH & GLOBAL VIEW */
            <div className="space-y-6 animate-in fade-in slide-in-from-left-4 duration-300">
              {/* Client Selection Search */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-slate-800 font-bold text-sm">
                  <Search className="h-4 w-4 text-indigo-500" />
                  <h4>Analyser un Client Précis</h4>
                </div>
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <Input
                    placeholder="Saisissez le nom d'un client..."
                    className="pl-9 bg-slate-50 border-slate-200 focus:ring-indigo-500 rounded-xl h-10 shadow-sm"
                    value={clientSearch}
                    onChange={(e) => setClientSearch(e.target.value)}
                  />
                  {clientSearch && (
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="absolute right-1 top-1 h-8 w-8 hover:bg-transparent text-slate-400"
                      onClick={() => setClientSearch('')}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                
                {filteredClients.length > 0 && (
                  <div className="space-y-2 mt-2 max-h-[160px] overflow-y-auto p-1 scrollbar-hide">
                    {filteredClients.map((client, idx) => (
                      <div 
                        key={idx} 
                        onClick={() => handleSelectClient(client)}
                        className="flex flex-col p-3 bg-white rounded-xl border border-slate-100 hover:border-indigo-300 hover:bg-indigo-50/50 hover:shadow-md transition-all cursor-pointer group"
                      >
                        <div className="flex justify-between items-start">
                          <span className="text-xs font-bold text-slate-800 group-hover:text-indigo-700 transition-colors truncate max-w-[200px]">
                            {client.clientName}
                          </span>
                          <ArrowRight className="h-3 w-3 text-slate-300 group-hover:text-indigo-500 transition-all group-hover:translate-x-1" />
                        </div>
                        <div className="flex justify-between items-center mt-2">
                          <span className="text-[10px] text-slate-500">Solde: <span className="font-semibold">{formatCurrency(client.totalBalance)}</span></span>
                          <Badge className={`text-[8px] h-4 py-0 ${
                            client.riskLevel === 'critical' ? 'bg-red-50 text-red-600 border-red-100' : 'bg-slate-50 text-slate-600'
                          }`}>
                            {client.riskLevel}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <Separator className="bg-slate-100" />

              {/* Quick Multi-Simulator */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-slate-800 font-bold text-sm">
                  <TrendingUp className="h-4 w-4 text-blue-500" />
                  <h4>Simulation Libre</h4>
                </div>
                <div className="relative">
                  <Wallet className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <Input
                    placeholder="Montant libre à encaisser (TND)"
                    className="pl-9 bg-slate-50 border-slate-200 focus:ring-blue-500 rounded-xl"
                    value={simulatedAmount}
                    onChange={(e) => setSimulatedAmount(e.target.value)}
                    type="number"
                  />
                </div>
                {simulationResult && (
                  <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-100 shadow-sm overflow-hidden">
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-center gap-2 mb-1">
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                        <span className="text-xs font-bold text-slate-700">Scénario de recouvrement</span>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <p className="text-[10px] text-slate-500 uppercase font-bold">Nouveau Taux</p>
                          <p className="text-lg font-black text-blue-700">{simulationResult.newRate.toFixed(2)}%</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-[10px] text-slate-500 uppercase font-bold">Amélioration</p>
                          <div className="flex items-center gap-1 text-green-600 font-black">
                            <Plus className="h-3 w-3" />
                            {simulationResult.improvement.toFixed(2)} pts
                          </div>
                        </div>
                      </div>
                      <div className="pt-2 border-t border-blue-200/50 flex justify-between items-center">
                        <span className="text-[10px] text-slate-500">Nouveau Solde Global:</span>
                        <span className="text-xs font-bold text-slate-700">{formatCurrency(simulationResult.newBalance)}</span>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>

              <Separator className="bg-slate-100" />

              {/* Tool: Retention */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-slate-800 font-bold text-sm">
                  <ShieldCheck className="h-4 w-4 text-amber-500" />
                  <h4>Outil: Retenu de Garantie (1.5%)</h4>
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
                    <div className="flex items-center justify-center bg-amber-50 text-amber-700 font-bold px-4 rounded-xl border border-amber-200 shadow-sm min-w-[90px]">
                      {retentionResult.toFixed(3)}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
          <p className="text-[10px] text-slate-400 italic">
            Données synchronisées • {debts.length} lignes
          </p>
          <div className="flex items-center gap-1">
             <AlertCircle className="h-3 w-3 text-slate-300" />
             <span className="text-[9px] text-slate-400">Simulation non persistée</span>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
