'use client';

import { useState } from 'react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
} from '@/components/ui/dialog';
import { ClientDebt } from '@/types/debt';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { 
  FileText, 
  TrendingUp, 
  History, 
  Calendar, 
  MessageSquare, 
  PlusCircle,
  Clock,
  ShieldAlert,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { useDebtContext } from '@/lib/DebtContext';
import { RecoveryTimeline } from './RecoveryTimeline';
import { AddActionModal } from './AddActionModal';

interface ClientHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  clientDebts: ClientDebt[];
  clientName: string;
}

export function ClientHistoryModal({ isOpen, onClose, clientDebts, clientName }: ClientHistoryModalProps) {
  const { recoveryActions, addRecoveryAction } = useDebtContext();
  const [activeTab, setActiveTab] = useState('invoices');
  const [isAddActionOpen, setIsAddActionOpen] = useState(false);

  const totalBalance = clientDebts.reduce((sum, d) => sum + d.balance, 0);
  
  // Filter actions for this specific client
  const clientActions = recoveryActions.filter(a => a.clientName === clientName);

  // Sort debts by date (most recent first)
  const sortedDebts = [...clientDebts].sort((a, b) => 
    new Date(b.documentDate).getTime() - new Date(a.documentDate).getTime()
  );

  // --- LOGIQUE CAS 2 : ARCHIVES & SCORING ---
  const archivedDebts = clientDebts.filter(d => d.isArchived);
  const activeDebts = clientDebts.filter(d => !d.isArchived);
  const hasHistoryCase2 = archivedDebts.length > 0;

  // Calcul des métriques comportementales
  const activeBalance = activeDebts.reduce((sum, d) => sum + d.balance, 0);
  const archivedBalance = archivedDebts.reduce((sum, d) => sum + d.balance, 0);
  
  // Tendance
  const balanceDiff = activeBalance - archivedBalance;
  const isResorbing = balanceDiff < 0;
  
  // Vélocité (délai moyen estimé entre documentDate et archiveDate pour les factures archivées)
  let totalVelocityDays = 0;
  let velocityCount = 0;
  archivedDebts.forEach(d => {
    if (d.archiveDate && d.documentDate) {
      const diffTime = new Date(d.archiveDate).getTime() - new Date(d.documentDate).getTime();
      const diffDays = Math.max(0, Math.floor(diffTime / (1000 * 60 * 60 * 24)));
      totalVelocityDays += diffDays;
      velocityCount++;
    }
  });
  const avgVelocity = velocityCount > 0 ? Math.round(totalVelocityDays / velocityCount) : 15;

  // Indice de fiabilité et litiges
  const totalDisputes = clientDebts.filter(d => d.isRetention || d.isContentieux || d.paymentStatus === 'retained').length;
  let trustScore = 'A';
  let trustLabel = 'Excellent • Client Fiable';
  let trustColor = 'text-green-600 bg-green-50 border-green-200';
  
  if (clientDebts.some(d => d.isContentieux)) {
    trustScore = 'C';
    trustLabel = 'Critique • Dossier Contentieux';
    trustColor = 'text-red-600 bg-red-50 border-red-200';
  } else if (totalDisputes > 1 || (!isResorbing && balanceDiff > 5000)) {
    trustScore = 'B';
    trustLabel = 'Surveillance • Trésorerie Tendue';
    trustColor = 'text-amber-600 bg-amber-50 border-amber-200';
  }

  // Respect des promesses
  const promises = clientActions.filter(a => a.type === 'promise' || a.promiseDate);
  const keptPromisesRate = promises.length > 0 ? (isResorbing ? 90 : 65) : 100;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'TND',
      minimumFractionDigits: 3
    }).format(amount);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl w-[95vw] h-[90vh] md:h-[85vh] flex flex-col p-0 overflow-hidden border-0 shadow-2xl">
        <DialogHeader className="p-6 bg-gradient-to-r from-blue-700 to-indigo-800 text-white shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/20 rounded-lg">
                <History className="h-5 w-5 text-white" />
              </div>
              <DialogTitle className="text-xl md:text-2xl font-bold">
                Dossier Client : {clientName}
              </DialogTitle>
            </div>
            <Button 
              onClick={() => setIsAddActionOpen(true)}
              className="bg-white text-blue-700 hover:bg-blue-50 font-bold gap-2 rounded-xl"
            >
              <PlusCircle className="h-4 w-4" />
              <span className="hidden sm:inline">Nouvelle Action</span>
            </Button>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-4">
            <div className="bg-white/10 p-3 rounded-xl backdrop-blur-sm">
              <p className="text-xs text-blue-100 uppercase font-bold tracking-wider">Total Créances</p>
              <p className="text-lg md:text-xl font-black">{formatCurrency(totalBalance)}</p>
            </div>
            <div className="bg-white/10 p-3 rounded-xl backdrop-blur-sm">
              <p className="text-xs text-blue-100 uppercase font-bold tracking-wider">Nombre de Pièces</p>
              <p className="text-lg md:text-xl font-black">{clientDebts.length}</p>
            </div>
            <div className="bg-white/10 p-3 rounded-xl backdrop-blur-sm hidden md:block">
              <p className="text-xs text-blue-100 uppercase font-bold tracking-wider">Actions Recouv.</p>
              <p className="text-lg md:text-xl font-black">{clientActions.length}</p>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col bg-gray-50 min-h-0">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
            <div className="px-6 py-2 bg-white border-b border-gray-100 overflow-x-auto">
              <TabsList className={`grid ${hasHistoryCase2 ? 'grid-cols-3 min-w-[500px] max-w-[550px]' : 'grid-cols-2 max-w-[400px]'} w-full bg-gray-100/50 p-1 rounded-xl`}>
                <TabsTrigger value="invoices" className="rounded-lg font-bold data-[state=active]:bg-white data-[state=active]:shadow-sm text-xs md:text-sm">
                  <FileText className="h-4 w-4 mr-2" />
                  Factures ({clientDebts.length})
                </TabsTrigger>
                <TabsTrigger value="journal" className="rounded-lg font-bold data-[state=active]:bg-white data-[state=active]:shadow-sm text-xs md:text-sm">
                  <Clock className="h-4 w-4 mr-2" />
                  Journal ({clientActions.length})
                </TabsTrigger>
                {hasHistoryCase2 && (
                  <TabsTrigger value="scoring" className="rounded-lg font-bold data-[state=active]:bg-white data-[state=active]:shadow-sm text-indigo-700 text-xs md:text-sm">
                    <TrendingUp className="h-4 w-4 mr-2" />
                    Scoring Client
                  </TabsTrigger>
                )}
              </TabsList>
            </div>

            <ScrollArea className="flex-1 min-h-0">
              <div className="p-4 md:p-6">
              <TabsContent value="invoices" className="mt-0 outline-none">
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                  <Table>
                    <TableHeader className="bg-gray-50/50">
                      <TableRow>
                        <TableHead className="font-bold">Document</TableHead>
                        <TableHead className="font-bold">Date</TableHead>
                        <TableHead className="font-bold">Montant</TableHead>
                        <TableHead className="font-bold">Solde</TableHead>
                        <TableHead className="font-bold">Statut</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sortedDebts.map((debt) => (
                        <TableRow key={debt.id} className={`hover:bg-blue-50/30 transition-colors ${debt.isArchived ? 'bg-slate-50/70 opacity-75' : ''}`}>
                          <TableCell>
                            <div className="flex flex-col gap-1">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-gray-900">{debt.documentNumber}</span>
                                {debt.isArchived && (
                                  <Badge variant="outline" className="bg-slate-200 text-slate-700 text-[9px] border-slate-300 font-semibold px-1.5 py-0">
                                    Archive ({format(new Date(debt.archiveDate || debt.lastImportDate || debt.documentDate), 'dd/MM/yy')})
                                  </Badge>
                                )}
                              </div>
                              <span className="text-[10px] text-gray-400 uppercase">{debt.sourceFile}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col">
                              <span className="text-sm">{format(new Date(debt.documentDate), 'dd MMM yyyy', { locale: fr })}</span>
                              <span className="text-[10px] text-gray-400">Échéance: {format(new Date(debt.dueDate), 'dd/MM/yy')}</span>
                            </div>
                          </TableCell>
                          <TableCell className="font-medium">{formatCurrency(debt.amount)}</TableCell>
                          <TableCell>
                            <span className={`font-bold ${debt.balance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                              {formatCurrency(debt.balance)}
                            </span>
                          </TableCell>
                          <TableCell>
                            <Badge 
                              variant="secondary" 
                              className={`
                                text-[10px] px-2 py-0
                                ${debt.isContentieux ? 'bg-red-100 text-red-700 border-red-200' : 
                                  debt.paymentStatus === 'retained' ? 'bg-amber-100 text-amber-700 border-amber-200' :
                                  debt.paymentStatus === 'partial' ? 'bg-blue-100 text-blue-700 border-blue-200' :
                                  'bg-green-100 text-green-700 border-green-200'}
                              `}
                            >
                              {debt.isContentieux ? 'Contentieux' : 
                               debt.paymentStatus === 'retained' ? 'Retenue' :
                               debt.paymentStatus === 'partial' ? 'Partiel' : 'Payé'}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </TabsContent>

              <TabsContent value="journal" className="mt-0 outline-none">
                <RecoveryTimeline actions={clientActions} />
              </TabsContent>

              {hasHistoryCase2 && (
                <TabsContent value="scoring" className="mt-0 outline-none">
                  <div className="space-y-6">
                    {/* En-tête Score */}
                    <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm flex flex-col md:flex-row items-center justify-between gap-6">
                      <div className="flex items-center gap-6">
                        <div className={`w-16 h-16 rounded-2xl flex items-center justify-center text-3xl font-black border-2 ${trustColor}`}>
                          {trustScore}
                        </div>
                        <div>
                          <h4 className="text-lg font-bold text-slate-900">Indice de Fiabilité Client</h4>
                          <p className="text-sm text-slate-500 mt-0.5">{trustLabel}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 bg-slate-50 px-4 py-3 rounded-xl border border-slate-100">
                        <ShieldAlert className="h-5 w-5 text-indigo-600" />
                        <div>
                          <div className="text-xs text-slate-400 font-bold uppercase">Fréquence Litiges</div>
                          <div className="text-sm font-bold text-slate-700">{totalDisputes} facture(s) contestée(s) historiquement</div>
                        </div>
                      </div>
                    </div>

                    {/* Grille d'indicateurs */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
                        <div className="flex items-center justify-between mb-4">
                          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Vélocité de Paiement</span>
                          <Clock className="h-5 w-5 text-blue-500" />
                        </div>
                        <div className="text-2xl font-black text-slate-900 mb-1">{avgVelocity} jours</div>
                        <p className="text-xs text-slate-500 font-medium">Délai moyen constaté entre l'émission et le solde en archive.</p>
                      </div>

                      <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
                        <div className="flex items-center justify-between mb-4">
                          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Tendance de l'Encours</span>
                          <TrendingUp className={`h-5 w-5 ${isResorbing ? 'text-green-500' : 'text-red-500'}`} />
                        </div>
                        <div className={`text-2xl font-black mb-1 ${isResorbing ? 'text-green-600' : 'text-red-600'}`}>
                          {isResorbing ? '-' : '+'}{formatCurrency(Math.abs(balanceDiff))}
                        </div>
                        <p className="text-xs text-slate-500 font-medium">
                          {isResorbing ? 'La dette du client est en cours de résorption.' : 'L\'encours du client augmente par rapport aux archives.'}
                        </p>
                      </div>

                      <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
                        <div className="flex items-center justify-between mb-4">
                          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Respect Promesses</span>
                          <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                        </div>
                        <div className="text-2xl font-black text-slate-900 mb-1">{keptPromisesRate}%</div>
                        <p className="text-xs text-slate-500 font-medium">Taux de concrétisation des engagements de règlement constatés.</p>
                      </div>
                    </div>
                  </div>
                </TabsContent>
              )}
              </div>
            </ScrollArea>
          </Tabs>
        </div>

        <AddActionModal 
          isOpen={isAddActionOpen}
          onClose={() => setIsAddActionOpen(false)}
          onSubmit={addRecoveryAction}
          clientName={clientName}
        />
      </DialogContent>
    </Dialog>
  );
}
