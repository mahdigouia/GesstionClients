'use client';

import { useState } from 'react';
import { useDebtContext } from '@/lib/DebtContext';
import { Sidebar } from '@/components/Sidebar';
import { FileText, Search, Filter, Download, ChevronRight, TrendingUp, PhoneCall, ShieldAlert, Clock, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ExportService } from '@/lib/export';
import { ClientHistoryModal } from '@/components/ClientHistoryModal';
import { ClientDebt } from '@/types/debt';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { 
  CheckCircle2,
  CalendarDays,
  Menu
} from 'lucide-react';

export default function InvoicesPage() {
  const { debts, archiveDebts, analysis, settings, logAudit } = useDebtContext();
  const [searchTerm, setSearchTerm] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [selectedClientName, setSelectedClientName] = useState('');
  const [clientHistoryDebts, setClientHistoryDebts] = useState<ClientDebt[]>([]);

  const handleShowClientHistory = (clientName: string) => {
    const activeClientDebts = debts.filter(d => d.clientName === clientName);
    const archivedClientDebts = (archiveDebts || []).filter(d => d.clientName === clientName);
    
    // Fusionner pour l'historique en combinant créances actives et archivées
    const combinedMap = new Map<string, ClientDebt>();
    archivedClientDebts.forEach(d => combinedMap.set(d.documentNumber + '_' + (d.lastImportDate || ''), d));
    activeClientDebts.forEach(d => combinedMap.set(d.documentNumber + '_' + (d.lastImportDate || ''), d));
    
    setSelectedClientName(clientName);
    setClientHistoryDebts(Array.from(combinedMap.values()));
    setIsHistoryModalOpen(true);
  };

  // --- LOGIQUE DE GROUPEMENT (Exclure le Contentieux) ---

  const today = new Date();
  const nonContentiousDebts = debts.filter(d => !d.isContentieux);
  
  // 1. Échéancier (Timeline)
  const timelineGroups = {
    overdue: nonContentiousDebts.filter(d => d.balance > 0 && new Date(d.dueDate) < today),
    thisMonth: nonContentiousDebts.filter(d => {
      const dueDate = new Date(d.dueDate);
      return d.balance > 0 && 
             dueDate >= today && 
             dueDate.getMonth() === today.getMonth() && 
             dueDate.getFullYear() === today.getFullYear();
    }),
    upcoming: nonContentiousDebts.filter(d => {
      const dueDate = new Date(d.dueDate);
      const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);
      return d.balance > 0 && dueDate >= nextMonth;
    })
  };

  // 2. Relances Prioritaires (Recovery)
  const priorityInvoices = nonContentiousDebts.filter(d => 
    d.balance > 0 && (d.riskLevel === 'critical' || d.balance > 10000)
  ).sort((a, b) => b.balance - a.balance);

  // 3. Litiges & Retenus (Disputes)
  const disputeInvoices = nonContentiousDebts.filter(d => d.balance > 0 && d.isRetention);

  // Filtrage global par recherche
  const filterBySearch = (list: ClientDebt[]) => {
    if (!searchTerm) return list;
    const s = searchTerm.toLowerCase();
    return list.filter(d => 
      d.clientName.toLowerCase().includes(s) || 
      d.documentNumber.toLowerCase().includes(s)
    );
  };

  const InvoiceCard = ({ debt }: { debt: ClientDebt }) => (
    <div 
      onClick={() => handleShowClientHistory(debt.clientName)}
      className="group bg-white border border-slate-200 rounded-2xl p-4 hover:shadow-xl hover:border-blue-400 transition-all cursor-pointer relative overflow-hidden mb-3"
    >
      <div className={`absolute left-0 top-0 bottom-0 w-1 ${
        debt.riskLevel === 'critical' ? 'bg-red-500' : 
        debt.riskLevel === 'overdue' ? 'bg-orange-500' : 'bg-blue-400'
      }`} />
      
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span className="font-black text-slate-900 group-hover:text-blue-600 transition-colors text-sm md:text-base">
              {debt.documentNumber}
            </span>
            {debt.isRetention && (
              <Badge className="bg-purple-100 text-purple-700 border-purple-200 text-[9px] md:text-[10px]">Retenus</Badge>
            )}
            {debt.balance > 20000 && (
              <Badge variant="outline" className="text-red-600 border-red-200 bg-red-50 text-[9px] md:text-[10px]">Grosse Créance</Badge>
            )}
          </div>
          <div className="text-xs md:text-sm font-bold text-slate-700 truncate">{debt.clientName}</div>
          <div className="text-[9px] md:text-[10px] text-slate-400 mt-1 uppercase tracking-wider font-bold">
            Échéance: {new Date(debt.dueDate).toLocaleDateString('fr-FR')} • {debt.age} jours
          </div>
        </div>

        <div className="flex items-center justify-between md:justify-end gap-4 md:gap-6 border-t md:border-t-0 pt-3 md:pt-0">
          <div className="text-left md:text-right">
            <div className="text-[9px] md:text-[10px] text-slate-400 font-bold uppercase">Solde restant</div>
            <div className="text-base md:text-lg font-black text-slate-900">
              {debt.balance.toLocaleString('fr-FR')} <span className="text-[10px] md:text-xs">TND</span>
            </div>
            <div className="text-[9px] md:text-[10px] text-green-600 font-medium">
              Règl: {debt.settlement.toLocaleString('fr-FR')} / {debt.amount.toLocaleString('fr-FR')}
            </div>
          </div>
          <ChevronRight className="h-5 w-5 text-slate-300 group-hover:text-blue-500 group-hover:translate-x-1 transition-all" />
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-slate-50/50">
      <Sidebar mobileOpen={sidebarOpen} onMobileClose={() => setSidebarOpen(false)} />
      <div className="flex-1 overflow-y-auto">
        <header className="bg-white/80 backdrop-blur-md border-b border-slate-200 px-4 md:px-8 py-4 md:py-6 sticky top-0 z-20">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="flex items-center gap-3 md:gap-4">
              <Button
                variant="ghost"
                size="sm"
                className="md:hidden p-2 -ml-2"
                onClick={() => setSidebarOpen(true)}
              >
                <Menu className="h-5 w-5" />
              </Button>
              <div className="p-2 bg-blue-600 rounded-lg">
                <FileText className="h-5 w-5 md:h-6 md:w-6 text-white" />
              </div>
              <div>
                <h1 className="text-lg md:text-2xl font-black text-slate-900">Gestionnaire de Trésorerie</h1>
                <p className="hidden md:block text-slate-500 font-medium text-sm">Suivi des encaissements et plan de relance MDS GROUP</p>
              </div>
            </div>
            
            <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
              <div className="relative flex-1 md:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Client ou N° Facture..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-100 border-0 rounded-xl text-sm font-bold focus:ring-2 focus:ring-blue-500 transition-all"
                />
              </div>
              <Button 
                onClick={() => ExportService.exportToExcel(nonContentiousDebts, analysis || undefined, logAudit)} 
                className="bg-slate-900 hover:bg-slate-800 text-white rounded-xl h-11 px-6 font-bold w-full md:w-auto"
              >
                <Download className="h-4 w-4 mr-2" />
                Export XLS
              </Button>
            </div>
          </div>
        </header>

        <main className="p-4 md:p-8 max-w-7xl mx-auto space-y-6 md:space-y-8">
          {/* Stats Summary */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="border-0 shadow-xl bg-gradient-to-br from-red-500 to-red-600 text-white">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <AlertCircle className="h-8 w-8 text-white/80" />
                  <Badge className="bg-white/20 text-white border-0">Retard</Badge>
                </div>
                <div className="text-3xl font-black mb-1">
                  {timelineGroups.overdue.reduce((sum, d) => sum + d.balance, 0).toLocaleString('fr-FR')}
                </div>
                <div className="text-sm font-bold text-red-100 uppercase tracking-wider">Trésorerie en souffrance (TND)</div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-xl bg-white">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <Clock className="h-8 w-8 text-blue-600" />
                  <Badge variant="outline" className="text-blue-600 border-blue-200">Ce mois</Badge>
                </div>
                <div className="text-3xl font-black text-slate-900 mb-1">
                  {timelineGroups.thisMonth.reduce((sum, d) => sum + d.balance, 0).toLocaleString('fr-FR')}
                </div>
                <div className="text-sm font-bold text-slate-400 uppercase tracking-wider">Encaissements attendus</div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-xl bg-white">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <ShieldAlert className="h-8 w-8 text-purple-600" />
                  <Badge variant="outline" className="text-purple-600 border-purple-200">Litiges</Badge>
                </div>
                <div className="text-3xl font-black text-slate-900 mb-1">
                  {disputeInvoices.reduce((sum, d) => sum + d.balance, 0).toLocaleString('fr-FR')}
                </div>
                <div className="text-sm font-bold text-slate-400 uppercase tracking-wider">Montant en Retenus</div>
              </CardContent>
            </Card>
          </div>

          <Tabs defaultValue="timeline" className="space-y-6">
            <div className="overflow-x-auto pb-2 -mx-4 px-4 md:mx-0 md:px-0 scrollbar-hide">
              <TabsList className="bg-white p-1 rounded-2xl shadow-sm border border-slate-200 inline-flex min-w-max">
                <TabsTrigger value="timeline" className="rounded-xl font-bold px-4 md:px-6 data-[state=active]:bg-blue-600 data-[state=active]:text-white transition-all gap-2 text-xs md:text-sm">
                  <CalendarDays className="h-4 w-4" />
                  Échéancier
                </TabsTrigger>
                <TabsTrigger value="recovery" className="rounded-xl font-bold px-4 md:px-6 data-[state=active]:bg-red-600 data-[state=active]:text-white transition-all gap-2 text-xs md:text-sm">
                  <PhoneCall className="h-4 w-4" />
                  Plan de Relance
                </TabsTrigger>
                <TabsTrigger value="disputes" className="rounded-xl font-bold px-4 md:px-6 data-[state=active]:bg-purple-600 data-[state=active]:text-white transition-all gap-2 text-xs md:text-sm">
                  <ShieldAlert className="h-4 w-4" />
                  Retenus & Litiges
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="timeline" className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 outline-none">
              {/* En retard */}
              {timelineGroups.overdue.length > 0 && (
                <section>
                  <div className="flex items-center gap-2 mb-4">
                    <h3 className="text-lg font-black text-red-600 uppercase tracking-tighter">Factures Échues</h3>
                    <Badge className="bg-red-100 text-red-700 border-0">{timelineGroups.overdue.length}</Badge>
                  </div>
                  {filterBySearch(timelineGroups.overdue).map(d => <InvoiceCard key={d.id} debt={d} />)}
                </section>
              )}

              {/* Ce mois */}
              <section>
                <div className="flex items-center gap-2 mb-4">
                  <h3 className="text-lg font-black text-blue-700 uppercase tracking-tighter">Attendu ce mois</h3>
                  <Badge className="bg-blue-100 text-blue-700 border-0">{timelineGroups.thisMonth.length}</Badge>
                </div>
                {timelineGroups.thisMonth.length > 0 ? (
                  filterBySearch(timelineGroups.thisMonth).map(d => <InvoiceCard key={d.id} debt={d} />)
                ) : (
                  <div className="p-8 text-center bg-slate-100 rounded-2xl border-2 border-dashed border-slate-200">
                    <CheckCircle2 className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                    <p className="text-slate-400 font-bold">Aucun encaissement prévu sur le reste du mois.</p>
                  </div>
                )}
              </section>

              {/* Futur */}
              {timelineGroups.upcoming.length > 0 && (
                <section>
                  <div className="flex items-center gap-2 mb-4">
                    <h3 className="text-lg font-black text-slate-400 uppercase tracking-tighter">Prochaines échéances</h3>
                    <Badge className="bg-slate-200 text-slate-600 border-0">{timelineGroups.upcoming.length}</Badge>
                  </div>
                  {filterBySearch(timelineGroups.upcoming).map(d => <InvoiceCard key={d.id} debt={d} />)}
                </section>
              )}
            </TabsContent>

            <TabsContent value="recovery" className="animate-in fade-in slide-in-from-bottom-4 duration-500 outline-none">
              <div className="mb-6 bg-red-50 p-4 rounded-2xl border border-red-100 flex items-start gap-3">
                <TrendingUp className="h-5 w-5 text-red-600 mt-1" />
                <div>
                  <h4 className="font-black text-red-900 text-sm">Priorités de Recouvrement</h4>
                  <p className="text-red-700/80 text-xs font-medium">Factures critiques ou montants supérieurs à 10 000 TND nécessitant une relance immédiate.</p>
                </div>
              </div>
              {filterBySearch(priorityInvoices).map(d => <InvoiceCard key={d.id} debt={d} />)}
            </TabsContent>

            <TabsContent value="disputes" className="animate-in fade-in slide-in-from-bottom-4 duration-500 outline-none">
              <div className="mb-6 bg-purple-50 p-4 rounded-2xl border border-purple-100 flex items-start gap-3">
                <ShieldAlert className="h-5 w-5 text-purple-600 mt-1" />
                <div>
                  <h4 className="font-black text-purple-900 text-sm">Analyse des Écarts</h4>
                  <p className="text-purple-700/80 text-xs font-medium">Factures dont le solde correspond à l'intervalle de retenus défini ({settings.retentionMin}%-{settings.retentionMax}%).</p>
                </div>
              </div>
              {disputeInvoices.length > 0 ? (
                filterBySearch(disputeInvoices).map(d => <InvoiceCard key={d.id} debt={d} />)
              ) : (
                <div className="p-12 text-center">
                  <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-4" />
                  <h3 className="text-lg font-bold text-slate-900">Aucun litige détecté</h3>
                  <p className="text-slate-500">Toutes les retenues potentielles ont été traitées ou ne correspondent pas aux critères.</p>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </main>
      </div>

      <ClientHistoryModal 
        isOpen={isHistoryModalOpen}
        onClose={() => setIsHistoryModalOpen(false)}
        clientName={selectedClientName}
        clientDebts={clientHistoryDebts}
      />
    </div>
  );
}
