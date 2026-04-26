'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { 
  Search, 
  Filter, 
  AlertTriangle, 
  Clock, 
  Users, 
  CheckCircle2,
  FileText,
  ArrowRight
} from 'lucide-react';
import { ClientDebt } from '@/types/debt';
import { useState } from 'react';

interface QuickFiltersProps {
  debts: ClientDebt[];
  onFilterChange: (filteredDebts: ClientDebt[], activeFilter: string) => void;
  onNavigateToDetail: () => void;
}

export function QuickFilters({ debts, onFilterChange, onNavigateToDetail }: QuickFiltersProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');

  const quickStats = [
    { 
      id: 'all', 
      label: 'Toutes', 
      count: debts.length,
      icon: FileText,
      color: 'bg-blue-500',
      bgColor: 'bg-blue-50',
      textColor: 'text-blue-700'
    },
    { 
      id: 'critical', 
      label: 'Critiques', 
      count: debts.filter(d => d.riskLevel === 'critical').length,
      icon: AlertTriangle,
      color: 'bg-red-500',
      bgColor: 'bg-red-50',
      textColor: 'text-red-700'
    },
    { 
      id: 'overdue', 
      label: 'En retard', 
      count: debts.filter(d => d.riskLevel === 'overdue').length,
      icon: Clock,
      color: 'bg-orange-500',
      bgColor: 'bg-orange-50',
      textColor: 'text-orange-700'
    },
    { 
      id: 'monitoring', 
      label: 'À surveiller', 
      count: debts.filter(d => d.riskLevel === 'monitoring').length,
      icon: Users,
      color: 'bg-yellow-500',
      bgColor: 'bg-yellow-50',
      textColor: 'text-yellow-700'
    },
    { 
      id: 'healthy', 
      label: 'Saines', 
      count: debts.filter(d => d.riskLevel === 'healthy').length,
      icon: CheckCircle2,
      color: 'bg-green-500',
      bgColor: 'bg-green-50',
      textColor: 'text-green-700'
    }
  ];

  const handleFilterClick = (filterId: string) => {
    setActiveFilter(filterId);
    
    let filtered = debts;
    if (filterId !== 'all') {
      filtered = debts.filter(d => d.riskLevel === filterId);
    }
    
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(d => 
        (d.clientName || '').toLowerCase().includes(searchLower) ||
        (d.clientCode || '').toLowerCase().includes(searchLower) ||
        (d.documentNumber || '').toLowerCase().includes(searchLower)
      );
    }
    
    onFilterChange(filtered, filterId);
  };

  const handleSearch = (value: string) => {
    setSearchTerm(value);
    
    let filtered = debts;
    if (activeFilter !== 'all') {
      filtered = debts.filter(d => d.riskLevel === activeFilter);
    }
    
    if (value) {
      const searchLower = value.toLowerCase();
      filtered = filtered.filter(d => 
        (d.clientName || '').toLowerCase().includes(searchLower) ||
        (d.clientCode || '').toLowerCase().includes(searchLower) ||
        (d.documentNumber || '').toLowerCase().includes(searchLower)
      );
    }
    
    onFilterChange(filtered, activeFilter);
  };

  const totalBalance = debts.reduce((sum, d) => sum + d.balance, 0);
  const filteredBalance = quickStats.find(s => s.id === activeFilter)?.count || 0;

  return (
    <Card className="mb-6 border-2 shadow-lg">
      <CardContent className="p-6">
        {/* Header with title and view button */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Filter className="h-5 w-5 text-blue-600" />
            <h3 className="text-lg font-semibold">Filtres Rapides</h3>
          </div>
          <Button 
            variant="outline" 
            size="sm"
            onClick={onNavigateToDetail}
            className="gap-2"
          >
            Voir le tableau détaillé
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>

        {/* Search bar */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Rechercher un client, code, ou N° pièce..."
            value={searchTerm}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleSearch(e.target.value)}
            className="pl-10 h-12 text-base"
          />
        </div>

        {/* Quick filter cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
          {quickStats.map((stat) => {
            const Icon = stat.icon;
            const isActive = activeFilter === stat.id;
            
            return (
              <button
                key={stat.id}
                onClick={() => handleFilterClick(stat.id)}
                className={`
                  relative p-4 rounded-xl border-2 transition-all duration-200 text-left
                  ${isActive 
                    ? `${stat.bgColor} border-current ${stat.textColor} shadow-md scale-105` 
                    : 'bg-white border-gray-200 hover:border-gray-300 hover:shadow-sm'
                  }
                `}
              >
                <div className="flex items-start justify-between">
                  <div className={`p-2 rounded-lg ${stat.color} text-white`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  {isActive && (
                    <Badge variant="outline" className={`${stat.bgColor} ${stat.textColor} border-current`}>
                      Actif
                    </Badge>
                  )}
                </div>
                <div className="mt-3">
                  <div className={`text-2xl font-bold ${isActive ? stat.textColor : 'text-gray-900'}`}>
                    {stat.count}
                  </div>
                  <div className={`text-sm ${isActive ? stat.textColor : 'text-gray-500'}`}>
                    {stat.label}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Summary */}
        <div className="flex items-center justify-between pt-4 border-t">
          <div className="text-sm text-gray-500">
            <span className="font-medium">{filteredBalance}</span> créances sélectionnées
          </div>
          <div className="text-right">
            <span className="text-sm text-gray-500">Solde total filtré: </span>
            <span className="text-lg font-bold text-red-600">
              {debts
                .filter(d => activeFilter === 'all' || d.riskLevel === activeFilter)
                .filter(d => {
                  if (!searchTerm) return true;
                  const searchLower = searchTerm.toLowerCase();
                  return (d.clientName || '').toLowerCase().includes(searchLower) ||
                         (d.clientCode || '').toLowerCase().includes(searchLower) ||
                         (d.documentNumber || '').toLowerCase().includes(searchLower);
                })
                .reduce((sum, d) => sum + d.balance, 0)
                .toFixed(2)} TND
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
