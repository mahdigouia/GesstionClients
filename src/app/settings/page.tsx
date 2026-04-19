'use client';

import { useDebtContext } from '@/lib/DebtContext';
import { Sidebar } from '@/components/Sidebar';
import { Settings, Trash2, Download, Upload, Info } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ExportService } from '@/lib/export';

export default function SettingsPage() {
  const { debts, analysis, clearAll } = useDebtContext();

  const handleExportData = () => {
    if (analysis && debts.length > 0) {
      ExportService.saveAnalysis(debts, analysis);
    }
  };

  const handleImportData = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e: any) => {
      const file = e.target.files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (ev) => {
          try {
            const data = JSON.parse(ev.target?.result as string);
            if (data.debts) {
              localStorage.setItem('gc_debts', JSON.stringify(data.debts));
              localStorage.setItem('gc_analysis', JSON.stringify(data.analysis));
              window.location.reload();
            }
          } catch (err) {
            alert('Fichier invalide');
          }
        };
        reader.readAsText(file);
      }
    };
    input.click();
  };

  const handleClearData = () => {
    if (confirm('Êtes-vous sûr de vouloir supprimer toutes les données ? Cette action est irréversible.')) {
      clearAll();
    }
  };

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      <div className="flex-1 overflow-y-auto">
        <header className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center space-x-4">
            <Settings className="h-6 w-6 text-blue-600" />
            <h1 className="text-xl font-semibold text-gray-900">Paramètres</h1>
          </div>
        </header>

        <main className="p-6 space-y-6">
          {/* Informations système */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Info className="h-5 w-5 text-blue-600" />
                <span>Informations</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="text-gray-500">Application</div>
                <div className="font-medium">GesstionClients</div>
                <div className="text-gray-500">Version</div>
                <div className="font-medium">2.0</div>
                <div className="text-gray-500">Devise</div>
                <div className="font-medium">Dinars Tunisiens (TND)</div>
                <div className="text-gray-500">Créances en mémoire</div>
                <div className="font-medium">{debts.length}</div>
                <div className="text-gray-500">Clients</div>
                <div className="font-medium">{analysis?.clientBreakdown?.length || 0}</div>
              </div>
            </CardContent>
          </Card>

          {/* Gestion des données */}
          <Card>
            <CardHeader>
              <CardTitle>Gestion des données</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                <div>
                  <h4 className="font-medium">Sauvegarder les données</h4>
                  <p className="text-sm text-gray-500">Exporter l'analyse complète en JSON</p>
                </div>
                <Button onClick={handleExportData} variant="outline" size="sm" disabled={debts.length === 0}>
                  <Download className="h-4 w-4 mr-2" />
                  Exporter
                </Button>
              </div>
              <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                <div>
                  <h4 className="font-medium">Importer des données</h4>
                  <p className="text-sm text-gray-500">Charger un fichier JSON sauvegardé</p>
                </div>
                <Button onClick={handleImportData} variant="outline" size="sm">
                  <Upload className="h-4 w-4 mr-2" />
                  Importer
                </Button>
              </div>
              <div className="flex items-center justify-between p-4 border border-red-200 rounded-lg bg-red-50">
                <div>
                  <h4 className="font-medium text-red-800">Supprimer toutes les données</h4>
                  <p className="text-sm text-red-600">Cette action est irréversible</p>
                </div>
                <Button onClick={handleClearData} variant="destructive" size="sm" disabled={debts.length === 0}>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Supprimer
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Configuration */}
          <Card>
            <CardHeader>
              <CardTitle>Configuration</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="text-gray-500">Format des dates</div>
                <div className="font-medium">JJ/MM/AAAA</div>
                <div className="text-gray-500">Séparateur décimal</div>
                <div className="font-medium">Virgule (,)</div>
                <div className="text-gray-500">Langue</div>
                <div className="font-medium">Français</div>
                <div className="text-gray-500">Stockage</div>
                <div className="font-medium">LocalStorage (navigateur)</div>
              </div>
            </CardContent>
          </Card>
        </main>
      </div>
    </div>
  );
}
