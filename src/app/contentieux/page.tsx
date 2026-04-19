'use client';

import { useDebtContext } from '@/lib/DebtContext';
import { Sidebar } from '@/components/Sidebar';
import { Scale, User, Calendar, FileText, AlertTriangle, DollarSign, Phone } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export default function ContentieuxPage() {
  const { debts, analysis } = useDebtContext();
  
  // Filtrer les créances en contentieux (IC + age > 365)
  const contentieuxDebts = debts.filter(debt => debt.isContentieux);
  
  // Regrouper par client
  const clientGroups = contentieuxDebts.reduce((groups, debt) => {
    const key = debt.clientCode;
    if (!groups[key]) {
      groups[key] = {
        clientCode: debt.clientCode,
        clientName: debt.clientName,
        clientPhone: debt.clientPhone,
        commercialCode: debt.commercialCode,
        commercialName: debt.commercialName,
        debts: [],
        totalAmount: 0,
        totalBalance: 0
      };
    }
    groups[key].debts.push(debt);
    groups[key].totalAmount += debt.amount;
    groups[key].totalBalance += debt.balance;
    return groups;
  }, {} as Record<string, any>);
  
  const clientsList = Object.values(clientGroups).sort((a: any, b: any) => b.totalBalance - a.totalBalance);
  const totalContentieux = contentieuxDebts.reduce((sum, d) => sum + d.balance, 0);

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      <div className="flex-1 overflow-y-auto">
        <header className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Scale className="h-6 w-6 text-red-600" />
              <h1 className="text-xl font-semibold text-gray-900">Contentieux</h1>
              <Badge variant="destructive" className="ml-2">
                {contentieuxDebts.length} dossiers
              </Badge>
            </div>
            <div className="text-right">
              <div className="text-sm text-gray-500">Montant total en contentieux</div>
              <div className="text-xl font-bold text-red-600">
                {totalContentieux.toLocaleString('fr-FR')} TND
              </div>
            </div>
          </div>
        </header>

        <main className="p-6 space-y-6">
          {contentieuxDebts.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <Scale className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">Aucun dossier en contentieux</h3>
                <p className="text-sm text-gray-600">
                  Les factures impayées IC avec un âge supérieur à 365 jours apparaîtront ici.
                </p>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Résumé */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Dossiers Contentieux</CardTitle>
                    <Scale className="h-4 w-4 text-red-600" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-red-600">{contentieuxDebts.length}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Clients Concernés</CardTitle>
                    <User className="h-4 w-4 text-blue-600" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{clientsList.length}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Solde Total</CardTitle>
                    <DollarSign className="h-4 w-4 text-orange-600" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {totalContentieux.toLocaleString('fr-FR', {maximumFractionDigits: 0})} TND
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Âge Moyen</CardTitle>
                    <Calendar className="h-4 w-4 text-purple-600" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {Math.round(contentieuxDebts.reduce((sum, d) => sum + d.age, 0) / contentieuxDebts.length)} j
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Liste des clients en contentieux */}
              <div className="space-y-4">
                {clientsList.map((client: any) => (
                  <Card key={client.clientCode} className="border-red-200">
                    <CardHeader className="bg-red-50">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                            <User className="h-5 w-5 text-red-600" />
                          </div>
                          <div>
                            <CardTitle className="text-lg">{client.clientName}</CardTitle>
                            <p className="text-sm text-gray-500">Code: {client.clientCode}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-xl font-bold text-red-600">
                            {client.totalBalance.toLocaleString('fr-FR')} TND
                          </div>
                          <p className="text-sm text-gray-500">{client.debts.length} facture(s)</p>
                        </div>
                      </div>
                      
                      {/* Commercial info */}
                      {client.commercialCode && (
                        <div className="mt-3 flex items-center space-x-2 text-sm">
                          <span className="text-gray-500">Commercial:</span>
                          <Badge variant="outline">{client.commercialCode}</Badge>
                          <span className="text-gray-700">{client.commercialName}</span>
                        </div>
                      )}
                      
                      {client.clientPhone && (
                        <div className="mt-2 flex items-center space-x-2 text-sm text-gray-500">
                          <Phone className="h-3 w-3" />
                          <span>{client.clientPhone}</span>
                        </div>
                      )}
                    </CardHeader>
                    
                    <CardContent className="p-0">
                      <div className="divide-y divide-gray-200">
                        {client.debts.map((debt: any) => (
                          <div key={debt.id} className="p-4 flex items-center justify-between hover:bg-gray-50">
                            <div className="flex items-center space-x-4">
                              <div className="w-2 h-12 bg-red-500 rounded-full" />
                              <div>
                                <div className="flex items-center space-x-2">
                                  <FileText className="h-4 w-4 text-gray-400" />
                                  <span className="font-medium">{debt.documentNumber}</span>
                                  <Badge variant="destructive" className="text-xs">IC</Badge>
                                </div>
                                <p className="text-sm text-gray-500 mt-1">{debt.description}</p>
                                <div className="flex items-center space-x-4 mt-2 text-xs text-gray-400">
                                  <span>Date: {new Date(debt.documentDate).toLocaleDateString('fr-FR')}</span>
                                  <span>Échéance: {new Date(debt.dueDate).toLocaleDateString('fr-FR')}</span>
                                  <span className="flex items-center space-x-1 text-red-600">
                                    <AlertTriangle className="h-3 w-3" />
                                    <span>Âge: {debt.age} jours</span>
                                  </span>
                                </div>
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="font-bold text-red-600">{debt.balance.toLocaleString('fr-FR')} TND</div>
                              <div className="text-xs text-gray-500">Montant: {debt.amount.toLocaleString('fr-FR')} TND</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
}
