'use client';

import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FileUpload } from '@/components/FileUpload';
import { Dashboard } from '@/components/Dashboard';
import { DebtTable } from '@/components/DebtTable';
import { OCRService } from '@/lib/ocr';
import { AnalysisService } from '@/lib/analysis';
import { ExportService } from '@/lib/export';
import { ClientDebt, ProcessingResult } from '@/types/debt';
import { Upload, BarChart3, Table, Download, AlertCircle } from 'lucide-react';

export default function Home() {
  const [debts, setDebts] = useState<ClientDebt[]>([]);
  const [analysis, setAnalysis] = useState<any>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

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
      console.error('Détails de l\'erreur:', {
        filesCount: files.length,
        fileNames: files.map(f => f.name),
        fileTypes: files.map(f => f.type),
        fileSizes: files.map(f => (f.size / 1024 / 1024).toFixed(2) + 'MB')
      });
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

  const handleExportReport = () => {
    if (debts.length > 0 && analysis) {
      const report = ExportService.generateReport(debts, analysis);
      const fileName = `rapport-creances-${new Date().toISOString().split('T')[0]}.txt`;
      ExportService.downloadTextFile(report, fileName);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                GesstionClients - Analyse des Créances
              </h1>
              <p className="text-sm text-gray-600">
                Solution intelligente de gestion et d'analyse des créances clients
              </p>
            </div>
            
            {debts.length > 0 && (
              <div className="flex space-x-2">
                <Button onClick={handleExportExcel} variant="outline" size="sm">
                  <Download className="h-4 w-4 mr-2" />
                  Excel
                </Button>
                <Button onClick={handleExportPDF} variant="outline" size="sm">
                  <Download className="h-4 w-4 mr-2" />
                  PDF
                </Button>
                <Button onClick={handleExportReport} variant="outline" size="sm">
                  <Download className="h-4 w-4 mr-2" />
                  Rapport
                </Button>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        {/* File Upload Section */}
        <div className="mb-8">
          <FileUpload 
            onFileSelect={handleFileProcess}
            isProcessing={isProcessing}
            progress={progress}
          />
        </div>

        {/* Error Display */}
        {error && (
          <Card className="mb-6 border-red-200 bg-red-50">
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <AlertCircle className="h-5 w-5 text-red-600" />
                <span className="text-red-800">{error}</span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Main Content */}
        {debts.length > 0 && analysis ? (
          <div id="dashboard-content">
            <Tabs defaultValue="dashboard" className="space-y-6">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="dashboard" className="flex items-center space-x-2">
                  <BarChart3 className="h-4 w-4" />
                  <span>Dashboard</span>
                </TabsTrigger>
                <TabsTrigger value="table" className="flex items-center space-x-2">
                  <Table className="h-4 w-4" />
                  <span>Détail des créances</span>
                </TabsTrigger>
                <TabsTrigger value="summary" className="flex items-center space-x-2">
                  <Upload className="h-4 w-4" />
                  <span>Résumé</span>
                </TabsTrigger>
              </TabsList>

              <TabsContent value="dashboard">
                <Dashboard analysis={analysis} />
              </TabsContent>

              <TabsContent value="table">
                <DebtTable 
                  debts={debts} 
                  onExport={(filteredDebts) => ExportService.exportToExcel(filteredDebts)}
                />
              </TabsContent>

              <TabsContent value="summary">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  <Card>
                    <CardHeader>
                      <CardTitle>Statistiques Générales</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex justify-between">
                        <span>Total créances:</span>
                        <span className="font-bold">{analysis.totalDebts.toFixed(2)}€</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Solde restant:</span>
                        <span className="font-bold text-red-600">{analysis.totalBalance.toFixed(2)}€</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Taux recouvrement:</span>
                        <span className="font-bold">{analysis.recoveryRate.toFixed(1)}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Nombre de clients:</span>
                        <span className="font-bold">{analysis.clientBreakdown.length}</span>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Répartition par Risque</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {analysis.agingBreakdown.map((range: any, index: number) => (
                        <div key={index} className="flex justify-between items-center">
                          <span className="text-sm">{range.range}</span>
                          <div className="flex items-center space-x-2">
                            <span className="font-bold">{range.count}</span>
                            <Badge variant="outline">
                              {range.percentage.toFixed(1)}%
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Alertes Actives</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex justify-between">
                        <span>Alertes critiques:</span>
                        <Badge variant="destructive">
                          {analysis.alerts.filter((a: any) => a.severity === 'high').length}
                        </Badge>
                      </div>
                      <div className="flex justify-between">
                        <span>Alertes moyennes:</span>
                        <Badge variant="secondary">
                          {analysis.alerts.filter((a: any) => a.severity === 'medium').length}
                        </Badge>
                      </div>
                      <div className="flex justify-between">
                        <span>Alertes faibles:</span>
                        <Badge variant="outline">
                          {analysis.alerts.filter((a: any) => a.severity === 'low').length}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        ) : (
          !isProcessing && (
            <Card className="text-center py-12">
              <CardContent>
                <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  Commencez par importer un fichier
                </h3>
                <p className="text-gray-600">
                  Importez un fichier PDF ou une image pour commencer l'analyse des créances
                </p>
              </CardContent>
            </Card>
          )
        )}
      </main>
    </div>
  );
}
