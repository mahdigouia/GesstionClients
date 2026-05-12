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
  AlertCircle,
  Coins,
  Info,
  ShieldAlert,
  BarChart3,
  Flame,
  ArrowDownCircle
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Progress } from '@/components/ui/progress';

export function SmartCalculator() {
  const { debts, analysis } = useDebtContext();
  const [isOpen, setIsOpen] = useState(false);
  
  // States for simulators
  const [simulatedAmount, setSimulatedAmount] = useState<string>('');
  const [clientSearch, setClientSearch] = useState<string>('');
  
  // State for specific client selection
  const [selectedClient, setSelectedClient] = useState<any | null>(null);
  const [clientSimAmount, setClientSimAmount] = useState<number>(0);
  
  // 1. Global Simulator Logic (Capped at 100%)
  const simulationResult = useMemo(() => {
    if (!analysis || !simulatedAmount || isNaN(parseFloat(simulatedAmount))) return null;
    
    const amount = parseFloat(simulatedAmount);
    const newTotalPaid = analysis.totalPaid + amount;
    const rawNewRate = (newTotalPaid / analysis.totalDebts) * 100;
    
    const cappedRate = Math.min(100, rawNewRate);
    const improvement = cappedRate - analysis.recoveryRate;
    
    return {
      newBalance: Math.max(0, analysis.totalBalance - amount),
      newRate: cappedRate,
      improvement: improvement > 0 ? improvement : 0
    };
  }, [analysis, simulatedAmount]);

  // 2. Client Search Logic
  const filteredClients = useMemo(() => {
    if (!analysis?.clientBreakdown || clientSearch.length < 2) return [];
    return analysis.clientBreakdown
      .filter(c => c.clientName.toLowerCase().includes(clientSearch.toLowerCase()))
      .sort((a, b) => b.totalBalance - a.totalBalance)
      .slice(0, 5);
  }, [analysis, clientSearch]);

  // 3. Concentration & Risk Analysis
  const riskAnalysis = useMemo(() => {
    if (!analysis) return null;
    
    // Top 3 clients concentration
    const top3Balance = analysis.clientBreakdown
      .sort((a, b) => b.totalBalance - a.totalBalance)
      .slice(0, 3)
      .reduce((sum, c) => sum + c.totalBalance, 0);
      
    const globalConcentration = (top3Balance / analysis.totalBalance) * 100;
    
    // Selected client analysis
    let clientConcentration = 0;
    let worstCaseRate = analysis.recoveryRate;
    
    if (selectedClient) {
      clientConcentration = (selectedClient.totalBalance / analysis.totalBalance) * 100;
      // If this client balance is considered "lost" (debt remains but payment 0 forever)
      // The maximum achievable recovery rate decreases
      worstCaseRate = (analysis.totalPaid / (analysis.totalDebts)) * 100; 
    }
    
    return {
      globalConcentration,
      clientConcentration,
      worstCaseRate,
      top3Balance
    };
  }, [analysis, selectedClient]);

  // 4. Selected Client Impact Logic (Capped at 100%)
  const clientSimulationResult = useMemo(() => {
    if (!analysis || !selectedClient) return null;
    
    const amount = clientSimAmount;
    const newTotalPaid = analysis.totalPaid + amount;
    const rawNewRate = (newTotalPaid / analysis.totalDebts) * 100;
    
    const cappedRate = Math.min(100, rawNewRate);
    const improvement = cappedRate - analysis.recoveryRate;
    
    return {
      newGlobalRate: cappedRate,
      globalImprovement: improvement > 0 ? improvement : 0,
      remainingClientBalance: Math.max(0, selectedClient.totalBalance - amount),
      paymentPercentage: (amount / selectedClient.totalBalance) * 100
    };
  }, [analysis, selectedClient, clientSimAmount]);

  const handleSelectClient = (client: any) => {
    setSelectedClient(client);
    setClientSimAmount(client.totalBalance);
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
                <p className="text-blue-100 text-[10px] uppercase font-medium tracking-wider">Simulations & Analyse de Risque</p>
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
                  Simulation Risque Client
                </Badge>
              </div>

              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 relative overflow-hidden group">
                <div className="absolute right-[-10px] top-[-10px] opacity-5 group-hover:opacity-10 transition-opacity">
                  <User className="h-24 w-24" />
                </div>
                <h4 className="text-base font-bold text-slate-900 mb-1">{selectedClient.clientName}</h4>
                <div className="flex items-center gap-4 mb-3">
                  <div className="flex flex-col">
                    <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Solde Actuel</span>
                    <span className="text-sm font-bold text-slate-700">{formatCurrency(selectedClient.totalBalance)}</span>
                  </div>
                  <div className="flex flex-col border-l border-slate-200 pl-4">
                    <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Poids Stratégique</span>
                    <div className="flex items-center gap-1">
                      <span className={`text-sm font-bold ${riskAnalysis?.clientConcentration! > 15 ? 'text-red-600' : 'text-indigo-600'}`}>
                        {riskAnalysis?.clientConcentration.toFixed(2)}%
                      </span>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger>
                            <Info className="h-3 w-3 text-slate-400" />
                          </TooltipTrigger>
                          <TooltipContent className="text-[10px] max-w-[200px]">
                            Part de ce client dans votre balance totale impayée.
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                  </div>
                </div>
                
                <div className="flex gap-2">
                  <Badge className={`text-[10px] border-none ${
                    selectedClient.riskLevel === 'critical' ? 'bg-red-100 text-red-700' : 
                    selectedClient.riskLevel === 'overdue' ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'
                  }`}>
                    {selectedClient.riskLevel.toUpperCase()}
                  </Badge>
                  {riskAnalysis?.clientConcentration! > 10 && (
                    <Badge className="bg-red-50 text-red-600 border-red-100 text-[10px] animate-pulse">
                      HAUTE DÉPENDANCE
                    </Badge>
                  )}
                </div>
              </div>

              {/* Simulation de Recouvrement pour ce client */}
              <div className="space-y-4 p-4 border border-slate-100 rounded-2xl bg-white shadow-sm">
                <div className="flex justify-between items-center mb-2">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-tight flex items-center gap-2">
                    <Coins className="h-4 w-4 text-green-500" />
                    Encaissement Prévisionnel
                  </label>
                  <span className="text-sm font-black text-indigo-600">
                    {formatCurrency(clientSimAmount)}
                  </span>
                </div>
                
                <Slider 
                  value={[clientSimAmount]} 
                  max={selectedClient.totalBalance} 
                  step={selectedClient.totalBalance / 100}
                  onValueChange={(val) => setClientSimAmount(val[0])}
                />
                
                <div className="grid grid-cols-2 gap-2 mt-4">
                  <Button variant="outline" size="sm" onClick={() => setClientSimAmount(selectedClient.totalBalance / 2)} className="text-[10px] h-8">50%</Button>
                  <Button variant="outline" size="sm" onClick={() => setClientSimAmount(selectedClient.totalBalance)} className="text-[10px] h-8">100%</Button>
                </div>

                {clientSimulationResult && (
                  <div className="mt-4 p-3 bg-indigo-50 rounded-xl border border-indigo-100 flex items-center justify-between">
                    <div>
                      <p className="text-[10px] text-indigo-600 font-bold uppercase">Impact Global</p>
                      <p className="text-xl font-black text-indigo-700">+{clientSimulationResult.globalImprovement.toFixed(2)} pts</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-slate-500">Nouveau Taux</p>
                      <p className="text-sm font-bold text-slate-700">{clientSimulationResult.newGlobalRate.toFixed(2)}%</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Analyse de Risque Maximum */}
              <div className="p-4 bg-red-50 rounded-2xl border border-red-100 space-y-3">
                <div className="flex items-center gap-2 text-red-700 font-bold text-xs uppercase">
                  <ShieldAlert className="h-4 w-4" />
                  Scénario Catastrophe (Défaut)
                </div>
                <p className="text-[10px] text-red-600 leading-tight">
                  Si ce client devenait totalement irrécouvrable aujourd'hui, vous perdriez 
                  <span className="font-bold"> {formatCurrency(selectedClient.totalBalance)} </span> 
                  directement de votre trésorerie prévisionnelle.
                </p>
                <div className="flex items-center justify-between pt-2 border-t border-red-200/50">
                  <span className="text-[10px] text-red-700">Exposition au risque:</span>
                  <span className="text-xs font-black text-red-700">{riskAnalysis?.clientConcentration.toFixed(2)}% de la balance</span>
                </div>
              </div>
            </div>
          ) : (
            /* SEARCH & CONCENTRATION VIEW */
            <div className="space-y-6 animate-in fade-in slide-in-from-left-4 duration-300">
              
              {/* Analyse de Concentration Globale */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-4">
                 <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-slate-800 font-bold text-sm">
                    <BarChart3 className="h-4 w-4 text-indigo-500" />
                    Concentration du Risque
                  </div>
                  <Badge variant="outline" className="bg-white text-[10px]">Top 3 Clients</Badge>
                </div>
                
                <div className="space-y-2">
                  <div className="flex justify-between text-[10px] font-bold text-slate-500 uppercase">
                    <span>Dépendance Stratégique</span>
                    <span>{riskAnalysis?.globalConcentration.toFixed(1)}%</span>
                  </div>
                  <Progress 
                    value={riskAnalysis?.globalConcentration} 
                    className="h-2 bg-slate-200" 
                    indicatorClassName={riskAnalysis?.globalConcentration! > 30 ? 'bg-red-500' : 'bg-indigo-600'}
                  />
                  <p className="text-[9px] text-slate-400 italic">
                    Le top 3 des clients détient {formatCurrency(riskAnalysis?.top3Balance!)} de votre balance impayée.
                  </p>
                </div>
              </div>

              {/* Search Client */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-slate-800 font-bold text-sm px-1">
                  <Search className="h-4 w-4 text-indigo-500" />
                  <h4>Analyser l'Exposition d'un Client</h4>
                </div>
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <Input
                    placeholder="Saisissez le nom d'un client..."
                    className="pl-9 bg-slate-50 border-slate-200 focus:ring-indigo-500 rounded-xl h-10 shadow-sm"
                    value={clientSearch}
                    onChange={(e) => setClientSearch(e.target.value)}
                  />
                </div>
                
                {filteredClients.length > 0 && (
                  <div className="space-y-2 mt-2 max-h-[180px] overflow-y-auto p-1 scrollbar-hide">
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
                          <div className="flex items-center gap-2">
                             <span className="text-[10px] font-bold text-indigo-600">
                                {((client.totalBalance / analysis!.totalBalance) * 100).toFixed(1)}%
                             </span>
                             <ArrowRight className="h-3 w-3 text-slate-300 group-hover:text-indigo-500 transition-all group-hover:translate-x-1" />
                          </div>
                        </div>
                        <div className="flex justify-between items-center mt-2">
                          <span className="text-[10px] text-slate-500">Exposition: <span className="font-semibold">{formatCurrency(client.totalBalance)}</span></span>
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

              {/* Simulation Libre */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-slate-800 font-bold text-sm px-1">
                  <TrendingUp className="h-4 w-4 text-blue-500" />
                  <h4>Simulateur de Trésorerie Rapide</h4>
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
                  <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-100 shadow-sm overflow-hidden">
                    <CardContent className="p-4 space-y-3">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <p className="text-[10px] text-slate-500 uppercase font-bold">Nouveau Taux</p>
                          <p className="text-lg font-black text-blue-700">{simulationResult.newRate.toFixed(2)}%</p>
                        </div>
                        <div className="space-y-1 text-right">
                          <p className="text-[10px] text-slate-500 uppercase font-bold">Amélioration</p>
                          <div className="flex items-center justify-end gap-1 text-green-600 font-black">
                            <Plus className="h-3 w-3" />
                            {simulationResult.improvement.toFixed(2)} pts
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
          <p className="text-[10px] text-slate-400 italic">
            Risque calculé sur {debts.length} lignes
          </p>
          <div className="flex items-center gap-1 text-red-400">
             <Flame className="h-3 w-3 animate-pulse" />
             <span className="text-[9px] font-bold">Analyse d'Exposition Active</span>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
