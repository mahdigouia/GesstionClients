'use client';

import { TrendingUp, DollarSign, Users, AlertTriangle, Activity } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface KPICardsProps {
  totalDebts: number;
  totalBalance: number;
  criticalDebts: number;
  recoveryRate: number;
  clientCount: number;
}

export function KPICards({ totalDebts, totalBalance, criticalDebts, recoveryRate, clientCount }: KPICardsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      {/* Total Créances */}
      <Card className="border-0 shadow-sm hover:shadow-md transition-shadow">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-gray-600">Total Créances</CardTitle>
          <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center">
            <DollarSign className="h-4 w-4 text-blue-600" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-gray-900">
            {totalDebts.toLocaleString('fr-FR')} TND
          </div>
          <p className="text-xs text-gray-500 mt-1">
            {clientCount} clients
          </p>
        </CardContent>
      </Card>

      {/* Montant en Retard */}
      <Card className="border-0 shadow-sm hover:shadow-md transition-shadow">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-gray-600">En Retard</CardTitle>
          <div className="h-8 w-8 rounded-full bg-red-100 flex items-center justify-center">
            <AlertTriangle className="h-4 w-4 text-red-600" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-red-600">
            {totalBalance.toLocaleString('fr-FR')} TND
          </div>
          <p className="text-xs text-gray-500 mt-1">
            {criticalDebts} critiques
          </p>
        </CardContent>
      </Card>

      {/* Taux Recouvrement */}
      <Card className="border-0 shadow-sm hover:shadow-md transition-shadow">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-gray-600">Taux Recouvrement</CardTitle>
          <div className="h-8 w-8 rounded-full bg-green-100 flex items-center justify-center">
            <TrendingUp className="h-4 w-4 text-green-600" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-gray-900">
            {isNaN(recoveryRate) ? '0.0' : recoveryRate.toFixed(1)}%
          </div>
          <p className="text-xs text-gray-500 mt-1">
            <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
              <div 
                className="bg-green-500 h-2 rounded-full transition-all duration-500"
                style={{ width: `${isNaN(recoveryRate) ? 0 : Math.min(recoveryRate, 100)}%` }}
              />
            </div>
          </p>
        </CardContent>
      </Card>

      {/* Clients Actifs */}
      <Card className="border-0 shadow-sm hover:shadow-md transition-shadow">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-gray-600">Clients Actifs</CardTitle>
          <div className="h-8 w-8 rounded-full bg-purple-100 flex items-center justify-center">
            <Users className="h-4 w-4 text-purple-600" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-gray-900">
            {clientCount}
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Total
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
