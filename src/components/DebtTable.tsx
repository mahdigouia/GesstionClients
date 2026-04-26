'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { Download } from 'lucide-react';
import { ClientDebt } from '@/types/debt';
import { AnalysisService } from '@/lib/analysis';
import { ClientSearchFilters } from './ClientSearchFilters';

interface DebtTableProps {
  debts: ClientDebt[];
  onExport?: (debts: ClientDebt[]) => void;
}

export function DebtTable({ debts, onExport }: DebtTableProps) {
  const [filteredDebts, setFilteredDebts] = useState<ClientDebt[]>(debts);

  // Update filtered debts when parent debts change
  useEffect(() => {
    setFilteredDebts(debts);
  }, [debts]);

  const riskColors = {
    healthy: 'bg-green-100 text-green-800 border-green-200',
    monitoring: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    overdue: 'bg-orange-100 text-orange-800 border-orange-200',
    critical: 'bg-red-100 text-red-800 border-red-200'
  };

  const totalBalance = filteredDebts.reduce((sum, debt) => sum + debt.balance, 0);
  const totalAmount = filteredDebts.reduce((sum, debt) => sum + debt.amount, 0);

  return (
    <Card>
      <ClientSearchFilters debts={debts} onFilterChange={setFilteredDebts} />
      
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle>Liste des Créances ({filteredDebts.length})</CardTitle>
          <div className="flex space-x-2">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => onExport?.(filteredDebts)}
            >
              <Download className="h-4 w-4 mr-2" />
              Exporter
            </Button>
          </div>
        </div>
      </CardHeader>
      
      <CardContent>
        {/* Summary */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="text-center p-4 bg-gray-50 rounded-lg">
            <div className="text-2xl font-bold">
              {totalAmount.toFixed(2)} TND
            </div>
            <div className="text-sm text-gray-600">Total Facturé</div>
          </div>
          <div className="text-center p-4 bg-red-50 rounded-lg">
            <div className="text-2xl font-bold text-red-600">
              {totalBalance.toFixed(2)} TND
            </div>
            <div className="text-sm text-gray-600">Solde Restant</div>
          </div>
        </div>

        {/* Table */}
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Client</TableHead>
                <TableHead>Code</TableHead>
                <TableHead>Téléphone</TableHead>
                <TableHead>N° Pièce</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Échéance</TableHead>
                <TableHead className="text-right">Montant</TableHead>
                <TableHead className="text-right">Règlement</TableHead>
                <TableHead className="text-right">Solde</TableHead>
                <TableHead className="text-center">Âge</TableHead>
                <TableHead className="text-center">J.P</TableHead>
                <TableHead className="text-center">Risque</TableHead>
                <TableHead className="text-center">Source</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredDebts.map((debt) => (
                <TableRow key={debt.id} className="hover:bg-gray-50">
                  <TableCell className="font-medium">
                    {debt.clientName || '-'}
                  </TableCell>
                  <TableCell className="text-gray-600">
                    {debt.clientCode || '-'}
                  </TableCell>
                  <TableCell className="text-gray-600">
                    {debt.clientPhone || '-'}
                  </TableCell>
                  <TableCell className="font-mono text-sm">
                    {debt.documentNumber || '-'}
                  </TableCell>
                  <TableCell className="max-w-xs truncate" title={debt.description}>
                    {debt.description}
                  </TableCell>
                  <TableCell>
                    {debt.documentDate && !isNaN(new Date(debt.documentDate).getTime()) 
                      ? new Date(debt.documentDate).toLocaleDateString('fr-FR') 
                      : '-'}
                  </TableCell>
                  <TableCell>
                    {debt.dueDate && !isNaN(new Date(debt.dueDate).getTime()) 
                      ? new Date(debt.dueDate).toLocaleDateString('fr-FR') 
                      : '-'}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {debt.amount.toFixed(2)} TND
                  </TableCell>
                  <TableCell className="text-right text-green-600">
                    {debt.settlement?.toFixed(2) || '0.00'} TND
                  </TableCell>
                  <TableCell className="text-right font-bold text-red-600">
                    {debt.balance.toFixed(2)} TND
                  </TableCell>
                  <TableCell className="text-center">
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                      debt.age > 365 ? 'bg-red-100 text-red-800' :
                      debt.age > 90 ? 'bg-orange-100 text-orange-800' :
                      debt.age > 30 ? 'bg-yellow-100 text-yellow-800' :
                      'bg-green-100 text-green-800'
                    }`}>
                      {debt.age}j
                    </span>
                  </TableCell>
                  <TableCell className="text-center">
                    {debt.paymentDays}
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge 
                      variant="outline" 
                      className={riskColors[debt.riskLevel]}
                    >
                      {AnalysisService.getRiskLabel(debt.riskLevel)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    <span className="text-xs text-gray-500">
                      {(debt.sourceFile || '').length > 15 ? 
                        (debt.sourceFile || '').substring(0, 12) + '...' : 
                        (debt.sourceFile || '-')
                      }
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {filteredDebts.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            Aucune créance trouvée pour les filtres sélectionnés
          </div>
        )}
      </CardContent>
    </Card>
  );
}
