'use client';

import { useState } from 'react';
import { Sidebar } from '@/components/Sidebar';
import { KPICards } from '@/components/KPICards';
import { FileUpload } from '@/components/FileUpload';
import { Dashboard } from '@/components/Dashboard';
import { DebtTable } from '@/components/DebtTable';
import { OCRService } from '@/lib/ocr';
import { AnalysisService } from '@/lib/analysis';
import { ExportService } from '@/lib/export';
import { ClientDebt } from '@/types/debt';
import { 
  LayoutDashboard, 
  Users, 
  FileText, 
  BarChart3, 
  TrendingUp,
  AlertTriangle,
  Bell,
  Search,
  Filter,
  Download,
  Settings,
  Save,
  X
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function Home() {
  const [debts, setDebts] = useState<ClientDebt[]>([]);
  const [analysis, setAnalysis] = useState<any>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('dashboard');

  const handleFileProcess = async (files: File[]) => {
    setIsProcessing(true);
    setProgress(0);
    setError(null);

    try {
      let allDebts: ClientDebt[] = [];
      const totalFiles = files.length;
      
      // Traiter chaque fichier
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const fileProgress = 20 + (60 * i / totalFiles);
        setProgress(Math.round(fileProgress));
        
        // Étape 1: Extraction OCR
        const ocrText = await OCRService.extractTextFromPDF(file);
        
        // Étape 2: Parsing des données
        const parsedDebts = OCRService.parseDebtData(ocrText, file.name);
        
        if (parsedDebts.length === 0) {
          console.warn(`Aucune donnée trouvée dans le fichier: ${file.name}`);
        } else {
          allDebts = [...allDebts, ...parsedDebts];
        }
      }
      
      if (allDebts.length === 0) {
        throw new Error('Aucune donnée de créance trouvée dans les fichiers');
      }

      // Étape 3: Analyse agrégée
      setProgress(90);
      const analysisResult = AnalysisService.analyzeDebts(allDebts);
      
      // Étape 4: Finalisation
      setProgress(100);
      setDebts(allDebts);
      setAnalysis(analysisResult);
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Une erreur est survenue lors du traitement';
      setError(errorMessage);
      console.error('Processing error:', err);
    } finally {
      setIsProcessing(false);
      setProgress(0);
    }
  };

  const handleExportExcel = () => {
    if (debts.length > 0) {
      ExportService.exportToExcel(debts, analysis);
    }
  };

  const handleExportPDF = async () => {
    if (analysis) {
      await ExportService.exportToPDF('dashboard-content');
    }
  };

  const handleSaveAnalysis = () => {
    if (debts.length > 0 && analysis) {
      ExportService.saveAnalysis(debts, analysis);
    }
  };

  const clearError = () => {
    setError(null);
  };

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <Sidebar />

      {/* Main Content */}
      <div className="flex-1 overflow-hidden">
        {/* Top Navigation Bar */}
        <header className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <h1 className="text-xl font-semibold text-gray-900">
                Tableau de Bord
              </h1>
              {debts.length > 0 && (
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-gray-500">
                    {debts.length} créances analysées
                  </span>
                </div>
              )}
            </div>
            
            <div className="flex items-center space-x-3">
              {/* Search Bar */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Rechercher un client, une facture..."
                  className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent w-64"
                />
              </div>

              {/* Filters */}
              <Button variant="outline" size="sm">
                <Filter className="h-4 w-4 mr-2" />
                Filtres
              </Button>

              {/* Notifications */}
              <Button variant="outline" size="sm" className="relative">
                <Bell className="h-4 w-4" />
                {analysis?.alerts?.filter((a: any) => a.severity === 'high').length > 0 && (
                  <div className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full" />
                )}
              </Button>

              {/* Settings */}
              <Button variant="outline" size="sm">
                <Settings className="h-4 w-4" />
              </Button>

              {/* Export & Save */}
              {debts.length > 0 && (
                <div className="flex items-center space-x-2">
                  <Button onClick={handleSaveAnalysis} variant="outline" size="sm" title="Sauvegarder l'analyse">
                    <Save className="h-4 w-4" />
                  </Button>
                  <Button onClick={handleExportExcel} variant="outline" size="sm" title="Exporter Excel">
                    <Download className="h-4 w-4" />
                  </Button>
                  <Button onClick={handleExportPDF} variant="outline" size="sm" title="Exporter PDF">
                    <Download className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto bg-gray-50 p-6">
          {/* Error Alert */}
          {error && (
            <Card className="mb-6 border-red-200 bg-red-50">
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-3">
                    <AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0" />
                    <div>
                      <h4 className="text-sm font-medium text-red-800">
                        Erreur de traitement
                      </h4>
                      <p className="text-sm text-red-700 mt-1">
                        {error}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearError}
                    className="text-red-600 hover:text-red-800 hover:bg-red-50"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Processing State */}
          {isProcessing ? (
            <Card className="mb-6">
              <CardContent className="p-8">
                <div className="text-center">
                  <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-4">
                    <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    Traitement des fichiers en cours...
                  </h3>
                  <p className="text-sm text-gray-600 mb-4">
                    Extraction OCR et analyse des données
                  </p>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    {progress}% complété
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* KPI Cards */}
              {analysis && (
                <div className="mb-8">
                  <KPICards
                    totalDebts={analysis.totalDebts}
                    totalBalance={analysis.totalBalance}
                    criticalDebts={analysis.alerts?.filter((a: any) => a.severity === 'high').length || 0}
                    recoveryRate={analysis.recoveryRate}
                    clientCount={analysis.clientBreakdown?.length || 0}
                  />
                </div>
              )}

              {/* File Upload */}
              {!debts.length && (
                <Card className="mb-8">
                  <CardContent className="p-8">
                    <div className="text-center">
                      <FileText className="mx-auto h-12 w-12 text-blue-600 mb-4" />
                      <h3 className="text-lg font-medium text-gray-900 mb-2">
                        Importer vos fichiers
                      </h3>
                      <p className="text-sm text-gray-600 mb-6">
                        Glissez-déposez vos fichiers PDF ou images pour commencer l'analyse
                      </p>
                      <FileUpload 
                        onFileSelect={handleFileProcess}
                        isProcessing={isProcessing}
                        progress={progress}
                      />
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Tabs Content */}
              {debts.length > 0 && analysis && (
                <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
                  <TabsList className="grid w-full grid-cols-4">
                    <TabsTrigger value="dashboard" className="flex items-center space-x-2">
                      <LayoutDashboard className="h-4 w-4" />
                      <span>Vue d'ensemble</span>
                    </TabsTrigger>
                    <TabsTrigger value="aging" className="flex items-center space-x-2">
                      <BarChart3 className="h-4 w-4" />
                      <span>Analyse</span>
                    </TabsTrigger>
                    <TabsTrigger value="clients" className="flex items-center space-x-2">
                      <Users className="h-4 w-4" />
                      <span>Clients</span>
                    </TabsTrigger>
                    <TabsTrigger value="table" className="flex items-center space-x-2">
                      <FileText className="h-4 w-4" />
                      <span>Détail</span>
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="dashboard" className="space-y-6">
                    <Dashboard analysis={analysis} />
                  </TabsContent>

                  <TabsContent value="aging" className="space-y-6">
                    <Card>
                      <CardContent className="p-6">
                        <h3 className="text-lg font-medium text-gray-900 mb-4">
                          Répartition par Ancienneté
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          {analysis.agingBreakdown?.map((range: any, index: number) => (
                            <div key={index} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                              <div className="flex items-center space-x-3">
                                <div className={`w-3 h-3 rounded-full ${
                                  index === 0 ? 'bg-green-500' :
                                  index === 1 ? 'bg-yellow-500' :
                                  index === 2 ? 'bg-orange-500' :
                                  'bg-red-500'
                                }`}></div>
                                <span className="text-sm font-medium">{range.range}</span>
                              </div>
                              <div className="text-right">
                                <div className="text-lg font-bold">{range.count}</div>
                                <div className="text-sm text-gray-500">{range.amount.toFixed(0)}€</div>
                                <div className="text-xs text-gray-400">{range.percentage.toFixed(1)}%</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>

                  <TabsContent value="clients" className="space-y-6">
                    <Card>
                      <CardContent className="p-6">
                        <h3 className="text-lg font-medium text-gray-900 mb-4">
                          Top Clients par Montant Dû
                        </h3>
                        <div className="space-y-3">
                          {analysis.clientBreakdown?.slice(0, 10).map((client: any, index: number) => (
                            <div key={index} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50">
                              <div className="flex items-center space-x-3">
                                <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center">
                                  <span className="text-sm font-medium text-gray-600">
                                    {client.clientName.charAt(0).toUpperCase()}
                                  </span>
                                </div>
                                <div>
                                  <div className="font-medium">{client.clientName}</div>
                                  <div className="text-sm text-gray-500">{client.totalAmount.toFixed(2)}€ dû</div>
                                </div>
                              </div>
                              <div className="text-right">
                                <div className={`px-2 py-1 rounded text-xs font-medium ${
                                  client.totalBalance > 1000 ? 'bg-red-100 text-red-800' :
                                  client.totalBalance > 500 ? 'bg-yellow-100 text-yellow-800' :
                                  'bg-green-100 text-green-800'
                                }`}>
                                  {client.totalBalance > 0 ? 'À risque' : 'Sain'}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>

                  <TabsContent value="table" className="space-y-6">
                    <DebtTable 
                      debts={debts} 
                      onExport={(filteredDebts) => ExportService.exportToExcel(filteredDebts)}
                    />
                  </TabsContent>
                </Tabs>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}
