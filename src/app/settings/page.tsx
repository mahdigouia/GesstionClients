'use client';

import { useDebtContext } from '@/lib/DebtContext';
import { useAuth } from '@/lib/AuthContext';
import { Sidebar } from '@/components/Sidebar';
import { Settings, Trash2, Download, Upload, Info, User, LogOut, Mail, Shield, TrendingUp, FileText, Menu, Users } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ExportService } from '@/lib/export';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { db } from '@/lib/firebase';
import { collection, query, orderBy, limit, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { History, FileClock, FileCode, Eye } from 'lucide-react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";

export default function SettingsPage() {
  const { debts, analysis, clearAll, clearHistory, settings, updateSettings, logAudit } = useDebtContext();
  const { user, initials, fullName, logout, userRole } = useAuth();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [localSettings, setLocalSettings] = useState(settings);
  const [logs, setLogs] = useState<any[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [clickCount, setClickCount] = useState(0);
  const [showRulesModal, setShowRulesModal] = useState(false);
  const [rulesContent, setRulesContent] = useState('');
  const [isLoadingRules, setIsLoadingRules] = useState(false);

  const [usersList, setUsersList] = useState<any[]>([]);
  const [editingUsers, setEditingUsers] = useState<Record<string, { role: string; commercialCode: string | null }>>({});

  const adminEmails = ['moslem.gouia@gmail.com', 'mahdigouia@gmail.com'];
  const isAdmin = adminEmails.includes(user?.email || '') || userRole === 'admin';
  const isSuperAdmin = user?.email === 'moslem.gouia@gmail.com';

  useEffect(() => {
    setLocalSettings(settings);
  }, [settings]);

  useEffect(() => {
    if (isAdmin) {
      const q = query(collection(db, 'audit_logs'), orderBy('timestamp', 'desc'), limit(15));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const logsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setLogs(logsData);
      });
      return () => unsubscribe();
    }
  }, [user, isAdmin]);

  useEffect(() => {
    if (userRole === 'admin') {
      const q = query(collection(db, 'users'));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const usersData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setUsersList(usersData);
      }, (error) => {
        console.error("Erreur lors du chargement des utilisateurs :", error);
      });
      return () => unsubscribe();
    }
  }, [user, userRole]);

  const handleRoleChange = (userId: string, role: string, currentCode: string | null) => {
    setEditingUsers(prev => ({
      ...prev,
      [userId]: {
        role,
        commercialCode: prev[userId]?.commercialCode || currentCode || 'C01'
      }
    }));
  };

  const handleCodeChange = (userId: string, commercialCode: string) => {
    setEditingUsers(prev => ({
      ...prev,
      [userId]: {
        role: prev[userId]?.role || 'commercial',
        commercialCode
      }
    }));
  };

  const hasChanges = (userId: string, currentRole: string, currentCode: string | null) => {
    const edit = editingUsers[userId];
    if (!edit) return false;
    return edit.role !== currentRole || (edit.role === 'commercial' && edit.commercialCode !== currentCode);
  };

  const handleUpdateUserRole = async (userId: string, newRole: string, commercialCode: string | null, userEmail: string) => {
    try {
      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, {
        role: newRole,
        commercialCode: newRole === 'commercial' ? commercialCode : null
      });

      // Si le compte est promu, on résout la notification pending
      const notifRef = doc(db, 'notifications', `new_user_${userId}`);
      try {
        await updateDoc(notifRef, {
          status: 'resolved'
        });
      } catch (err) {
        // La notification peut ne pas exister, non bloquant
      }

      // Log audit
      await logAudit(
        'Habilitation Rôle',
        `Mise à jour du rôle de ${userEmail} vers '${newRole}'${newRole === 'commercial' ? ` (Code: ${commercialCode})` : ''}`
      );

      // Clean editing status for this user
      setEditingUsers(prev => {
        const next = { ...prev };
        delete next[userId];
        return next;
      });

      alert('Rôle mis à jour avec succès !');
    } catch (err) {
      console.error('Erreur lors de la mise à jour du rôle :', err);
      alert('Une erreur est survenue lors de la mise à jour du rôle.');
    }
  };

  const handleVersionClick = () => {
    if (!isAdmin) return;
    const newCount = clickCount + 1;
    if (newCount >= 5) {
      setShowAdvanced(true);
      setClickCount(0);
      alert("Mode Configuration Avancée activé !");
    } else {
      setClickCount(newCount);
    }
  };

  const handleUpdateSettings = async () => {
    setIsSaving(true);
    await updateSettings(localSettings);
    setIsSaving(false);
    alert("Paramètres mis à jour avec succès !\n\nIMPORTANT : N'oubliez pas de mettre à jour le fichier 'Regles & plans' pour refléter ces nouveaux seuils de calcul.");
  };

  const handleExportData = () => {
    if (analysis && debts.length > 0) {
      ExportService.saveAnalysis(debts, analysis, undefined, logAudit);
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
              
              // Journalisation avant le reload
              logAudit('Import JSON', `Restauration manuelle de ${data.debts.length} créances depuis un fichier JSON`).then(() => {
                window.location.reload();
              });
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

  const handleViewRules = async () => {
    setIsLoadingRules(true);
    try {
      const response = await fetch('/api/rules');
      if (response.ok) {
        const text = await response.text();
        setRulesContent(text);
        setShowRulesModal(true);
      } else {
        alert('Impossible de charger les règles.');
      }
    } catch (err) {
      console.error('Error fetching rules:', err);
      alert('Erreur lors du chargement.');
    } finally {
      setIsLoadingRules(false);
    }
  };

  const handleDownloadRules = () => {
    window.open('/api/rules', '_blank');
  };

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar mobileOpen={sidebarOpen} onMobileClose={() => setSidebarOpen(false)} />
      <div className="flex-1 overflow-y-auto">
        <header className="bg-white border-b border-gray-200 px-4 md:px-6 py-4 sticky top-0 z-20">
          <div className="flex items-center space-x-3 md:space-x-4">
            <Button
              variant="ghost"
              size="sm"
              className="md:hidden p-2 -ml-2"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu className="h-5 w-5" />
            </Button>
            <Settings className="h-5 w-5 md:h-6 md:w-6 text-blue-600" />
            <h1 className="text-lg md:text-xl font-bold text-gray-900">Paramètres</h1>
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

          {/* Gestion des Rôles & Habilitations (Admin only) */}
          {userRole === 'admin' && (
            <Card className="border-0 shadow-xl bg-white overflow-hidden border-l-4 border-l-indigo-600">
              <CardHeader className="bg-slate-50/50 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-indigo-600" />
                  <CardTitle className="text-lg font-bold">Gestion des Rôles & Habilitations</CardTitle>
                </div>
                <CardDescription>
                  Gérez l'accès des utilisateurs et affectez les codes commerciaux pour restreindre la visibilité des données.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-6">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-100 text-xs font-bold text-slate-400 uppercase tracking-wider">
                        <th className="py-3 px-4">Utilisateur</th>
                        <th className="py-3 px-4">Date Inscription</th>
                        <th className="py-3 px-4">Rôle</th>
                        <th className="py-3 px-4">Code Commercial</th>
                        <th className="py-3 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {usersList.map((u) => {
                        const edit = editingUsers[u.uid];
                        const role = edit ? edit.role : (u.role || 'pending');
                        const code = edit ? edit.commercialCode : (u.commercialCode || null);
                        const changed = hasChanges(u.uid, u.role || 'pending', u.commercialCode || null);
                        
                        return (
                          <tr key={u.uid} className="hover:bg-slate-50/50 transition-colors">
                            <td className="py-4 px-4">
                              <div className="flex items-center gap-3">
                                <Avatar className="h-9 w-9 border border-indigo-100">
                                  <AvatarFallback className="bg-indigo-50 text-indigo-600 font-bold text-sm">
                                    {u.fullName?.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase() || '??'}
                                  </AvatarFallback>
                                </Avatar>
                                <div>
                                  <div className="font-bold text-slate-800 text-sm">{u.fullName || 'Utilisateur'}</div>
                                  <div className="text-xs text-slate-500">{u.email}</div>
                                </div>
                              </div>
                            </td>
                            <td className="py-4 px-4 text-xs font-medium text-slate-500">
                              {u.createdAt ? new Date(u.createdAt).toLocaleDateString('fr-FR', {
                                day: 'numeric',
                                month: 'short',
                                year: 'numeric'
                              }) : 'Inconnue'}
                            </td>
                            <td className="py-4 px-4">
                              <select
                                value={role}
                                onChange={(e) => handleRoleChange(u.uid, e.target.value, u.commercialCode || null)}
                                className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm text-slate-700 cursor-pointer"
                              >
                                <option value="pending">En attente (pending)</option>
                                <option value="commercial">Commercial</option>
                                <option value="gestionnaire">Gestionnaire</option>
                                <option value="admin">Administrateur</option>
                              </select>
                            </td>
                            <td className="py-4 px-4">
                              {role === 'commercial' ? (
                                <select
                                  value={code || 'C01'}
                                  onChange={(e) => handleCodeChange(u.uid, e.target.value)}
                                  className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm text-slate-700 cursor-pointer"
                                >
                                  <option value="C01">C01</option>
                                  <option value="C02">C02</option>
                                  <option value="C03">C03</option>
                                  <option value="C04">C04</option>
                                  <option value="C05">C05</option>
                                  <option value="C07">C07</option>
                                </select>
                              ) : (
                                <span className="text-xs text-slate-400 font-medium italic">Non applicable</span>
                              )}
                            </td>
                            <td className="py-4 px-4 text-right">
                              <Button
                                size="sm"
                                disabled={!changed}
                                onClick={() => handleUpdateUserRole(u.uid, role, code, u.email)}
                                className={cn(
                                  "text-xs font-bold px-4 py-1.5 rounded-xl h-8 transition-all duration-300",
                                  changed
                                    ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/10 scale-105"
                                    : "bg-slate-100 text-slate-400"
                                )}
                              >
                                Enregistrer
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                      {usersList.length === 0 && (
                        <tr>
                          <td colSpan={5} className="py-8 text-center text-slate-400 text-sm font-medium">
                            Aucun utilisateur trouvé.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Configuration Dynamique (Hidden behind Secret Click + Admin) */}
          {isAdmin && showAdvanced && (
            <Card className="border-0 shadow-lg bg-white overflow-hidden border-l-4 border-l-blue-600 animate-in fade-in slide-in-from-top-4 duration-500">
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
          )}

          {/* Journal d'historisation (Super Admin Only) */}
          {isSuperAdmin && (
            <Card className="border-0 shadow-xl bg-slate-900 text-white overflow-hidden">
              <CardHeader className="border-b border-white/10 bg-white/5">
                <CardTitle className="text-lg font-bold flex items-center gap-2">
                  <FileClock className="h-5 w-5 text-emerald-400" />
                  Journal d'Audit (Super Administrateur)
                </CardTitle>
                <CardDescription className="text-slate-400">Activités récentes (moslem.gouia@gmail.com uniquement)</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="max-h-[400px] overflow-y-auto">
                  {logs.length > 0 ? (
                    <div className="divide-y divide-white/5">
                      {logs.map((log) => (
                        <div key={log.id} className="p-4 hover:bg-white/5 transition-colors">
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex flex-col">
                              <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">{log.action}</span>
                              <span className="text-[9px] text-slate-500 font-bold">{log.user}</span>
                            </div>
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
                <div 
                  className={`font-black cursor-pointer select-none transition-colors ${isAdmin ? 'hover:text-blue-600' : ''}`}
                  onClick={handleVersionClick}
                >
                  2.0 {isAdmin && !showAdvanced && <span className="text-[10px] font-normal text-slate-300 ml-1">(Click 5x)</span>}
                </div>
                <div className="text-gray-500">Devise</div>
                <div className="font-medium">Dinars Tunisiens (TND)</div>
                <div className="text-gray-500">Stockage</div>
                <div className="font-medium">Firebase (Cloud) + Local</div>
              </div>
            </CardContent>
          </Card>

          {/* Règles & Plans (Hidden behind Secret Click + Admin) */}
          {isAdmin && showAdvanced && (
            <Card className="border-0 shadow-lg bg-white overflow-hidden border-l-4 border-l-emerald-600 animate-in fade-in slide-in-from-top-4 duration-500">
              <CardHeader className="bg-emerald-50/50 border-b border-emerald-100">
                <CardTitle className="text-lg font-bold flex items-center gap-2">
                  <FileCode className="h-5 w-5 text-emerald-600" />
                  Règles Métier & Plan d'Analyse
                </CardTitle>
                <CardDescription>Consultez la documentation technique et les règles de calcul de l'application</CardDescription>
              </CardHeader>
              <CardContent className="p-6">
                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-emerald-100 rounded-lg">
                      <FileText className="h-5 w-5 text-emerald-600" />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-800">regles_et_plans.md</h4>
                      <p className="text-xs text-slate-500">Dernière version à jour</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button 
                      onClick={handleViewRules} 
                      variant="outline" 
                      size="sm" 
                      disabled={isLoadingRules}
                      className="border-emerald-200 text-emerald-700 hover:bg-emerald-50 h-10 px-4 rounded-xl font-bold"
                    >
                      {isLoadingRules ? (
                        <div className="h-4 w-4 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin mr-2" />
                      ) : (
                        <Eye className="h-4 w-4 mr-2" />
                      )}
                      Consulter
                    </Button>
                    <Button 
                      onClick={handleDownloadRules} 
                      variant="outline" 
                      size="sm"
                      className="bg-emerald-600 text-white border-0 hover:bg-emerald-700 h-10 px-4 rounded-xl font-bold"
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Télécharger
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

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

      <RulesModal 
        isOpen={showRulesModal} 
        onClose={() => setShowRulesModal(false)} 
        content={rulesContent} 
      />
    </div>
  );
}

function RulesModal({ isOpen, onClose, content }: { isOpen: boolean, onClose: () => void, content: string }) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[85vh] p-0 overflow-hidden bg-white rounded-[32px] border-0 shadow-2xl">
        <DialogHeader className="p-8 bg-slate-900 text-white">
          <div className="flex items-center gap-3 mb-2">
            <FileCode className="h-6 w-6 text-emerald-400" />
            <DialogTitle className="text-2xl font-black tracking-tight">Règles Métier & Plan d'Analyse</DialogTitle>
          </div>
          <DialogDescription className="text-slate-400 font-medium">
            Documentation complète des algorithmes et règles de gestion de GesstionClients
          </DialogDescription>
        </DialogHeader>
        
        <ScrollArea className="p-8 h-[calc(85vh-160px)]">
          <div className="prose prose-slate max-w-none">
            <pre className="whitespace-pre-wrap font-mono text-sm text-slate-700 bg-slate-50 p-6 rounded-2xl border border-slate-100 leading-relaxed">
              {content}
            </pre>
          </div>
        </ScrollArea>
        
        <div className="p-6 border-t border-slate-100 bg-slate-50 flex justify-end">
          <Button onClick={onClose} className="bg-slate-900 text-white hover:bg-slate-800 rounded-xl px-8 font-bold">
            Fermer la consultation
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
