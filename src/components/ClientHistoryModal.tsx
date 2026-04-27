'use client';

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
import { FileText, TrendingUp, History, Calendar } from 'lucide-react';

interface ClientHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  clientDebts: ClientDebt[];
  clientName: string;
}

export function ClientHistoryModal({ isOpen, onClose, clientDebts, clientName }: ClientHistoryModalProps) {
  const totalBalance = clientDebts.reduce((sum, d) => sum + d.balance, 0);
  const totalAmount = clientDebts.reduce((sum, d) => sum + d.amount, 0);
  
  // Sort debts by date (most recent first)
  const sortedDebts = [...clientDebts].sort((a, b) => 
    new Date(b.documentDate).getTime() - new Date(a.documentDate).getTime()
  );

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'TND',
      minimumFractionDigits: 3
    }).format(amount);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0 overflow-hidden border-0 shadow-2xl">
        <DialogHeader className="p-6 bg-gradient-to-r from-blue-700 to-indigo-800 text-white shrink-0">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-white/20 rounded-lg">
              <History className="h-5 w-5 text-white" />
            </div>
            <DialogTitle className="text-xl md:text-2xl font-bold">
              Historique Client : {clientName}
            </DialogTitle>
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
              <p className="text-xs text-blue-100 uppercase font-bold tracking-wider">Ancienneté Max</p>
              <p className="text-lg md:text-xl font-black">
                {clientDebts.length > 0 ? Math.max(...clientDebts.map(d => d.age)) : 0} jours
              </p>
            </div>
          </div>
        </DialogHeader>

        <ScrollArea className="flex-1 p-4 md:p-6 bg-gray-50">
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
                  <TableRow key={debt.id} className="hover:bg-blue-50/30 transition-colors">
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-bold text-gray-900">{debt.documentNumber}</span>
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
          
          <div className="mt-6 p-4 bg-blue-50 rounded-2xl border border-blue-100 flex items-start gap-3">
            <div className="mt-1 p-2 bg-blue-600 rounded-full text-white">
              <Calendar className="h-4 w-4" />
            </div>
            <div>
              <p className="text-sm font-bold text-blue-900">Dernier Import</p>
              <p className="text-xs text-blue-700 leading-relaxed">
                Toutes les créances ci-dessus ont été synchronisées lors des différents imports. 
                Les factures dont le solde est nul ne sont conservées que si elles figuraient dans le dernier fichier importé.
              </p>
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
