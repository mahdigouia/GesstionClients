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
import { ScrollArea } from '@/components/ui/scroll-area';

interface FilteredResultsModalProps {
  isOpen: boolean;
  onClose: () => void;
  debts: ClientDebt[];
  filterName: string;
}

export function FilteredResultsModal({ isOpen, onClose, debts, filterName }: FilteredResultsModalProps) {
  const filterLabels: Record<string, string> = {
    critical: 'Créances Critiques',
    overdue: 'Créances en Retard',
    monitoring: 'Créances à Surveiller',
    healthy: 'Créances Saines',
    retained: 'Retenues de Garantie',
    all: 'Toutes les Créances'
  };

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case 'critical': return 'bg-red-100 text-red-800 border-red-200';
      case 'overdue': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'monitoring': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'healthy': return 'bg-green-100 text-green-800 border-green-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl w-[95vw] h-[80vh] flex flex-col p-0 overflow-hidden rounded-2xl">
        <DialogHeader className="p-6 border-b bg-gray-50/50">
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-xl font-bold text-gray-900">
                {filterLabels[filterName] || 'Résultats filtrés'}
              </DialogTitle>
              <p className="text-sm text-gray-500 mt-1">
                {debts.length} créance(s) trouvée(s)
              </p>
            </div>
            <Badge variant="outline" className="px-3 py-1 bg-white shadow-sm">
              Total: {debts.reduce((sum, d) => sum + d.balance, 0).toLocaleString('fr-FR')} TND
            </Badge>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-hidden">
          <ScrollArea className="h-full">
            <div className="p-0 md:p-4">
              <Table>
                <TableHeader className="sticky top-0 bg-white z-10">
                  <TableRow>
                    <TableHead className="font-bold">Client</TableHead>
                    <TableHead className="hidden md:table-cell font-bold">N° Pièce</TableHead>
                    <TableHead className="text-right font-bold">Montant</TableHead>
                    <TableHead className="text-right font-bold">Solde</TableHead>
                    <TableHead className="text-center font-bold">Âge</TableHead>
                    <TableHead className="text-center font-bold">Risque</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {debts.map((debt) => (
                    <TableRow key={debt.id} className="hover:bg-gray-50">
                      <TableCell>
                        <div className="font-medium text-gray-900 truncate max-w-[120px] md:max-w-none">
                          {debt.clientName}
                        </div>
                        <div className="text-[10px] text-gray-500 md:hidden">
                          {debt.documentNumber}
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-gray-600 font-mono text-xs">
                        {debt.documentNumber}
                      </TableCell>
                      <TableCell className="text-right text-gray-600">
                        {debt.amount.toLocaleString('fr-FR', { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell className="text-right font-bold text-red-600">
                        {debt.balance.toLocaleString('fr-FR', { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">
                          {debt.age}j
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge className={`text-[10px] px-2 py-0 border ${getRiskColor(debt.riskLevel)}`}>
                          {debt.riskLevel === 'critical' ? 'Critique' : 
                           debt.riskLevel === 'overdue' ? 'En retard' :
                           debt.riskLevel === 'monitoring' ? 'Surveillance' : 'Sain'}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                  {debts.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="h-32 text-center text-gray-500">
                        Aucun résultat trouvé pour ce filtre.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
}
