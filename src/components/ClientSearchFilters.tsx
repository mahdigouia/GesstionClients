'use client';

import { useState, useMemo } from 'react';
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
  SortDesc,
  CheckCircle2,
  XCircle
} from 'lucide-react';
import { ClientDebt } from '@/types/debt';

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
      sortBy: 'extraction',
      sortOrder: 'asc'
    });
  };

  // Pre-calculate counts for labels
  const contentieuxCount = useMemo(() => 
    debts.filter(d => Number(d.age || 0) > 365 && Number(d.balance || 0) > 0).length
  , [debts]);

  const retainedCount = useMemo(() => 
    debts.filter(d => {
      const upper = (d.documentNumber || '').toUpperCase();
      if (!upper.startsWith('FT') && !upper.startsWith('FS')) return false;
      const b = Number(d.balance || 0);
      const a = Number(d.amount || 0);
      if (b <= 0 || a <= 0) return false;
      const ratio = (b / a) * 100;
      return ratio >= 0.5 && ratio <= 1.5;
    }).length
  , [debts]);

  const partialCount = useMemo(() => 
    debts.filter(d => {
      const upper = (d.documentNumber || '').toUpperCase();
      if (!upper.startsWith('FT') && !upper.startsWith('FS')) return false;
      const b = Number(d.balance || 0);
      const a = Number(d.amount || 0);
      if (b <= 0 || a <= 0) return false;
      const ratio = (b / a) * 100;
      return ratio > 1.5 && ratio < 99;
    }).length
  , [debts]);

  const activeFiltersCount = [
    filters.clientCode, filters.phone, filters.documentNumber, filters.commercial,
    filters.docType, filters.minAmount, filters.maxAmount, filters.minAge, filters.maxAge,
    filters.riskLevels.length > 0 ? 'yes' : ''
  ].filter(Boolean).length;

  return (
    <Card className="mb-4 border-b border-gray-100 shadow-none bg-transparent">
      <CardContent className="p-4 space-y-4">
        {/* Global Search Bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
          <Input
            placeholder="Recherche globale (nom, code, pièce, commercial...)"
            value={filters.searchTerm}
            onChange={(e) => updateFilter('searchTerm', e.target.value)}
            className="pl-10 h-12 text-lg shadow-sm"
          />
        </div>

        {/* Tristate Filters - Toujours visibles */}
        <div className="flex flex-wrap gap-2 items-center pt-2 border-t border-gray-100">
          {/* Contentieux Filter */}
          <Badge
            variant={filters.contentieuxFilter === 'off' ? 'secondary' : filters.contentieuxFilter === 'include' ? 'default' : 'destructive'}
            className={`cursor-pointer h-8 gap-2 px-3 text-xs font-bold transition-all ${
              filters.contentieuxFilter === 'include' ? 'bg-emerald-500 hover:bg-emerald-600' : 
              filters.contentieuxFilter === 'exclude' ? 'bg-red-500 hover:bg-red-600' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
            onClick={() => cycleTristate('contentieuxFilter')}
          >
            {filters.contentieuxFilter === 'off' ? (
              <>⚖️ Contentieux</>
            ) : filters.contentieuxFilter === 'include' ? (
              <><CheckCircle2 className="h-4 w-4" /> Contentieux ({contentieuxCount})</>
            ) : (
              <><XCircle className="h-4 w-4" /> Non Contentieux ({debts.length - contentieuxCount})</>
            )}
          </Badge>

          {/* Retained Filter */}
          <Badge
            variant={filters.retainedFilter === 'off' ? 'secondary' : filters.retainedFilter === 'include' ? 'default' : 'destructive'}
            className={`cursor-pointer h-8 gap-2 px-3 text-xs font-bold transition-all ${
              filters.retainedFilter === 'include' ? 'bg-emerald-500 hover:bg-emerald-600' : 
              filters.retainedFilter === 'exclude' ? 'bg-red-500 hover:bg-red-600' : 'bg-purple-50 text-purple-700 hover:bg-purple-100'
            }`}
            onClick={() => cycleTristate('retainedFilter')}
          >
            {filters.retainedFilter === 'off' ? (
              <>🛡️ Retenue</>
            ) : filters.retainedFilter === 'include' ? (
              <><CheckCircle2 className="h-4 w-4" /> Retenue ({retainedCount})</>
            ) : (
              <><XCircle className="h-4 w-4" /> Hors Retenue ({debts.length - retainedCount})</>
            )}
          </Badge>

          {/* Partial Filter */}
          <Badge
            variant={filters.partialFilter === 'off' ? 'secondary' : filters.partialFilter === 'include' ? 'default' : 'destructive'}
            className={`cursor-pointer h-8 gap-2 px-3 text-xs font-bold transition-all ${
              filters.partialFilter === 'include' ? 'bg-emerald-500 hover:bg-emerald-600' : 
              filters.partialFilter === 'exclude' ? 'bg-red-500 hover:bg-red-600' : 'bg-orange-50 text-orange-700 hover:bg-orange-100'
            }`}
            onClick={() => cycleTristate('partialFilter')}
          >
            {filters.partialFilter === 'off' ? (
              <>💳 Partiel</>
            ) : filters.partialFilter === 'include' ? (
              <><CheckCircle2 className="h-4 w-4" /> Partiel ({partialCount})</>
            ) : (
              <><XCircle className="h-4 w-4" /> Hors Partiel ({debts.length - partialCount})</>
            )}
          </Badge>
        </div>

        {/* Advanced Toggle */}
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
          {(activeFiltersCount > 0 || filters.searchTerm) && (
            <Button variant="ghost" onClick={clearAllFilters} className="gap-2">
              <X className="h-4 w-4" />
              Effacer tout
            </Button>
          )}
        </div>

        {/* Advanced Filters Panel */}
        {showAdvanced && (
          <div className="border-t pt-4 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="relative">
                <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Code client"
                  value={filters.clientCode}
                  onChange={(e) => updateFilter('clientCode', e.target.value)}
                  className="pl-10"
                />
              </div>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Téléphone"
                  value={filters.phone}
                  onChange={(e) => updateFilter('phone', e.target.value)}
                  className="pl-10"
                />
              </div>
              <div className="relative">
                <FileText className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="N° pièce"
                  value={filters.documentNumber}
                  onChange={(e) => updateFilter('documentNumber', e.target.value)}
                  className="pl-10"
                />
              </div>
              <div className="relative">
                <Building2 className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <select
                  className="w-full h-10 pl-10 pr-4 rounded-md border border-input bg-background text-sm appearance-none"
                  value={filters.commercial}
                  onChange={(e) => updateFilter('commercial', e.target.value)}
                >
                  <option value="">Tous les commerciaux</option>
                  {commercials.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="relative">
                <FileText className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <select
                  className="w-full h-10 pl-10 pr-4 rounded-md border border-input bg-background text-sm appearance-none"
                  value={filters.docType}
                  onChange={(e) => updateFilter('docType', e.target.value)}
                >
                  <option value="">Tous les types</option>
                  {docTypes.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Min"
                    type="number"
                    value={filters.minAmount}
                    onChange={(e) => updateFilter('minAmount', e.target.value)}
                    className="pl-10"
                  />
                </div>
                <div className="relative flex-1">
                  <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Max"
                    type="number"
                    value={filters.maxAmount}
                    onChange={(e) => updateFilter('maxAmount', e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Clock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Âge min"
                    type="number"
                    value={filters.minAge}
                    onChange={(e) => updateFilter('minAge', e.target.value)}
                    className="pl-10"
                  />
                </div>
                <div className="relative flex-1">
                  <Clock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Âge max"
                    type="number"
                    value={filters.maxAge}
                    onChange={(e) => updateFilter('maxAge', e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <select
                  value={filters.sortBy}
                  onChange={(e) => updateFilter('sortBy', e.target.value as any)}
                  className="flex-1 h-10 px-3 rounded-md border border-input bg-background text-sm"
                >
                  <option value="extraction">Ordre Document</option>
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

            <div className="flex flex-wrap gap-2 items-center">
              <span className="text-sm text-gray-500">Risque:</span>
              {['healthy', 'monitoring', 'overdue', 'critical'].map((risk) => (
                <Badge
                  key={risk}
                  variant={filters.riskLevels.includes(risk) ? 'default' : 'outline'}
                  className="cursor-pointer"
                  onClick={() => toggleRiskLevel(risk)}
                >
                  {risk === 'healthy' ? 'Sain' : risk === 'monitoring' ? 'Surv.' : risk === 'overdue' ? 'Retard' : 'Critique'}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
