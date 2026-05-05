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
import { ExportService } from '@/lib/export';
import { FileSpreadsheet, FileText as FilePdf } from 'lucide-react';

interface DebtTableProps {
  debts: ClientDebt[];
  onExport?: (debts: ClientDebt[]) => void;
  onClientClick?: (clientName: string) => void;
  onQuickAction?: (clientName: string) => void;
}

export function DebtTable({ debts, onExport, onClientClick, onQuickAction }: DebtTableProps) {
  // State for all filters moved here for single source of truth
  const [filters, setFilters] = useState({
    searchTerm: '',
    clientCode: '',
    phone: '',
    documentNumber: '',
    commercial: '',
    docType: '',
    minAmount: '',
    maxAmount: '',
    minAge: '',
    maxAge: '',
    riskLevels: [] as string[],
    sortBy: 'age',
    sortOrder: 'desc' as 'asc' | 'desc',
    contentieuxFilter: 'off' as 'off' | 'include' | 'exclude',
    retainedFilter: 'off' as 'off' | 'include' | 'exclude',
    partialFilter: 'off' as 'off' | 'include' | 'exclude',
  });

  const [selectedClient, setSelectedClient] = useState<string>('');
  const [clientSearchValue, setClientSearchValue] = useState<string>('');
  
  // Helpers for specific business rules - EXTREMELY DEFENSIVE
  const parseNumeric = (val: any) => {
    if (typeof val === 'number') return val;
    if (!val) return 0;
    const cleaned = String(val).replace(/[^-0-9.]/g, '');
    return parseFloat(cleaned) || 0;
  };

  const checkContentieux = useCallback((d: ClientDebt) => {
    const age = parseNumeric(d.age);
    const balance = parseNumeric(d.balance);
    return age > 365 && balance > 0;
  }, []);
  
  const checkRetained = useCallback((d: ClientDebt) => {
    const upper = (d.documentNumber || '').toUpperCase();
    if (!upper.startsWith('FT') && !upper.startsWith('FS')) return false;
    const b = parseNumeric(d.balance);
    const a = parseNumeric(d.amount);
    if (b <= 0 || a <= 0) return false;
    const ratio = (b / a) * 100;
    return ratio >= 0.5 && ratio <= 1.5;
  }, []);

  const checkPartial = useCallback((d: ClientDebt) => {
    const upper = (d.documentNumber || '').toUpperCase();
    if (!upper.startsWith('FT') && !upper.startsWith('FS')) return false;
    const b = parseNumeric(d.balance);
    const a = parseNumeric(d.amount);
    if (b <= 0 || a <= 0) return false;
    const ratio = (b / a) * 100;
    return ratio > 1.5 && ratio < 99;
  }, []);

  // Main filtering logic - THE SINGLE SOURCE OF TRUTH
  const filteredDebts = useMemo(() => {
    let result = debts.filter(debt => {
      // 1. Tristate Filters - APPLY FIRST AS THEY ARE THE MOST STRICT
      if (filters.contentieuxFilter !== 'off') {
        const isC = checkContentieux(debt);
        if (filters.contentieuxFilter === 'include' && !isC) return false;
        if (filters.contentieuxFilter === 'exclude' && isC) return false;
      }
      if (filters.retainedFilter !== 'off') {
        const isR = checkRetained(debt);
        if (filters.retainedFilter === 'include' && !isR) return false;
        if (filters.retainedFilter === 'exclude' && isR) return false;
      }
      if (filters.partialFilter !== 'off') {
        const isP = checkPartial(debt);
        if (filters.partialFilter === 'include' && !isP) return false;
        if (filters.partialFilter === 'exclude' && isP) return false;
      }

      // 2. Text Search (Global)
      if (filters.searchTerm) {
        const s = filters.searchTerm.toLowerCase();
        const match = 
          (debt.clientName || '').toLowerCase().includes(s) ||
          (debt.clientCode || '').toLowerCase().includes(s) ||
          (debt.documentNumber || '').toLowerCase().includes(s) ||
          (debt.commercialName || '').toLowerCase().includes(s);
        if (!match) return false;
      }

      // 3. Client Autocomplete Filter
      if (selectedClient) {
        if ((debt.clientName || '').toLowerCase() !== selectedClient.toLowerCase()) return false;
      }

      // 4. Field Specific Filters
      if (filters.clientCode && !(debt.clientCode || '').toLowerCase().includes(filters.clientCode.toLowerCase())) return false;
      if (filters.phone && !(debt.clientPhone || '').includes(filters.phone)) return false;
      if (filters.documentNumber && !(debt.documentNumber || '').toLowerCase().includes(filters.documentNumber.toLowerCase())) return false;
      if (filters.commercial && debt.commercialName !== filters.commercial) return false;
      if (filters.docType && !(debt.documentNumber || '').toUpperCase().startsWith(filters.docType)) return false;

      // 5. Numeric Filters
      const balance = parseNumeric(debt.balance);
      const age = parseNumeric(debt.age);
      if (filters.minAmount && balance < parseFloat(filters.minAmount)) return false;
      if (filters.maxAmount && balance > parseFloat(filters.maxAmount)) return false;
      if (filters.minAge && age < parseInt(filters.minAge)) return false;
      if (filters.maxAge && age > parseInt(filters.maxAge)) return false;

      // 6. Risk Level
      if (filters.riskLevels.length > 0 && !filters.riskLevels.includes(debt.riskLevel)) return false;

      return true;
    });

    // Sorting
    result.sort((a, b) => {
      let comparison = 0;
      switch (filters.sortBy) {
        case 'name': comparison = (a.clientName || '').localeCompare(b.clientName || ''); break;
        case 'amount': comparison = Number(a.amount || 0) - Number(b.amount || 0); break;
        case 'age': comparison = Number(a.age || 0) - Number(b.age || 0); break;
        case 'balance': comparison = Number(a.balance || 0) - Number(b.balance || 0); break;
      }
      return filters.sortOrder === 'asc' ? comparison : -comparison;
    });

    return result;
  }, [debts, filters, selectedClient, checkContentieux, checkRetained, checkPartial]);

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
      <ClientSearchFilters 
        debts={debts} 
        filters={filters} 
        onFiltersChange={setFilters} 
      />
      
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle>Liste des Créances ({filteredDebts.length})</CardTitle>
          <div className="flex space-x-2">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => ExportService.exportToExcel(filteredDebts)}
              className="bg-emerald-50 hover:bg-emerald-100 border-emerald-200 text-emerald-700"
            >
              <FileSpreadsheet className="h-4 w-4 mr-2" />
              Excel
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => {
                const activeLabels = [];
                if (filters.contentieuxFilter === 'include') activeLabels.push('Contentieux');
                if (filters.retainedFilter === 'include') activeLabels.push('Retenue');
                if (filters.partialFilter === 'include') activeLabels.push('Partiel');
                if (selectedClient) activeLabels.push(`Client: ${selectedClient}`);
                
                ExportService.exportFilteredToPDF(
                  filteredDebts, 
                  "Rapport des Créances", 
                  activeLabels.length > 0 ? activeLabels.join(' + ') : 'Aucun filtre'
                );
              }}
              className="bg-red-50 hover:bg-red-100 border-red-200 text-red-700"
            >
              <FilePdf className="h-4 w-4 mr-2" />
              PDF
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
