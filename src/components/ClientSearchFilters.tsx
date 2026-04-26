'use client';

import { useState, useMemo, useEffect, ChangeEvent } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { 
  Search, 
  Filter, 
  X, 
  ChevronDown, 
  ChevronUp,
  Phone,
  User,
  FileText,
  DollarSign,
  Clock,
  Building2,
  SortAsc,
  SortDesc
} from 'lucide-react';
import { ClientDebt } from '@/types/debt';

interface FilterState {
  searchTerm: string;
  clientCode: string;
  phone: string;
  documentNumber: string;
  commercial: string;
  minAmount: string;
  maxAmount: string;
  minAge: string;
  maxAge: string;
  riskLevels: string[];
  sortBy: 'name' | 'amount' | 'age' | 'balance';
  sortOrder: 'asc' | 'desc';
}

interface ClientSearchFiltersProps {
  debts: ClientDebt[];
  onFilterChange: (filteredDebts: ClientDebt[]) => void;
}

export function ClientSearchFilters({ debts, onFilterChange }: ClientSearchFiltersProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [filters, setFilters] = useState<FilterState>({
    searchTerm: '',
    clientCode: '',
    phone: '',
    documentNumber: '',
    commercial: '',
    minAmount: '',
    maxAmount: '',
    minAge: '',
    maxAge: '',
    riskLevels: [],
    sortBy: 'name',
    sortOrder: 'asc'
  });

  // Extract unique commercials for dropdown
  const commercials = useMemo(() => {
    const uniqueCommerciaux = new Set<string>();
    debts.forEach(d => {
      if (d.commercialName) uniqueCommerciaux.add(d.commercialName);
    });
    return Array.from(uniqueCommerciaux).sort();
  }, [debts]);

  // Apply filters
  const filteredDebts = useMemo(() => {
    let result = debts.filter(debt => {
      // Text search
      const searchLower = filters.searchTerm.toLowerCase();
      const matchesSearch = !filters.searchTerm || 
        (debt.clientName?.toLowerCase().includes(searchLower)) ||
        (debt.clientCode?.toLowerCase().includes(searchLower)) ||
        (debt.documentNumber?.toLowerCase().includes(searchLower)) ||
        (debt.commercialName?.toLowerCase().includes(searchLower));

      // Specific filters
      const matchesCode = !filters.clientCode || 
        debt.clientCode?.toLowerCase().includes(filters.clientCode.toLowerCase());
      
      const matchesPhone = !filters.phone || 
        debt.clientPhone?.includes(filters.phone);
      
      const matchesDoc = !filters.documentNumber || 
        debt.documentNumber?.toLowerCase().includes(filters.documentNumber.toLowerCase());
      
      const matchesCommercial = !filters.commercial || 
        debt.commercialName === filters.commercial;

      // Amount filters
      const matchesMinAmount = !filters.minAmount || debt.balance >= parseFloat(filters.minAmount);
      const matchesMaxAmount = !filters.maxAmount || debt.balance <= parseFloat(filters.maxAmount);

      // Age filters
      const matchesMinAge = !filters.minAge || debt.age >= parseInt(filters.minAge);
      const matchesMaxAge = !filters.maxAge || debt.age <= parseInt(filters.maxAge);

      // Risk filter
      const matchesRisk = filters.riskLevels.length === 0 || 
        filters.riskLevels.includes(debt.riskLevel);

      return matchesSearch && matchesCode && matchesPhone && matchesDoc && 
             matchesCommercial && matchesMinAmount && matchesMaxAmount &&
             matchesMinAge && matchesMaxAge && matchesRisk;
    });

    // Sort
    result.sort((a, b) => {
      let comparison = 0;
      switch (filters.sortBy) {
        case 'name':
          comparison = (a.clientName || '').localeCompare(b.clientName || '');
          break;
        case 'amount':
          comparison = a.amount - b.amount;
          break;
        case 'age':
          comparison = a.age - b.age;
          break;
        case 'balance':
          comparison = a.balance - b.balance;
          break;
      }
      return filters.sortOrder === 'asc' ? comparison : -comparison;
    });

    return result;
  }, [debts, filters]);

  // Notify parent of filter changes
  useEffect(() => {
    onFilterChange(filteredDebts);
  }, [filteredDebts, onFilterChange]);

  const updateFilter = <K extends keyof FilterState>(key: K, value: FilterState[K]) => {
    setFilters((prev: FilterState) => ({ ...prev, [key]: value }));
  };

  const toggleRiskLevel = (risk: string) => {
    setFilters((prev: FilterState) => ({
      ...prev,
      riskLevels: prev.riskLevels.includes(risk)
        ? prev.riskLevels.filter((r: string) => r !== risk)
        : [...prev.riskLevels, risk]
    }));
  };

  const clearAllFilters = () => {
    setFilters({
      searchTerm: '',
      clientCode: '',
      phone: '',
      documentNumber: '',
      commercial: '',
      minAmount: '',
      maxAmount: '',
      minAge: '',
      maxAge: '',
      riskLevels: [],
      sortBy: 'name',
      sortOrder: 'asc'
    });
  };

  const activeFiltersCount = [
    filters.searchTerm,
    filters.clientCode,
    filters.phone,
    filters.documentNumber,
    filters.commercial,
    filters.minAmount,
    filters.maxAmount,
    filters.minAge,
    filters.maxAge
  ].filter(Boolean).length + filters.riskLevels.length;

  const quickFilters = [
    { label: 'Tous', count: debts.length, risk: null },
    { label: 'Critiques', count: debts.filter(d => d.riskLevel === 'critical').length, risk: 'critical', color: 'bg-red-100 text-red-800' },
    { label: 'En retard', count: debts.filter(d => d.riskLevel === 'overdue').length, risk: 'overdue', color: 'bg-orange-100 text-orange-800' },
    { label: 'À surveiller', count: debts.filter(d => d.riskLevel === 'monitoring').length, risk: 'monitoring', color: 'bg-yellow-100 text-yellow-800' },
    { label: 'Sains', count: debts.filter(d => d.riskLevel === 'healthy').length, risk: 'healthy', color: 'bg-green-100 text-green-800' }
  ];

  return (
    <Card className="mb-6">
      <CardContent className="p-4 space-y-4">
        {/* Quick Stats & Filters - Garder uniquement les badges de risque */}
        <div className="flex flex-wrap gap-2">
          {quickFilters.map((filter) => (
            <Button
              key={filter.label}
              variant={filter.risk && filters.riskLevels.includes(filter.risk) ? 'default' : 'outline'}
              size="sm"
              onClick={() => filter.risk && toggleRiskLevel(filter.risk)}
              className={`h-8 ${filter.risk && filters.riskLevels.includes(filter.risk) && filter.color ? filter.color : ''}`}
            >
              {filter.label}
              <Badge variant="secondary" className="ml-2 text-xs">
                {filter.count}
              </Badge>
            </Button>
          ))}
        </div>

        {/* Filtres avancés toggle uniquement - sans recherche principale */}
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="gap-2"
          >
            <Filter className="h-4 w-4" />
            Filtres avancés
            {activeFiltersCount > 0 && (
              <Badge variant="default" className="ml-1">{activeFiltersCount}</Badge>
            )}
            {showAdvanced ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
          {activeFiltersCount > 0 && (
            <Button variant="ghost" onClick={clearAllFilters} className="gap-2">
              <X className="h-4 w-4" />
              Effacer
            </Button>
          )}
        </div>

        {/* Advanced Filters */}
        {showAdvanced && (
          <div className="border-t pt-4 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
              {/* Client Code */}
              <div className="relative">
                <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Code client"
                  value={filters.clientCode}
                  onChange={(e) => updateFilter('clientCode', e.target.value)}
                  className="pl-10"
                />
              </div>

              {/* Phone */}
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Téléphone"
                  value={filters.phone}
                  onChange={(e) => updateFilter('phone', e.target.value)}
                  className="pl-10"
                />
              </div>

              {/* Document Number */}
              <div className="relative">
                <FileText className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="N° pièce"
                  value={filters.documentNumber}
                  onChange={(e) => updateFilter('documentNumber', e.target.value)}
                  className="pl-10"
                />
              </div>

              {/* Commercial */}
              <div className="relative">
                <Building2 className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <select
                  value={filters.commercial}
                  onChange={(e) => updateFilter('commercial', e.target.value)}
                  className="w-full h-10 pl-10 pr-3 rounded-md border border-input bg-background text-sm"
                >
                  <option value="">Tous les commerciaux</option>
                  {commercials.map(com => (
                    <option key={com} value={com}>{com}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
              {/* Amount Range */}
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Solde min"
                    type="number"
                    value={filters.minAmount}
                    onChange={(e) => updateFilter('minAmount', e.target.value)}
                    className="pl-10"
                  />
                </div>
                <div className="relative flex-1">
                  <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Solde max"
                    type="number"
                    value={filters.maxAmount}
                    onChange={(e) => updateFilter('maxAmount', e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              {/* Age Range */}
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Clock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Âge min (jours)"
                    type="number"
                    value={filters.minAge}
                    onChange={(e) => updateFilter('minAge', e.target.value)}
                    className="pl-10"
                  />
                </div>
                <div className="relative flex-1">
                  <Clock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Âge max (jours)"
                    type="number"
                    value={filters.maxAge}
                    onChange={(e) => updateFilter('maxAge', e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              {/* Sort */}
              <div className="flex gap-2">
                <select
                  value={filters.sortBy}
                  onChange={(e) => updateFilter('sortBy', e.target.value as any)}
                  className="flex-1 h-10 px-3 rounded-md border border-input bg-background text-sm"
                >
                  <option value="name">Trier par nom</option>
                  <option value="amount">Trier par montant</option>
                  <option value="age">Trier par âge</option>
                  <option value="balance">Trier par solde</option>
                </select>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => updateFilter('sortOrder', filters.sortOrder === 'asc' ? 'desc' : 'asc')}
                >
                  {filters.sortOrder === 'asc' ? <SortAsc className="h-4 w-4" /> : <SortDesc className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            {/* Risk Level Badges */}
            <div className="flex flex-wrap gap-2 items-center">
              <span className="text-sm text-gray-500">Niveaux de risque:</span>
              {['healthy', 'monitoring', 'overdue', 'critical'].map((risk) => (
                <Badge
                  key={risk}
                  variant={filters.riskLevels.includes(risk) ? 'default' : 'outline'}
                  className={`cursor-pointer ${
                    risk === 'healthy' ? 'bg-green-100 text-green-800 hover:bg-green-200' :
                    risk === 'monitoring' ? 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200' :
                    risk === 'overdue' ? 'bg-orange-100 text-orange-800 hover:bg-orange-200' :
                    'bg-red-100 text-red-800 hover:bg-red-200'
                  }`}
                  onClick={() => toggleRiskLevel(risk)}
                >
                  {risk === 'healthy' ? 'Sain' :
                   risk === 'monitoring' ? 'Surveillance' :
                   risk === 'overdue' ? 'En retard' : 'Critique'}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Results count */}
        <div className="flex justify-between items-center text-sm text-gray-500 border-t pt-2">
          <span>
            <strong>{filteredDebts.length}</strong> créance{filteredDebts.length !== 1 ? 's' : ''} trouvée{filteredDebts.length !== 1 ? 's' : ''}
          </span>
          <span>
            Solde total: <strong className="text-red-600">{filteredDebts.reduce((sum, d) => sum + d.balance, 0).toFixed(2)} TND</strong>
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
