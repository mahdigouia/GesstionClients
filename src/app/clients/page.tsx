'use client';

import { useState, useMemo } from 'react';
import { useDebtContext } from '@/lib/DebtContext';
import { Sidebar } from '@/components/Sidebar';
import {
  Users,
  Phone,
  Search,
  ChevronDown,
  ChevronRight,
  FileText,
  Expand,
  Shrink
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import { AnalysisService } from '@/lib/analysis';
import { ClientDebt } from '@/types/debt';

const riskBadgeColors: Record<string, string> = {
  healthy: 'bg-green-100 text-green-800 border-green-200',
  monitoring: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  overdue: 'bg-orange-100 text-orange-800 border-orange-200',
  critical: 'bg-red-100 text-red-800 border-red-200'
};

export default function ClientsPage() {
  const { debts, analysis } = useDebtContext();
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedClients, setExpandedClients] = useState<Set<string>>(new Set());

  // Group debts by client name
  const clientsMap = useMemo(() => {
    const map = new Map<string, ClientDebt[]>();
    for (const debt of debts) {
      const name = debt.clientName || 'Client inconnu';
      if (!map.has(name)) map.set(name, []);
      map.get(name)!.push(debt);
    }
    return map;
  }, [debts]);

  // Filtered client names
  const filteredClientNames = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return Array.from(clientsMap.keys()).sort();
    return Array.from(clientsMap.keys()).filter(name => {
      const clientDebts = clientsMap.get(name) || [];
      const matchName = name.toLowerCase().includes(term);
      const matchCode = clientDebts.some(d => (d.clientCode || '').toLowerCase().includes(term));
      const matchPhone = clientDebts.some(d => (d.clientPhone || '').toLowerCase().includes(term));
      return matchName || matchCode || matchPhone;
    }).sort();
  }, [clientsMap, searchTerm]);

  // Toggle expand/collapse for one client
  const toggleClient = (name: string) => {
    setExpandedClients(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  // Expand all / Collapse all
  const expandAll = () => setExpandedClients(new Set(filteredClientNames));
  const collapseAll = () => setExpandedClients(new Set());

  const allExpanded = filteredClientNames.length > 0 && expandedClients.size === filteredClientNames.length;

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      <div className="flex-1 overflow-y-auto">
        {/* Header */}
        <header className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Users className="h-6 w-6 text-blue-600" />
              <h1 className="text-xl font-semibold text-gray-900">Clients</h1>
              <span className="text-sm text-gray-500">
                {filteredClientNames.length} client{filteredClientNames.length > 1 ? 's' : ''}
              </span>
            </div>
          </div>
        </header>

        <main className="p-6 space-y-6">
          {debts.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <Users className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">Aucun client</h3>
                <p className="text-sm text-gray-600">Importez des fichiers depuis le Dashboard pour voir les clients</p>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Search bar + expand/collapse buttons */}
              <div className="flex items-center gap-3">
                <div className="relative flex-1 max-w-lg">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Rechercher un client par nom, code, téléphone..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-full"
                  />
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={allExpanded ? collapseAll : expandAll}
                  className="gap-1.5"
                >
                  {allExpanded ? <Shrink className="h-4 w-4" /> : <Expand className="h-4 w-4" />}
                  {allExpanded ? 'Tout replier' : 'Tout déplier'}
                </Button>
              </div>

              {/* Clients list */}
              <div className="space-y-4">
                {filteredClientNames.map(clientName => {
                  const clientDebts = clientsMap.get(clientName) || [];
                  const isExpanded = expandedClients.has(clientName);

                  // Totaux
                  const totalAmount = clientDebts.reduce((s, d) => s + d.amount, 0);
                  const totalSettlement = clientDebts.reduce((s, d) => s + (d.settlement || 0), 0);
                  const totalBalance = clientDebts.reduce((s, d) => s + d.balance, 0);

                  // Risk level = worst among debts
                  const worstRisk: string = clientDebts.reduce((worst, d) => {
                    const order = ['healthy', 'monitoring', 'overdue', 'critical'];
                    return order.indexOf(d.riskLevel) > order.indexOf(worst) ? d.riskLevel : worst;
                  }, 'healthy' as string);

                  const firstDebt = clientDebts[0];

                  return (
                    <Card key={clientName} className="shadow-sm hover:shadow-md transition-shadow overflow-hidden">
                      {/* Client header — clickable */}
                      <div
                        className="p-4 cursor-pointer bg-white hover:bg-gray-50 transition-colors"
                        onClick={() => toggleClient(clientName)}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <div className="flex-shrink-0">
                              {isExpanded ? (
                                <ChevronDown className="h-5 w-5 text-gray-400" />
                              ) : (
                                <ChevronRight className="h-5 w-5 text-gray-400" />
                              )}
                            </div>

                            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                              <span className="text-sm font-bold text-blue-700">
                                {(clientName || '?').charAt(0).toUpperCase()}
                              </span>
                            </div>

                            <div>
                              <div className="flex items-center gap-2">
                                <h3 className="font-semibold text-gray-900">{clientName}</h3>
                                <Badge
                                  variant="outline"
                                  className={riskBadgeColors[worstRisk] || ''}
                                >
                                  {AnalysisService.getRiskLabel(worstRisk as any)}
                                </Badge>
                              </div>
                              <div className="flex items-center gap-4 text-sm text-gray-500 mt-0.5">
                                <span className="flex items-center gap-1">
                                  <FileText className="h-3.5 w-3.5" />
                                  {clientDebts.length} facture{clientDebts.length > 1 ? 's' : ''}
                                </span>
                                {firstDebt?.clientCode && (
                                  <span className="font-mono text-xs">Code: {firstDebt.clientCode}</span>
                                )}
                                {firstDebt?.clientPhone && (
                                  <span className="flex items-center gap-1">
                                    <Phone className="h-3.5 w-3.5" />
                                    {firstDebt.clientPhone}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Totaux mini-cards */}
                          <div className="flex items-center gap-3">
                            <div className="text-center px-3 py-2 bg-gray-50 rounded-lg border border-gray-100">
                              <div className="text-[10px] text-gray-500 font-medium uppercase tracking-wide">Facturé</div>
                              <div className="text-sm font-bold text-gray-800">
                                {totalAmount.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} TND
                              </div>
                            </div>
                            <div className="text-center px-3 py-2 bg-green-50 rounded-lg border border-green-100">
                              <div className="text-[10px] text-green-600 font-medium uppercase tracking-wide">Réglé</div>
                              <div className="text-sm font-bold text-green-700">
                                {totalSettlement.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} TND
                              </div>
                            </div>
                            <div className="text-center px-3 py-2 bg-red-50 rounded-lg border border-red-100">
                              <div className="text-[10px] text-red-500 font-medium uppercase tracking-wide">Solde</div>
                              <div className="text-sm font-bold text-red-600">
                                {totalBalance.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} TND
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Expanded table */}
                      {isExpanded && (
                        <div className="border-t border-gray-100">
                          <div className="overflow-x-auto">
                            <Table>
                              <TableHeader>
                                <TableRow className="bg-gray-50/50">
                                  <TableHead className="text-xs">N° Pièce</TableHead>
                                  <TableHead className="text-xs">Description</TableHead>
                                  <TableHead className="text-xs">Date</TableHead>
                                  <TableHead className="text-xs">Échéance</TableHead>
                                  <TableHead className="text-xs text-right">Montant</TableHead>
                                  <TableHead className="text-xs text-right">Règlement</TableHead>
                                  <TableHead className="text-xs text-right">Solde</TableHead>
                                  <TableHead className="text-xs text-center">Âge</TableHead>
                                  <TableHead className="text-xs text-center">J.P</TableHead>
                                  <TableHead className="text-xs text-center">Risque</TableHead>
                                  <TableHead className="text-xs text-center">Source</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {clientDebts.map((debt) => (
                                  <TableRow
                                    key={debt.id}
                                    className="hover:bg-blue-50/50 transition-colors"
                                  >
                                    <TableCell className="font-mono text-xs py-2">
                                      {debt.documentNumber || '-'}
                                    </TableCell>
                                    <TableCell className="text-xs max-w-[200px] truncate py-2" title={debt.description}>
                                      {debt.description}
                                    </TableCell>
                                    <TableCell className="text-xs py-2">
                                      {debt.documentDate && !isNaN(new Date(debt.documentDate).getTime())
                                        ? new Date(debt.documentDate).toLocaleDateString('fr-FR')
                                        : '-'}
                                    </TableCell>
                                    <TableCell className="text-xs py-2">
                                      {debt.dueDate && !isNaN(new Date(debt.dueDate).getTime())
                                        ? new Date(debt.dueDate).toLocaleDateString('fr-FR')
                                        : '-'}
                                    </TableCell>
                                    <TableCell className="text-xs text-right font-medium py-2">
                                      {debt.amount.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} TND
                                    </TableCell>
                                    <TableCell className="text-xs text-right text-green-600 py-2">
                                      {(debt.settlement || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} TND
                                    </TableCell>
                                    <TableCell className="text-xs text-right font-bold text-red-600 py-2">
                                      {debt.balance.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} TND
                                    </TableCell>
                                    <TableCell className="text-center py-2">
                                      <span
                                        className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${
                                          debt.age > 365
                                            ? 'bg-red-100 text-red-800'
                                            : debt.age > 90
                                            ? 'bg-orange-100 text-orange-800'
                                            : debt.age > 30
                                            ? 'bg-yellow-100 text-yellow-800'
                                            : 'bg-green-100 text-green-800'
                                        }`}
                                      >
                                        {debt.age}j
                                      </span>
                                    </TableCell>
                                    <TableCell className="text-xs text-center py-2">
                                      {debt.paymentDays}
                                    </TableCell>
                                    <TableCell className="text-center py-2">
                                      <Badge
                                        variant="outline"
                                        className={`text-[10px] px-1.5 py-0 ${riskBadgeColors[debt.riskLevel] || ''}`}
                                      >
                                        {AnalysisService.getRiskLabel(debt.riskLevel)}
                                      </Badge>
                                    </TableCell>
                                    <TableCell className="text-center py-2">
                                      <span className="text-[10px] text-gray-500">
                                        {(debt.sourceFile || '').length > 12
                                          ? (debt.sourceFile || '').substring(0, 9) + '...'
                                          : debt.sourceFile || '-'}
                                      </span>
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        </div>
                      )}
                    </Card>
                  );
                })}

                {filteredClientNames.length === 0 && (
                  <div className="text-center py-12 text-gray-500">
                    Aucun client trouvé pour la recherche "<span className="font-medium">{searchTerm}</span>"
                  </div>
                )}
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
}
