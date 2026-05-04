'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
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
import { Download, X, History, Calendar, PhoneCall } from 'lucide-react';
import { ClientDebt } from '@/types/debt';
import { AnalysisService } from '@/lib/analysis';
import { ClientSearchFilters } from './ClientSearchFilters';
import { AutocompleteSearch } from './AutocompleteSearch';

interface DebtTableProps {
  debts: ClientDebt[];
  onExport?: (debts: ClientDebt[]) => void;
  onClientClick?: (clientName: string) => void;
  onQuickAction?: (clientName: string) => void;
}

export function DebtTable({ debts, onExport, onClientClick }: DebtTableProps) {
  const [advancedFilteredDebts, setAdvancedFilteredDebts] = useState<ClientDebt[]>(debts);
  const [selectedClient, setSelectedClient] = useState<string>('');
  const [clientSearchValue, setClientSearchValue] = useState<string>('');
  const prevDebtsLengthRef = useRef(debts.length);

  // Update when parent debts change (only reset if necessary or let ClientSearchFilters handle it)
  useEffect(() => {
    // If the entire debts array changed (e.g. new import), we might want to reset.
    // But ClientSearchFilters already re-renders and calls onFilterChange when debts prop changes.
    // So we don't need to manually setAdvancedFilteredDebts(debts) here as it competes with the filter.
    if (prevDebtsLengthRef.current !== debts.length) {
      setSelectedClient('');
      setClientSearchValue('');
      prevDebtsLengthRef.current = debts.length;
    }
  }, [debts]);

  // Final filtered debts = advanced filters + client selection
  const filteredDebts = useMemo(() => {
    if (!selectedClient) return advancedFilteredDebts;
    return advancedFilteredDebts.filter(d => 
      (d.clientName || '').toLowerCase() === selectedClient.toLowerCase()
    );
  }, [advancedFilteredDebts, selectedClient]);

  const handleClientSelect = useCallback((value: string) => {
    // Check if the selected value is an actual client name
    const isClientName = debts.some(d => 
      (d.clientName || '').toLowerCase() === value.toLowerCase()
    );
    if (isClientName) {
      setSelectedClient(value);
    }
    setClientSearchValue(value);
  }, [debts]);

  const handleClientSearchChange = useCallback((value: string) => {
    setClientSearchValue(value);
    if (!value) {
      setSelectedClient('');
    }
  }, []);

  const clearClientFilter = useCallback(() => {
    setSelectedClient('');
    setClientSearchValue('');
  }, []);

  const riskColors = {
    healthy: 'bg-green-100 text-green-800 border-green-200',
    monitoring: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    overdue: 'bg-orange-100 text-orange-800 border-orange-200',
    critical: 'bg-red-100 text-red-800 border-red-200'
  };

  const totalBalance = filteredDebts.reduce((sum, debt) => sum + debt.balance, 0);
  const totalAmount = filteredDebts.reduce((sum, debt) => sum + debt.amount, 0);
  const totalSettlement = filteredDebts.reduce((sum, debt) => sum + (debt.settlement || 0), 0);

  return (
    <Card>
      <ClientSearchFilters debts={debts} onFilterChange={setAdvancedFilteredDebts} />
      
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
        {/* Client Autocomplete Filter */}
        <div className="mb-6">
          <div className="flex items-center gap-2">
            <div className="flex-1">
              <AutocompleteSearch
                debts={debts}
                value={clientSearchValue}
                onChange={handleClientSearchChange}
                onSelect={handleClientSelect}
                placeholder="🔍 Filtrer par client (tapez 2 lettres pour l'autocomplétion)..."
              />
            </div>
            {selectedClient && (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={clearClientFilter}
                className="gap-1 h-12 px-4 border-purple-200 bg-purple-50 hover:bg-purple-100 text-purple-700"
              >
                <span className="font-medium">{selectedClient}</span>
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        {/* Summary - 4 cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="text-center p-4 bg-blue-50 rounded-lg border border-blue-100">
            <div className="text-sm text-blue-600 font-medium mb-1">Créances</div>
            <div className="text-2xl font-bold text-blue-800">
              {filteredDebts.length}
            </div>
          </div>
          <div className="text-center p-4 bg-gray-50 rounded-lg border border-gray-100">
            <div className="text-sm text-gray-600 font-medium mb-1">Total Facturé</div>
            <div className="text-2xl font-bold text-gray-800">
              {totalAmount.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span className="text-sm font-normal">TND</span>
            </div>
          </div>
          <div className="text-center p-4 bg-green-50 rounded-lg border border-green-100">
            <div className="text-sm text-green-600 font-medium mb-1">Total Réglé</div>
            <div className="text-2xl font-bold text-green-700">
              {totalSettlement.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span className="text-sm font-normal">TND</span>
            </div>
          </div>
          <div className="text-center p-4 bg-red-50 rounded-lg border border-red-100">
            <div className="text-sm text-red-600 font-medium mb-1">Solde Restant</div>
            <div className="text-2xl font-bold text-red-600">
              {totalBalance.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span className="text-sm font-normal">TND</span>
            </div>
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
                <TableRow 
                  key={debt.id} 
                  className="hover:bg-blue-50/50 cursor-pointer transition-colors group"
                >
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 rounded-full hover:bg-blue-100 hover:text-blue-700 text-slate-400 opacity-0 group-hover:opacity-100 transition-all shrink-0"
                        onClick={(e) => {
                          e.stopPropagation();
                          onQuickAction?.(debt.clientName);
                        }}
                        title="Enregistrer une action"
                      >
                        <PhoneCall className="h-4 w-4" />
                      </Button>

                      <div 
                        className="flex flex-col flex-1" 
                        onClick={() => onClientClick?.(debt.clientName)}
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-gray-900 group-hover:text-blue-700 transition-colors">
                            {debt.clientName || '-'}
                          </span>
                          {debt.isRecentlyUpdated && (
                            <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-[8px] h-3 px-1">
                              Mis à jour
                            </Badge>
                          )}
                        </div>
                        {debt.lastImportDate && (
                          <span className="text-[9px] text-gray-400 font-normal">
                            Importé le {new Date(debt.lastImportDate).toLocaleString('fr-FR', { 
                              day: '2-digit', 
                              month: '2-digit', 
                              year: '2-digit', 
                              hour: '2-digit', 
                              minute: '2-digit' 
                            })}
                          </span>
                        )}
                      </div>
                    </div>
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
                    {debt.amount.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} TND
                  </TableCell>
                  <TableCell className="text-right text-green-600">
                    {(debt.settlement || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} TND
                  </TableCell>
                  <TableCell className="text-right font-bold text-red-600">
                    {debt.balance.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} TND
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
