'use client';

import { useState } from 'react';
import { useDebtContext } from '@/lib/DebtContext';
import { Sidebar } from '@/components/Sidebar';
import { FileUpload } from '@/components/FileUpload';
import { OCRService } from '@/lib/ocr';
import { AnalysisService } from '@/lib/analysis';
import { Upload, FileText, AlertTriangle, CheckCircle, X, XCircle, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function ImportPage() {
  const { debts, addDebts } = useDebtContext();
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [waitingMessage, setWaitingMessage] = useState<string | null>(null);
  const [fileStatuses, setFileStatuses] = useState<{name: string, status: 'pending' | 'processing' | 'success' | 'error', count: number, error?: string}[]>([]);
  const handleFileProcess = async (files: File[]) => {
    setIsProcessing(true);
    setProgress(0);
    setError(null);
    setSuccessMessage(null);
    setWaitingMessage(null);

    // Initialiser les statuts
    setFileStatuses(files.map(f => ({ name: f.name, status: 'pending', count: 0 })));

    try {
      // Étape 1: Vérifier le service
      setProgress(10);
      setWaitingMessage('Vérification du service...');
      const healthCheck = await OCRService.waitForPythonService((s, m) => setWaitingMessage(m), 90);
      
      if (!healthCheck.available) {
        throw new Error(`Le service est indisponible.`);
      }
      
      setWaitingMessage(null);
      setProgress(30);

      // Étape 2: Traitement en parallèle
      const results = await Promise.all(files.map(async (file, index) => {
        setFileStatuses(prev => prev.map((s, i) => i === index ? { ...s, status: 'processing' } : s));
        
        try {
          const result = await OCRService.extractDebtsFromPDF(file);
          
          if (result.success && result.debts.length > 0) {
            setFileStatuses(prev => prev.map((s, i) => i === index ? { ...s, status: 'success', count: result.debts.length } : s));
            return result.debts;
          } else {
            setFileStatuses(prev => prev.map((s, i) => i === index ? { ...s, status: 'error', count: 0, error: result.error || 'Aucune donnée' } : s));
            return [];
          }
        } catch (e) {
          setFileStatuses(prev => prev.map((s, i) => i === index ? { ...s, status: 'error', count: 0, error: 'Erreur réseau' } : s));
          return [];
        }
      }));

      const allNewDebts = results.flat();
      setProgress(90);
      
      if (allNewDebts.length > 0) {
        addDebts(allNewDebts);
        setSuccessMessage(`${allNewDebts.length} créances importées depuis ${files.length} fichier(s)`);
      } else {
        setError('Aucune créance n\'a pu être extraite des fichiers sélectionnés.');
      }
      
      setProgress(100);
      
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

          {/* Statut détaillé des fichiers */}
          {fileStatuses.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Détail du traitement</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {fileStatuses.map((file, i) => (
                  <div key={i} className="flex items-center justify-between p-2 rounded-md bg-gray-50 border text-xs">
                    <div className="flex items-center gap-2">
                      {file.status === 'processing' ? <Loader2 className="h-3 w-3 animate-spin text-blue-500" /> :
                       file.status === 'success' ? <CheckCircle className="h-3 w-3 text-green-500" /> :
                       file.status === 'error' ? <XCircle className="h-3 w-3 text-red-500" /> :
                       <div className="h-3 w-3 rounded-full bg-gray-200" />}
                      <span className="font-medium truncate max-w-[200px]">{file.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {file.status === 'success' && <span className="text-green-600 font-bold">{file.count} créances</span>}
                      {file.status === 'error' && <span className="text-red-500 italic">{file.error}</span>}
                      {file.status === 'processing' && <span className="text-blue-500">Extraction...</span>}
                      {file.status === 'pending' && <span className="text-gray-400">En attente</span>}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Progression globale */}
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
