'use client';

import { useState, useEffect } from 'react';
import { Sidebar } from '@/components/Sidebar';
import { FileUpload } from '@/components/FileUpload';
import { Dashboard } from '@/components/Dashboard';
import { DebtTable } from '@/components/DebtTable';
import { QuickFilters } from '@/components/QuickFilters';
import { VoiceAssistant } from '@/components/VoiceAssistant';
import { AddActionModal } from '@/components/AddActionModal';
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
  PhoneCall,
  Settings,
  Save,
  X,
  Menu,
  FileSpreadsheet
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { FilteredResultsModal } from '@/components/FilteredResultsModal';
import { NotificationPopover } from '@/components/NotificationPopover';
import { SmartCalculator } from '@/components/SmartCalculator';
import { ClientHistoryModal } from '@/components/ClientHistoryModal';
import { useToast } from '@/hooks/use-toast';
import { ContactDirectory } from '@/components/ContactDirectory';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import Link from 'next/link';
import { useAuth } from '@/lib/AuthContext';
import { ClientRemarkModal } from '@/components/ClientRemarkModal';

export default function Home() {
  const { 
    debts, 
    archiveDebts, 
    analysis, 
    addDebts, 
    updateDebtsFromFile, 
    updateDebtsFromFiles, 
    setDebts, 
    setAnalysis, 
    addRecoveryAction, 
    logAudit,
    clientRemarks,
    addClientRemark,
    updateClientRemark,
    deleteClientRemark
  } = useDebtContext();
  const { userRole } = useAuth();
  const { toast } = useToast();
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
  
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [selectedClientName, setSelectedClientName] = useState('');
  const [clientHistoryDebts, setClientHistoryDebts] = useState<ClientDebt[]>([]);
  
  const [isRemarkModalOpen, setIsRemarkModalOpen] = useState(false);
  const [remarkClientName, setRemarkClientName] = useState('');

  const [isQuickActionOpen, setIsQuickActionOpen] = useState(false);
  const [quickActionClient, setQuickActionClient] = useState('');

  const [waitingMessage, setWaitingMessage] = useState<string | null>(null);
  const [selectedClientCommercial, setSelectedClientCommercial] = useState('all');

  // Initialize filtered debts when debts change
  useEffect(() => {
    console.log("Debts updated, re-filtering...");
    setFilteredDebts(debts);
  }, [debts]);

  const handleFileProcess = async (files: File[]) => {
    setIsProcessing(true);
    setProgress(0);
    setError(null);
    setWaitingMessage(null);
    let filesProcessed = 0;
    
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
      
      const allExtractedData: { filename: string, debts: ClientDebt[] }[] = [];
      
      // Traiter chaque fichier un par un avec fusion intelligente
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const fileProgress = 50 + (50 * (i + 1) / files.length);
        setProgress(Math.round(fileProgress));
        setWaitingMessage(`Traitement de ${file.name}...`);
        
        // Extraction via Python
        const result = await OCRService.extractDebtsFromPDF(file);
        
        if (result.success && result.debts.length > 0) {
          allExtractedData.push({ filename: file.name, debts: result.debts });
          filesProcessed++;
        } else if (result.error) {
          console.error(`[Import] Erreur pour ${file.name}:`, result.error);
        }
      }
      
      if (filesProcessed === 0) {
        throw new Error('Aucune donnée valide n\'a pu être extraite des fichiers.');
      }

      // Mise à jour groupée de toutes les données
      const stats = updateDebtsFromFiles(allExtractedData);
      
      // Notification globale
      toast({
        title: `Import terminé : ${filesProcessed} fichiers`,
        description: `${stats.new} nouvelles factures, ${stats.updated} mises à jour, ${stats.removed} soldées.`,
        variant: "default",
      });

      logAudit('Import Fichiers', `Traitement de ${filesProcessed} fichiers (${allExtractedData.map(d => d.filename).join(', ')}). ${stats.new} nouvelles, ${stats.updated} MAJ, ${stats.removed} soldées.`);
      
      // Étape finale
      setProgress(100);
      setWaitingMessage("Finalisation...");
      
      setTimeout(() => {
        setIsProcessing(false);
        setWaitingMessage(null);
        setActiveTab('dashboard');
      }, 800);
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Une erreur est survenue lors du traitement';
      setError(errorMessage);
      console.error('Processing error:', err);
      setIsProcessing(false);
      setProgress(0);
    }
  };

  const handleShowClientHistory = (clientName: string) => {
    const activeClientDebts = debts.filter(d => d.clientName === clientName);
    const archivedClientDebts = (archiveDebts || []).filter(d => d.clientName === clientName);
    
    // Fusionner pour l'historique en combinant créances actives et archivées
    const combinedMap = new Map<string, ClientDebt>();
    archivedClientDebts.forEach(d => combinedMap.set(d.documentNumber + '_' + (d.lastImportDate || ''), d));
    activeClientDebts.forEach(d => combinedMap.set(d.documentNumber + '_' + (d.lastImportDate || ''), d));
    
    setSelectedClientName(clientName);
    setClientHistoryDebts(Array.from(combinedMap.values()));
    setIsHistoryModalOpen(true);
  };

  const handleShowClientRemark = (clientName: string) => {
    setRemarkClientName(clientName);
    setIsRemarkModalOpen(true);
  };

  const handleExportExcel = () => {
    if (debts.length > 0) {
      ExportService.exportToExcel(debts, analysis || undefined, logAudit);
    }
  };

  const handleExportPDF = async () => {
    if (analysis) {
      await ExportService.exportToPDF('dashboard-content', undefined, logAudit);
    }
  };

  const handleSaveAnalysis = () => {
    if (debts.length > 0 && analysis) {
      ExportService.saveAnalysis(debts, analysis, undefined, logAudit);
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
              {/* Action Buttons - Excel and Word */}
              {debts.length > 0 && (
                <div className="flex items-center space-x-1 md:space-x-2">
                  <Button 
                    onClick={() => ExportService.exportToExcelByCommercial(debts, logAudit)} 
                    variant="outline" 
                    size="sm" 
                    className="h-9 px-2 md:px-3 bg-green-50 hover:bg-green-100 border-green-200 text-green-700 gap-1.5"
                    title="Rapport Excel"
                  >
                    <FileSpreadsheet className="h-4 w-4" />
                    <span className="hidden sm:inline text-xs font-bold">Excel</span>
                  </Button>
                  <Button 
                    onClick={() => ExportService.generateWordReportWithAI(debts, analysis || undefined, logAudit)} 
                    variant="outline" 
                    size="sm" 
                    className="h-9 px-2 md:px-3 bg-indigo-50 hover:bg-indigo-100 border-indigo-200 text-indigo-700 gap-1.5"
                    title="Rapport Word IA"
                  >
                    <FileText className="h-4 w-4" />
                    <span className="hidden sm:inline text-xs font-bold">Word IA</span>
                  </Button>
                </div>
              )}

              {/* Smart Calculator */}
              <SmartCalculator />

              {/* Notifications */}
              <NotificationPopover />
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
                  {/* Modern Tabs with glassmorphism - Optimized for Mobile */}
                  <div className="sticky top-0 z-30 -mx-4 md:mx-0 mb-8 px-4 py-2 bg-slate-50/80 backdrop-blur-md md:bg-transparent md:backdrop-blur-none">
                    <div className="flex justify-start md:justify-center overflow-x-auto scrollbar-hide">
                      <TabsList className="bg-white/70 backdrop-blur-md p-1 rounded-2xl shadow-sm border border-slate-200/50 flex-nowrap inline-flex min-w-max md:min-w-0">
                        <TabsTrigger value="dashboard" className="rounded-xl font-bold px-4 md:px-6 py-2 data-[state=active]:bg-white data-[state=active]:text-blue-700 data-[state=active]:shadow-md transition-all whitespace-nowrap text-[11px] md:text-sm flex items-center gap-2">
                          <TrendingUp className="h-4 w-4" />
                          <span>Vue d'ensemble</span>
                        </TabsTrigger>
                        <TabsTrigger value="contacts" className="rounded-xl font-bold px-4 md:px-6 py-2 data-[state=active]:bg-white data-[state=active]:text-amber-700 data-[state=active]:shadow-md transition-all whitespace-nowrap text-[11px] md:text-sm flex items-center gap-2">
                          <PhoneCall className="h-4 w-4" />
                          <span>Contacts</span>
                        </TabsTrigger>
                        <TabsTrigger value="table" className="rounded-xl font-bold px-4 md:px-6 py-2 data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-md transition-all whitespace-nowrap text-[11px] md:text-sm flex items-center gap-2">
                          <FileText className="h-4 w-4" />
                          <span>Détail</span>
                        </TabsTrigger>
                      </TabsList>
                    </div>
                  </div>

                  <TabsContent value="dashboard" className="space-y-6">
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
                    <Dashboard 
                      analysis={analysis} 
                      onClientClick={handleShowClientRemark} 
                      onRelanceClick={handleShowClientRemark}
                    />
                  </TabsContent>

                  <TabsContent value="contacts" className="space-y-6">
                    <ContactDirectory />
                  </TabsContent>

                  <TabsContent value="table" className="space-y-6">
                    <DebtTable 
                      debts={filteredDebts.length > 0 ? filteredDebts : debts} 
                      onExport={(filteredDebts) => ExportService.exportToExcel(filteredDebts, analysis || undefined, logAudit)}
                      onClientClick={handleShowClientRemark}
                      onQuickAction={(clientName) => {
                        setQuickActionClient(clientName);
                        setIsQuickActionOpen(true);
                      }}
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

        {/* Floating shortcut to Clients page ("liste de créances") - Scroll resilient, optimized for mobile */}
        {debts.length > 0 && (
          <Link
            href="/clients"
            title={userRole === 'commercial' ? "Liste de créances" : "Liste de créances générale"}
            className="fixed bottom-20 right-4 md:bottom-24 md:right-6 z-40 w-14 h-14 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white shadow-lg hover:shadow-xl flex items-center justify-center transition-all duration-300 hover:scale-110 active:scale-95 group"
          >
            <Users className="h-6 w-6" />
            
            {/* Tooltip on hover */}
            <span className="absolute right-16 scale-0 group-hover:scale-100 transition-all origin-right bg-slate-900/95 text-white text-xs font-bold px-3 py-1.5 rounded-lg whitespace-nowrap shadow-md pointer-events-none">
              {userRole === 'commercial' ? "Liste de créances" : "Liste de créances générale"}
            </span>
          </Link>
        )}
      </div>

      {/* Filter Modal */}
      <FilteredResultsModal 
        isOpen={isFilterModalOpen}
        onClose={() => setIsFilterModalOpen(false)}
        debts={modalFilteredDebts}
        filterName={activeFilterName}
      />

      {/* Client History Modal */}
      <ClientHistoryModal 
        isOpen={isHistoryModalOpen}
        onClose={() => setIsHistoryModalOpen(false)}
        clientName={selectedClientName}
        clientDebts={clientHistoryDebts}
      />

      {/* Quick Action Modal */}
      <AddActionModal 
        isOpen={isQuickActionOpen}
        onClose={() => setIsQuickActionOpen(false)}
        onSubmit={addRecoveryAction}
        clientName={quickActionClient}
      />

      <ClientRemarkModal
        isOpen={isRemarkModalOpen}
        onClose={() => setIsRemarkModalOpen(false)}
        clientName={remarkClientName}
        remarks={clientRemarks[remarkClientName] || []}
        onAddRemark={addClientRemark}
        onUpdateRemark={updateClientRemark}
        onDeleteRemark={deleteClientRemark}
      />
    </div>
  );
}
