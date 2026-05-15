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
  Target,
  Menu,
  SlidersHorizontal
} from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
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
import { ClientRemarkModal } from '@/components/ClientRemarkModal';

export default function ClientsPage() {
  const { debts, analysis, clientRemarks, addClientRemark, logAudit } = useDebtContext();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCommercial, setSelectedCommercial] = useState('all');
  const [expandedClients, setExpandedClients] = useState<Set<string>>(new Set());
  const [sidebarOpen, setSidebarOpen] = useState(false);
  
  // State for Remark Modal
  const [isRemarkModalOpen, setIsRemarkModalOpen] = useState(false);
  const [remarkClientName, setRemarkClientName] = useState('');
  
  // Tristate filters
  const [contentieuxFilter, setContentieuxFilter] = useState<'off' | 'include' | 'exclude'>('off');
  const [retainedFilter, setRetainedFilter] = useState<'off' | 'include' | 'exclude'>('off');
  const [partialFilter, setPartialFilter] = useState<'off' | 'include' | 'exclude'>('off');
  const [minAmountFilter, setMinAmountFilter] = useState<boolean>(false);

  // Age-based exclusion filters
  const [excludedAgeRanges, setExcludedAgeRanges] = useState<Set<string>>(new Set());

  const ageRanges = [
    { id: '0-15', label: '0-15j', min: 0, max: 15 },
    { id: '16-30', label: '16-30j', min: 16, max: 30 },
    { id: '31-60', label: '31-60j', min: 31, max: 60 },
    { id: '61-100', label: '61-100j', min: 61, max: 100 },
    { id: '101-364', label: '101-364j', min: 101, max: 364 },
  ];

  const toggleAgeExclusion = (rangeId: string) => {
    const next = new Set(excludedAgeRanges);
    if (next.has(rangeId)) next.delete(rangeId);
    else next.add(rangeId);
    setExcludedAgeRanges(next);
  };

  const isAgeExcluded = (ageValue: any) => {
    const age = typeof ageValue === 'number' ? ageValue : parseInt(String(ageValue).replace(/[^0-9]/g, '')) || 0;
    
    for (const rangeId of Array.from(excludedAgeRanges)) {
      const range = ageRanges.find(r => r.id === rangeId);
      if (range && age >= range.min && age <= range.max) return true;
    }
    return false;
  };

  // Business logic for filters
  const isContentieux = (d: ClientDebt) => {
    const age = typeof d.age === 'number' ? d.age : parseInt(String(d.age).replace(/[^0-9]/g, '')) || 0;
    const balance = typeof d.balance === 'number' ? d.balance : parseFloat(String(d.balance).replace(/[^\d.,-]/g, '').replace(',', '.')) || 0;
    return age > 365 && balance > 0;
  };

  const isRetained = (debt: ClientDebt) => {
    const upper = (debt.documentNumber || '').toUpperCase();
    if (!upper.startsWith('FT') && !upper.startsWith('FS')) return false;
    
    const balance = typeof debt.balance === 'number' ? debt.balance : parseFloat(String(debt.balance).replace(/[^\d.,-]/g, '').replace(',', '.')) || 0;
    const amount = typeof debt.amount === 'number' ? debt.amount : parseFloat(String(debt.amount).replace(/[^\d.,-]/g, '').replace(',', '.')) || 0;
    
    if (balance <= 0 || amount <= 0) return false;
    const ratio = (balance / amount) * 100;
    return ratio >= 0.5 && ratio <= 1.5;
  };

  const isPartial = (debt: ClientDebt) => {
    const upper = (debt.documentNumber || '').toUpperCase();
    if (!upper.startsWith('FT') && !upper.startsWith('FS')) return false;
    
    const balance = typeof debt.balance === 'number' ? debt.balance : parseFloat(String(debt.balance).replace(/[^\d.,-]/g, '').replace(',', '.')) || 0;
    const amount = typeof debt.amount === 'number' ? debt.amount : parseFloat(String(debt.amount).replace(/[^\d.,-]/g, '').replace(',', '.')) || 0;
    
    if (balance <= 0 || amount <= 0) return false;
    const ratio = (balance / amount) * 100;
    return ratio > 1.5 && ratio < 99;
  };

  // Helper to get client-level matches
  const clientHasContentieux = (clientName: string) => {
    return debts.filter(d => d.clientName === clientName).some(d => {
      const rawAge = d.age;
      const rawAmount = d.amount;
      const amount = typeof rawAmount === 'number' ? rawAmount : parseFloat(String(rawAmount).replace(/[^\d.,-]/g, '').replace(',', '.')) || 0;
      
      const matchesAgeExclusion = !isAgeExcluded(rawAge);
      const matchesMinAmount = minAmountFilter ? amount >= 5000 : true;
      return isContentieux(d) && matchesAgeExclusion && matchesMinAmount;
    });
  };
  const clientHasRetained = (clientName: string) => {
    return debts.filter(d => d.clientName === clientName).some(d => {
      const rawAge = d.age;
      const rawAmount = d.amount;
      const amount = typeof rawAmount === 'number' ? rawAmount : parseFloat(String(rawAmount).replace(/[^\d.,-]/g, '').replace(',', '.')) || 0;
      
      const matchesAgeExclusion = !isAgeExcluded(rawAge);
      const matchesMinAmount = minAmountFilter ? amount >= 5000 : true;
      return isRetained(d) && matchesAgeExclusion && matchesMinAmount;
    });
  };
  const clientHasPartial = (clientName: string) => {
    return debts.filter(d => d.clientName === clientName).some(d => {
      const rawAge = d.age;
      const rawAmount = d.amount;
      const amount = typeof rawAmount === 'number' ? rawAmount : parseFloat(String(rawAmount).replace(/[^\d.,-]/g, '').replace(',', '.')) || 0;
      
      const matchesAgeExclusion = !isAgeExcluded(rawAge);
      const matchesMinAmount = minAmountFilter ? amount >= 5000 : true;
      return isPartial(d) && matchesAgeExclusion && matchesMinAmount;
    });
  };

  // Counts for tristate filters
  const stats = useMemo(() => {
    if (!analysis) return { contentieux: 0, retained: 0, partial: 0, nonContentieux: 0, nonRetained: 0, nonPartial: 0 };
    
    // The counts should also respect the Age and Amount filters to be consistent
    const list = analysis.clientBreakdown || [];
    return {
      contentieux: list.filter(c => clientHasContentieux(c.clientName)).length,
      retained: list.filter(c => clientHasRetained(c.clientName)).length,
      partial: list.filter(c => clientHasPartial(c.clientName)).length,
      nonContentieux: list.filter(c => !clientHasContentieux(c.clientName)).length,
      nonRetained: list.filter(c => !clientHasRetained(c.clientName)).length,
      nonPartial: list.filter(c => !clientHasPartial(c.clientName)).length
    };
  }, [analysis, debts, excludedAgeRanges, minAmountFilter]);

  // Filtered client list logic with line-level filtering
  const filteredClients = useMemo(() => {
    if (!analysis) return [];
    let list = analysis.clientBreakdown || [];
    
    // 1. Basic Filters (Search)
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      list = list.filter((c: any) => 
        c.clientName.toLowerCase().includes(term) || 
        c.clientCode.toLowerCase().includes(term)
      );
    }

    // 2. Line-level status filtering
    return list.map((client: any) => {
      // Get all debts for this client
      const allClientDebts = debts.filter(d => d.clientName === client.clientName);
      
      // Filter the debts based on all active criteria
      const filteredDebts = allClientDebts.filter(debt => {
        // Special invoice flag - used to bypass STATUS filters only
        const isSpecial = (debt.balance < 0) || /^(AVS|AVT|FRS|FRT)/i.test(debt.documentNumber || '');

        // 1. Commercial filter - ALWAYS ENFORCED (even for special invoices)
        if (selectedCommercial !== 'all' && debt.commercialName !== selectedCommercial) return false;

        // --- Special invoices bypass STATUS and AMOUNT filters below ---
        if (isSpecial) return true;

        // 2. Age exclusion logic
        const rawAge = debt.age;
        const matchesAgeExclusion = !isAgeExcluded(rawAge);
        if (!matchesAgeExclusion) return false;

        // 3. Min amount logic
        const balance = typeof debt.balance === 'number' ? debt.balance : parseFloat(String(debt.balance).replace(/[^\d.,-]/g, '').replace(',', '.')) || 0;
        
        const matchesMinAmount = minAmountFilter ? (balance >= 5000) : true;
        if (!matchesMinAmount) return false;

        // 4. Status filters (Tristate)
        const matchesContentieux =
          contentieuxFilter === 'off' ? true :
          contentieuxFilter === 'include' ? isContentieux(debt) :
          !isContentieux(debt);
        if (!matchesContentieux) return false;

        const matchesRetained =
          retainedFilter === 'off' ? true :
          retainedFilter === 'include' ? isRetained(debt) :
          !isRetained(debt);
        if (!matchesRetained) return false;

        const matchesPartial =
          partialFilter === 'off' ? true :
          partialFilter === 'include' ? isPartial(debt) :
          !isPartial(debt);
        if (!matchesPartial) return false;

        return true;
      });

      // Recalculate totals for this client based on visible lines
      const totalBalance = filteredDebts.reduce((sum, d) => sum + (d.balance || 0), 0);
      const debtCount = filteredDebts.length;

      return {
        ...client,
        filteredDebts,
        totalBalance,
        debtCount
      };
    }).filter(client => client.debtCount > 0)
      .sort((a, b) => {
        const fileComp = (a.sourceFile || '').localeCompare(b.sourceFile || '');
        if (fileComp !== 0) return fileComp;
        return (a.clientCode || '').localeCompare(b.clientCode || '', undefined, { numeric: true });
      });
  }, [analysis, debts, selectedCommercial, searchTerm, contentieuxFilter, retainedFilter, partialFilter, excludedAgeRanges, minAmountFilter]);

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

  const handleOpenRemarkModal = (e: React.MouseEvent, name: string) => {
    e.stopPropagation();
    setRemarkClientName(name);
    setIsRemarkModalOpen(true);
  };

  const allExpanded = filteredClients.length > 0 && expandedClients.size === filteredClients.length;

  return (
    <div className="flex h-screen bg-slate-50">
      <Sidebar mobileOpen={sidebarOpen} onMobileClose={() => setSidebarOpen(false)} />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white border-b border-slate-200 px-4 md:px-8 py-4 md:py-6 flex-shrink-0">
          <div className="flex flex-col gap-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 md:gap-4">
                <Button
                  variant="ghost"
                  size="sm"
                  className="md:hidden p-2 -ml-2"
                  onClick={() => setSidebarOpen(true)}
                >
                  <Menu className="h-5 w-5" />
                </Button>
                <div className="p-2 md:p-3 rounded-xl md:rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 shadow-lg shadow-emerald-200">
                  <Users className="h-5 w-5 md:h-7 md:w-7 text-white" />
                </div>
                <div>
                  <h1 className="text-lg md:text-2xl font-bold text-slate-800 tracking-tight">Portefeuille Clients</h1>
                  <p className="text-slate-500 text-[10px] md:text-sm font-medium">
                    {filteredClients.length} clients affichés
                  </p>
                </div>
              </div>

              {/* Mobile Filter Trigger */}
              <div className="md:hidden">
                <Sheet>
                  <SheetTrigger asChild>
                    <Button variant="outline" size="sm" className="rounded-xl border-slate-200 gap-2">
                      <SlidersHorizontal className="h-4 w-4" />
                      Filtres
                    </Button>
                  </SheetTrigger>
                  <SheetContent side="right" className="w-[300px] sm:w-[400px] overflow-y-auto">
                    <SheetHeader>
                      <SheetTitle>Filtres Avancés</SheetTitle>
                      <SheetDescription>
                        Affinez votre recherche par statut et par âge.
                      </SheetDescription>
                    </SheetHeader>
                    <div className="py-6 space-y-8">
                      <div className="space-y-4">
                        <h4 className="text-sm font-black uppercase tracking-widest text-slate-400">Statuts</h4>
                        <div className="flex flex-col gap-3">
                          <Badge
                            variant="outline"
                            className={`cursor-pointer px-4 py-3 rounded-xl text-xs font-bold transition-all shadow-sm flex items-center justify-between ${
                              contentieuxFilter === 'include' ? 'bg-green-600 text-white border-green-600' :
                              contentieuxFilter === 'exclude' ? 'bg-red-600 text-white border-red-600' :
                              'bg-white text-slate-600 border-slate-200'
                            }`}
                            onClick={() => setContentieuxFilter(prev => prev === 'off' ? 'include' : prev === 'include' ? 'exclude' : 'off')}
                          >
                            <div className="flex items-center gap-2">
                              <Scale className="h-4 w-4" />
                              <span>{contentieuxFilter === 'exclude' ? 'Non ' : ''}Contentieux</span>
                            </div>
                            <span>{contentieuxFilter === 'exclude' ? stats.nonContentieux : stats.contentieux}</span>
                          </Badge>
                          
                          <Badge
                            variant="outline"
                            className={`cursor-pointer px-4 py-3 rounded-xl text-xs font-bold transition-all shadow-sm flex items-center justify-between ${
                              retainedFilter === 'include' ? 'bg-green-600 text-white border-green-600' :
                              retainedFilter === 'exclude' ? 'bg-red-600 text-white border-red-600' :
                              'bg-white text-slate-600 border-slate-200'
                            }`}
                            onClick={() => setRetainedFilter(prev => prev === 'off' ? 'include' : prev === 'include' ? 'exclude' : 'off')}
                          >
                            <div className="flex items-center gap-2">
                              <ShieldCheck className="h-4 w-4" />
                              <span>{retainedFilter === 'exclude' ? 'Non ' : ''}Retenue</span>
                            </div>
                            <span>{retainedFilter === 'exclude' ? stats.nonRetained : stats.retained}</span>
                          </Badge>
                          
                          <Badge
                            variant="outline"
                            className={`cursor-pointer px-4 py-3 rounded-xl text-xs font-bold transition-all shadow-sm flex items-center justify-between ${
                              partialFilter === 'include' ? 'bg-green-600 text-white border-green-600' :
                              partialFilter === 'exclude' ? 'bg-red-600 text-white border-red-600' :
                              'bg-white text-slate-600 border-slate-200'
                            }`}
                            onClick={() => setPartialFilter(prev => prev === 'off' ? 'include' : prev === 'include' ? 'exclude' : 'off')}
                          >
                            <div className="flex items-center gap-2">
                              <CreditCard className="h-4 w-4" />
                              <span>{partialFilter === 'exclude' ? 'Non ' : ''}Partiel</span>
                            </div>
                            <span>{partialFilter === 'exclude' ? stats.nonPartial : stats.partial}</span>
                          </Badge>

                          <Badge
                            variant="outline"
                            className={`cursor-pointer px-4 py-3 rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-2 ${
                              minAmountFilter ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-200'
                            }`}
                            onClick={() => setMinAmountFilter(!minAmountFilter)}
                          >
                            <Target className="h-4 w-4" />
                            Solde ≥ 5 000 TND
                          </Badge>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <h4 className="text-sm font-black uppercase tracking-widest text-slate-400">Exclure par âge</h4>
                        <div className="grid grid-cols-2 gap-2">
                          {ageRanges.map((range) => {
                            const isExcluded = excludedAgeRanges.has(range.id);
                            return (
                              <Badge
                                key={range.id}
                                variant="outline"
                                className={`cursor-pointer px-3 py-2 rounded-lg text-[10px] font-bold transition-all shadow-sm flex items-center justify-center gap-2 ${
                                  isExcluded ? 'bg-amber-100 text-amber-700 border-amber-200' : 'bg-white text-slate-500 border-slate-200'
                                }`}
                                onClick={() => toggleAgeExclusion(range.id)}
                              >
                                {isExcluded && '✗ '}{range.label}
                              </Badge>
                            );
                          })}
                        </div>
                      </div>

                      <Button
                        variant="outline"
                        className="w-full rounded-xl"
                        onClick={() => {
                          setContentieuxFilter('off');
                          setRetainedFilter('off');
                          setPartialFilter('off');
                          setExcludedAgeRanges(new Set());
                          setMinAmountFilter(false);
                        }}
                      >
                        <X className="h-4 w-4 mr-2" /> Réinitialiser
                      </Button>
                    </div>
                  </SheetContent>
                </Sheet>
              </div>
            </div>

            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="flex flex-col md:flex-row gap-3 flex-1">
                <div className="relative flex-1 md:max-w-xs">
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
                  <SelectTrigger className="w-full md:w-[250px] h-11 bg-white border-slate-200 rounded-xl text-slate-700">
                    <Filter className="h-4 w-4 mr-2 text-slate-400" />
                    <SelectValue placeholder="Commercial" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous les commerciaux</SelectItem>
                    {commercialOptions.map(opt => (
                      <SelectItem key={opt.name} value={opt.name}>
                        <span className="font-semibold">{opt.name}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0 scrollbar-hide">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => allExpanded ? setExpandedClients(new Set()) : setExpandedClients(new Set(filteredClients.map((c: any) => c.clientName)))}
                  className="rounded-xl h-11 px-4 bg-white border-slate-200 text-slate-600 hover:bg-slate-50 font-semibold whitespace-nowrap"
                >
                  {allExpanded ? <Shrink className="h-4 w-4 md:mr-2" /> : <Expand className="h-4 w-4 md:mr-2" />}
                  <span className="hidden md:inline">{allExpanded ? 'Tout replier' : 'Tout déplier'}</span>
                </Button>

                <div className="h-8 w-px bg-slate-200 mx-1 hidden md:block" />

                <div className="flex items-center gap-2">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => {
                      const activeFilters = [
                        searchTerm ? `Recherche: "${searchTerm}"` : '',
                        selectedCommercial !== 'all' ? `Commercial: ${selectedCommercial}` : '',
                        contentieuxFilter !== 'off' ? `${contentieuxFilter === 'include' ? '' : 'Non '}Contentieux` : '',
                        retainedFilter !== 'off' ? `${retainedFilter === 'include' ? '' : 'Non '}Retenue` : '',
                        partialFilter !== 'off' ? `${partialFilter === 'include' ? '' : 'Non '}Partiel` : '',
                        minAmountFilter ? 'Solde ≥ 5000 TND' : '',
                        excludedAgeRanges.size > 0 ? `Exclusion âge: ${Array.from(excludedAgeRanges).join(', ')}` : ''
                      ].filter(Boolean).join(' | ');
                      ExportService.exportClientsToExcel(filteredClients, clientRemarks, activeFilters || 'Aucun', logAudit);
                    }}
                    className="bg-emerald-50 hover:bg-emerald-100 border-emerald-200 text-emerald-700 rounded-xl h-11 px-4 font-bold"
                  >
                    <FileSpreadsheet className="h-4 w-4 md:mr-2" />
                    <span className="hidden md:inline">Excel</span>
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => {
                      const activeFilters = [
                        searchTerm ? `Recherche: "${searchTerm}"` : '',
                        selectedCommercial !== 'all' ? `Commercial: ${selectedCommercial}` : '',
                        contentieuxFilter !== 'off' ? `${contentieuxFilter === 'include' ? '' : 'Non '}Contentieux` : '',
                        retainedFilter !== 'off' ? `${retainedFilter === 'include' ? '' : 'Non '}Retenue` : '',
                        partialFilter !== 'off' ? `${partialFilter === 'include' ? '' : 'Non '}Partiel` : '',
                        minAmountFilter ? 'Solde ≥ 5000 TND' : '',
                        excludedAgeRanges.size > 0 ? `Exclusion âge: ${Array.from(excludedAgeRanges).join(', ')}` : ''
                      ].filter(Boolean).join(' | ');
                      ExportService.exportClientsToPDF(filteredClients, clientRemarks, activeFilters || 'Aucun', logAudit);
                    }}
                    className="bg-rose-50 hover:bg-rose-100 border-rose-200 text-rose-700 rounded-xl h-11 px-4 font-bold"
                  >
                    <FileText className="h-4 w-4 md:mr-2" />
                    <span className="hidden md:inline">PDF</span>
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* Desktop Only Advanced Filters */}
          <div className="hidden md:flex flex-col gap-4 mt-6">
            <div className="flex flex-wrap items-center gap-3">
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
                {contentieuxFilter === 'exclude' ? 'Non ' : ''}Contentieux ({contentieuxFilter === 'exclude' ? stats.nonContentieux : stats.contentieux})
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
                {retainedFilter === 'exclude' ? 'Non ' : ''}Retenue ({retainedFilter === 'exclude' ? stats.nonRetained : stats.retained})
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
                {partialFilter === 'exclude' ? 'Non ' : ''}Partiel ({partialFilter === 'exclude' ? stats.nonPartial : stats.partial})
              </Badge>

              <Badge
                variant="outline"
                className={`cursor-pointer px-5 py-2 rounded-full text-xs font-bold transition-all shadow-sm flex items-center gap-2 ${
                  minAmountFilter ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                }`}
                onClick={() => setMinAmountFilter(!minAmountFilter)}
              >
                <Target className="h-3.5 w-3.5" />
                Solde ≥ 5 000 TND
              </Badge>

              {(contentieuxFilter !== 'off' || retainedFilter !== 'off' || partialFilter !== 'off' || excludedAgeRanges.size > 0 || minAmountFilter) && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-slate-400 hover:text-slate-600 gap-1 h-8 text-[10px] uppercase font-black tracking-widest ml-auto"
                  onClick={() => {
                    setContentieuxFilter('off');
                    setRetainedFilter('off');
                    setPartialFilter('off');
                    setExcludedAgeRanges(new Set());
                    setMinAmountFilter(false);
                  }}
                >
                  <X className="h-3 w-3" /> Réinitialiser
                </Button>
              )}
            </div>

            <div className="flex items-center gap-3 border-t border-slate-100 pt-4">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-2 flex items-center gap-2">
                <Filter className="h-3 w-3" /> Exclure par âge :
              </span>
              {ageRanges.map((range) => {
                const isExcluded = excludedAgeRanges.has(range.id);
                return (
                  <Badge
                    key={range.id}
                    variant="outline"
                    className={`cursor-pointer px-4 py-1.5 rounded-full text-[10px] font-bold transition-all shadow-sm flex items-center gap-2 ${
                      isExcluded ? 'bg-amber-100 text-amber-700 border-amber-200' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                    }`}
                    onClick={() => toggleAgeExclusion(range.id)}
                  >
                    {isExcluded && '✗ '}{range.label}
                  </Badge>
                );
              })}
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 md:p-8 bg-slate-50/50">
          <div className="max-w-7xl mx-auto space-y-4 md:space-y-6">
            {filteredClients.map((client: any, idx: number) => {
              const isExpanded = expandedClients.has(client.clientName);
              const clientDebts = client.filteredDebts.sort((a: any, b: any) => (a.extractIndex || 0) - (b.extractIndex || 0));
              
              return (
                <Card key={idx} className="border-0 shadow-md bg-white overflow-hidden rounded-[32px] transition-all hover:shadow-xl">
                  <div 
                    onClick={() => toggleClient(client.clientName)}
                    className="p-4 md:p-8 flex flex-col md:flex-row md:items-center justify-between cursor-pointer hover:bg-slate-50/50 transition-colors gap-4"
                  >
                    <div className="flex items-center gap-4 md:gap-6">
                      <div className="flex-shrink-0">
                        {isExpanded ? <ChevronDown className="h-5 w-5 md:h-6 md:w-6 text-slate-400" /> : <ChevronRight className="h-5 w-5 md:h-6 md:w-6 text-slate-400" />}
                      </div>
                      <div className={`w-12 h-12 md:w-16 md:h-16 rounded-xl md:rounded-[20px] flex items-center justify-center font-black text-lg md:text-2xl shadow-inner flex-shrink-0 ${client.totalBalance > 0 ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'}`}>
                        {client.clientName?.[0] || '?'}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-col md:flex-row md:items-center gap-1 md:gap-3">
                          <span className="text-[9px] md:text-[11px] font-black font-mono text-slate-400 bg-slate-50 border border-slate-100 px-2 py-0.5 md:py-1 rounded-lg w-fit">{client.sourceFile || '?'}</span>
                          <h4 
                            onClick={(e) => handleOpenRemarkModal(e, client.clientName)}
                            className="font-black text-slate-800 text-sm md:text-xl tracking-tight truncate hover:text-blue-600 hover:underline decoration-blue-300 underline-offset-4 transition-all"
                          >
                            {client.clientName}
                          </h4>
                        </div>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[10px] md:text-sm text-slate-500 mt-2 md:mt-3">
                          <span className="flex items-center gap-1.5 font-bold bg-slate-50 px-2 py-1 md:px-3 md:py-1.5 rounded-lg md:rounded-xl text-[10px] md:text-xs text-slate-700 border border-slate-100 whitespace-nowrap">Code: <span className="text-blue-600 font-black">{client.clientCode}</span></span>
                          <span className="flex items-center gap-1.5 font-semibold whitespace-nowrap"><FileText className="h-3 w-3 md:h-4 md:w-4 text-slate-400" />{client.debtCount} factures</span>
                          <span className="text-emerald-600 font-black flex items-center gap-1.5 bg-emerald-50/50 px-2 py-1 md:px-3 md:py-1.5 rounded-lg md:rounded-xl border border-emerald-100/50 whitespace-nowrap"><Users className="h-3 w-3 md:h-4 md:w-4" />{client.commercialName}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center justify-between md:justify-end gap-6 md:gap-10 md:pr-4 border-t md:border-t-0 pt-3 md:pt-0">
                      <div className="text-left md:text-right">
                        <div className={`text-xl md:text-3xl font-black tracking-tighter ${client.totalBalance > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                          {(client.totalBalance ?? 0).toLocaleString('fr-FR')} <span className="text-xs md:text-base font-medium opacity-60">TND</span>
                        </div>
                        <div className="text-[9px] md:text-[11px] font-black text-slate-400 uppercase tracking-widest md:tracking-[0.2em] mt-0.5 md:mt-1">Solde global</div>
                      </div>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="px-4 md:px-8 pb-4 md:pb-8 pt-0 border-t border-slate-50">
                      <div className="bg-white rounded-2xl md:rounded-[24px] overflow-x-auto border border-slate-200 shadow-inner scrollbar-hide">
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-slate-50/80 border-b border-slate-100 hover:bg-slate-50/80">
                              <TableHead className="text-[10px] md:text-xs font-black uppercase tracking-wider text-slate-500 py-3 md:py-5 px-4 md:px-6">N° Facture</TableHead>
                              <TableHead className="text-[10px] md:text-xs font-black uppercase tracking-wider text-slate-500 py-3 md:py-5">Date</TableHead>
                              <TableHead className="hidden lg:table-cell text-[10px] md:text-xs font-black uppercase tracking-wider text-slate-500 py-3 md:py-5">Intitulé / BC</TableHead>
                              <TableHead className="text-[10px] md:text-xs font-black uppercase tracking-wider text-slate-500 text-right py-3 md:py-5">Montant</TableHead>
                              <TableHead className="hidden md:table-cell text-[10px] md:text-xs font-black uppercase tracking-wider text-slate-500 text-right py-3 md:py-5">Réglé</TableHead>
                              <TableHead className="text-[10px] md:text-xs font-black uppercase tracking-wider text-slate-500 text-right py-3 md:py-5">Solde</TableHead>
                              <TableHead className="text-[10px] md:text-xs font-black uppercase tracking-wider text-slate-500 text-center py-3 md:py-5">Âge</TableHead>
                              <TableHead className="hidden sm:table-cell text-[10px] md:text-xs font-black uppercase tracking-wider text-slate-500 text-center py-3 md:py-5 px-4 md:px-6">% Règlement</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {clientDebts.map((debt, i) => {
                              const paymentRatio = debt.amount > 0 ? (debt.settlement / debt.amount) * 100 : 0;
                              return (
                                <TableRow key={i} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/30 transition-colors group">
                                  <TableCell className="font-mono text-xs md:sm font-bold text-slate-700 py-3 md:py-5 px-4 md:px-6">{debt.documentNumber}</TableCell>
                                  <TableCell className="text-xs md:text-sm font-medium text-slate-600 py-3 md:py-5 whitespace-nowrap">{new Date(debt.documentDate).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit' })}</TableCell>
                                  <TableCell className="hidden lg:table-cell text-[10px] md:text-xs font-semibold text-slate-500 py-3 md:py-5 italic max-w-[150px] truncate">{debt.description || '-'}</TableCell>
                                  <TableCell className="text-xs md:text-sm font-bold text-slate-800 text-right py-3 md:py-5">{(debt.amount ?? 0).toLocaleString('fr-FR')} TND</TableCell>
                                  <TableCell className="hidden md:table-cell text-xs md:text-sm font-bold text-emerald-600 text-right py-3 md:py-5">{(debt.settlement ?? 0).toLocaleString('fr-FR')} TND</TableCell>
                                  <TableCell className="text-sm md:text-base font-black text-rose-600 text-right py-3 md:py-5">{(debt.balance ?? 0).toLocaleString('fr-FR')} TND</TableCell>
                                  <TableCell className="text-center py-3 md:py-5">
                                    <Badge className={`font-black px-2 py-0.5 md:px-3 md:py-1 rounded-lg text-[9px] md:text-[11px] ${debt.age > 90 ? 'bg-rose-100 text-rose-600' : 'bg-slate-100 text-slate-600'}`}>{debt.age} j</Badge>
                                  </TableCell>
                                  <TableCell className="hidden sm:table-cell py-3 md:py-5 px-4 md:px-6">
                                    <div className="flex flex-col gap-1.5 min-w-[60px] md:min-w-[100px]">
                                      <div className="flex justify-between items-center text-[9px] md:text-[10px] font-black text-slate-500">
                                        <span>{paymentRatio.toFixed(0)}%</span>
                                        <Target className="h-2.5 w-2.5 md:h-3 md:w-3 text-slate-300" />
                                      </div>
                                      <Progress value={paymentRatio} className="h-1 md:h-1.5 bg-slate-100" />
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

      <ClientRemarkModal
        isOpen={isRemarkModalOpen}
        onClose={() => setIsRemarkModalOpen(false)}
        clientName={remarkClientName}
        remarks={clientRemarks[remarkClientName] || []}
        onAddRemark={addClientRemark}
      />
    </div>
  );
}
