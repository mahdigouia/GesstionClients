'use client';

import { useState, useMemo } from 'react';
import { useDebtContext } from '@/lib/DebtContext';
import { useAuth } from '@/lib/AuthContext';
import { Sidebar } from '@/components/Sidebar';
import { 
  History, 
  Search, 
  Menu, 
  MessageSquare, 
  Clock, 
  Calendar, 
  User, 
  Coins, 
  CheckCircle2, 
  AlertCircle,
  Users
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ClientRemarkModal } from '@/components/ClientRemarkModal';

export default function HistoryPage() {
  const { 
    debts, 
    allClientRemarks, 
    clientRemarks, 
    addClientRemark, 
    updateClientRemark, 
    deleteClientRemark 
  } = useDebtContext();
  
  const { userRole } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Modal State
  const [isRemarkModalOpen, setIsRemarkModalOpen] = useState(false);
  const [remarkClientName, setRemarkClientName] = useState('');

  const handleOpenRemarkModal = (name: string) => {
    setRemarkClientName(name);
    setIsRemarkModalOpen(true);
  };

  // Compute complete historical clients list
  const historicalClients = useMemo(() => {
    const rawRemarksMap = allClientRemarks || {};
    const activeClientNamesSet = new Set(debts.map(d => d.clientName));
    const allKnownClientNames = Array.from(new Set([
      ...Object.keys(rawRemarksMap),
      ...debts.map(d => d.clientName)
    ]));

    return allKnownClientNames
      .map(name => {
        const remarks = rawRemarksMap[name] || [];
        const isActiveInImport = activeClientNamesSet.has(name);
        const activeDebts = debts.filter(d => d.clientName === name && d.balance > 0);
        const totalActiveBalance = activeDebts.reduce((sum, d) => sum + d.balance, 0);

        return {
          clientName: name,
          remarks,
          isActiveInImport,
          activeDebtCount: activeDebts.length,
          totalActiveBalance,
          lastRemarkDate: remarks.length > 0 ? remarks[0].date : null
        };
      })
      .filter(item => {
        if (!searchTerm.trim()) return true;
        const term = searchTerm.toLowerCase();
        const matchesName = item.clientName.toLowerCase().includes(term);
        const matchesRemark = item.remarks.some((r: any) => (r.content || '').toLowerCase().includes(term));
        return matchesName || matchesRemark;
      })
      .sort((a, b) => {
        if (!a.isActiveInImport && b.isActiveInImport) return -1;
        if (a.isActiveInImport && !b.isActiveInImport) return 1;
        return a.clientName.localeCompare(b.clientName);
      });
  }, [allClientRemarks, debts, searchTerm]);

  return (
    <div className="flex h-screen bg-slate-50">
      <Sidebar mobileOpen={sidebarOpen} onMobileClose={() => setSidebarOpen(false)} />

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="bg-white border-b border-slate-200 px-4 md:px-8 py-4 md:py-6 flex-shrink-0">
          <div className="max-w-7xl mx-auto w-full flex flex-col gap-4">
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
                <div className="p-2 md:p-3 rounded-xl md:rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg shadow-indigo-200">
                  <History className="h-5 w-5 md:h-7 md:w-7 text-white" />
                </div>
                <div>
                  <h1 className="text-lg md:text-2xl font-bold text-slate-800 tracking-tight">
                    Historique & Archives des Clients
                  </h1>
                  <p className="text-slate-500 text-[10px] md:text-sm font-medium">
                    {historicalClients.length} clients répertoriés
                  </p>
                </div>
              </div>

              {/* Search Bar */}
              <div className="relative flex-1 max-w-md ml-auto">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  type="text"
                  placeholder="Rechercher par nom de client ou contenu de remarque..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 h-10 rounded-2xl border-slate-200 bg-slate-50 focus:bg-white text-xs md:text-sm font-medium transition-all"
                />
                {searchTerm && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="absolute right-2 top-1/2 -translate-y-1/2 h-6 w-6 p-0 rounded-full"
                    onClick={() => setSearchTerm('')}
                  >
                    ×
                  </Button>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto p-4 md:p-8 bg-slate-50/50">
          <div className="max-w-7xl mx-auto space-y-4 md:space-y-6">

            {/* Banner */}
            <div className="bg-gradient-to-r from-slate-900 via-indigo-900 to-purple-950 text-white p-6 rounded-3xl shadow-xl flex items-center justify-between flex-wrap gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <History className="h-5 w-5 text-indigo-400" />
                  <h2 className="text-lg font-black tracking-tight">Historique des Remarques & Relances</h2>
                </div>
                <p className="text-xs text-indigo-200 font-medium max-w-2xl">
                  Consultez l'historique complet de toutes les remarques et relances enregistrées en base, y compris pour les clients qui n'ont pas de créances actives dans l'import actuel.
                </p>
              </div>
              <Badge variant="outline" className="border-indigo-400/30 bg-indigo-500/20 text-indigo-100 font-bold px-3.5 py-1.5 text-xs rounded-xl">
                {historicalClients.length} clients
              </Badge>
            </div>

            {/* Grid of Clients */}
            {historicalClients.length === 0 ? (
              <Card className="p-8 text-center bg-white rounded-3xl border-slate-200">
                <Clock className="h-10 w-10 text-slate-300 mx-auto mb-3" />
                <p className="text-sm font-bold text-slate-600">Aucune donnée historique trouvée</p>
                <p className="text-xs text-slate-400 mt-1">Aucune remarque ne correspond à votre recherche.</p>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {historicalClients.map((item) => (
                  <Card key={item.clientName} className="p-5 bg-white rounded-3xl border border-slate-200/80 shadow-sm hover:shadow-md transition-all flex flex-col justify-between space-y-4">
                    <div>
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div className="min-w-0">
                          <h3 className="font-bold text-slate-800 text-sm md:text-base truncate">{item.clientName}</h3>
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            {item.isActiveInImport ? (
                              <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] font-bold">
                                Créances actives ({item.activeDebtCount} pce)
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="bg-slate-100 text-slate-600 border-slate-200 text-[10px] font-bold">
                                Archivé (Sans facture dans import)
                              </Badge>
                            )}
                          </div>
                        </div>

                        <Button
                          size="sm"
                          variant="outline"
                          className="rounded-xl border-indigo-200 text-indigo-700 hover:bg-indigo-50 text-xs font-bold gap-1.5 flex-shrink-0 shadow-sm"
                          onClick={() => handleOpenRemarkModal(item.clientName)}
                        >
                          <MessageSquare className="h-3.5 w-3.5" />
                          Voir / Saisir ({item.remarks.length})
                        </Button>
                      </div>

                      {item.remarks.length > 0 ? (
                        <div className="space-y-2 mt-3 bg-slate-50/80 p-3.5 rounded-2xl border border-slate-100">
                          <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">Dernière remarque :</p>
                          <div className="text-xs text-slate-700 font-medium leading-relaxed">
                            {item.remarks[0].content}
                          </div>
                          <div className="flex items-center justify-between text-[10px] text-slate-400 font-semibold pt-2 border-t border-slate-200/50">
                            <span>{new Date(item.remarks[0].date).toLocaleDateString('fr-FR')}</span>
                            <span>Par: {item.remarks[0].user?.split('@')[0] || 'Utilisateur'}</span>
                          </div>
                        </div>
                      ) : (
                        <p className="text-xs text-slate-400 italic mt-2">Aucune remarque enregistrée pour le moment.</p>
                      )}
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </main>
      </div>

      <ClientRemarkModal
        isOpen={isRemarkModalOpen}
        onClose={() => setIsRemarkModalOpen(false)}
        clientName={remarkClientName}
        remarks={(allClientRemarks || clientRemarks)[remarkClientName] || []}
        onAddRemark={addClientRemark}
        onUpdateRemark={updateClientRemark}
        onDeleteRemark={deleteClientRemark}
      />
    </div>
  );
}
