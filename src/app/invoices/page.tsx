'use client';

import { useState } from 'react';
import { useDebtContext } from '@/lib/DebtContext';
import { Sidebar } from '@/components/Sidebar';
import { FileText, Search, Filter, Download } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ExportService } from '@/lib/export';

export default function InvoicesPage() {
  const { debts, analysis } = useDebtContext();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRisk, setFilterRisk] = useState('all');

  const filteredDebts = debts.filter(debt => {
    const matchesSearch = searchTerm === '' || 
      debt.clientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      debt.documentNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      debt.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRisk = filterRisk === 'all' || debt.riskLevel === filterRisk;
    return matchesSearch && matchesRisk;
  });

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      <div className="flex-1 overflow-y-auto">
        <header className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <FileText className="h-6 w-6 text-blue-600" />
              <h1 className="text-xl font-semibold text-gray-900">Factures</h1>
              <span className="text-sm text-gray-500">{filteredDebts.length} factures</span>
            </div>
            {debts.length > 0 && (
              <Button onClick={() => ExportService.exportToExcel(filteredDebts, analysis || undefined)} variant="outline" size="sm">
                <Download className="h-4 w-4 mr-2" />
                Exporter
              </Button>
            )}
          </div>
        </header>

        <main className="p-6 space-y-6">
          {/* Filtres */}
          <div className="flex items-center space-x-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Rechercher par client, n° facture..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-full"
              />
            </div>
            <select
              value={filterRisk}
              onChange={(e) => setFilterRisk(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">Tous les risques</option>
              <option value="critical">Critique</option>
              <option value="overdue">En retard</option>
              <option value="monitoring">À surveiller</option>
              <option value="healthy">Sain</option>
            </select>
          </div>

          {filteredDebts.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <FileText className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  {debts.length === 0 ? 'Aucune facture' : 'Aucun résultat'}
                </h3>
                <p className="text-sm text-gray-600">
                  {debts.length === 0 ? 'Importez des fichiers depuis le Dashboard pour voir les factures' : 'Modifiez vos critères de recherche'}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {filteredDebts.map((debt) => {
                const riskColor = debt.riskLevel === 'critical' ? 'red' : debt.riskLevel === 'overdue' ? 'orange' : debt.riskLevel === 'monitoring' ? 'yellow' : 'green';
                return (
                  <Card key={debt.id} className="hover:shadow-sm transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                          <div className={`w-2 h-8 rounded-full bg-${riskColor}-500`} />
                          <div>
                            <div className="font-medium text-gray-900">{debt.documentNumber}</div>
                            <div className="text-sm text-gray-500">{debt.clientName}</div>
                            <div className="text-xs text-gray-400">{debt.description}</div>
                          </div>
                        </div>
                        <div className="flex items-center space-x-8">
                          <div className="text-center">
                            <div className="text-xs text-gray-500">Date</div>
                            <div className="text-sm font-medium">{new Date(debt.documentDate).toLocaleDateString('fr-FR')}</div>
                          </div>
                          <div className="text-center">
                            <div className="text-xs text-gray-500">Échéance</div>
                            <div className="text-sm font-medium">{new Date(debt.dueDate).toLocaleDateString('fr-FR')}</div>
                          </div>
                          <div className="text-right">
                            <div className="text-sm font-medium">{debt.amount.toLocaleString('fr-FR')} TND</div>
                            <div className="text-xs text-green-600">Règlement: {debt.settlement.toLocaleString('fr-FR')} TND</div>
                            <div className="text-sm font-bold text-red-600">{debt.balance.toLocaleString('fr-FR')} TND</div>
                          </div>
                          <div className="text-center">
                            <div className="text-xs text-gray-500">Âge</div>
                            <div className="text-sm font-medium">{debt.age}j</div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
