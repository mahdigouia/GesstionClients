'use client';

import { useState } from 'react';
import { useDebtContext } from '@/lib/DebtContext';
import { Sidebar } from '@/components/Sidebar';
import { FileUpload } from '@/components/FileUpload';
import { OCRService } from '@/lib/ocr';
import { AnalysisService } from '@/lib/analysis';
import { Upload, FileText, AlertTriangle, CheckCircle, X } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function ImportPage() {
  const { debts, addDebts } = useDebtContext();
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [waitingMessage, setWaitingMessage] = useState<string | null>(null);

  const handleFileProcess = async (files: File[]) => {
    setIsProcessing(true);
    setProgress(0);
    setError(null);
    setSuccessMessage(null);
    setWaitingMessage(null);

    try {
      // Étape 1: Vérifier que le service Python est disponible (avec attente)
      setProgress(10);
      setWaitingMessage('Vérification du service...');
      
      const healthCheck = await OCRService.waitForPythonService(
        (seconds, message) => {
          setWaitingMessage(message);
          // Progression de 10% à 50% pendant l'attente (max 90s)
          const progressValue = Math.min(10 + (seconds * 40 / 90), 50);
          setProgress(Math.round(progressValue));
        },
        90 // max 90 secondes
      );
      
      if (!healthCheck.available) {
        throw new Error(`Le service n'est pas disponible après ${healthCheck.waitedSeconds} secondes. Veuillez réessayer plus tard.`);
      }
      
      setWaitingMessage(null);
      setProgress(50);

      // Étape 2: Importer les fichiers
      let allNewDebts: any[] = [];
      const totalFiles = files.length;
      
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const fileProgress = 50 + (40 * (i + 1) / totalFiles);
        setProgress(Math.round(fileProgress));
        
        // Utiliser le service d'extraction Python (PAS de fallback OCR)
        const result = await OCRService.extractDebtsFromPDF(file);
        
        if (!result.success || result.debts.length === 0) {
          console.warn(`Aucune donnée trouvée dans: ${file.name}`);
          if (result.error) {
            console.error(`[Import] Erreur pour ${file.name}:`, result.error);
          }
        } else {
          console.log(`[Import] ${file.name}: ${result.debts.length} créances via ${result.method}`);
          allNewDebts = [...allNewDebts, ...result.debts];
        }
      }
      
      if (allNewDebts.length === 0) {
        throw new Error('Aucune donnée de créance trouvée dans les fichiers');
      }

      setProgress(90);
      addDebts(allNewDebts);
      setProgress(100);
      setSuccessMessage(`${allNewDebts.length} créances importées avec succès depuis ${totalFiles} fichier(s)`);
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Une erreur est survenue lors du traitement';
      setError(errorMessage);
      console.error('Processing error:', err);
    } finally {
      setIsProcessing(false);
      setProgress(0);
    }
  };

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      <div className="flex-1 overflow-y-auto">
        <header className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center space-x-4">
            <Upload className="h-6 w-6 text-blue-600" />
            <h1 className="text-xl font-semibold text-gray-900">Import OCR</h1>
            {debts.length > 0 && (
              <span className="text-sm text-gray-500">{debts.length} créances en mémoire</span>
            )}
          </div>
        </header>

        <main className="p-6 space-y-6">
          {/* Zone d'upload */}
          <Card>
            <CardHeader>
              <CardTitle>Importer des fichiers</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center">
                <FileText className="mx-auto h-12 w-12 text-blue-600 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  Glissez-déposez vos fichiers PDF
                </h3>
                <p className="text-sm text-gray-600 mb-6">
                  Supporte les fichiers PDF et images. Les données seront extraites automatiquement par OCR.
                </p>
                <FileUpload 
                  onFileSelect={handleFileProcess}
                  isProcessing={isProcessing}
                  progress={progress}
                />
              </div>
            </CardContent>
          </Card>

          {/* Progression */}
          {isProcessing && (
            <Card className="border-blue-200 bg-blue-50">
              <CardContent className="p-6">
                <div className="text-center">
                  <div className="inline-flex items-center justify-center w-12 h-12 bg-blue-100 rounded-full mb-3">
                    <div className="w-6 h-6 border-3 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    {waitingMessage || 'Traitement en cours...'}
                  </h3>
                  <div className="w-full bg-gray-200 rounded-full h-2 mt-3">
                    <div 
                      className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-2">{progress}% complété</p>
                  {waitingMessage && waitingMessage.includes('Démarrage') && (
                    <p className="text-xs text-amber-600 mt-2">
                      Le service se réveille, cela peut prendre jusqu'à 90 secondes...
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Succès */}
          {successMessage && (
            <Card className="border-green-200 bg-green-50">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                    <p className="text-sm text-green-800">{successMessage}</p>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => setSuccessMessage(null)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Erreur */}
          {error && (
            <Card className="border-red-200 bg-red-50">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <AlertTriangle className="h-5 w-5 text-red-600" />
                    <p className="text-sm text-red-800">{error}</p>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => setError(null)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Historique des imports */}
          {debts.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Données en mémoire ({debts.length} créances)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {Array.from(new Set(debts.map(d => d.sourceFile))).map((file, i) => {
                    const fileDebts = debts.filter(d => d.sourceFile === file);
                    const totalBalance = fileDebts.reduce((sum, d) => sum + d.balance, 0);
                    return (
                      <div key={i} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                        <div className="flex items-center space-x-3">
                          <FileText className="h-4 w-4 text-blue-600" />
                          <div>
                            <div className="text-sm font-medium">{file}</div>
                            <div className="text-xs text-gray-500">{fileDebts.length} créances</div>
                          </div>
                        </div>
                        <div className="text-sm font-medium">{totalBalance.toLocaleString('fr-FR')} TND</div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </main>
      </div>
    </div>
  );
}
