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
  Phone,
  Scale,
  ShieldCheck,
  CreditCard
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

  // Filtered client list logic
  const filteredClients = useMemo(() => {
    if (!analysis) return [];
    let list = analysis.clientBreakdown || [];
    
    // 1. Filter by Commercial
    if (selectedCommercial !== 'all') {
      list = list.filter((c: any) => c.commercialName === selectedCommercial);
    }
    
    // 2. Filter by Search
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      list = list.filter((c: any) => 
        c.clientName.toLowerCase().includes(term) || 
        c.clientCode.toLowerCase().includes(term)
      );
    }

    // 3. Apply Tristate Filters (based on debts within client)
    return list.filter((client: any) => {
      const clientDebts = debts.filter(d => d.clientName === client.clientName);
      
      const matchesContentieux =
        contentieuxFilter === 'off' ? true :
        contentieuxFilter === 'include' ? clientDebts.some(isContentieux) :
        !clientDebts.some(isContentieux);

      const matchesRetained =
        retainedFilter === 'off' ? true :
        retainedFilter === 'include' ? clientDebts.some(isRetained) :
        !clientDebts.some(isRetained);

      const matchesPartial =
        partialFilter === 'off' ? true :
        partialFilter === 'include' ? clientDebts.some(isPartial) :
        !clientDebts.some(isPartial);

      return matchesContentieux && matchesRetained && matchesPartial;
    });
  }, [analysis.clientBreakdown, debts, selectedCommercial, searchTerm, contentieuxFilter, retainedFilter, partialFilter]);

  // Expand by default when list changes
  useEffect(() => {
    if (filteredClients.length > 0) {
      setExpandedClients(new Set(filteredClients.map((c: any) => c.clientName)));
    }
  }, [filteredClients]);

  const commercialOptions = useMemo(() => {
    const map = new Map<string, string>();
    if (!analysis) return [];
    (analysis.clientBreakdown || []).forEach((c: any) => {
      if (c.commercialName && c.commercialCode) {
        map.set(c.commercialName, c.commercialCode);
      }
    });
    return Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([name, code]) => ({ name, code }));
  }, [analysis.clientBreakdown]);

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
        {/* Header Section */}
        <header className="bg-white border-b border-slate-200 px-8 py-6 flex-shrink-0">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 shadow-lg shadow-emerald-200">
                <Users className="h-7 w-7 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Portefeuille Clients</h1>
                <p className="text-slate-500 text-sm font-medium">
                  {filteredClients.length} clients affichés
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Rechercher un client..."
                  className="w-full pl-10 pr-4 py-2 bg-slate-100 border-transparent focus:bg-white focus:ring-2 focus:ring-emerald-500 rounded-xl text-sm transition-all outline-none"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              
              <Select value={selectedCommercial} onValueChange={setSelectedCommercial}>
                <SelectTrigger className="w-[240px] bg-white border-slate-200 rounded-xl">
                  <Filter className="h-4 w-4 mr-2 text-slate-400" />
                  <SelectValue placeholder="Filtrer par commercial" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les commerciaux</SelectItem>
                  {commercialOptions.map(opt => (
                    <SelectItem key={opt.name} value={opt.name}>
                      <span className="text-[10px] font-mono text-slate-400 mr-2">[{opt.code}]</span>
                      {opt.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Button 
                variant="outline" 
                size="sm"
                onClick={() => allExpanded ? setExpandedClients(new Set()) : setExpandedClients(new Set(filteredClients.map((c: any) => c.clientName)))}
                className="rounded-xl h-10 px-4 bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
              >
                {allExpanded ? <Shrink className="h-4 w-4 mr-2" /> : <Expand className="h-4 w-4 mr-2" />}
                {allExpanded ? 'Tout replier' : 'Tout déplier'}
              </Button>

              <div className="flex items-center gap-2 border-l border-slate-200 pl-3">
                <Button 
                  variant="outline" 
                  onClick={() => ExportService.exportClientsToExcel(filteredClients)}
                  className="bg-emerald-50 hover:bg-emerald-100 border-emerald-200 text-emerald-700 rounded-xl h-10 px-4"
                >
                  <FileSpreadsheet className="h-4 w-4 mr-2" />
                  Excel
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => ExportService.exportClientsToPDF(filteredClients)}
                  className="bg-rose-50 hover:bg-rose-100 border-rose-200 text-rose-700 rounded-xl h-10 px-4"
                >
                  <FileText className="h-4 w-4 mr-2" />
                  PDF
                </Button>
              </div>
            </div>
          </div>

          {/* Tristate Filters Bar */}
          <div className="flex flex-wrap items-center gap-3 mt-6">
            <Badge
              variant="outline"
              className={`cursor-pointer px-4 py-1.5 rounded-full text-xs font-bold transition-all shadow-sm flex items-center gap-2 ${
                contentieuxFilter === 'include' ? 'bg-rose-600 text-white border-rose-600' :
                contentieuxFilter === 'exclude' ? 'bg-slate-800 text-white border-slate-800' :
                'bg-white text-rose-600 border-rose-200 hover:bg-rose-50'
              }`}
              onClick={() => setContentieuxFilter(prev => prev === 'off' ? 'include' : prev === 'include' ? 'exclude' : 'off')}
            >
              <Scale className="h-3.5 w-3.5" />
              Contentieux {contentieuxFilter === 'include' ? '✓' : contentieuxFilter === 'exclude' ? '✗' : ''}
            </Badge>
            
            <Badge
              variant="outline"
              className={`cursor-pointer px-4 py-1.5 rounded-full text-xs font-bold transition-all shadow-sm flex items-center gap-2 ${
                retainedFilter === 'include' ? 'bg-violet-600 text-white border-violet-600' :
                retainedFilter === 'exclude' ? 'bg-slate-800 text-white border-slate-800' :
                'bg-white text-violet-600 border-violet-200 hover:bg-violet-50'
              }`}
              onClick={() => setRetainedFilter(prev => prev === 'off' ? 'include' : prev === 'include' ? 'exclude' : 'off')}
            >
              <ShieldCheck className="h-3.5 w-3.5" />
              Retenue {retainedFilter === 'include' ? '✓' : retainedFilter === 'exclude' ? '✗' : ''}
            </Badge>
            
            <Badge
              variant="outline"
              className={`cursor-pointer px-4 py-1.5 rounded-full text-xs font-bold transition-all shadow-sm flex items-center gap-2 ${
                partialFilter === 'include' ? 'bg-amber-600 text-white border-amber-600' :
                partialFilter === 'exclude' ? 'bg-slate-800 text-white border-slate-800' :
                'bg-white text-amber-600 border-amber-200 hover:bg-amber-50'
              }`}
              onClick={() => setPartialFilter(prev => prev === 'off' ? 'include' : prev === 'include' ? 'exclude' : 'off')}
            >
              <CreditCard className="h-3.5 w-3.5" />
              Partiel {partialFilter === 'include' ? '✓' : partialFilter === 'exclude' ? '✗' : ''}
            </Badge>

            {(contentieuxFilter !== 'off' || retainedFilter !== 'off' || partialFilter !== 'off') && (
              <Button
                variant="ghost"
                size="sm"
                className="text-slate-400 hover:text-slate-600 gap-1 h-8 text-[10px] uppercase font-bold"
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

        {/* Content Area */}
        <main className="flex-1 overflow-y-auto p-8 bg-slate-50/50">
          <div className="max-w-7xl mx-auto space-y-6">
            {filteredClients.map((client: any, idx: number) => {
              const isExpanded = expandedClients.has(client.clientName);
              const clientDebts = debts.filter(d => d.clientName === client.clientName);
              
              return (
                <Card key={idx} className="border-0 shadow-sm bg-white overflow-hidden rounded-3xl transition-all">
                  {/* Client Card Header */}
                  <div 
                    onClick={() => toggleClient(client.clientName)}
                    className="p-6 flex items-center justify-between cursor-pointer hover:bg-slate-50/50 transition-colors"
                  >
                    <div className="flex items-center gap-5">
                      <div className="flex-shrink-0">
                        {isExpanded ? (
                          <ChevronDown className="h-5 w-5 text-slate-400" />
                        ) : (
                          <ChevronRight className="h-5 w-5 text-slate-400" />
                        )}
                      </div>
                      
                      <div className={`w-14 h-14 rounded-2xl flex items-center justify-center font-bold text-xl shadow-inner ${
                        client.totalBalance > 0 ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'
                      }`}>
                        {client.clientName?.[0] || '?'}
                      </div>
                      
                      <div>
                        <div className="flex items-center gap-3">
                          <span className="text-[10px] font-bold font-mono text-slate-400 bg-slate-50 border border-slate-100 px-2 py-0.5 rounded-lg">
                            {client.sourceFile || '?'}
                          </span>
                          <h4 className="font-bold text-slate-800 text-lg">
                            {client.clientName}
                          </h4>
                        </div>
                        
                        <div className="flex items-center gap-4 text-sm text-slate-500 mt-2">
                          <span className="flex items-center gap-1.5 font-medium bg-slate-50 px-2.5 py-1 rounded-lg text-[11px] text-slate-600 border border-slate-100">
                            <strong>Code client:</strong> {client.clientCode}
                          </span>
                          <span className="flex items-center gap-1.5 text-[11px]">
                            <FileText className="h-3.5 w-3.5 text-slate-400" />
                            {client.debtCount} factures
                          </span>
                          <span className="text-emerald-600 font-semibold flex items-center gap-1.5 text-[11px]">
                            <Users className="h-3.5 w-3.5" />
                            {client.commercialName}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-8">
                      <div className="text-right">
                        <div className={`text-2xl font-black tracking-tight ${client.totalBalance > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                          {(client.totalBalance ?? 0).toLocaleString('fr-FR')} <span className="text-sm font-normal opacity-60">TND</span>
                        </div>
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Solde restant</div>
                      </div>
                    </div>
                  </div>

                  {/* Expanded Table Section */}
                  {isExpanded && (
                    <div className="px-6 pb-6 pt-0 border-t border-slate-50">
                      <div className="bg-slate-50/50 rounded-2xl overflow-hidden border border-slate-100">
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-slate-100/50 border-0 hover:bg-slate-100/50">
                              <TableHead className="text-[10px] font-bold uppercase tracking-wider text-slate-500">N° Facture</TableHead>
                              <TableHead className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Date</TableHead>
                              <TableHead className="text-[10px] font-bold uppercase tracking-wider text-slate-500 text-right">Montant</TableHead>
                              <TableHead className="text-[10px] font-bold uppercase tracking-wider text-slate-500 text-right">Réglé</TableHead>
                              <TableHead className="text-[10px] font-bold uppercase tracking-wider text-slate-500 text-right">Solde</TableHead>
                              <TableHead className="text-[10px] font-bold uppercase tracking-wider text-slate-500 text-center">Âge</TableHead>
                              <TableHead className="text-[10px] font-bold uppercase tracking-wider text-slate-500 text-center">Type</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {clientDebts.map((debt, i) => (
                              <TableRow key={i} className="border-slate-50 hover:bg-white transition-colors group">
                                <TableCell className="font-mono text-xs font-bold text-slate-600">{debt.documentNumber}</TableCell>
                                <TableCell className="text-[11px] text-slate-500">{new Date(debt.documentDate).toLocaleDateString('fr-FR')}</TableCell>
                                <TableCell className="text-[11px] font-bold text-slate-700 text-right">{(debt.amount ?? 0).toLocaleString('fr-FR')} TND</TableCell>
                                <TableCell className="text-[11px] font-bold text-emerald-600 text-right">{(debt.payment ?? 0).toLocaleString('fr-FR')} TND</TableCell>
                                <TableCell className="text-[11px] font-black text-rose-600 text-right">{(debt.balance ?? 0).toLocaleString('fr-FR')} TND</TableCell>
                                <TableCell className="text-center">
                                  <Badge className={debt.age > 90 ? 'bg-rose-100 text-rose-600' : 'bg-slate-100 text-slate-600'}>
                                    {debt.age} j
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-center">
                                  <div className="flex justify-center gap-1">
                                    {isContentieux(debt) && <Badge className="bg-rose-500 text-white border-0 h-4 px-1 text-[8px]">C</Badge>}
                                    {isRetained(debt) && <Badge className="bg-violet-500 text-white border-0 h-4 px-1 text-[8px]">R</Badge>}
                                    {isPartial(debt) && <Badge className="bg-amber-500 text-white border-0 h-4 px-1 text-[8px]">P</Badge>}
                                  </div>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  )}
                </Card>
              );
            })}
            
            {filteredClients.length === 0 && (
              <div className="text-center py-20">
                <div className="bg-white p-12 rounded-3xl shadow-sm border border-slate-100 inline-block">
                  <Users className="h-16 w-16 text-slate-200 mx-auto mb-4" />
                  <p className="text-slate-400 font-medium">Aucun client trouvé pour ces critères.</p>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
