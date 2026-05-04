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
  docType: string;
  minAmount: string;
  maxAmount: string;
  minAge: string;
  maxAge: string;
  riskLevels: string[];
  retainedFilter: 'off' | 'include' | 'exclude';
  partialFilter: 'off' | 'include' | 'exclude';
  contentieuxFilter: 'off' | 'include' | 'exclude';
  sortBy: 'name' | 'amount' | 'age' | 'balance';
  sortOrder: 'asc' | 'desc';
}

interface ClientSearchFiltersProps {
  debts: ClientDebt[];
  filters: any;
  onFiltersChange: (filters: any) => void;
}

export function ClientSearchFilters({ debts, filters, onFiltersChange }: ClientSearchFiltersProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Extract unique commercials for dropdown
  const commercials = useMemo(() => {
    const uniqueCommerciaux = new Set<string>();
    debts.forEach(d => {
      if (d.commercialName) uniqueCommerciaux.add(d.commercialName);
    });
    return Array.from(uniqueCommerciaux).sort();
  }, [debts]);

  // Extract unique document type prefixes for dropdown
  const docTypes = useMemo(() => {
    const uniqueTypes = new Set<string>();
    debts.forEach(d => {
      const prefix = (d.documentNumber || '').match(/^[A-Z]+/i);
      if (prefix) uniqueTypes.add(prefix[0].toUpperCase());
    });
    return Array.from(uniqueTypes).sort();
  }, [debts]);

  const updateFilter = (key: string, value: any) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  const toggleRiskLevel = (risk: string) => {
    const nextRiskLevels = filters.riskLevels.includes(risk)
      ? filters.riskLevels.filter((r: string) => r !== risk)
      : [...filters.riskLevels, risk];
    onFiltersChange({ ...filters, riskLevels: nextRiskLevels });
  };

  const cycleTristate = (field: 'retainedFilter' | 'partialFilter' | 'contentieuxFilter') => {
    const current = filters[field];
    const next = current === 'off' ? 'include' : current === 'include' ? 'exclude' : 'off';
    onFiltersChange({ ...filters, [field]: next });
  };

  const clearAllFilters = () => {
    onFiltersChange({
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
      riskLevels: [],
      retainedFilter: 'off',
      partialFilter: 'off',
      contentieuxFilter: 'off',
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
    filters.docType,
    filters.minAmount,
    filters.maxAmount,
    filters.minAge,
    filters.maxAge
  ].filter(Boolean).length + filters.riskLevels.length +
    (filters.retainedFilter !== 'off' ? 1 : 0) +
    (filters.partialFilter !== 'off' ? 1 : 0) +
    (filters.contentieuxFilter !== 'off' ? 1 : 0);

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

        {/* Tristate Filters - Toujours visibles pour accessibilité directe */}
        <div className="flex flex-wrap gap-2 items-center pt-2 border-t border-gray-100">
          <Badge
            variant="outline"
            className={`cursor-pointer transition-all ${
              filters.contentieuxFilter === 'include'
                ? 'bg-green-600 text-white hover:bg-green-700 border-green-600'
                : filters.contentieuxFilter === 'exclude'
                ? 'bg-red-600 text-white hover:bg-red-700 border-red-600'
                : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
            }`}
            onClick={() => cycleTristate('contentieuxFilter')}
          >
            ⚖️ Contentieux {filters.contentieuxFilter === 'include' ? '✓' : filters.contentieuxFilter === 'exclude' ? '✗' : ''} ({debts.filter(d => Number(d.age || 0) > 365 && Number(d.balance || 0) > 0).length})
          </Badge>
          <Badge
            variant="outline"
            className={`cursor-pointer transition-all ${
              filters.retainedFilter === 'include'
                ? 'bg-green-600 text-white hover:bg-green-700 border-green-600'
                : filters.retainedFilter === 'exclude'
                ? 'bg-red-600 text-white hover:bg-red-700 border-red-600'
                : 'bg-purple-100 text-purple-800 hover:bg-purple-200'
            }`}
            onClick={() => cycleTristate('retainedFilter')}
          >
            🛡️ Retenue {filters.retainedFilter === 'include' ? '✓' : filters.retainedFilter === 'exclude' ? '✗' : ''} ({debts.filter(d => {
              const upper = (d.documentNumber || '').toUpperCase();
              if (!upper.startsWith('FT') && !upper.startsWith('FS')) return false;
              if (Number(d.balance || 0) <= 0) return false;
              if (Number(d.amount || 0) <= 0) return false;
              const ratio = (Number(d.balance) / Number(d.amount)) * 100;
              return ratio >= 0.5 && ratio <= 1.5;
            }).length})
          </Badge>
          <Badge
            variant="outline"
            className={`cursor-pointer transition-all ${
              filters.partialFilter === 'include'
                ? 'bg-green-600 text-white hover:bg-green-700 border-green-600'
                : filters.partialFilter === 'exclude'
                ? 'bg-red-600 text-white hover:bg-red-700 border-red-600'
                : 'bg-orange-100 text-orange-800 hover:bg-orange-200'
            }`}
            onClick={() => cycleTristate('partialFilter')}
          >
            💳 Partiel {filters.partialFilter === 'include' ? '✓' : filters.partialFilter === 'exclude' ? '✗' : ''} ({debts.filter(d => {
              const upper = (d.documentNumber || '').toUpperCase();
              if (!upper.startsWith('FT') && !upper.startsWith('FS')) return false;
              if (Number(d.balance || 0) <= 0) return false;
              if (Number(d.amount || 0) <= 0) return false;
              const ratio = (Number(d.balance) / Number(d.amount)) * 100;
              return ratio > 1.5 && ratio < 99;
            }).length})
          </Badge>
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

              {/* Document Type */}
              <div className="relative">
                <FileText className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <select
                  value={filters.docType}
                  onChange={(e) => updateFilter('docType', e.target.value)}
                  className="w-full h-10 pl-10 pr-3 rounded-md border border-input bg-background text-sm"
                >
                  <option value="">Tous les types</option>
                  {docTypes.map(type => (
                    <option key={type} value={type}>{type}</option>
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
            {/* Note: In controlled mode, we use the debts count passed from parent if needed, 
                but usually DebtTable shows its own count. Keeping it simple here. */}
            Filtres actifs
          </span>
          <span>
            Détail des créances
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
