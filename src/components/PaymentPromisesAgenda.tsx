'use client';

import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useDebtContext } from '@/lib/DebtContext';
import { useAuth } from '@/lib/AuthContext';
import { ClientRemark } from '@/types/debt';
import { 
  Calendar, 
  Search, 
  Phone, 
  Mail, 
  ArrowUpRight, 
  Clock, 
  AlertCircle, 
  CheckCircle2, 
  ChevronRight, 
  User, 
  Filter,
  TrendingUp,
  Sparkles
} from 'lucide-react';

interface PaymentPromisesAgendaProps {
  onClientClick?: (clientName: string) => void;
  onRelanceClick?: (clientName: string) => void;
}

interface PromiseItem extends ClientRemark {
  clientBalance: number;
  clientPhone?: string;
  commercialCode?: string;
}

export function PaymentPromisesAgenda({ onClientClick, onRelanceClick }: PaymentPromisesAgendaProps) {
  const { debts, archiveDebts, clientRemarks } = useDebtContext();
  const { userRole, commercialCode } = useAuth();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCommercial, setSelectedCommercial] = useState<string>('all');
  const [activeTab, setActiveTab] = useState<string>('today');

  // 1. Get the list of all clients assigned to the logged-in commercial (if applicable)
  const assignedClientNames = useMemo(() => {
    if (userRole !== 'commercial') return null;
    const names = new Set<string>();
    debts.forEach(d => names.add(d.clientName));
    archiveDebts.forEach(d => names.add(d.clientName));
    return names;
  }, [debts, archiveDebts, userRole]);

  // 2. Build a mapping of clients to their total outstanding active balance
  const clientActiveBalances = useMemo(() => {
    const balances: Record<string, number> = {};
    debts.forEach(d => {
      if (d.balance > 0) {
        balances[d.clientName] = (balances[d.clientName] || 0) + d.balance;
      }
    });
    return balances;
  }, [debts]);

  // 3. Find client details like phone & commercial code from active debts
  const clientDetails = useMemo(() => {
    const details: Record<string, { phone?: string; commercialCode?: string }> = {};
    // We scan raw debts (or filtered debts) to get the most accurate details
    debts.forEach(d => {
      if (!details[d.clientName]) {
        details[d.clientName] = {
          phone: d.clientPhone,
          commercialCode: d.commercialCode
        };
      }
    });
    return details;
  }, [debts]);

  // 4. Get the list of unique commercial codes for the Admin dropdown filter
  const commercialCodesList = useMemo(() => {
    const codes = new Set<string>();
    debts.forEach(d => {
      if (d.commercialCode) {
        codes.add(d.commercialCode);
      }
    });
    return Array.from(codes).sort();
  }, [debts]);

  // 5. Extract, filter, deduplicate and format the active promises
  const promisesList = useMemo(() => {
    const list: PromiseItem[] = [];
    const todayStr = new Date().toISOString().split('T')[0];

    Object.entries(clientRemarks).forEach(([clientName, remarks]) => {
      // Rule 1: For commercials, filter to only their clients
      if (assignedClientNames && !assignedClientNames.has(clientName)) {
        return;
      }

      // Rule 2: Client must still have an active outstanding balance > 0
      const activeBalance = clientActiveBalances[clientName] || 0;
      if (activeBalance <= 0) {
        return;
      }

      // Rule 3: Find all remarks with promise dates
      const promises = remarks.filter(r => r.promiseDate);
      if (promises.length === 0) return;

      // Rule 4: Dédoublonnement - keep ONLY the latest promise per client
      const latestPromise = promises.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
      
      const details = clientDetails[clientName] || {};

      list.push({
        ...latestPromise,
        clientBalance: activeBalance,
        clientPhone: details.phone,
        commercialCode: details.commercialCode
      });
    });

    return list;
  }, [clientRemarks, assignedClientNames, clientActiveBalances, clientDetails]);

  // 6. Apply search and commercial filters
  const filteredPromises = useMemo(() => {
    return promisesList.filter(p => {
      const matchesSearch = p.clientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            (p.content || '').toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesCommercial = userRole === 'commercial' || 
                                selectedCommercial === 'all' || 
                                p.commercialCode === selectedCommercial;

      return matchesSearch && matchesCommercial;
    });
  }, [promisesList, searchTerm, selectedCommercial, userRole]);

  // 7. Categorize promises relative to current date (Today, Overdue, Upcoming)
  const categorizedPromises = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    
    const overdue: PromiseItem[] = [];
    const today: PromiseItem[] = [];
    const upcoming: PromiseItem[] = [];

    filteredPromises.forEach(p => {
      if (!p.promiseDate) return;
      
      if (p.promiseDate < todayStr) {
        overdue.push(p);
      } else if (p.promiseDate === todayStr) {
        today.push(p);
      } else {
        upcoming.push(p);
      }
    });

    // Sort: Overdue (oldest first to resolve backlog), Today (earliest or latest?), Upcoming (soonest first)
    const sortByPromiseDateAsc = (a: PromiseItem, b: PromiseItem) => 
      new Date(a.promiseDate!).getTime() - new Date(b.promiseDate!).getTime();

    return {
      overdue: overdue.sort(sortByPromiseDateAsc),
      today: today.sort(sortByPromiseDateAsc),
      upcoming: upcoming.sort(sortByPromiseDateAsc)
    };
  }, [filteredPromises]);

  // 8. Calculate aggregate statistics
  const stats = useMemo(() => {
    const getSum = (arr: PromiseItem[]) => arr.reduce((sum, p) => sum + (p.promiseAmount || 0), 0);
    return {
      overdueCount: categorizedPromises.overdue.length,
      overdueSum: getSum(categorizedPromises.overdue),
      todayCount: categorizedPromises.today.length,
      todaySum: getSum(categorizedPromises.today),
      upcomingCount: categorizedPromises.upcoming.length,
      upcomingSum: getSum(categorizedPromises.upcoming),
    };
  }, [categorizedPromises]);

  // 9. Format Tunisian mobile phone links for direct calls and WhatsApp
  const getContactLinks = (phone?: string) => {
    if (!phone) return { callUrl: '', whatsappUrl: '' };
    
    // Strip non-digits to get pure numbers
    const cleanPhone = phone.replace(/\D/g, '');
    
    // Check if it looks like a Tunisian mobile number (typically 8 digits starting with 9, 5, 2, 4)
    // Tunisian mobile formats: 8 digits
    const isMobile = cleanPhone.length === 8 && /^[2459]/.test(cleanPhone);
    
    const callUrl = `tel:${cleanPhone}`;
    const whatsappUrl = isMobile ? `https://wa.me/216${cleanPhone}` : '';
    
    return { callUrl, whatsappUrl };
  };

  // 10. Date helper for nice badges
  const getRelativeDateDetails = (dateStr: string) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const target = new Date(dateStr);
    target.setHours(0, 0, 0, 0);
    
    const diffTime = target.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    const formattedDate = new Date(dateStr).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
    
    if (diffDays === 0) {
      return { 
        label: "Aujourd'hui", 
        style: "bg-amber-100 text-amber-800 border-amber-200" 
      };
    } else if (diffDays < 0) {
      const abs = Math.abs(diffDays);
      return { 
        label: `En retard de ${abs} j.`, 
        style: "bg-rose-100 text-rose-800 border-rose-200 font-extrabold animate-pulse" 
      };
    } else {
      return { 
        label: `Dans ${diffDays} j.`, 
        style: "bg-emerald-100 text-emerald-800 border-emerald-200" 
      };
    }
  };

  return (
    <Card className="border-0 shadow-2xl bg-white overflow-hidden rounded-2xl border-l-4 border-l-blue-600 transition-all duration-300 hover:shadow-slate-200">
      <CardHeader className="border-b border-gray-50 bg-gradient-to-r from-blue-50/50 to-indigo-50/50 py-5">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <CardTitle className="text-xl font-black text-slate-800 flex items-center gap-2.5">
              <div className="p-2 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl shadow-md text-white">
                <Calendar className="h-5 w-5" />
              </div>
              Agenda des Promesses de Paiement
            </CardTitle>
            <p className="text-xs text-slate-500 font-semibold mt-1">
              Planification des relances et encaissements {userRole === 'commercial' ? 'de votre portefeuille client' : 'de l\'équipe commerciale'}
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Search Input */}
            <div className="relative w-full sm:w-60">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Rechercher un client..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 h-9 text-xs rounded-xl border-slate-200 bg-white/80 focus:bg-white transition-all shadow-sm focus:ring-blue-500/20"
              />
            </div>

            {/* Commercial Dropdown Filter (Admin & Gestionnaire only) */}
            {userRole !== 'commercial' && commercialCodesList.length > 0 && (
              <div className="flex items-center gap-1 bg-slate-100/80 p-1 rounded-xl border border-slate-200/60 shadow-sm">
                <Filter className="h-3 w-3 text-slate-500 ml-2" />
                <select
                  value={selectedCommercial}
                  onChange={(e) => setSelectedCommercial(e.target.value)}
                  className="bg-transparent border-none text-[11px] font-black text-slate-700 focus:outline-none pr-6 pl-1 py-1 cursor-pointer"
                >
                  <option value="all">Tous les commerciaux</option>
                  {commercialCodesList.map(code => (
                    <option key={code} value={code}>Commercial {code}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-6">
        {/* KPI Mini-Cards Section */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          {/* Overdue Stat */}
          <div className="bg-gradient-to-br from-rose-50 to-white border border-rose-100/80 rounded-2xl p-4 flex items-center justify-between shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md">
            <div>
              <div className="text-[10px] font-black text-rose-600 uppercase tracking-widest flex items-center gap-1">
                <AlertCircle className="h-3.5 w-3.5" /> En retard
              </div>
              <div className="text-xl font-black text-rose-800 mt-1">
                {stats.overdueSum.toLocaleString('fr-FR')} <span className="text-xs font-bold">TND</span>
              </div>
            </div>
            <Badge className="bg-rose-500 text-white font-extrabold hover:bg-rose-600 border-0 h-6 px-2.5 rounded-lg">
              {stats.overdueCount} fiche{stats.overdueCount > 1 ? 's' : ''}
            </Badge>
          </div>

          {/* Today Stat */}
          <div className="bg-gradient-to-br from-amber-50 to-white border border-amber-100/80 rounded-2xl p-4 flex items-center justify-between shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md">
            <div>
              <div className="text-[10px] font-black text-amber-600 uppercase tracking-widest flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" /> Aujourd'hui
              </div>
              <div className="text-xl font-black text-amber-800 mt-1">
                {stats.todaySum.toLocaleString('fr-FR')} <span className="text-xs font-bold">TND</span>
              </div>
            </div>
            <Badge className="bg-amber-500 text-white font-extrabold hover:bg-amber-600 border-0 h-6 px-2.5 rounded-lg">
              {stats.todayCount} fiche{stats.todayCount > 1 ? 's' : ''}
            </Badge>
          </div>

          {/* Upcoming Stat */}
          <div className="bg-gradient-to-br from-emerald-50 to-white border border-emerald-100/80 rounded-2xl p-4 flex items-center justify-between shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md">
            <div>
              <div className="text-[10px] font-black text-emerald-600 uppercase tracking-widest flex items-center gap-1">
                <CheckCircle2 className="h-3.5 w-3.5" /> À venir
              </div>
              <div className="text-xl font-black text-emerald-800 mt-1">
                {stats.upcomingSum.toLocaleString('fr-FR')} <span className="text-xs font-bold">TND</span>
              </div>
            </div>
            <Badge className="bg-emerald-500 text-white font-extrabold hover:bg-emerald-600 border-0 h-6 px-2.5 rounded-lg">
              {stats.upcomingCount} fiche{stats.upcomingCount > 1 ? 's' : ''}
            </Badge>
          </div>
        </div>

        {/* Tabs and Lists Container */}
        <Tabs defaultValue="today" value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3 bg-slate-100 p-1 rounded-xl h-11 border border-slate-200/50 mb-6">
            <TabsTrigger 
              value="overdue" 
              className="rounded-lg text-xs font-bold transition-all data-[state=active]:bg-white data-[state=active]:text-rose-700 data-[state=active]:shadow-sm flex items-center justify-center gap-1.5"
            >
              En retard
              <span className={`inline-flex items-center justify-center w-5 h-5 text-[10px] font-black rounded-full ${stats.overdueCount > 0 ? 'bg-rose-500 text-white' : 'bg-slate-200 text-slate-600'}`}>
                {stats.overdueCount}
              </span>
            </TabsTrigger>
            
            <TabsTrigger 
              value="today" 
              className="rounded-lg text-xs font-bold transition-all data-[state=active]:bg-white data-[state=active]:text-amber-700 data-[state=active]:shadow-sm flex items-center justify-center gap-1.5"
            >
              Aujourd'hui
              <span className={`inline-flex items-center justify-center w-5 h-5 text-[10px] font-black rounded-full ${stats.todayCount > 0 ? 'bg-amber-500 text-white' : 'bg-slate-200 text-slate-600'}`}>
                {stats.todayCount}
              </span>
            </TabsTrigger>
            
            <TabsTrigger 
              value="upcoming" 
              className="rounded-lg text-xs font-bold transition-all data-[state=active]:bg-white data-[state=active]:text-emerald-700 data-[state=active]:shadow-sm flex items-center justify-center gap-1.5"
            >
              À venir
              <span className={`inline-flex items-center justify-center w-5 h-5 text-[10px] font-black rounded-full ${stats.upcomingCount > 0 ? 'bg-emerald-50 text-emerald-800' : 'bg-slate-200 text-slate-600'}`}>
                {stats.upcomingCount}
              </span>
            </TabsTrigger>
          </TabsList>

          {/* List Renderer */}
          {['overdue', 'today', 'upcoming'].map((category) => {
            const list = categorizedPromises[category as keyof typeof categorizedPromises] || [];
            
            return (
              <TabsContent key={category} value={category} className="mt-0 focus-visible:outline-none">
                <ScrollArea className="h-[380px] w-full rounded-xl pr-3">
                  <div className="space-y-4">
                    {list.length > 0 ? (
                      list.map((promise) => {
                        const dateDetails = getRelativeDateDetails(promise.promiseDate!);
                        const contact = getContactLinks(promise.clientPhone);
                        
                        return (
                          <div 
                            key={promise.id} 
                            className="group bg-white border border-slate-100 hover:border-blue-200 p-4 rounded-2xl shadow-sm hover:shadow-md transition-all duration-300 flex flex-col md:flex-row md:items-center justify-between gap-4"
                          >
                            {/* Left Side: Client Name, Meta, Message content */}
                            <div className="flex-1 space-y-2">
                              <div className="flex flex-wrap items-center gap-2">
                                <span 
                                  onClick={() => onRelanceClick ? onRelanceClick(promise.clientName) : onClientClick?.(promise.clientName)}
                                  className="text-sm font-black text-slate-800 hover:text-blue-600 cursor-pointer transition-colors"
                                >
                                  {promise.clientName}
                                </span>

                                {/* Commercial Tag (Admin/Manager only) */}
                                {userRole !== 'commercial' && promise.commercialCode && (
                                  <Badge variant="outline" className="bg-slate-50 text-slate-600 border-slate-200/60 font-bold text-[9px] h-4 py-0 uppercase">
                                    <User className="h-2 w-2 mr-1 text-slate-400" /> Comm: {promise.commercialCode}
                                  </Badge>
                                )}

                                {/* Date Status Badge */}
                                <Badge variant="outline" className={`text-[10px] font-bold h-4.5 px-2 py-0 border-0 ${dateDetails.style}`}>
                                  {dateDetails.label}
                                </Badge>
                              </div>

                              {/* Promesse note description */}
                              <div className="relative pl-3 border-l-2 border-slate-200 bg-slate-50/60 p-2.5 rounded-r-xl max-w-2xl">
                                <p className="text-xs text-slate-600 italic font-medium leading-relaxed">
                                  &ldquo;{promise.content}&rdquo;
                                </p>
                                <span className="absolute right-2 bottom-1 text-[9px] text-slate-400 font-bold">
                                  Par {promise.user.split('@')[0]} • {new Date(promise.date).toLocaleDateString('fr-FR')}
                                </span>
                              </div>
                            </div>

                            {/* Right Side: Promise Amount, Client Balance, Contacts & Actions */}
                            <div className="flex flex-row md:flex-col items-center md:items-end justify-between md:justify-center gap-4 min-w-[200px] border-t md:border-t-0 pt-3 md:pt-0 border-slate-100">
                              {/* Financial details */}
                              <div className="text-left md:text-right">
                                <div className="text-xs text-slate-400 font-bold uppercase tracking-wider">Montant Promis</div>
                                <div className="text-base font-black text-emerald-600">
                                  {promise.promiseAmount?.toLocaleString('fr-FR') || '0'} <span className="text-[10px] font-bold">TND</span>
                                </div>
                                <div className="text-[10px] text-slate-500 font-bold mt-0.5">
                                  Solde global : <span className="text-slate-700">{promise.clientBalance.toLocaleString('fr-FR')} TND</span>
                                </div>
                              </div>

                              {/* Action buttons */}
                              <div className="flex items-center gap-2">
                                {/* Telephonic Call Button */}
                                {contact.callUrl ? (
                                  <a 
                                    href={contact.callUrl} 
                                    className="p-2 rounded-xl bg-blue-50 text-blue-600 border border-blue-100 hover:bg-blue-100 hover:text-blue-700 transition-colors shadow-sm flex items-center justify-center"
                                    title={`Appeler au ${promise.clientPhone}`}
                                  >
                                    <Phone className="h-3.5 w-3.5" />
                                  </a>
                                ) : (
                                  <div className="p-2 rounded-xl bg-slate-50 text-slate-300 border border-slate-100/60 cursor-not-allowed flex items-center justify-center" title="Pas de numéro">
                                    <Phone className="h-3.5 w-3.5" />
                                  </div>
                                )}

                                {/* WhatsApp Button (Tunisian Format wa.me/216) */}
                                {contact.whatsappUrl ? (
                                  <a 
                                    href={contact.whatsappUrl} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="p-2 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100 hover:bg-emerald-100 hover:text-emerald-700 transition-colors shadow-sm flex items-center justify-center font-bold"
                                    title="Ouvrir sur WhatsApp"
                                  >
                                    {/* Direct Custom WhatsApp Icon */}
                                    <svg className="h-3.5 w-3.5 fill-current" viewBox="0 0 24 24">
                                      <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.514 2.266 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.73-1.45L0 24zm6.59-4.846c1.6.95 3.188 1.449 4.825 1.451 5.436 0 9.86-4.42 9.863-9.855.001-2.63-1.024-5.101-2.885-6.964C16.59 1.97 14.12 .946 11.5 .944c-5.442 0-9.87 4.42-9.874 9.86-.002 1.705.459 3.369 1.333 4.809L1.93 21.07l5.9-1.543a9.836 9.836 0 0 0 4.817 1.258z" />
                                    </svg>
                                  </a>
                                ) : null}

                                {/* Client detail/history inspection link */}
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => onRelanceClick ? onRelanceClick(promise.clientName) : onClientClick?.(promise.clientName)}
                                  className="h-8 pl-3 pr-2.5 rounded-xl border border-slate-100 hover:bg-blue-50 hover:text-blue-700 text-slate-500 text-xs font-black group"
                                >
                                  Relance
                                  <ArrowUpRight className="ml-1 h-3.5 w-3.5 text-slate-400 group-hover:text-blue-500 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div className="flex flex-col items-center justify-center p-12 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
                        <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-3">
                          <CheckCircle2 className="h-6 w-6" />
                        </div>
                        <p className="text-slate-700 text-sm font-black text-center">Aucune promesse de paiement dans cette catégorie.</p>
                        <p className="text-slate-400 text-xs text-center mt-1">Excellent travail ! Tout est à jour ou aucun enregistrement correspondant.</p>
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </TabsContent>
            );
          })}
        </Tabs>
      </CardContent>
    </Card>
  );
}
