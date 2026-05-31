'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useDebtContext } from '@/lib/DebtContext';
import { useAuth } from '@/lib/AuthContext';
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
  SlidersHorizontal,
  MessageSquare,
  Star,
  Clock
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

// Helper to generate a dynamic and beautiful color theme for client cards based on a name hash
const getClientTheme = (clientName: string) => {
  const hash = (clientName || '').split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const themes = [
    {
      cardClass: 'bg-gradient-to-br from-white via-white to-blue-50/30 border-l-4 border-blue-400 hover:to-blue-50/50',
      avatarBg: 'bg-blue-50 text-blue-600 border border-blue-100/50',
    },
    {
      cardClass: 'bg-gradient-to-br from-white via-white to-purple-50/30 border-l-4 border-purple-400 hover:to-purple-50/50',
      avatarBg: 'bg-purple-50 text-purple-600 border border-purple-100/50',
    },
    {
      cardClass: 'bg-gradient-to-br from-white via-white to-emerald-50/30 border-l-4 border-emerald-400 hover:to-emerald-50/50',
      avatarBg: 'bg-emerald-50 text-emerald-600 border border-emerald-100/50',
    },
    {
      cardClass: 'bg-gradient-to-br from-white via-white to-amber-50/30 border-l-4 border-amber-400 hover:to-amber-50/50',
      avatarBg: 'bg-amber-50 text-amber-600 border border-amber-100/50',
    },
    {
      cardClass: 'bg-gradient-to-br from-white via-white to-rose-50/30 border-l-4 border-rose-400 hover:to-rose-50/50',
      avatarBg: 'bg-rose-50 text-rose-600 border border-rose-100/50',
    },
    {
      cardClass: 'bg-gradient-to-br from-white via-white to-sky-50/30 border-l-4 border-sky-400 hover:to-sky-50/50',
      avatarBg: 'bg-sky-50 text-sky-600 border border-sky-100/50',
    },
    {
      cardClass: 'bg-gradient-to-br from-white via-white to-indigo-50/30 border-l-4 border-indigo-400 hover:to-indigo-50/50',
      avatarBg: 'bg-indigo-50 text-indigo-600 border border-indigo-100/50',
    },
    {
      cardClass: 'bg-gradient-to-br from-white via-white to-teal-50/30 border-l-4 border-teal-400 hover:to-teal-50/50',
      avatarBg: 'bg-teal-50 text-teal-600 border border-teal-100/50',
    }
  ];
  return themes[hash % themes.length];
};

export default function ClientsPage() {
  const { debts, analysis, clientRemarks, addClientRemark, updateClientRemark, deleteClientRemark, logAudit, toggleManualContentious } = useDebtContext();
  const { userRole } = useAuth();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCommercial, setSelectedCommercial] = useState('all');
  const [expandedClients, setExpandedClients] = useState<Set<string>>(new Set());
  const [sidebarOpen, setSidebarOpen] = useState(false);
  
  // State for Remark Modal
  const [isRemarkModalOpen, setIsRemarkModalOpen] = useState(false);
  const [remarkClientName, setRemarkClientName] = useState('');

  // 🔔 Auto-navigation depuis une notification push
  // URL format: /clients?search=NOM_CLIENT&open=remark
  useEffect(() => {
    const searchFromNotif = searchParams?.get('search');
    const openParam = searchParams?.get('open');
    if (searchFromNotif) {
      // Appliquer la recherche pour filtrer sur ce client
      setSearchTerm(searchFromNotif);
      // Développer automatiquement les factures du client
      setExpandedClients(prev => {
        const next = new Set(prev);
        next.add(searchFromNotif);
        return next;
      });
      // Si le paramètre open=remark, ouvrir aussi le modal de remarques
      if (openParam === 'remark') {
        setRemarkClientName(searchFromNotif);
        setIsRemarkModalOpen(true);
      }
      // Nettoyer l'URL sans rechargement (enlever les paramètres de navigation)
      router.replace('/clients', { scroll: false });
    }
  }, [searchParams, router]);
  
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
    return !!d.isContentieux;
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

  // Counts for tristate filters - Count individual lines (invoices) instead of clients for consistency with PDF and Dashboard
  const stats = useMemo(() => {
    if (!analysis) return { contentieux: 0, retained: 0, partial: 0, nonContentieux: 0, nonRetained: 0, nonPartial: 0 };
    
    // Start with the full debts list or filtered by commercial/search
    let list = debts;
    
    if (selectedCommercial !== 'all') {
      list = list.filter(d => d.commercialName === selectedCommercial);
    }
    
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      list = list.filter(d => 
        (d.clientName || '').toLowerCase().includes(term) || 
        (d.clientCode || '').toLowerCase().includes(term) ||
        (d.documentNumber || '').toLowerCase().includes(term)
      );
    }
    
    // Apply Age and Amount exclusions to counts for total consistency
    list = list.filter(d => !isAgeExcluded(d.age));
    if (minAmountFilter) {
      list = list.filter(d => {
        const balance = typeof d.balance === 'number' ? d.balance : parseFloat(String(d.balance).replace(/[^\d.,-]/g, '').replace(',', '.')) || 0;
        return balance >= 5000;
      });
    }

    return {
      contentieux: list.filter(d => isContentieux(d)).length,
      retained: list.filter(d => isRetained(d)).length,
      partial: list.filter(d => isPartial(d)).length,
      nonContentieux: list.filter(d => !isContentieux(d)).length,
      nonRetained: list.filter(d => !isRetained(d)).length,
      nonPartial: list.filter(d => !isPartial(d)).length
    };
  }, [analysis, debts, selectedCommercial, searchTerm, excludedAgeRanges, minAmountFilter]);

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
        // MODIFICATION: If we are specifically filtering for RETAINED, do NOT bypass for specials
        if (isSpecial && retainedFilter !== 'include') return true;

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

  // Moyenne d'âge et totaux s'adaptant aux filtres
  const filteredStats = useMemo(() => {
    let totalBalance = 0;
    let totalAmount = 0;
    let ageSum = 0;
    let debtCount = 0;
    
    filteredClients.forEach(c => {
      c.filteredDebts.forEach((d: ClientDebt) => {
        totalBalance += d.balance;
        totalAmount += d.amount;
        ageSum += d.age;
        debtCount++;
      });
    });
    
    const averageAge = debtCount > 0 ? Math.round(ageSum / debtCount) : 0;
    
    return {
      totalBalance,
      totalAmount,
      averageAge,
      debtCount,
      clientCount: filteredClients.length
    };
  }, [filteredClients]);

  const allExpanded = filteredClients.length > 0 && expandedClients.size === filteredClients.length;

  return (
    <div className="flex h-screen bg-slate-50">
      <Sidebar mobileOpen={sidebarOpen} onMobileClose={() => setSidebarOpen(false)} />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white border-b border-slate-200 px-4 md:px-8 py-4 md:py-6 flex-shrink-0">
          <div className="max-w-7xl mx-auto w-full flex flex-col gap-6">
            <div className="flex items-center justify-between flex-wrap gap-4">
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

              {/* Desktop KPI Cards - Placed next to the Title on Desktop */}
              <div className="hidden md:flex items-center gap-3 ml-auto mr-4 lg:mr-0">
                {/* Card Solde Total */}
                <div className="flex items-center gap-3 px-4 py-2.5 rounded-2xl bg-rose-50 border border-rose-100 text-rose-800 shadow-sm min-w-[160px] lg:min-w-[190px] transition-all hover:shadow-md">
                  <div className="w-2.5 h-2.5 rounded-full bg-rose-500 flex-shrink-0 animate-pulse" />
                  <div className="flex flex-col min-w-0">
                    <span className="text-[10px] md:text-xs font-black uppercase tracking-wider text-rose-600/80 truncate">Solde Restant</span>
                    <span className="text-sm md:text-lg lg:text-xl font-black tracking-tight text-slate-800 whitespace-nowrap">
                      {filteredStats.totalBalance.toLocaleString('fr-TN', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} <span className="text-[10px] font-bold text-slate-500">TND</span>
                    </span>
                  </div>
                </div>

                {/* Card Moyenne d'âge */}
                <div className="flex items-center gap-3 px-4 py-2.5 rounded-2xl bg-indigo-50 border border-indigo-100 text-indigo-800 shadow-sm min-w-[130px] lg:min-w-[150px] transition-all hover:shadow-md">
                  <div className="w-2.5 h-2.5 rounded-full bg-indigo-500 flex-shrink-0" />
                  <div className="flex flex-col min-w-0">
                    <span className="text-[10px] md:text-xs font-black uppercase tracking-wider text-indigo-600/80 truncate">Moyenne d'Âge</span>
                    <span className="text-sm md:text-lg lg:text-xl font-black tracking-tight text-slate-800 whitespace-nowrap">
                      {filteredStats.averageAge} <span className="text-[10px] font-bold text-slate-500">jours</span>
                    </span>
                  </div>
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

            {/* Row 2: Search, Commercial and Buttons */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="flex flex-col md:flex-row gap-3 flex-1 w-full">
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
                
                {userRole !== 'commercial' && (
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
                )}
              </div>

              <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0 scrollbar-hide w-full lg:w-auto">
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
                      ExportService.exportClientsToExcel(filteredClients, clientRemarks, activeFilters || 'Aucun', logAudit, userRole === 'commercial');
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
                      ExportService.exportClientsToPDF(filteredClients, clientRemarks, activeFilters || 'Aucun', logAudit, userRole === 'commercial');
                    }}
                    className="bg-rose-50 hover:bg-rose-100 border-rose-200 text-rose-700 rounded-xl h-11 px-4 font-bold"
                  >
                    <FileText className="h-4 w-4 md:mr-2" />
                    <span className="hidden md:inline">PDF</span>
                  </Button>
                </div>
              </div>
            </div>

            {/* Row 3: Desktop Only Advanced Filters */}
            <div className="hidden md:flex flex-col gap-4 mt-2">
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
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 md:p-8 bg-slate-50/50">
          <div className="max-w-7xl mx-auto space-y-4 md:space-y-6">
            
            {/* Mobile Only KPI Cards */}
            <div className="flex md:hidden items-center gap-2 overflow-x-auto pb-2 scrollbar-hide">
              {/* Card Solde Total */}
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-rose-50 border border-rose-100 text-rose-800 shadow-sm flex-shrink-0 min-w-[130px]">
                <div className="w-1.5 h-1.5 rounded-full bg-rose-500 flex-shrink-0 animate-pulse" />
                <div className="flex flex-col min-w-0">
                  <span className="text-[8px] font-black uppercase tracking-wider text-rose-600/80">Solde Restant</span>
                  <span className="text-xs font-black tracking-tight text-slate-800">
                    {filteredStats.totalBalance.toLocaleString('fr-TN', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} <span className="text-[8px] font-bold text-slate-500">TND</span>
                  </span>
                </div>
              </div>

              {/* Card Moyenne d'âge */}
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-800 shadow-sm flex-shrink-0 min-w-[105px]">
                <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 flex-shrink-0" />
                <div className="flex flex-col min-w-0">
                  <span className="text-[8px] font-black uppercase tracking-wider text-indigo-600/80">Moyenne d'Âge</span>
                  <span className="text-xs font-black tracking-tight text-slate-800">
                    {filteredStats.averageAge} <span className="text-[8px] font-bold text-slate-500">j</span>
                  </span>
                </div>
              </div>
            </div>

            {filteredClients.map((client: any, idx: number) => {
              const isExpanded = expandedClients.has(client.clientName);
              const clientDebts = client.filteredDebts.sort((a: any, b: any) => (a.extractIndex || 0) - (b.extractIndex || 0));
              const theme = getClientTheme(client.clientName);
              
              // Calculate average client age
              const averageAge = clientDebts.length > 0
                ? Math.round(clientDebts.reduce((sum: number, d: any) => sum + (d.age || 0), 0) / clientDebts.length)
                : 0;
              
              return (
                <Card key={idx} className={`border-0 shadow-md ${theme.cardClass} overflow-hidden rounded-[32px] transition-all hover:shadow-xl`}>
                    <div 
                      onClick={() => toggleClient(client.clientName)}
                      className="p-4 md:p-8 flex flex-col md:flex-row md:items-center justify-between cursor-pointer hover:bg-slate-50/50 transition-colors gap-4"
                    >
                      <div className="flex items-center gap-4 md:gap-6 flex-1 min-w-0">
                        <div className="flex-shrink-0">
                          {isExpanded ? <ChevronDown className="h-5 w-5 md:h-6 md:w-6 text-slate-400" /> : <ChevronRight className="h-5 w-5 md:h-6 md:w-6 text-slate-400" />}
                        </div>
                        <div className={`w-12 h-12 md:w-16 md:h-16 rounded-xl md:rounded-[20px] flex items-center justify-center font-black text-lg md:text-2xl shadow-inner flex-shrink-0 ${theme.avatarBg}`}>
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
                            
                            {/* Visually distinguishable average age badge */}
                            <span className={`flex items-center gap-1.5 font-black px-2 py-1 md:px-3 md:py-1.5 rounded-lg md:rounded-xl border text-[10px] md:text-xs whitespace-nowrap shadow-sm transition-all ${
                              averageAge <= 15 ? 'bg-emerald-50 text-emerald-700 border-emerald-200 shadow-emerald-50/40' :
                              averageAge <= 30 ? 'bg-blue-50 text-blue-700 border-blue-200 shadow-blue-50/40' :
                              averageAge <= 45 ? 'bg-amber-50 text-amber-700 border-amber-200 shadow-amber-50/40' :
                              averageAge <= 60 ? 'bg-orange-50 text-orange-700 border-orange-200 shadow-orange-50/40' :
                              'bg-rose-50 text-rose-700 border-rose-200 shadow-rose-50/40'
                            }`} title="Âge moyen des factures de ce client">
                              <Clock className="h-3.5 w-3.5" />
                              <span>Âge moyen: <span className="font-extrabold underline decoration-2 underline-offset-2">{averageAge} j</span></span>
                            </span>

                            <span className="text-emerald-600 font-black flex items-center gap-1.5 bg-emerald-50/50 px-2 py-1 md:px-3 md:py-1.5 rounded-lg md:rounded-xl border border-emerald-100/50 whitespace-nowrap"><Users className="h-3 w-3 md:h-4 md:w-4" />{client.commercialName}</span>
                          </div>
                          
                          {/* Affichage de la remarque pour mobile */}
                          {clientRemarks[client.clientName]?.[0] && (
                            <div 
                              onClick={(e) => handleOpenRemarkModal(e, client.clientName)}
                              className="md:hidden mt-2 p-2 bg-indigo-50/30 border border-indigo-100/50 rounded-xl text-[10px] font-medium text-slate-600 flex items-center justify-between gap-2"
                            >
                              <div className="flex items-center gap-1.5 min-w-0">
                                <MessageSquare className="h-3.5 w-3.5 text-indigo-500 flex-shrink-0" />
                                <span className="truncate">
                                  <span className="font-bold text-slate-700">{clientRemarks[client.clientName][0].user.split('@')[0]} :</span> {clientRemarks[client.clientName][0].content}
                                </span>
                              </div>
                              {clientRemarks[client.clientName].length > 1 && (
                                <Badge className="bg-indigo-50 text-indigo-700 border-none font-bold text-[8px] px-1 py-0 shadow-none scale-90 flex-shrink-0">
                                  +{clientRemarks[client.clientName].length - 1}
                                </Badge>
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Colonne Remarque au milieu (Desktop/Tablette uniquement) */}
                      <div 
                        onClick={(e) => handleOpenRemarkModal(e, client.clientName)}
                        className="hidden md:flex flex-col flex-1 max-w-sm px-6 border-l border-slate-100 min-w-0"
                      >
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
                          <MessageSquare className="h-3.5 w-3.5 text-indigo-500" />
                          <span>Dernière Remarque</span>
                        </span>
                        {clientRemarks[client.clientName]?.[0] ? (
                          <div className="text-xs font-semibold text-slate-700 hover:text-blue-600 transition-colors line-clamp-2 pr-4 relative">
                            <span className="font-bold text-slate-500">{clientRemarks[client.clientName][0].user.split('@')[0]} : </span>
                            {clientRemarks[client.clientName][0].content}
                            {clientRemarks[client.clientName].length > 1 && (
                              <span className="inline-flex items-center ml-1.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-indigo-50 text-indigo-600 border border-indigo-100 whitespace-nowrap">
                                +{clientRemarks[client.clientName].length - 1} hist.
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400 italic">Aucune remarque</span>
                        )}
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
                      {/* Desktop/Tablet Table View */}
                      <div className="hidden md:block bg-white rounded-2xl md:rounded-[24px] overflow-x-auto border border-slate-200 shadow-inner scrollbar-hide">
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
                                  <TableCell className="font-mono text-xs md:sm font-bold text-slate-700 py-3 md:py-5 px-4 md:px-6">
                                    <div className="flex items-center gap-2">
                                      <input
                                        type="checkbox"
                                        checked={!!debt.isContentieux}
                                        disabled={userRole !== 'admin' && userRole !== 'gestionnaire'}
                                        onChange={() => toggleManualContentious(debt.documentNumber)}
                                        className="h-3.5 w-3.5 rounded border-slate-300 text-rose-600 focus:ring-rose-500 cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
                                        title={
                                          userRole === 'admin' || userRole === 'gestionnaire'
                                            ? "Marquer/Démarquer comme contentieux manuel"
                                            : "Statut contentieux"
                                        }
                                      />
                                      {debt.isManualContentieux && (
                                        <Star className="h-3.5 w-3.5 text-amber-500 fill-amber-500 flex-shrink-0 animate-pulse" title="Modifié manuellement (ne suit pas les règles d'âge)" />
                                      )}
                                      <span>{debt.documentNumber}</span>
                                    </div>
                                  </TableCell>
                                  <TableCell className="text-xs md:text-sm font-medium text-slate-600 py-3 md:py-5 whitespace-nowrap">{new Date(debt.documentDate).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit' })}</TableCell>
                                  <TableCell className="hidden lg:table-cell text-[10px] md:text-xs font-semibold text-slate-500 py-3 md:py-5 italic max-w-[150px] truncate">{debt.description || '-'}</TableCell>
                                  <TableCell className="text-xs md:text-sm font-bold text-slate-800 text-right py-3 md:py-5">{(debt.amount ?? 0).toLocaleString('fr-FR')} TND</TableCell>
                                  <TableCell className="hidden md:table-cell text-xs md:text-sm font-bold text-emerald-600 text-right py-3 md:py-5">{(debt.settlement ?? 0).toLocaleString('fr-FR')} TND</TableCell>
                                  <TableCell className="text-sm md:text-base font-black text-rose-600 text-right py-3 md:py-5">{(debt.balance ?? 0).toLocaleString('fr-FR')} TND</TableCell>
                                  <TableCell className="text-center py-3 md:py-5">
                                    <Badge className={`font-black px-3 py-1 md:px-4 md:py-1.5 rounded-xl text-xs md:text-sm shadow-sm border ${
                                      debt.age <= 15 ? 'bg-emerald-100 text-emerald-700 border-emerald-200' :
                                      debt.age <= 30 ? 'bg-blue-100 text-blue-700 border-blue-200' :
                                      debt.age <= 45 ? 'bg-amber-100 text-amber-700 border-amber-200' :
                                      debt.age <= 60 ? 'bg-orange-100 text-orange-700 border-orange-200' :
                                      'bg-rose-100 text-rose-700 border-rose-200'
                                    }`}>{debt.age} j</Badge>
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

                      {/* Mobile-Optimized List View (No horizontal scrolling!) */}
                      <div className="md:hidden space-y-3">
                        {clientDebts.map((debt, i) => {
                          const paymentRatio = debt.amount > 0 ? (debt.settlement / debt.amount) * 100 : 0;
                          return (
                            <div key={i} className="bg-slate-50/50 border border-slate-150 rounded-2xl p-4 transition-all hover:bg-slate-50 flex flex-col gap-3">
                              {/* Row 1: Invoice number & Age in large characters */}
                              <div className="flex justify-between items-start gap-2">
                                <div className="flex flex-col min-w-0">
                                  <div className="flex items-center gap-2">
                                    <input
                                      type="checkbox"
                                      checked={!!debt.isContentieux}
                                      disabled={userRole !== 'admin' && userRole !== 'gestionnaire'}
                                      onChange={() => toggleManualContentious(debt.documentNumber)}
                                      className="h-4 w-4 rounded border-slate-300 text-rose-600 focus:ring-rose-500 cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
                                      title={
                                        userRole === 'admin' || userRole === 'gestionnaire'
                                          ? "Marquer/Démarquer comme contentieux manuel"
                                          : "Statut contentieux"
                                      }
                                    />
                                    {debt.isManualContentieux && (
                                      <Star className="h-3.5 w-3.5 text-amber-500 fill-amber-500 flex-shrink-0 animate-pulse" title="Modifié manuellement (ne suit pas les règles d'âge)" />
                                    )}
                                    <span className="font-mono text-sm font-bold text-slate-800 truncate">{debt.documentNumber}</span>
                                  </div>
                                  {debt.description && (
                                    <span className="text-[10px] text-slate-400 font-medium truncate max-w-[150px]" title={debt.description}>
                                      {debt.description}
                                    </span>
                                  )}
                                </div>
                                <div className="flex flex-col items-center">
                                  <span className="text-[8px] font-black text-slate-400 uppercase tracking-wider mb-0.5">Âge</span>
                                  <Badge className={`font-black px-3.5 py-1.5 rounded-xl text-lg shadow-sm border ${
                                    debt.age <= 15 ? 'bg-emerald-100 text-emerald-700 border-emerald-200' :
                                    debt.age <= 30 ? 'bg-blue-100 text-blue-700 border-blue-200' :
                                    debt.age <= 45 ? 'bg-amber-100 text-amber-700 border-amber-200' :
                                    debt.age <= 60 ? 'bg-orange-100 text-orange-700 border-orange-200' :
                                    'bg-rose-100 text-rose-700 border-rose-200'
                                  }`}>{debt.age} j</Badge>
                                </div>
                              </div>

                              {/* Row 2: Date & Solde */}
                              <div className="flex justify-between items-baseline">
                                <div className="flex flex-col">
                                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Date</span>
                                  <span className="text-xs font-semibold text-slate-600">
                                    {new Date(debt.documentDate).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                                  </span>
                                </div>
                                <div className="flex flex-col text-right">
                                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Solde restant</span>
                                  <span className="text-base font-black text-rose-600">
                                    {(debt.balance ?? 0).toLocaleString('fr-FR')} <span className="text-[10px] font-normal text-slate-500">TND</span>
                                  </span>
                                </div>
                              </div>

                              {/* Divider */}
                              <div className="h-px bg-slate-200/60" />

                              {/* Row 3: Montant total, Réglé, and Progress */}
                              <div className="grid grid-cols-2 gap-2 text-xs">
                                <div>
                                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block">Montant Initial</span>
                                  <span className="font-bold text-slate-700">{(debt.amount ?? 0).toLocaleString('fr-FR')} TND</span>
                                </div>
                                <div className="text-right">
                                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block">Réglé</span>
                                  <span className="font-bold text-emerald-600">{(debt.settlement ?? 0).toLocaleString('fr-FR')} TND</span>
                                </div>
                              </div>

                              {/* Progress Bar */}
                              <div className="flex flex-col gap-1 mt-1">
                                <div className="flex justify-between items-center text-[9px] font-black text-slate-500">
                                  <span>Progression du règlement</span>
                                  <span>{paymentRatio.toFixed(0)}%</span>
                                </div>
                                <Progress value={paymentRatio} className="h-1 bg-slate-200" />
                              </div>
                            </div>
                          );
                        })}
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
        onUpdateRemark={updateClientRemark}
        onDeleteRemark={deleteClientRemark}
      />
    </div>
  );
}
