'use client';

import { useDebtContext } from '@/lib/DebtContext';
import { Sidebar } from '@/components/Sidebar';
import { Users, Phone, DollarSign, AlertTriangle, FileText } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function ClientsPage() {
  const { debts, analysis } = useDebtContext();

  const clients = analysis?.clientBreakdown || [];

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      <div className="flex-1 overflow-y-auto">
        <header className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center space-x-4">
            <Users className="h-6 w-6 text-blue-600" />
            <h1 className="text-xl font-semibold text-gray-900">Clients</h1>
            <span className="text-sm text-gray-500">{clients.length} clients</span>
          </div>
        </header>

        <main className="p-6 space-y-6">
          {clients.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <Users className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">Aucun client</h3>
                <p className="text-sm text-gray-600">Importez des fichiers depuis le Dashboard pour voir les clients</p>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Résumé */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Clients</CardTitle>
                    <Users className="h-4 w-4 text-blue-600" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{clients.length}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Clients à Risque</CardTitle>
                    <AlertTriangle className="h-4 w-4 text-red-600" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-red-600">
                      {clients.filter((c: any) => c.riskLevel === 'critical' || c.riskLevel === 'overdue').length}
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Solde Total Dû</CardTitle>
                    <DollarSign className="h-4 w-4 text-orange-600" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {clients.reduce((sum: number, c: any) => sum + c.totalBalance, 0).toLocaleString('fr-FR')} TND
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Liste des clients */}
              <div className="space-y-3">
                {clients.map((client: any, index: number) => {
                  const clientDebts = debts.filter(d => d.clientName === client.clientName);
                  const riskColor = client.riskLevel === 'critical' ? 'red' : client.riskLevel === 'overdue' ? 'orange' : client.riskLevel === 'monitoring' ? 'yellow' : 'green';
                  
                  return (
                    <Card key={index} className="hover:shadow-md transition-shadow">
                      <CardContent className="p-6">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-4">
                            <div className="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center">
                              <span className="text-lg font-bold text-gray-600">
                                {(client.clientName || '?').charAt(0)}
                              </span>
                            </div>
                            <div>
                              <h3 className="font-semibold text-gray-900">{client.clientName || 'Client inconnu'}</h3>
                              <div className="flex items-center space-x-4 text-sm text-gray-500 mt-1">
                                <span className="flex items-center space-x-1">
                                  <FileText className="h-3 w-3" />
                                  <span>{client.debtCount || clientDebts.length} factures</span>
                                </span>
                                {clientDebts[0]?.clientPhone && (
                                  <span className="flex items-center space-x-1">
                                    <Phone className="h-3 w-3" />
                                    <span>{clientDebts[0].clientPhone}</span>
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="text-right space-y-1">
                            <div className="text-lg font-bold">{client.totalBalance.toLocaleString('fr-FR')} TND</div>
                            <div className="text-sm text-gray-500">
                              Montant: {client.totalAmount.toLocaleString('fr-FR')} TND
                            </div>
                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-${riskColor}-100 text-${riskColor}-800`}>
                              {client.riskLevel === 'critical' ? 'Critique' : client.riskLevel === 'overdue' ? 'En retard' : client.riskLevel === 'monitoring' ? 'À surveiller' : 'Sain'}
                            </span>
                          </div>
                        </div>
                        {/* Barre de progression du paiement */}
                        <div className="mt-4">
                          <div className="flex justify-between text-xs text-gray-500 mb-1">
                            <span>Taux de recouvrement</span>
                            <span>{client.totalAmount > 0 ? ((client.totalPaid / client.totalAmount) * 100).toFixed(1) : '0.0'}%</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div 
                              className={`h-2 rounded-full ${riskColor === 'red' ? 'bg-red-500' : riskColor === 'orange' ? 'bg-orange-500' : riskColor === 'yellow' ? 'bg-yellow-500' : 'bg-green-500'}`}
                              style={{ width: `${client.totalAmount > 0 ? Math.min((client.totalPaid / client.totalAmount) * 100, 100) : 0}%` }}
                            />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
}
