'use client';

import { useDebtContext } from '@/lib/DebtContext';
import { useAuth } from '@/lib/AuthContext';
import { Sidebar } from '@/components/Sidebar';
import { Settings, Trash2, Download, Upload, Info, User, LogOut, Mail, Shield, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ExportService } from '@/lib/export';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { db } from '@/lib/firebase';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { History, FileClock } from 'lucide-react';

export default function SettingsPage() {
  const { debts, analysis, clearAll, clearHistory, settings, updateSettings } = useDebtContext();
  const { user, initials, fullName, logout } = useAuth();
  const router = useRouter();

  const [localSettings, setLocalSettings] = useState(settings);
  const [logs, setLogs] = useState<any[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setLocalSettings(settings);
  }, [settings]);

  useEffect(() => {
    if (user?.email === 'moslem.gouia@gmail.com') {
      const q = query(collection(db, 'audit_logs'), orderBy('timestamp', 'desc'), limit(15));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const logsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setLogs(logsData);
      });
      return () => unsubscribe();
    }
  }, [user]);

  const handleUpdateSettings = async () => {
    setIsSaving(true);
    await updateSettings(localSettings);
    setIsSaving(false);
    alert("Paramètres mis à jour avec succès !\n\nIMPORTANT : N'oubliez pas de mettre à jour le fichier 'Regles & plans' pour refléter ces nouveaux seuils de calcul.");
  };

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

  const handleClearHistory = () => {
    if (confirm('Êtes-vous sûr de vouloir réinitialiser l\'historique d\'évolution ?')) {
      clearHistory();
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      router.push('/login');
    } catch (err) {
      console.error('Logout error:', err);
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
          {/* Profil utilisateur */}
          <Card className="border-0 shadow-xl bg-gradient-to-br from-blue-600 to-violet-600 text-white overflow-hidden relative">
            <div className="absolute inset-0 bg-white/10 backdrop-blur-sm" />
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/20 rounded-full blur-3xl" />
            
            <CardHeader className="relative z-10">
              <CardTitle className="flex items-center gap-2 text-white">
                <User className="h-5 w-5" />
                Profil Utilisateur
              </CardTitle>
              <CardDescription className="text-blue-100">
                Informations de votre compte
              </CardDescription>
            </CardHeader>
            <CardContent className="relative z-10">
              <div className="flex items-center gap-4 mb-6">
                <Avatar className="h-16 w-16 border-4 border-white/30 shadow-xl">
                  <AvatarFallback className="bg-white text-blue-600 font-bold text-2xl">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h3 className="text-xl font-bold">{fullName}</h3>
                  <div className="flex items-center gap-2 text-blue-100 text-sm mt-1">
                    <Mail className="h-4 w-4" />
                    {user?.email}
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-2 p-3 bg-white/20 rounded-xl backdrop-blur-sm">
                <Shield className="h-5 w-5 text-green-300" />
                <span className="text-sm">Compte vérifié via Firebase Authentication</span>
              </div>
              
              <Button 
                onClick={handleLogout}
                variant="outline" 
                className="mt-4 w-full bg-white/20 border-white/30 text-white hover:bg-white/30"
              >
                <LogOut className="h-4 w-4 mr-2" />
                Se déconnecter
              </Button>
            </CardContent>
          </Card>

          {/* Configuration Dynamique */}
          <Card className="border-0 shadow-lg bg-white overflow-hidden">
            <CardHeader className="bg-slate-50 border-b border-slate-100">
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <Settings className="h-5 w-5 text-blue-600" />
                Seuils de Calcul (Business Logic)
              </CardTitle>
              <CardDescription>Ajustez les règles d'analyse de votre portefeuille</CardDescription>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="contentieux" className="text-sm font-bold text-slate-700">Âge de Contentieux (jours)</Label>
                    <div className="flex items-center gap-3">
                      <Input 
                        id="contentieux"
                        type="number" 
                        value={localSettings.contentiousAgeDays}
                        onChange={(e) => setLocalSettings({...localSettings, contentiousAgeDays: parseInt(e.target.value)})}
                        className="font-bold text-lg h-12 border-slate-200 focus:ring-blue-500"
                      />
                      <span className="text-slate-400 font-medium">jours</span>
                    </div>
                    <p className="text-[10px] text-slate-400 font-medium italic">Par défaut: 365 jours. Détermine l'indicateur H.C (Hors Contentieux).</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-sm font-bold text-slate-700">Intervalle des "Retenus" (%)</Label>
                    <div className="flex items-center gap-2">
                      <Input 
                        type="number" 
                        step="0.1"
                        value={localSettings.retentionMin}
                        onChange={(e) => setLocalSettings({...localSettings, retentionMin: parseFloat(e.target.value)})}
                        className="font-bold text-lg h-12 border-slate-200 focus:ring-blue-500 w-24"
                      />
                      <span className="text-slate-400 font-bold">à</span>
                      <Input 
                        type="number" 
                        step="0.1"
                        value={localSettings.retentionMax}
                        onChange={(e) => setLocalSettings({...localSettings, retentionMax: parseFloat(e.target.value)})}
                        className="font-bold text-lg h-12 border-slate-200 focus:ring-blue-500 w-24"
                      />
                      <span className="text-slate-400 font-medium">%</span>
                    </div>
                    <p className="text-[10px] text-slate-400 font-medium italic">Actuellement configuré sur [{localSettings.retentionMin}% - {localSettings.retentionMax}%].</p>
                  </div>
                </div>
              </div>

              <Button 
                onClick={handleUpdateSettings} 
                disabled={isSaving}
                className="mt-8 bg-blue-600 hover:bg-blue-700 text-white font-bold h-12 px-8 rounded-xl transition-all"
              >
                {isSaving ? 'Mise à jour...' : 'Appliquer les nouveaux seuils'}
              </Button>
            </CardContent>
          </Card>

          {/* Journal d'historisation (Admin Only) */}
          {user?.email === 'moslem.gouia@gmail.com' && (
            <Card className="border-0 shadow-xl bg-slate-900 text-white overflow-hidden">
              <CardHeader className="border-b border-white/10 bg-white/5">
                <CardTitle className="text-lg font-bold flex items-center gap-2">
                  <FileClock className="h-5 w-5 text-emerald-400" />
                  Journal d'Audit (Administrateur)
                </CardTitle>
                <CardDescription className="text-slate-400">Activités récentes pour {user.email}</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="max-h-[400px] overflow-y-auto">
                  {logs.length > 0 ? (
                    <div className="divide-y divide-white/5">
                      {logs.map((log) => (
                        <div key={log.id} className="p-4 hover:bg-white/5 transition-colors">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">{log.action}</span>
                            <span className="text-[10px] text-slate-500 font-medium">
                              {log.timestamp?.toDate ? log.timestamp.toDate().toLocaleString('fr-FR') : 'Date inconnue'}
                            </span>
                          </div>
                          <p className="text-sm font-medium text-slate-200">{log.details}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-8 text-center text-slate-500">
                      <p>Aucun log d'activité pour le moment.</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

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
                <div className="text-gray-500">Stockage</div>
                <div className="font-medium">Firebase (Cloud) + Local</div>
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
              <div className="flex items-center justify-between p-4 border border-amber-200 rounded-lg bg-amber-50">
                <div>
                  <h4 className="font-medium text-amber-800">Réinitialiser l'historique</h4>
                  <p className="text-sm text-amber-600">Supprimer les points de données d'évolution</p>
                </div>
                <Button onClick={handleClearHistory} variant="outline" size="sm" className="border-amber-300 text-amber-700 hover:bg-amber-100">
                  <History className="h-4 w-4 mr-2" />
                  Réinitialiser
                </Button>
              </div>
            </CardContent>
          </Card>
        </main>
      </div>
    </div>
  );
}
