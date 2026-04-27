'use client';

import { useState, useEffect } from 'react';
import { Sidebar } from '@/components/Sidebar';
import { FileUpload } from '@/components/FileUpload';
import { Dashboard } from '@/components/Dashboard';
import { DebtTable } from '@/components/DebtTable';
import { QuickFilters } from '@/components/QuickFilters';
import { VoiceAssistant } from '@/components/VoiceAssistant';
import { OCRService } from '@/lib/ocr';
import { AnalysisService } from '@/lib/analysis';
import { ExportService } from '@/lib/export';
import { ClientDebt } from '@/types/debt';
import { useDebtContext } from '@/lib/DebtContext';
import { 
  LayoutDashboard, 
  Users, 
  FileText, 
  BarChart3, 
  TrendingUp,
  AlertTriangle,
  Bell,
  Search,
  Download,
  Settings,
  Save,
  X,
  Menu
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { FilteredResultsModal } from '@/components/FilteredResultsModal';
import { NotificationPopover } from '@/components/NotificationPopover';

export default function Home() {
  const { debts, analysis, setDebts, setAnalysis } = useDebtContext();
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [filteredDebts, setFilteredDebts] = useState<ClientDebt[]>([]);
  const [notifications, setNotifications] = useState<string[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [modalFilteredDebts, setModalFilteredDebts] = useState<ClientDebt[]>([]);
  const [activeFilterName, setActiveFilterName] = useState('');

  const [waitingMessage, setWaitingMessage] = useState<string | null>(null);

  // Initialize filtered debts when debts change
  useEffect(() => {
    setFilteredDebts(debts);
  }, [debts]);

  const handleFileProcess = async (files: File[]) => {
    setIsProcessing(true);
    setProgress(0);
    setError(null);
    setWaitingMessage(null);

    try {
      // Étape 1: Attendre que le service Python soit disponible
      setProgress(10);
      setWaitingMessage('Vérification du service...');
      
      const healthCheck = await OCRService.waitForPythonService(
        (seconds, message) => {
          setWaitingMessage(message);
          const progressValue = Math.min(10 + (seconds * 40 / 90), 50);
          setProgress(Math.round(progressValue));
        },
        90
      );
      
      if (!healthCheck.available) {
        throw new Error(`Le service n'est pas disponible après ${healthCheck.waitedSeconds} secondes. Veuillez réessayer plus tard.`);
      }
      
      setWaitingMessage(null);
      setProgress(50);
      
      let allDebts: ClientDebt[] = [];
      const totalFiles = files.length;
      
      // Traiter chaque fichier
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const fileProgress = 50 + (40 * (i + 1) / totalFiles);
        setProgress(Math.round(fileProgress));
        
        // Extraction via Python (PAS de fallback OCR)
        const result = await OCRService.extractDebtsFromPDF(file);
        
        if (!result.success || result.debts.length === 0) {
          console.warn(`Aucune donnée trouvée dans: ${file.name}`);
          if (result.error) {
            console.error(`[Import] Erreur pour ${file.name}:`, result.error);
          }
        } else {
          console.log(`[Import] ${file.name}: ${result.debts.length} créances via ${result.method}`);
          allDebts = [...allDebts, ...result.debts];
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
      setAnalysis(analysisResult as any);
      
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
      <Sidebar mobileOpen={sidebarOpen} onMobileClose={() => setSidebarOpen(false)} />

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto flex flex-col">
        {/* Top Navigation Bar */}
        <header className="bg-white border-b border-gray-200 px-4 md:px-6 py-3 md:py-4 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              {/* Hamburger menu - mobile only */}
              <Button
                variant="ghost"
                size="sm"
                className="md:hidden p-2"
                onClick={() => setSidebarOpen(true)}
              >
                <Menu className="h-5 w-5" />
              </Button>
              <div className="flex flex-col">
                <h1 className="text-base md:text-xl font-bold text-gray-900 leading-tight">
                  Tableau de Bord
                </h1>
                {debts.length > 0 && (
                  <Badge variant="secondary" className="mt-0.5 md:mt-1 bg-blue-50 text-blue-700 border-blue-100 text-[10px] md:text-xs py-0 px-1.5 w-fit">
                    {debts.length} créances
                  </Badge>
                )}
              </div>
            </div>
            
            <div className="flex items-center space-x-2 md:space-x-3">
              {/* Search Bar - Hidden on small screens to save space */}
              <div className="relative hidden sm:block">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Rechercher..."
                  className="pl-9 pr-4 py-1.5 border border-gray-200 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent w-32 md:w-64 bg-gray-50/50"
                />
              </div>

              {/* Notifications */}
              <NotificationPopover />

              {/* Export & Save - Icon only on mobile */}
              {debts.length > 0 && (
                <div className="flex items-center space-x-1 md:space-x-2">
                  <Button onClick={handleSaveAnalysis} variant="ghost" size="icon" className="h-9 w-9 rounded-full bg-gray-50" title="Sauvegarder">
                    <Save className="h-4 w-4 text-gray-600" />
                  </Button>
                  <Button onClick={handleExportExcel} variant="ghost" size="icon" className="h-9 w-9 rounded-full bg-gray-50" title="Excel">
                    <Download className="h-4 w-4 text-green-600" />
                  </Button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto bg-gray-50 p-3 md:p-6">
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
                    {waitingMessage || 'Traitement des fichiers en cours...'}
                  </h3>
                  <p className="text-sm text-gray-600 mb-4">
                    {waitingMessage && waitingMessage.includes('Démarrage') 
                      ? 'Le service se réveille, cela peut prendre jusqu\'à 90 secondes...'
                      : 'Extraction Python et analyse des données'}
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

              {/* Tabs Content - Modern glassmorphism design */}
              {debts.length > 0 && analysis && (
                <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
                  {/* Modern Tabs with glassmorphism */}
                  <div className="p-2 bg-white/50 backdrop-blur-xl rounded-2xl shadow-lg border border-white/60">
                    <TabsList className="flex w-full bg-transparent p-1 gap-1 overflow-x-auto">
                      <TabsTrigger 
                        value="dashboard" 
                        className="flex-1 min-w-[120px] flex items-center justify-center gap-2 rounded-xl data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-600 data-[state=active]:to-blue-700 data-[state=active]:text-white data-[state=active]:shadow-lg transition-all duration-300 py-2.5 md:py-3 text-xs md:text-sm"
                      >
                        <LayoutDashboard className="h-4 w-4" />
                        <span className="font-semibold">Vue d'ensemble</span>
                      </TabsTrigger>
                      <TabsTrigger 
                        value="aging" 
                        className="flex-1 min-w-[120px] flex items-center justify-center gap-2 rounded-xl data-[state=active]:bg-gradient-to-r data-[state=active]:from-emerald-600 data-[state=active]:to-emerald-700 data-[state=active]:text-white data-[state=active]:shadow-lg transition-all duration-300 py-2.5 md:py-3 text-xs md:text-sm"
                      >
                        <BarChart3 className="h-4 w-4" />
                        <span className="font-semibold">Analyse</span>
                      </TabsTrigger>
                      <TabsTrigger 
                        value="clients" 
                        className="flex-1 min-w-[120px] flex items-center justify-center gap-2 rounded-xl data-[state=active]:bg-gradient-to-r data-[state=active]:from-violet-600 data-[state=active]:to-violet-700 data-[state=active]:text-white data-[state=active]:shadow-lg transition-all duration-300 py-2.5 md:py-3 text-xs md:text-sm"
                      >
                        <Users className="h-4 w-4" />
                        <span className="font-semibold">Clients</span>
                      </TabsTrigger>
                      <TabsTrigger 
                        value="table" 
                        className="flex-1 min-w-[120px] flex items-center justify-center gap-2 rounded-xl data-[state=active]:bg-gradient-to-r data-[state=active]:from-amber-600 data-[state=active]:to-amber-700 data-[state=active]:text-white data-[state=active]:shadow-lg transition-all duration-300 py-2.5 md:py-3 text-xs md:text-sm"
                      >
                        <FileText className="h-4 w-4" />
                        <span className="font-semibold">Détail</span>
                      </TabsTrigger>
                    </TabsList>
                  </div>

                  <TabsContent value="dashboard" className="space-y-6">
                    {/* Boutons de génération de rapports */}
                    <div className="flex flex-wrap gap-3 mb-4">
                      <Button 
                        variant="outline" 
                        onClick={() => ExportService.exportToExcelByCommercial(debts)}
                        className="gap-2 bg-blue-50 hover:bg-blue-100 border-blue-200"
                      >
                        <svg className="h-4 w-4 text-green-600" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>
                        </svg>
                        <span>📊 Rapport Excel par Commercial</span>
                      </Button>
                      <Button 
                        variant="outline" 
                        onClick={() => ExportService.generateWordReportWithAI(debts)}
                        className="gap-2 bg-indigo-50 hover:bg-indigo-100 border-indigo-200"
                      >
                        <svg className="h-4 w-4 text-indigo-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>
                        </svg>
                        <span>📝 Rapport Word IA par Document</span>
                      </Button>
                    </div>
                    
                    <QuickFilters 
                      debts={debts}
                      onFilterChange={(filtered, activeFilter) => {
                        setFilteredDebts(filtered);
                        // Open modal if not 'all'
                        if (activeFilter !== 'all') {
                          setModalFilteredDebts(filtered);
                          setActiveFilterName(activeFilter);
                          setIsFilterModalOpen(true);
                        }
                      }}
                      onNavigateToDetail={() => setActiveTab('table')}
                    />
                    <Dashboard analysis={analysis} />
                  </TabsContent>

                  <TabsContent value="aging" className="space-y-6">
                    {/* Glassmorphism Card */}
                    <Card className="overflow-hidden border-0 shadow-2xl bg-gradient-to-br from-white to-slate-50">
                      <CardContent className="p-8">
                        <div className="flex items-center gap-3 mb-8">
                          <div className="p-3 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 shadow-lg">
                            <BarChart3 className="h-6 w-6 text-white" />
                          </div>
                          <div>
                            <h3 className="text-2xl font-bold text-slate-800">Répartition par Ancienneté</h3>
                            <p className="text-slate-500">Analyse détaillée des créances selon leur âge</p>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {analysis.agingBreakdown?.map((range: any, index: number) => (
                            <div key={index} className="group relative overflow-hidden rounded-2xl bg-white border border-slate-100 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-[1.02]">
                              {/* Gradient background */}
                              <div className={`
                                absolute inset-0 opacity-10
                                ${index === 0 ? 'bg-gradient-to-r from-emerald-500 to-green-600' :
                                  index === 1 ? 'bg-gradient-to-r from-amber-500 to-yellow-600' :
                                  index === 2 ? 'bg-gradient-to-r from-orange-500 to-red-500' :
                                  'bg-gradient-to-r from-red-600 to-rose-600'}
                              `} />
                              
                              <div className="relative p-6 flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                  <div className={`
                                    w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg
                                    ${index === 0 ? 'bg-gradient-to-br from-emerald-500 to-green-600' :
                                      index === 1 ? 'bg-gradient-to-br from-amber-500 to-yellow-600' :
                                      index === 2 ? 'bg-gradient-to-br from-orange-500 to-red-500' :
                                      'bg-gradient-to-br from-red-600 to-rose-600'}
                                  `}>
                                    <span className="text-white font-bold text-lg">{range.count}</span>
                                  </div>
                                  <div>
                                    <span className="block text-sm font-bold text-slate-700">{range.range}</span>
                                    <span className="text-xs text-slate-500">{range.count} créances</span>
                                  </div>
                                </div>
                                
                                <div className="text-right">
                                  <div className="text-2xl font-bold text-slate-800">{range.amount.toLocaleString('fr-FR')} <span className="text-sm font-normal text-slate-500">TND</span></div>
                                  <div className={`
                                    inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold
                                    ${index === 0 ? 'bg-emerald-100 text-emerald-700' :
                                      index === 1 ? 'bg-amber-100 text-amber-700' :
                                      index === 2 ? 'bg-orange-100 text-orange-700' :
                                      'bg-red-100 text-red-700'}
                                  `}>
                                    {range.percentage.toFixed(1)}%
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>

                  <TabsContent value="clients" className="space-y-6">
                    {/* Modern Clients Card with glassmorphism */}
                    <Card className="overflow-hidden border-0 shadow-2xl bg-gradient-to-br from-white to-violet-50/30">
                      <CardContent className="p-8">
                        <div className="flex items-center justify-between mb-8">
                          <div className="flex items-center gap-3">
                            <div className="p-3 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 shadow-lg">
                              <Users className="h-6 w-6 text-white" />
                            </div>
                            <div>
                              <h3 className="text-2xl font-bold text-slate-800">Portefeuille Clients</h3>
                              <p className="text-slate-500">{analysis.clientBreakdown?.length || 0} clients actifs</p>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Badge className="bg-emerald-100 text-emerald-700 px-3 py-1">
                              {analysis.clientBreakdown?.filter((c: any) => c.totalBalance === 0).length || 0} Sains
                            </Badge>
                            <Badge className="bg-red-100 text-red-700 px-3 py-1">
                              {analysis.clientBreakdown?.filter((c: any) => c.totalBalance > 0).length || 0} À risque
                            </Badge>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-1 gap-3">
                          {analysis.clientBreakdown?.map((client: any, index: number) => (
                            <div key={index} className="group relative overflow-hidden rounded-2xl bg-white border border-slate-100 shadow-md hover:shadow-xl transition-all duration-300 hover:scale-[1.01]">
                              <div className={`
                                absolute left-0 top-0 bottom-0 w-1
                                ${client.totalBalance > 1000 ? 'bg-gradient-to-b from-red-500 to-rose-600' :
                                  client.totalBalance > 500 ? 'bg-gradient-to-b from-amber-500 to-orange-500' :
                                  'bg-gradient-to-b from-emerald-500 to-green-600'}
                              `} />
                              
                              <div className="p-5 flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                  {/* Avatar with gradient */}
                                  <div className={`
                                    w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg
                                    ${client.totalBalance > 1000 ? 'bg-gradient-to-br from-red-500 to-rose-600' :
                                      client.totalBalance > 500 ? 'bg-gradient-to-br from-amber-500 to-orange-500' :
                                      'bg-gradient-to-br from-emerald-500 to-green-600'}
                                  `}>
                                    <span className="text-white font-bold text-lg">
                                      {(client.clientName || '?').charAt(0).toUpperCase()}
                                    </span>
                                  </div>
                                  
                                  <div>
                                    <div className="font-bold text-slate-800 text-lg">{client.clientName || 'Client inconnu'}</div>
                                    <div className="flex items-center gap-3 text-sm">
                                      <span className="text-slate-500">
                                        <span className="font-semibold text-slate-700">{client.debtCount}</span> factures
                                      </span>
                                      <span className="text-slate-300">|</span>
                                      <span className="text-slate-500">
                                        Délai moy: <span className="font-semibold text-slate-700">{Math.round(client.averagePaymentDelay)}j</span>
                                      </span>
                                    </div>
                                  </div>
                                </div>
                                
                                <div className="text-right">
                                  <div className="text-2xl font-bold text-slate-800">
                                    {client.totalBalance.toLocaleString('fr-FR')} <span className="text-sm font-normal text-slate-500">TND</span>
                                  </div>
                                  <div className={`
                                    inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold mt-1
                                    ${client.totalBalance > 1000 ? 'bg-red-100 text-red-700' :
                                      client.totalBalance > 500 ? 'bg-amber-100 text-amber-700' :
                                      'bg-emerald-100 text-emerald-700'}
                                  `}>
                                    {client.totalBalance > 1000 ? '🔴 Risque élevé' :
                                      client.totalBalance > 500 ? '🟠 Surveillance' :
                                      '🟢 Client sain'}
                                  </div>
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
                      debts={filteredDebts.length > 0 ? filteredDebts : debts} 
                      onExport={(filteredDebts) => ExportService.exportToExcel(filteredDebts)}
                    />
                  </TabsContent>
                </Tabs>
              )}
            </>
          )}
        </main>
        
        {/* Voice Assistant - visible when data is loaded */}
        {debts.length > 0 && (
          <VoiceAssistant 
            debts={debts} 
            analysis={analysis} 
            onShowResults={(results, title) => {
              setModalFilteredDebts(results);
              setActiveFilterName(title);
              setIsFilterModalOpen(true);
            }}
          />
        )}
      </div>

      {/* Filter Modal */}
      <FilteredResultsModal 
        isOpen={isFilterModalOpen}
        onClose={() => setIsFilterModalOpen(false)}
        debts={modalFilteredDebts}
        filterName={activeFilterName}
      />
    </div>
  );
}
