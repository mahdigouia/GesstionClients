'use client';

import { useState, useMemo, useEffect } from 'react';
import { useDebtContext } from '@/lib/DebtContext';
import { Sidebar } from '@/components/Sidebar';
import { ExportService } from '@/lib/export';
import { AnalysisService } from '@/lib/analysis';
import {
  Users,
  Search,
  FileSpreadsheet,
  FileText,
  Filter,
  ChevronDown,
  ChevronRight,
  Expand,
  Shrink,
  X,
  Scale,
  ShieldCheck,
  CreditCard,
  Target
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { ClientDebt } from '@/types/debt';
import { Progress } from "@/components/ui/progress";

export default function ClientsPage() {
  const { debts, analysis } = useDebtContext();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCommercial, setSelectedCommercial] = useState('all');
  const [expandedClients, setExpandedClients] = useState<Set<string>>(new Set());
  
  // Tristate filters
  const [contentieuxFilter, setContentieuxFilter] = useState<'off' | 'include' | 'exclude'>('off');
  const [retainedFilter, setRetainedFilter] = useState<'off' | 'include' | 'exclude'>('off');
  const [partialFilter, setPartialFilter] = useState<'off' | 'include' | 'exclude'>('off');

  // Business logic for filters
  const isContentieux = (d: ClientDebt) => Number(d.age || 0) > 365 && Number(d.balance || 0) > 0;
  const isRetained = (debt: ClientDebt) => {
    const upper = (debt.documentNumber || '').toUpperCase();
    if (!upper.startsWith('FT') && !upper.startsWith('FS')) return false;
    if (debt.balance <= 0 || debt.amount <= 0) return false;
    const ratio = (debt.balance / debt.amount) * 100;
    return ratio >= 0.5 && ratio <= 1.5;
  };
  const isPartial = (debt: ClientDebt) => {
    const upper = (debt.documentNumber || '').toUpperCase();
    if (!upper.startsWith('FT') && !upper.startsWith('FS')) return false;
    if (debt.balance <= 0 || debt.amount <= 0) return false;
    const ratio = (debt.balance / debt.amount) * 100;
    return ratio > 1.5 && ratio < 99;
  };

  // Helper to get client-level matches
  const clientHasContentieux = (clientName: string) => debts.filter(d => d.clientName === clientName).some(isContentieux);
  const clientHasRetained = (clientName: string) => debts.filter(d => d.clientName === clientName).some(isRetained);
  const clientHasPartial = (clientName: string) => debts.filter(d => d.clientName === clientName).some(isPartial);

  // Counts for tristate filters
  const stats = useMemo(() => {
    const list = analysis?.clientBreakdown || [];
    return {
      contentieux: list.filter(c => clientHasContentieux(c.clientName)).length,
      retained: list.filter(c => clientHasRetained(c.clientName)).length,
      partial: list.filter(c => clientHasPartial(c.clientName)).length,
      nonContentieux: list.filter(c => !clientHasContentieux(c.clientName)).length,
      nonRetained: list.filter(c => !clientHasRetained(c.clientName)).length,
      nonPartial: list.filter(c => !clientHasPartial(c.clientName)).length
    };
  }, [analysis, debts]);

  // Filtered client list logic
  const filteredClients = useMemo(() => {
    if (!analysis) return [];
    let list = analysis.clientBreakdown || [];
    
    if (selectedCommercial !== 'all') {
      list = list.filter((c: any) => c.commercialName === selectedCommercial);
    }
    
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      list = list.filter((c: any) => 
        c.clientName.toLowerCase().includes(term) || 
        c.clientCode.toLowerCase().includes(term)
      );
    }

    return list.filter((client: any) => {
      const matchesContentieux =
        contentieuxFilter === 'off' ? true :
        contentieuxFilter === 'include' ? clientHasContentieux(client.clientName) :
        !clientHasContentieux(client.clientName);

      const matchesRetained =
        retainedFilter === 'off' ? true :
        retainedFilter === 'include' ? clientHasRetained(client.clientName) :
        !clientHasRetained(client.clientName);

      const matchesPartial =
        partialFilter === 'off' ? true :
        partialFilter === 'include' ? clientHasPartial(client.clientName) :
        !clientHasPartial(client.clientName);

      return matchesContentieux && matchesRetained && matchesPartial;
    });
  }, [analysis, debts, selectedCommercial, searchTerm, contentieuxFilter, retainedFilter, partialFilter]);

  useEffect(() => {
    if (filteredClients.length > 0 && expandedClients.size === 0) {
      setExpandedClients(new Set(filteredClients.map((c: any) => c.clientName)));
    }
  }, [filteredClients]);

  const commercialOptions = useMemo(() => {
    if (!analysis) return [];
    const map = new Map<string, any>();
    (analysis.clientBreakdown || []).forEach((c: any) => {
      if (c.commercialName) {
        if (!map.has(c.commercialName)) {
          map.set(c.commercialName, {
            name: c.commercialName,
            code: c.commercialCode || '?',
            source: c.sourceFile || '?'
          });
        }
      }
    });
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [analysis]);

  const toggleClient = (name: string) => {
    const next = new Set(expandedClients);
    if (next.has(name)) next.delete(name);
    else next.add(name);
    setExpandedClients(next);
  };

  const allExpanded = filteredClients.length > 0 && expandedClients.size === filteredClients.length;

  return (
    <div className="flex h-screen bg-slate-50">
      <Sidebar />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white border-b border-slate-200 px-8 py-6 flex-shrink-0">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 shadow-lg shadow-emerald-200">
                <Users className="h-7 w-7 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Portefeuille Clients</h1>
                <p className="text-slate-500 text-sm font-medium">
                  {filteredClients.length} clients affichés sur {analysis?.clientBreakdown?.length || 0}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="relative w-72">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Nom, code client..."
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-100 border-transparent focus:bg-white focus:ring-2 focus:ring-emerald-500 rounded-xl text-sm transition-all outline-none"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              
              <Select value={selectedCommercial} onValueChange={setSelectedCommercial}>
                <SelectTrigger className="w-[300px] h-11 bg-white border-slate-200 rounded-xl text-slate-700">
                  <Filter className="h-4 w-4 mr-2 text-slate-400" />
                  <SelectValue placeholder="Commercial" />
                </SelectTrigger>
                <SelectContent className="max-w-[400px]">
                  <SelectItem value="all">Tous les commerciaux</SelectItem>
                  {commercialOptions.map(opt => (
                    <SelectItem key={opt.name} value={opt.name}>
                      <div className="flex flex-col py-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 bg-slate-100 rounded text-slate-500">
                            {opt.code}
                          </span>
                          <span className="font-semibold text-slate-700">{opt.name}</span>
                        </div>
                        <span className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-1">
                          <FileText className="h-3 w-3" /> {opt.source}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Button 
                variant="outline" 
                size="sm"
                onClick={() => allExpanded ? setExpandedClients(new Set()) : setExpandedClients(new Set(filteredClients.map((c: any) => c.clientName)))}
                className="rounded-xl h-11 px-4 bg-white border-slate-200 text-slate-600 hover:bg-slate-50 font-semibold"
              >
                {allExpanded ? <Shrink className="h-4 w-4 mr-2" /> : <Expand className="h-4 w-4 mr-2" />}
                {allExpanded ? 'Tout replier' : 'Tout déplier'}
              </Button>

              <div className="flex items-center gap-2 border-l border-slate-200 pl-3">
                <Button 
                  variant="outline" 
                  onClick={() => ExportService.exportClientsToExcel(filteredClients)}
                  className="bg-emerald-50 hover:bg-emerald-100 border-emerald-200 text-emerald-700 rounded-xl h-11 px-5 font-bold"
                >
                  <FileSpreadsheet className="h-4 w-4 mr-2" />
                  Excel
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => ExportService.exportClientsToPDF(filteredClients)}
                  className="bg-rose-50 hover:bg-rose-100 border-rose-200 text-rose-700 rounded-xl h-11 px-5 font-bold"
                >
                  <FileText className="h-4 w-4 mr-2" />
                  PDF
                </Button>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 mt-6">
            <Badge
              variant="outline"
              className={`cursor-pointer px-5 py-2 rounded-full text-xs font-bold transition-all shadow-sm flex items-center gap-2 ${
                contentieuxFilter === 'include' ? 'bg-green-600 text-white border-green-600' :
                contentieuxFilter === 'exclude' ? 'bg-red-600 text-white border-red-600' :
                'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
              onClick={() => setContentieuxFilter(prev => prev === 'off' ? 'include' : prev === 'include' ? 'exclude' : 'off')}
            >
              <Scale className="h-3.5 w-3.5" />
              {contentieuxFilter === 'exclude' ? 'Non ' : ''}Contentieux ({contentieuxFilter === 'exclude' ? stats.nonContentieux : stats.contentieux}) {contentieuxFilter === 'include' ? '✓' : contentieuxFilter === 'exclude' ? '✗' : ''}
            </Badge>
            
            <Badge
              variant="outline"
              className={`cursor-pointer px-5 py-2 rounded-full text-xs font-bold transition-all shadow-sm flex items-center gap-2 ${
                retainedFilter === 'include' ? 'bg-green-600 text-white border-green-600' :
                retainedFilter === 'exclude' ? 'bg-red-600 text-white border-red-600' :
                'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
              onClick={() => setRetainedFilter(prev => prev === 'off' ? 'include' : prev === 'include' ? 'exclude' : 'off')}
            >
              <ShieldCheck className="h-3.5 w-3.5" />
              {retainedFilter === 'exclude' ? 'Non ' : ''}Retenue ({retainedFilter === 'exclude' ? stats.nonRetained : stats.retained}) {retainedFilter === 'include' ? '✓' : retainedFilter === 'exclude' ? '✗' : ''}
            </Badge>
            
            <Badge
              variant="outline"
              className={`cursor-pointer px-5 py-2 rounded-full text-xs font-bold transition-all shadow-sm flex items-center gap-2 ${
                partialFilter === 'include' ? 'bg-green-600 text-white border-green-600' :
                partialFilter === 'exclude' ? 'bg-red-600 text-white border-red-600' :
                'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
              onClick={() => setPartialFilter(prev => prev === 'off' ? 'include' : prev === 'include' ? 'exclude' : 'off')}
            >
              <CreditCard className="h-3.5 w-3.5" />
              {partialFilter === 'exclude' ? 'Non ' : ''}Partiel ({partialFilter === 'exclude' ? stats.nonPartial : stats.partial}) {partialFilter === 'include' ? '✓' : partialFilter === 'exclude' ? '✗' : ''}
            </Badge>

            {(contentieuxFilter !== 'off' || retainedFilter !== 'off' || partialFilter !== 'off') && (
              <Button
                variant="ghost"
                size="sm"
                className="text-slate-400 hover:text-slate-600 gap-1 h-8 text-[10px] uppercase font-black tracking-widest"
                onClick={() => {
                  setContentieuxFilter('off');
                  setRetainedFilter('off');
                  setPartialFilter('off');
                }}
              >
                <X className="h-3 w-3" /> Réinitialiser
              </Button>
            )}
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-8 bg-slate-50/50">
          <div className="max-w-7xl mx-auto space-y-6">
            {filteredClients.map((client: any, idx: number) => {
              const isExpanded = expandedClients.has(client.clientName);
              const clientDebts = debts
                .filter(d => d.clientName === client.clientName)
                .sort((a, b) => (a.extractIndex || 0) - (b.extractIndex || 0));
              
              return (
                <Card key={idx} className="border-0 shadow-md bg-white overflow-hidden rounded-[32px] transition-all hover:shadow-xl">
                  <div 
                    onClick={() => toggleClient(client.clientName)}
                    className="p-8 flex items-center justify-between cursor-pointer hover:bg-slate-50/50 transition-colors"
                  >
                    <div className="flex items-center gap-6">
                      <div className="flex-shrink-0">
                        {isExpanded ? <ChevronDown className="h-6 w-6 text-slate-400" /> : <ChevronRight className="h-6 w-6 text-slate-400" />}
                      </div>
                      <div className={`w-16 h-16 rounded-[20px] flex items-center justify-center font-black text-2xl shadow-inner ${client.totalBalance > 0 ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'}`}>
                        {client.clientName?.[0] || '?'}
                      </div>
                      <div>
                        <div className="flex items-center gap-3">
                          <span className="text-[11px] font-black font-mono text-slate-400 bg-slate-50 border border-slate-100 px-2 py-1 rounded-lg">{client.sourceFile || '?'}</span>
                          <h4 className="font-black text-slate-800 text-xl tracking-tight">{client.clientName}</h4>
                        </div>
                        <div className="flex items-center gap-6 text-sm text-slate-500 mt-3">
                          <span className="flex items-center gap-1.5 font-bold bg-slate-50 px-3 py-1.5 rounded-xl text-xs text-slate-700 border border-slate-100">Code client: <span className="text-blue-600 font-black ml-1">{client.clientCode}</span></span>
                          <span className="flex items-center gap-2 font-semibold"><FileText className="h-4 w-4 text-slate-400" />{client.debtCount} factures</span>
                          <span className="text-emerald-600 font-black flex items-center gap-2 bg-emerald-50/50 px-3 py-1.5 rounded-xl border border-emerald-100/50"><Users className="h-4 w-4" />{client.commercialName}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-10 pr-4">
                      <div className="text-right">
                        <div className={`text-3xl font-black tracking-tighter ${client.totalBalance > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                          {(client.totalBalance ?? 0).toLocaleString('fr-FR')} <span className="text-base font-medium opacity-60">TND</span>
                        </div>
                        <div className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] mt-1 text-right">Solde global</div>
                      </div>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="px-8 pb-8 pt-0 border-t border-slate-50">
                      <div className="bg-white rounded-[24px] overflow-hidden border border-slate-200 shadow-inner">
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-slate-50/80 border-b border-slate-100 hover:bg-slate-50/80">
                              <TableHead className="text-xs font-black uppercase tracking-wider text-slate-500 py-5 px-6">N° Facture</TableHead>
                              <TableHead className="text-xs font-black uppercase tracking-wider text-slate-500 py-5">Date</TableHead>
                              <TableHead className="text-xs font-black uppercase tracking-wider text-slate-500 py-5">Intitulé / BC</TableHead>
                              <TableHead className="text-xs font-black uppercase tracking-wider text-slate-500 text-right py-5">Montant</TableHead>
                              <TableHead className="text-xs font-black uppercase tracking-wider text-slate-500 text-right py-5">Réglé</TableHead>
                              <TableHead className="text-xs font-black uppercase tracking-wider text-slate-500 text-right py-5">Solde</TableHead>
                              <TableHead className="text-xs font-black uppercase tracking-wider text-slate-500 text-center py-5">Âge</TableHead>
                              <TableHead className="text-xs font-black uppercase tracking-wider text-slate-500 text-center py-5 px-6">% Règlement</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {clientDebts.map((debt, i) => {
                              const paymentRatio = debt.amount > 0 ? (debt.settlement / debt.amount) * 100 : 0;
                              return (
                                <TableRow key={i} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/30 transition-colors group">
                                  <TableCell className="font-mono text-sm font-bold text-slate-700 py-5 px-6">{debt.documentNumber}</TableCell>
                                  <TableCell className="text-sm font-medium text-slate-600 py-5">{new Date(debt.documentDate).toLocaleDateString('fr-FR')}</TableCell>
                                  <TableCell className="text-xs font-semibold text-slate-500 py-5 italic">{debt.description || '-'}</TableCell>
                                  <TableCell className="text-sm font-bold text-slate-800 text-right py-5">{(debt.amount ?? 0).toLocaleString('fr-FR')} TND</TableCell>
                                  <TableCell className="text-sm font-bold text-emerald-600 text-right py-5">{(debt.settlement ?? 0).toLocaleString('fr-FR')} TND</TableCell>
                                  <TableCell className="text-base font-black text-rose-600 text-right py-5">{(debt.balance ?? 0).toLocaleString('fr-FR')} TND</TableCell>
                                  <TableCell className="text-center py-5">
                                    <Badge className={`font-black px-3 py-1 rounded-lg ${debt.age > 90 ? 'bg-rose-100 text-rose-600' : 'bg-slate-100 text-slate-600'}`}>{debt.age} j</Badge>
                                  </TableCell>
                                  <TableCell className="py-5 px-6">
                                    <div className="flex flex-col gap-1.5 min-w-[100px]">
                                      <div className="flex justify-between items-center text-[10px] font-black text-slate-500">
                                        <span>{paymentRatio.toFixed(0)}%</span>
                                        <Target className="h-3 w-3 text-slate-300" />
                                      </div>
                                      <Progress value={paymentRatio} className="h-1.5 bg-slate-100" />
                                    </div>
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        </main>
      </div>
    </div>
  );
}
