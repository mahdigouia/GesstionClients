'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from "@/components/ui/progress";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { 
  X, 
  FileText, 
  Clock, 
  Users, 
  MessageSquare,
  Star,
  Target
} from 'lucide-react';
import { ClientDebt } from '@/types/debt';
import { useDebtContext } from '@/lib/DebtContext';
import { useAuth } from '@/lib/AuthContext';
import { ClientRemarkModal } from '@/components/ClientRemarkModal';
import { ContentiousConfirmModal } from '@/components/ContentiousConfirmModal';

interface QuickClientProfileProps {
  clientName: string;
  debts: ClientDebt[];
  onClose: () => void;
}

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

export function QuickClientProfile({ clientName, debts: clientDebts, onClose }: QuickClientProfileProps) {
  const { 
    clientRemarks, 
    addClientRemark, 
    updateClientRemark, 
    deleteClientRemark, 
    toggleManualContentious 
  } = useDebtContext();
  const { userRole } = useAuth();
  
  const [isRemarkModalOpen, setIsRemarkModalOpen] = useState(false);
  const [pendingContentiousDoc, setPendingContentiousDoc] = useState<string | null>(null);

  const sortedDebts = useMemo(() => 
    [...clientDebts].sort((a, b) => (a.extractIndex || 0) - (b.extractIndex || 0)),
    [clientDebts]
  );

  const totalBalance = useMemo(() => 
    clientDebts.reduce((sum, d) => sum + (d.balance || 0), 0),
    [clientDebts]
  );

  const clientCode = clientDebts[0]?.clientCode || '?';
  const commercialName = clientDebts[0]?.commercialName || 'Non assigné';
  const sourceFile = clientDebts[0]?.sourceFile || '?';

  const averageAge = useMemo(() => 
    clientDebts.length > 0
      ? Math.round(clientDebts.reduce((sum, d) => sum + (d.age || 0), 0) / clientDebts.length)
      : 0,
    [clientDebts]
  );

  const theme = getClientTheme(clientName);

  const handleOpenRemarkModal = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsRemarkModalOpen(true);
  };

  return (
    <div className="relative">
      <Card className={`border-0 shadow-2xl ${theme.cardClass} overflow-hidden rounded-[32px] transition-all bg-white`}>
        {/* Absolute Close Button */}
        <div className="absolute top-4 right-4 z-10">
          <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full hover:bg-slate-100/80">
            <X className="h-5 w-5 text-slate-500" />
          </Button>
        </div>

        {/* Header (Visually matching clients page row) */}
        <div className="p-4 md:p-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4 md:gap-6 flex-1 min-w-0">
            <div className={`w-12 h-12 md:w-16 md:h-16 rounded-xl md:rounded-[20px] flex items-center justify-center font-black text-lg md:text-2xl shadow-inner flex-shrink-0 ${theme.avatarBg}`}>
              {clientName?.[0] || '?'}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-col md:flex-row md:items-center gap-1 md:gap-3">
                <span className="text-[9px] md:text-[11px] font-black font-mono text-slate-400 bg-slate-50 border border-slate-100 px-2 py-0.5 md:py-1 rounded-lg w-fit">{sourceFile}</span>
                <h4 
                  onClick={handleOpenRemarkModal}
                  className="font-black text-slate-800 text-sm md:text-xl tracking-tight truncate hover:text-blue-600 hover:underline decoration-blue-300 underline-offset-4 transition-all cursor-pointer"
                >
                  {clientName}
                </h4>
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[10px] md:text-sm text-slate-500 mt-2 md:mt-3">
                <span className="flex items-center gap-1.5 font-bold bg-slate-50 px-2 py-1 md:px-3 md:py-1.5 rounded-lg md:rounded-xl text-[10px] md:text-xs text-slate-700 border border-slate-100 whitespace-nowrap">Code: <span className="text-blue-600 font-black">{clientCode}</span></span>
                <span className="flex items-center gap-1.5 font-semibold whitespace-nowrap"><FileText className="h-3 w-3 md:h-4 md:w-4 text-slate-400" />{clientDebts.length} factures</span>
                
                <span className={`flex items-center gap-1.5 font-black px-2 py-1 md:px-3 md:py-1.5 rounded-lg md:rounded-xl border text-[10px] md:text-xs whitespace-nowrap shadow-sm transition-all ${
                  averageAge <= 15 ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                  averageAge <= 30 ? 'bg-blue-50 text-blue-700 border-blue-200' :
                  averageAge <= 45 ? 'bg-amber-50 text-amber-700 border-amber-200' :
                  averageAge <= 60 ? 'bg-orange-50 text-orange-700 border-orange-200' :
                  'bg-rose-50 text-rose-700 border-rose-200'
                }`}>
                  <Clock className="h-3.5 w-3.5" />
                  <span>Âge moyen: <span className="font-extrabold">{averageAge} j</span></span>
                </span>

                <span className="text-emerald-600 font-black flex items-center gap-1.5 bg-emerald-50/50 px-2 py-1 md:px-3 md:py-1.5 rounded-lg md:rounded-xl border border-emerald-100/50 whitespace-nowrap"><Users className="h-3 w-3 md:h-4 md:w-4" />{commercialName}</span>
              </div>
              
              {/* Remark for mobile */}
              {clientRemarks[clientName]?.[0] && (
                <div 
                  onClick={handleOpenRemarkModal}
                  className="md:hidden mt-2 p-2 bg-indigo-50/30 border border-indigo-100/50 rounded-xl text-[10px] font-medium text-slate-600 flex items-center justify-between gap-2 cursor-pointer"
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    <MessageSquare className="h-3.5 w-3.5 text-indigo-500 flex-shrink-0" />
                    <span className="truncate">
                      <span className="font-bold text-slate-700">{clientRemarks[clientName][0].user.split('@')[0]} :</span> {clientRemarks[clientName][0].content}
                    </span>
                  </div>
                  {clientRemarks[clientName].length > 1 && (
                    <Badge className="bg-indigo-50 text-indigo-700 border-none font-bold text-[8px] px-1 py-0 shadow-none scale-90 flex-shrink-0">
                      +{clientRemarks[clientName].length - 1}
                    </Badge>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Remark on Desktop */}
          <div 
            onClick={handleOpenRemarkModal}
            className="hidden md:flex flex-col flex-1 max-w-xs px-6 border-l border-slate-100 min-w-0 cursor-pointer"
          >
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
              <MessageSquare className="h-3.5 w-3.5 text-indigo-500" />
              <span>Dernière Remarque</span>
            </span>
            {clientRemarks[clientName]?.[0] ? (
              <div className="text-xs font-semibold text-slate-700 hover:text-blue-600 transition-colors line-clamp-2 pr-4 relative">
                <span className="font-bold text-slate-500">{clientRemarks[clientName][0].user.split('@')[0]} : </span>
                {clientRemarks[clientName][0].content}
                {clientRemarks[clientName].length > 1 && (
                  <span className="inline-flex items-center ml-1.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-indigo-50 text-indigo-600 border border-indigo-100 whitespace-nowrap">
                    +{clientRemarks[clientName].length - 1} hist.
                  </span>
                )}
              </div>
            ) : (
              <span className="text-xs text-slate-400 italic">Aucune remarque</span>
            )}
          </div>

          {/* Solde global */}
          <div className="flex items-center justify-between md:justify-end gap-6 md:gap-10 md:pr-4 border-t md:border-t-0 pt-3 md:pt-0">
            <div className="text-left md:text-right">
              <div className={`text-xl md:text-3xl font-black tracking-tighter ${totalBalance > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                {totalBalance.toLocaleString('fr-FR')} <span className="text-xs md:text-base font-medium opacity-60">TND</span>
              </div>
              <div className="text-[9px] md:text-[11px] font-black text-slate-400 uppercase tracking-widest md:tracking-[0.2em] mt-0.5 md:mt-1">Solde global</div>
            </div>
          </div>
        </div>

        {/* Content (Expanded / Table of Invoices) */}
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
                {sortedDebts.map((debt, i) => {
                  const paymentRatio = debt.amount > 0 ? (debt.settlement / debt.amount) * 100 : 0;
                  return (
                    <TableRow key={i} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/30 transition-colors group">
                      <TableCell className="font-mono text-xs md:sm font-bold text-slate-700 py-3 md:py-5 px-4 md:px-6">
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={!!debt.isContentieux}
                            disabled={userRole !== 'admin' && userRole !== 'gestionnaire'}
                            onChange={() => {
                              if (!debt.isContentieux) {
                                setPendingContentiousDoc(debt.documentNumber);
                              } else {
                                toggleManualContentious(debt.documentNumber);
                              }
                            }}
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
                      <TableCell className="text-sm md:text-base font-black text-rose-600 text-right py-3 md:py-5">
                        {(debt.balance ?? 0).toLocaleString('fr-FR')} TND
                      </TableCell>
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
                          <Progress value={paymentRatio} className="h-1 md:h-1.5 bg-red-500 overflow-hidden" indicatorClassName="bg-green-500" />
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {/* Mobile-Optimized List View */}
          <div className="md:hidden space-y-3">
            {sortedDebts.map((debt, i) => {
              const paymentRatio = debt.amount > 0 ? (debt.settlement / debt.amount) * 100 : 0;
              return (
                <div key={i} className="bg-slate-50/50 border border-slate-150 rounded-2xl p-4 transition-all hover:bg-slate-50 flex flex-col gap-3">
                  <div className="flex justify-between items-start gap-2">
                    <div className="flex flex-col min-w-0">
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={!!debt.isContentieux}
                          disabled={userRole !== 'admin' && userRole !== 'gestionnaire'}
                          onChange={() => {
                            if (!debt.isContentieux) {
                              setPendingContentiousDoc(debt.documentNumber);
                            } else {
                              toggleManualContentious(debt.documentNumber);
                            }
                          }}
                          className="h-4 w-4 rounded border-slate-300 text-rose-600 focus:ring-rose-500 cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
                        />
                        {debt.isManualContentieux && (
                          <Star className="h-3.5 w-3.5 text-amber-500 fill-amber-500 flex-shrink-0 animate-pulse" />
                        )}
                        <span className="font-mono text-sm font-bold text-slate-800 truncate">{debt.documentNumber}</span>
                      </div>
                      {debt.description && (
                        <span className="text-[10px] text-slate-400 font-medium truncate max-w-[150px]">
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

                  <div className="h-px bg-slate-200/60" />

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

                  <div className="flex flex-col gap-1 mt-1">
                    <div className="flex justify-between items-center text-[9px] font-black text-slate-500">
                      <span>Progression du règlement</span>
                      <span>{paymentRatio.toFixed(0)}%</span>
                    </div>
                    <Progress value={paymentRatio} className="h-1 bg-red-500 overflow-hidden" indicatorClassName="bg-green-500" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </Card>

      {/* Modals required for Card actions inside popup */}
      <ClientRemarkModal
        isOpen={isRemarkModalOpen}
        onClose={() => setIsRemarkModalOpen(false)}
        clientName={clientName}
        remarks={clientRemarks[clientName] || []}
        onAddRemark={addClientRemark}
        onUpdateRemark={updateClientRemark}
        onDeleteRemark={deleteClientRemark}
      />

      <ContentiousConfirmModal
        isOpen={pendingContentiousDoc !== null}
        onClose={() => setPendingContentiousDoc(null)}
        onConfirm={() => {
          if (pendingContentiousDoc) {
            toggleManualContentious(pendingContentiousDoc);
          }
        }}
        invoiceNumber={pendingContentiousDoc || undefined}
      />
    </div>
  );
}
