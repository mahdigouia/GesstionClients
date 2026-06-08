'use client';

import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import { ClientDebt, AnalysisResult, RecoveryAction } from '@/types/debt';
import { AnalysisService } from '@/lib/analysis';
import { db } from '@/lib/firebase';
import { useAuth } from '@/lib/AuthContext';
import { doc, setDoc, onSnapshot, serverTimestamp, collection, addDoc, getDocs } from 'firebase/firestore';

interface DebtContextType {
  debts: ClientDebt[];
  archiveDebts: ClientDebt[];
  analysis: AnalysisResult | null;
  recoveryActions: RecoveryAction[];
  clientRemarks: Record<string, ClientRemark[]>;
  setDebts: (debts: ClientDebt[]) => void;
  setAnalysis: (analysis: AnalysisResult | null) => void;
  addDebts: (newDebts: ClientDebt[]) => void;
  addRecoveryAction: (action: Omit<RecoveryAction, 'id' | 'date' | 'user'>) => void;
  addClientRemark: (clientName: string, content: string, promiseDate?: string, promiseAmount?: number) => void;
  updateClientRemark: (clientName: string, remarkId: string, content: string, promiseDate?: string, promiseAmount?: number) => void;
  deleteClientRemark: (clientName: string, remarkId: string) => void;
  updateDebtsFromFile: (filename: string, newDebts: ClientDebt[]) => { 
    updated: number, 
    new: number, 
    removed: number, 
    totalChange: number 
  };
  updateDebtsFromFiles: (filesData: { filename: string, debts: ClientDebt[] }[]) => {
    updated: number,
    new: number,
    removed: number,
    totalChange: number
  };
  clearAll: () => void;
  deleteFileDebts: (filename: string) => Promise<void>;
  lastUpdatedBy: string | null;
  readAlertIds: string[];
  markAllNotificationsAsRead: () => void;
  history: HistoryPoint[];
  clearHistory: () => void;
  settings: AppSettings;
  updateSettings: (newSettings: Partial<AppSettings>) => void;
  logAudit: (action: string, details: string) => Promise<void>;
  toggleManualContentious: (documentNumber: string) => Promise<void>;
  markInvoiceAsPaid: (documentNumber: string, paymentMethod: 'versement' | 'espece' | 'traite' | 'cheque') => Promise<void>;
  markClientAsPaid: (clientName: string, paymentMethod: 'versement' | 'espece' | 'traite' | 'cheque') => Promise<void>;
}

export interface AppSettings {
  contentiousAgeDays: number;
  retentionMin: number;
  retentionMax: number;
}

export interface AuditLog {
  id: string;
  user: string;
  action: string;
  details: string;
  timestamp: any;
}

export interface HistoryPoint {
  date: string;
  totalBalance: number;
  totalPaid: number;
  recoveryRate: number;
  debtCount: number;
  commercialStats?: any[];
}

const DebtContext = createContext<DebtContextType | undefined>(undefined);

const FIRESTORE_COLLECTION = 'shared_data';
const FIRESTORE_DOC = 'current_debts';

export function DebtProvider({ children }: { children: ReactNode }) {
  const [rawDebts, setRawDebts] = useState<ClientDebt[]>([]);
  const [rawArchiveDebts, setRawArchiveDebts] = useState<ClientDebt[]>([]);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [recoveryActions, setRecoveryActions] = useState<RecoveryAction[]>([]);
  const [clientRemarks, setClientRemarks] = useState<Record<string, ClientRemark[]>>({});
  const [lastUpdatedBy, setLastUpdatedBy] = useState<string | null>(null);
  const [readAlertIds, setReadAlertIds] = useState<string[]>([]);
  const [history, setHistory] = useState<HistoryPoint[]>([]);
  const [settings, setSettings] = useState<AppSettings>({ contentiousAgeDays: 365, retentionMin: 0.5, retentionMax: 1.5 });
  const [manualContentiousInvoices, setManualContentiousInvoices] = useState<Record<string, boolean>>({});
  const [firestoreReady, setFirestoreReady] = useState(false);
  const isLocalUpdateRef = useRef(false); // Guard: skip onSnapshot during local imports
  const saveFailedRef = useRef(false); // Track if last save failed
  const { user, userRole, commercialCode } = useAuth();

  // Liste mémoïsée et filtrée selon le rôle de l'utilisateur
  const debts = React.useMemo(() => {
    if (userRole === 'commercial' && commercialCode) {
      return rawDebts.filter(d => d.commercialCode === commercialCode);
    }
    return rawDebts;
  }, [rawDebts, userRole, commercialCode]);

  const archiveDebts = React.useMemo(() => {
    if (userRole === 'commercial' && commercialCode) {
      return rawArchiveDebts.filter(d => d.commercialCode === commercialCode);
    }
    return rawArchiveDebts;
  }, [rawArchiveDebts, userRole, commercialCode]);

  // Analyse réactive de la liste filtrée
  useEffect(() => {
    if (debts.length > 0) {
      const newAnalysis = AnalysisService.analyzeDebts(debts, {
        ...settings,
        manualContentiousInvoices
      });
      setAnalysis(newAnalysis);
    } else {
      setAnalysis(null);
    }
  }, [debts, settings, manualContentiousInvoices]);

  // Écouter les changements Firestore en temps réel (collaboratif)
  useEffect(() => {
    let unsubscribe: (() => void) | null = null;

    try {
      const docRef = doc(db, FIRESTORE_COLLECTION, FIRESTORE_DOC);
      unsubscribe = onSnapshot(docRef, (snapshot) => {
        // Skip Firestore echo during local import to prevent old data from flashing back
        if (isLocalUpdateRef.current) {
          console.log('[DebtContext] Skipping onSnapshot during local update (guard active)');
          setFirestoreReady(true);
          return;
        }

        // If last save failed, prefer localStorage data over stale Firestore data
        if (saveFailedRef.current) {
          console.warn('[DebtContext] Last save failed, loading from localStorage instead of Firestore');
          loadFromLocalStorage();
          saveFailedRef.current = false;
          setFirestoreReady(true);
          return;
        }

        if (snapshot.exists()) {
          const data = snapshot.data();
          const firestoreDebts = data.debts || [];
          const currentSettings = data.settings || settings;
          const manualContentious = data.manualContentiousInvoices || {};
          
          let processed = firestoreDebts;
          if (firestoreDebts.length > 0) {
            const tempAnalysis = AnalysisService.analyzeDebts(firestoreDebts, {
              ...currentSettings,
              manualContentiousInvoices: manualContentious
            });
            if (tempAnalysis.processedDebts) {
              processed = tempAnalysis.processedDebts;
            }
          }
          
          setRawDebts(processed);
          setRawArchiveDebts(data.archiveDebts || []);
          setRecoveryActions(data.recoveryActions || []);
          setClientRemarks(data.clientRemarks || {});
          setLastUpdatedBy(data.updatedBy || null);
          setReadAlertIds(data.readAlertIds || []);
          setHistory(data.history || []);
          if (data.settings) setSettings(data.settings);
          setManualContentiousInvoices(manualContentious);
        } else {
          // Pas encore de données Firestore, charger depuis localStorage comme fallback
          loadFromLocalStorage();
        }
        setFirestoreReady(true);
      }, (error) => {
        console.warn('[DebtContext] Firestore error, falling back to localStorage:', error);
        loadFromLocalStorage();
        setFirestoreReady(true);
      });
    } catch (error) {
      console.warn('[DebtContext] Firestore init error, falling back to localStorage:', error);
      loadFromLocalStorage();
      setFirestoreReady(true);
    }

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  const loadFromLocalStorage = () => {
    try {
      const savedDebts = localStorage.getItem('gc_debts');
      const savedArchive = localStorage.getItem('gc_archive');
      const savedAnalysis = localStorage.getItem('gc_analysis');
      const savedManual = localStorage.getItem('gc_manual_contentious');
      if (savedDebts) {
        setRawDebts(JSON.parse(savedDebts));
      }
      if (savedArchive) {
        setRawArchiveDebts(JSON.parse(savedArchive));
      }
      if (savedAnalysis) {
        setAnalysis(JSON.parse(savedAnalysis));
      }
      const savedSettings = localStorage.getItem('gc_settings');
      if (savedSettings) {
        setSettings(JSON.parse(savedSettings));
      }
      const savedRemarks = localStorage.getItem('gc_remarks');
      if (savedRemarks) {
        setClientRemarks(JSON.parse(savedRemarks));
      }
      if (savedManual) {
        setManualContentiousInvoices(JSON.parse(savedManual));
      }
    } catch (e) {
      console.warn('Erreur chargement données sauvegardées:', e);
    }
  };

// Helper to clean undefined properties from objects recursively before writing to Firestore
function cleanUndefined(obj: any): any {
  if (obj === undefined) return null;
  if (obj === null) return null;
  if (Array.isArray(obj)) {
    return obj.map(cleanUndefined);
  }
  if (typeof obj === 'object') {
    const cleaned: any = {};
    for (const key in obj) {
      if (obj[key] !== undefined) {
        cleaned[key] = cleanUndefined(obj[key]);
      }
    }
    return cleaned;
  }
  return obj;
}

  const saveToFirestore = async (
    newDebts: ClientDebt[] = rawDebts, 
    newActions: RecoveryAction[] = recoveryActions, 
    newRemarks: Record<string, ClientRemark[]> = clientRemarks, 
    newArchive: ClientDebt[] = rawArchiveDebts,
    newManual: Record<string, boolean> = manualContentiousInvoices
  ) => {
    // 🔒 Tronquer les archives pour éviter de dépasser la limite Firestore (1 MB)
    const truncatedArchive = newArchive.slice(-200);
    
    // Toujours sauvegarder en local comme fallback
    localStorage.setItem('gc_debts', JSON.stringify(newDebts));
    localStorage.setItem('gc_actions', JSON.stringify(newActions));
    localStorage.setItem('gc_remarks', JSON.stringify(newRemarks));
    localStorage.setItem('gc_archive', JSON.stringify(truncatedArchive));
    localStorage.setItem('gc_manual_contentious', JSON.stringify(newManual));
    
    try {
      const docRef = doc(db, FIRESTORE_COLLECTION, FIRESTORE_DOC);
      const payload = cleanUndefined({
        debts: newDebts,
        archiveDebts: truncatedArchive,
        recoveryActions: newActions,
        clientRemarks: newRemarks,
        manualContentiousInvoices: newManual,
        settings: settings,
        updatedAt: serverTimestamp(),
        updatedBy: user?.email || 'unknown',
        debtCount: newDebts.length,
        readAlertIds: readAlertIds,
        history: updateHistory(newDebts, history)
      });
      
      // Estimation de la taille du payload
      const payloadSize = JSON.stringify(payload).length;
      console.log(`[DebtContext] Taille payload: ${(payloadSize / 1024).toFixed(1)} KB (${newDebts.length} créances, ${truncatedArchive.length} archives)`);
      
      if (payloadSize > 900000) {
        console.warn('[DebtContext] ⚠️ Payload proche de la limite Firestore (1MB)! Troncature supplémentaire...');
        payload.archiveDebts = truncatedArchive.slice(-50);
      }
      
      // Remplacer TOUT le document (pas de merge) pour garantir la cohérence
      await setDoc(docRef, payload);
      saveFailedRef.current = false;
      console.log(`[DebtContext] ✅ Sauvegardé ${newDebts.length} créances dans Firestore par ${user?.email}`);
      
      if (user?.email === 'moslem.gouia@gmail.com') {
        logAction('Sync Firestore', `Mise à jour de ${newDebts.length} créances`);
      }
    } catch (error: any) {
      saveFailedRef.current = true;
      console.error('[DebtContext] ❌ ERREUR sauvegarde Firestore:', error?.message || error);
      console.warn('[DebtContext] Les données sont sauvegardées localement. Elles seront re-synchronisées.');
    }
  };

  const addRecoveryAction = (actionData: Omit<RecoveryAction, 'id' | 'date' | 'user'>) => {
    const newAction: RecoveryAction = {
      ...actionData,
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      date: new Date().toISOString(),
      user: user?.email || 'Utilisateur inconnu',
    };
    
    const updatedActions = [newAction, ...recoveryActions];
    setRecoveryActions(updatedActions);
    saveToFirestore(rawDebts, updatedActions, clientRemarks, rawArchiveDebts, manualContentiousInvoices);
    
    if (user?.email === 'moslem.gouia@gmail.com') {
      logAction('Action de recouvrement', `Ajout d'une action pour le client ${actionData.clientName}`);
    }
  };

  const addClientRemark = (clientName: string, content: string, promiseDate?: string, promiseAmount?: number) => {
    const newRemark: ClientRemark = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      clientName,
      content,
      date: new Date().toISOString(),
      user: user?.email || 'Utilisateur inconnu',
      promiseDate,
      promiseAmount
    };

    const currentRemarks = clientRemarks[clientName] || [];
    const updatedRemarks = {
      ...clientRemarks,
      [clientName]: [newRemark, ...currentRemarks].slice(0, 50) // Garder les 50 dernières remarques
    };

    setClientRemarks(updatedRemarks);
    saveToFirestore(rawDebts, recoveryActions, updatedRemarks, rawArchiveDebts, manualContentiousInvoices);

    // Fonction d'assistance pour envoyer les notifications push
    const sendNotification = async (type: 'payment' | 'conflit', messageText: string) => {
      try {
        // Récupérer les abonnements client-side (utilisateur authentifié)
        const subsSnapshot = await getDocs(collection(db, 'push_subscriptions'));
        const subscriptions = subsSnapshot.docs.map(subDoc => ({
          id: subDoc.id,
          subscription: subDoc.data().subscription
        }));
        // Déclencher la notification push via l'API
        await fetch('/api/webpush/notify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ clientName, content, promiseAmount, user: user?.email, type, subscriptions })
        });
      } catch (e) {
        console.error(`[DebtContext] Erreur notification ${type}:`, e);
      }
    };

    // ✅ Notification Push pour "Payé" (commence par "Payé :")
    if (content.startsWith('Payé :')) {
      // Enregistrer le paiement en attente dans Firestore
      addDoc(collection(db, 'pending_payments'), {
        clientName,
        content,
        promiseAmount: promiseAmount || 0,
        user: user?.email || 'Utilisateur inconnu',
        createdAt: new Date().toISOString(),
        status: 'pending'
      }).catch(e => console.error('[DebtContext] Erreur pending_payments:', e));

      const userShort = user?.email?.split('@')[0] || 'Un utilisateur';
      const amountStr = promiseAmount && promiseAmount > 0
        ? `${promiseAmount.toLocaleString('fr-TN', { minimumFractionDigits: 3 })} TND`
        : 'Solde total';
      
      const invoiceMatch = content.match(/facture\s+([A-Z0-9_\-\/]+)/i);
      const invoiceDetails = invoiceMatch ? ` (Facture n° ${invoiceMatch[1]})` : '';
      const messageText = `${userShort} a marqué le client ${clientName} comme PAYÉ${invoiceDetails} (${amountStr}).`;

      // Notification collaborative in-app
      addDoc(collection(db, 'notifications'), {
        type: 'payment',
        message: messageText,
        severity: 'low',
        createdAt: new Date().toISOString(),
        status: 'pending',
        metadata: { clientName }
      }).catch(e => console.error('[DebtContext] Erreur notification in-app payment:', e));

      // Notification push en arrière-plan
      sendNotification('payment', messageText);
    }

    // ⚠️ Notification Push pour "Client à Conflit"
    if (content.startsWith('Client à Conflit :') || content.startsWith('Client à Conflit:')) {
      const userShort = user?.email?.split('@')[0] || 'Un utilisateur';
      const conflitMessage = `⚠️ ${userShort} a signalé un CONFLIT avec le client ${clientName} !`;

      // Notification collaborative in-app
      addDoc(collection(db, 'notifications'), {
        type: 'conflit',
        message: conflitMessage,
        severity: 'high',
        createdAt: new Date().toISOString(),
        status: 'pending',
        metadata: { clientName }
      }).catch(e => console.error('[DebtContext] Erreur notification in-app conflit:', e));

      // Notification push en arrière-plan
      sendNotification('conflit', conflitMessage);
    }
    
    if (user?.email === 'moslem.gouia@gmail.com') {
      logAction('Remarque Client', `Ajout d'une remarque pour le client ${clientName}`);
    }
  };

  const updateClientRemark = (clientName: string, remarkId: string, content: string, promiseDate?: string, promiseAmount?: number) => {
    const currentRemarks = clientRemarks[clientName] || [];
    const updatedRemarksList = currentRemarks.map(remark => {
      if (remark.id === remarkId) {
        return {
          ...remark,
          content,
          promiseDate,
          promiseAmount
        };
      }
      return remark;
    });

    const updatedRemarks = {
      ...clientRemarks,
      [clientName]: updatedRemarksList
    };

    setClientRemarks(updatedRemarks);
    saveToFirestore(rawDebts, recoveryActions, updatedRemarks, rawArchiveDebts, manualContentiousInvoices);
    
    if (user?.email === 'moslem.gouia@gmail.com') {
      logAction('Modification Remarque', `Modification d'une remarque pour le client ${clientName}`);
    }
  };

  const deleteClientRemark = (clientName: string, remarkId: string) => {
    const currentRemarks = clientRemarks[clientName] || [];
    const updatedRemarksList = currentRemarks.filter(remark => remark.id !== remarkId);

    const updatedRemarks = {
      ...clientRemarks,
      [clientName]: updatedRemarksList
    };

    setClientRemarks(updatedRemarks);
    saveToFirestore(rawDebts, recoveryActions, updatedRemarks, rawArchiveDebts, manualContentiousInvoices);
    
    if (user?.email === 'moslem.gouia@gmail.com') {
      logAction('Suppression Remarque', `Suppression d'une remarque pour le client ${clientName}`);
    }
  };

  const setDebts = (newDebts: ClientDebt[]) => {
    setRawDebts(newDebts);
    saveToFirestore(newDebts, recoveryActions, clientRemarks, rawArchiveDebts, manualContentiousInvoices);
    
    // Analyse locale
    if (newDebts.length > 0) {
      const newAnalysis = AnalysisService.analyzeDebts(newDebts, {
        ...settings,
        manualContentiousInvoices
      });
      setAnalysis(newAnalysis);
      
      // Mettre à jour l'état local avec les créances enrichies (isContentieux, etc.)
      if (newAnalysis.processedDebts) {
        setRawDebts(newAnalysis.processedDebts);
      }
      
      localStorage.setItem('gc_analysis', JSON.stringify(newAnalysis));
    }
  };

  const addDebts = (newDebts: ClientDebt[]) => {
    setRawDebts(prevDebts => {
      const debtMap = new Map<string, ClientDebt>();
      
      // 1. Ajouter les dettes existantes
      prevDebts.forEach(d => debtMap.set(d.id, d));
      
      // 2. Ajouter les nouvelles
      newDebts.forEach(d => debtMap.set(d.id, d));
      
      const updatedDebts = Array.from(debtMap.values());
      
      // Analyse locale et application des surcharges manuelles
      let processedDebts = updatedDebts;
      if (updatedDebts.length > 0) {
        const newAnalysis = AnalysisService.analyzeDebts(updatedDebts, {
          ...settings,
          manualContentiousInvoices
        });
        setAnalysis(newAnalysis);
        if (newAnalysis.processedDebts) {
          processedDebts = newAnalysis.processedDebts;
        }
      } else {
        setAnalysis(null);
      }
      
      // Sauvegarder la version finale fusionnée et analysée dans Firestore & LocalStorage
      saveToFirestore(processedDebts, recoveryActions, clientRemarks, rawArchiveDebts, manualContentiousInvoices);

      if (user?.email === 'moslem.gouia@gmail.com') {
        logAction('Import de masse', `Ajout de ${newDebts.length} nouvelles créances`);
      }
      
      return processedDebts;
    });
  };

  const updateDebtsFromFiles = (filesData: { filename: string, debts: ClientDebt[] }[]) => {
    const today = new Date().toISOString();
    
    // 🛡️ Guard: empêcher onSnapshot d'écraser l'état local pendant l'import
    isLocalUpdateRef.current = true;
    
    // We'll work on a copy of the debts
    let currentTotalDebts = [...rawDebts];
    let currentArchiveDebts = [...rawArchiveDebts];
    
    let totalUpdated = 0;
    let totalNew = 0;
    let totalRemoved = 0;
    let totalBalanceChange = 0;

    filesData.forEach(({ filename, debts: newDebtsForFile }) => {
      const normName = filename.toLowerCase();
      
      // ═══════════════════════════════════════════════════════════════════
      // ÉTAPE 1: Construire les critères d'identification pour CE fichier
      // ═══════════════════════════════════════════════════════════════════
      
      // 1a. Codes commerciaux (ex: "C01", "C02")
      const commercialCodesToReplace = new Set<string>();
      newDebtsForFile.forEach(d => {
        if (d.commercialCode) {
          commercialCodesToReplace.add(d.commercialCode.toUpperCase());
        }
      });
      // Aussi depuis le nom du fichier
      const fnMatch = filename.match(/\b(C\d{2})\b/i);
      if (fnMatch) {
        commercialCodesToReplace.add(fnMatch[1].toUpperCase());
      }

      // 1b. Noms commerciaux (ex: "MED AMINE BEN ZAARA")
      const commercialNamesToReplace = new Set<string>();
      newDebtsForFile.forEach(d => {
        if (d.commercialName) {
          commercialNamesToReplace.add(d.commercialName.toUpperCase().trim());
        }
      });

      console.log(`[Import] Remplacement fichier '${filename}'`);
      console.log(`[Import]   Codes commerciaux: [${Array.from(commercialCodesToReplace).join(', ')}]`);
      console.log(`[Import]   Noms commerciaux: [${Array.from(commercialNamesToReplace).join(', ')}]`);
      console.log(`[Import]   Créances actuelles en mémoire: ${currentTotalDebts.length}`);

      // ═══════════════════════════════════════════════════════════════════
      // ÉTAPE 2: Identifier TOUTES les anciennes créances à remplacer
      // Un match sur N'IMPORTE QUEL critère suffit pour identifier une
      // ancienne créance du même commercial
      // ═══════════════════════════════════════════════════════════════════
      const isOldDebtForThisFile = (d: ClientDebt): boolean => {
        // Critère 1: Même nom de fichier exact
        if ((d.sourceFile || '').toLowerCase() === normName) return true;
        
        // Critère 2: Même code commercial (C01, C02, etc.)
        if (d.commercialCode && commercialCodesToReplace.has(d.commercialCode.toUpperCase())) return true;
        
        // Critère 3: L'ancien fichier contient le même pattern C## dans son nom
        const oldFileMatch = (d.sourceFile || '').match(/\b(C\d{2})\b/i);
        if (oldFileMatch && commercialCodesToReplace.has(oldFileMatch[1].toUpperCase())) return true;
        
        // Critère 4: Même nom de commercial (ex: "MED AMINE BEN ZAARA")
        if (d.commercialName && commercialNamesToReplace.has(d.commercialName.toUpperCase().trim())) return true;
        
        return false;
      };

      const existingDebtsForFile = currentTotalDebts.filter(d => isOldDebtForThisFile(d));
      const otherDebts = currentTotalDebts.filter(d => !isOldDebtForThisFile(d));

      console.log(`[Import]   → ${existingDebtsForFile.length} anciennes créances IDENTIFIÉES à remplacer`);
      console.log(`[Import]   → ${otherDebts.length} créances d'autres commerciaux (conservées)`);
      
      // ═══════════════════════════════════════════════════════════════════
      // ÉTAPE 3: Préparer les NOUVELLES créances
      // Transférer les flags manuels (contentieux) depuis le dictionnaire
      // ═══════════════════════════════════════════════════════════════════
      const debtsWithDate = newDebtsForFile.map(d => {
        const manualState = manualContentiousInvoices[d.documentNumber];
        return { 
          ...d, 
          sourceFile: filename,
          lastImportDate: today,
          isRecentlyUpdated: true,
          ...(manualState !== undefined ? { isContentieux: manualState, isManualContentieux: true } : {})
        };
      });

      // ═══════════════════════════════════════════════════════════════════
      // ÉTAPE 4: Statistiques
      // ═══════════════════════════════════════════════════════════════════
      debtsWithDate.forEach(newDebt => {
        const existing = existingDebtsForFile.find(d => d.documentNumber === newDebt.documentNumber);
        if (existing) {
          if (existing.balance !== newDebt.balance) {
            totalUpdated++;
            totalBalanceChange += (newDebt.balance - existing.balance);
          }
        } else {
          totalNew++;
          totalBalanceChange += newDebt.balance;
        }
      });

      // Factures qui existaient mais ne sont plus dans le nouveau fichier (clients qui ont payé)
      const removedDebts = existingDebtsForFile.filter(ed => !newDebtsForFile.some(nd => nd.documentNumber === ed.documentNumber));
      totalRemoved += removedDebts.length;
      console.log(`[Import]   → ${removedDebts.length} factures disparues (clients ayant payé)`);
      console.log(`[Import]   → ${totalNew} nouvelles factures, ${totalUpdated} mises à jour`);
      
      // ═══════════════════════════════════════════════════════════════════
      // ÉTAPE 5: Archiver les anciennes créances
      // ═══════════════════════════════════════════════════════════════════
      if (existingDebtsForFile.length > 0) {
        const archivedOfThisFile = existingDebtsForFile.map(d => ({ 
          ...d, 
          isArchived: true, 
          archiveDate: today 
        }));
        const existingArchiveFiltered = currentArchiveDebts.filter(ad => !archivedOfThisFile.some(newAd => newAd.id === ad.id));
        currentArchiveDebts = [...existingArchiveFiltered, ...archivedOfThisFile];
      }

      // ═══════════════════════════════════════════════════════════════════
      // ÉTAPE 6: Assembler le résultat final
      // SEULES les nouvelles créances + les créances d'autres commerciaux
      // ═══════════════════════════════════════════════════════════════════
      const otherDebtsReset = otherDebts.map(d => ({ ...d, isRecentlyUpdated: false }));
      currentTotalDebts = [...otherDebtsReset, ...debtsWithDate];
      
      console.log(`[Import]   ✅ Résultat: ${currentTotalDebts.length} créances actives totales`);
    });

    // Final update
    setRawArchiveDebts(currentArchiveDebts);
    
    // Analyse et application des surcharges manuelles
    let processedDebts = currentTotalDebts;
    if (currentTotalDebts.length > 0) {
      const newAnalysis = AnalysisService.analyzeDebts(currentTotalDebts, {
        ...settings,
        manualContentiousInvoices
      });
      setAnalysis(newAnalysis);
      if (newAnalysis.processedDebts) {
        processedDebts = newAnalysis.processedDebts;
      }
      localStorage.setItem('gc_analysis', JSON.stringify(newAnalysis));
    } else {
      setAnalysis(null);
    }

    // Appliquer l'état local immédiatement
    setRawDebts(processedDebts);
    
    // Sauvegarder dans Firestore (async) puis libérer le guard
    saveToFirestore(processedDebts, recoveryActions, clientRemarks, currentArchiveDebts, manualContentiousInvoices)
      .then(() => {
        console.log('[Import] ✅ Sauvegarde Firestore terminée, guard maintenu 5s...');
        // Délai de 5s pour laisser Firestore propager et éviter que onSnapshot ramène des données obsolètes
        setTimeout(() => {
          isLocalUpdateRef.current = false;
          console.log('[Import] Guard onSnapshot libéré');
        }, 5000);
      })
      .catch((err) => {
        console.error('[Import] ❌ Sauvegarde Firestore échouée:', err);
        // Même en cas d'erreur, garder le guard 5s pour éviter que les vieilles données reviennent
        setTimeout(() => {
          isLocalUpdateRef.current = false;
        }, 5000);
      });

    return {
      updated: totalUpdated,
      new: totalNew,
      removed: totalRemoved,
      totalChange: totalBalanceChange
    };
  };

  const updateDebtsFromFile = (filename: string, newDebts: ClientDebt[]) => {
    return updateDebtsFromFiles([{ filename, debts: newDebts }]);
  };

  const clearAll = async () => {
    setRawDebts([]);
    setRawArchiveDebts([]);
    setAnalysis(null);
    localStorage.removeItem('gc_debts');
    localStorage.removeItem('gc_archive');
    localStorage.removeItem('gc_analysis');

    try {
      const docRef = doc(db, FIRESTORE_COLLECTION, FIRESTORE_DOC);
      await setDoc(docRef, {
        debts: [],
        archiveDebts: [],
        updatedAt: serverTimestamp(),
        updatedBy: user?.email || 'unknown',
        debtCount: 0,
        history: []
      }, { merge: true });
      if (user?.email === 'moslem.gouia@gmail.com') {
        logAction('Suppression Totale', `L'utilisateur a vidé toutes les données du système`);
      }
    } catch (error) {
      console.warn('[DebtContext] Erreur suppression Firestore:', error);
    }
  };

  const deleteFileDebts = async (filename: string) => {
    const normName = filename.toLowerCase();

    // Filtre des créances actives et archivées
    const updatedDebts = rawDebts.filter(d => (d.sourceFile || '').toLowerCase() !== normName);
    const updatedArchive = rawArchiveDebts.filter(d => (d.sourceFile || '').toLowerCase() !== normName);

    setRawDebts(updatedDebts);
    setRawArchiveDebts(updatedArchive);

    // Recalculer l'état local
    let newAnalysis = null;
    if (updatedDebts.length > 0) {
      newAnalysis = AnalysisService.analyzeDebts(updatedDebts, {
        ...settings,
        manualContentiousInvoices
      });
      setAnalysis(newAnalysis);
    } else {
      setAnalysis(null);
    }

    // Mettre à jour localStorage pour l'analyse
    if (newAnalysis) {
      localStorage.setItem('gc_analysis', JSON.stringify(newAnalysis));
    } else {
      localStorage.removeItem('gc_analysis');
    }

    // Sauvegarder dans LocalStorage et Firestore
    await saveToFirestore(updatedDebts, recoveryActions, clientRemarks, updatedArchive, manualContentiousInvoices);

    // Journalisation de la suppression de fichier
    await logAction(
      'Suppression Fichier', 
      `Suppression du fichier '${filename}' (${updatedDebts.length} créances actives restantes)`
    );
  };

  const updateHistory = (currentDebts: ClientDebt[], currentHistory: HistoryPoint[]) => {
    if (currentDebts.length === 0) return currentHistory;
    
    const currentAnalysis = AnalysisService.analyzeDebts(currentDebts);
    const newPoint: HistoryPoint = {
      date: new Date().toISOString(),
      totalBalance: currentAnalysis.totalBalance,
      totalPaid: currentAnalysis.totalPaid,
      recoveryRate: currentAnalysis.recoveryRate,
      debtCount: currentDebts.length,
      commercialStats: currentAnalysis.commercialBreakdown
    };
    
    const lastPoint = currentHistory[currentHistory.length - 1];
    if (lastPoint && Math.abs(lastPoint.totalBalance - newPoint.totalBalance) < 1 && lastPoint.debtCount === newPoint.debtCount) {
      return currentHistory;
    }

    const updatedHistory = [...currentHistory, newPoint].slice(-30);
    return updatedHistory;
  };

  const markAllNotificationsAsRead = () => {
    if (!analysis?.alerts) return;
    const allIds = analysis.alerts.map(a => a.id);
    setReadAlertIds(allIds);
    
    // Update Firestore
     const docRef = doc(db, FIRESTORE_COLLECTION, FIRESTORE_DOC);
    setDoc(docRef, { readAlertIds: allIds }, { merge: true });
  };

  const clearHistory = async () => {
    setHistory([]);
    try {
      const docRef = doc(db, FIRESTORE_COLLECTION, FIRESTORE_DOC);
      await setDoc(docRef, { history: [] }, { merge: true });
    } catch (error) {
      console.warn('[DebtContext] Erreur suppression historique:', error);
    }
  };

  const updateSettings = async (newSettings: Partial<AppSettings>) => {
    const updated = { ...settings, ...newSettings };
    setSettings(updated);
    localStorage.setItem('gc_settings', JSON.stringify(updated));

    // Déclencher une nouvelle analyse avec les nouveaux paramètres
    if (debts.length > 0) {
      const newAnalysis = AnalysisService.analyzeDebts(debts, {
        ...updated,
        manualContentiousInvoices
      });
      setAnalysis(newAnalysis);
      if (newAnalysis.processedDebts) {
        setRawDebts(newAnalysis.processedDebts);
      }
    }

    try {
      const docRef = doc(db, FIRESTORE_COLLECTION, FIRESTORE_DOC);
      await setDoc(docRef, { settings: updated }, { merge: true });
      
      if (user?.email === 'moslem.gouia@gmail.com') {
        logAction('Mise à jour paramètres', `Contentieux: ${updated.contentiousAgeDays}j, Retenus: ${updated.retentionMin}%-${updated.retentionMax}%`);
      }
    } catch (error) {
      console.warn('[DebtContext] Erreur sauvegarde paramètres:', error);
    }
  };

  const logAction = async (action: string, details: string) => {
    try {
      const logRef = doc(db, 'audit_logs', `${Date.now()}_${user?.email?.split('@')[0]}`);
      await setDoc(logRef, {
        user: user?.email || 'inconnu',
        action,
        details,
        timestamp: serverTimestamp()
      });
    } catch (e) {
      console.error('Erreur logging:', e);
    }
  };

  const toggleManualContentious = async (documentNumber: string) => {
    const debt = rawDebts.find(d => d.documentNumber === documentNumber);
    if (!debt) return;

    const currentManualState = manualContentiousInvoices[documentNumber];
    let nextManualState: boolean;

    if (currentManualState === undefined) {
      // Toggle from default
      const defaultState = debt.age > settings.contentiousAgeDays;
      nextManualState = !defaultState;
    } else {
      nextManualState = !currentManualState;
    }

    const updatedManual = {
      ...manualContentiousInvoices,
      [documentNumber]: nextManualState
    };

    setManualContentiousInvoices(updatedManual);

    // Update rawDebts locally first to react immediately in the UI
    const updatedDebts = rawDebts.map(d => {
      if (d.documentNumber === documentNumber) {
        return {
          ...d,
          isContentieux: nextManualState,
          isManualContentieux: true
        };
      }
      return d;
    });

    setRawDebts(updatedDebts);
    
    // Save
    await saveToFirestore(updatedDebts, recoveryActions, clientRemarks, rawArchiveDebts, updatedManual);
    await logAction('Override Contentieux', `Facture ${documentNumber} marquée comme ${nextManualState ? 'contentieuse' : 'non contentieuse'}`);
  };

  const markInvoiceAsPaid = async (documentNumber: string, paymentMethod: 'versement' | 'espece' | 'traite' | 'cheque') => {
    const debt = rawDebts.find(d => d.documentNumber === documentNumber);
    if (!debt) return;

    const amount = debt.balance;
    if (amount <= 0) return;

    // 1. Update the debt in rawDebts
    const updatedDebts = rawDebts.map(d => {
      if (d.documentNumber === documentNumber) {
        return {
          ...d,
          settlement: d.amount,
          balance: 0,
          paymentStatus: 'paid' as const,
          riskLevel: 'healthy' as const
        };
      }
      return d;
    });

    setRawDebts(updatedDebts);

    // 2. Add client remark
    const methodLabels: Record<string, string> = {
      versement: 'versement',
      espece: 'espèce',
      traite: 'traite',
      cheque: 'chèque'
    };
    const methodLabel = methodLabels[paymentMethod] || paymentMethod;
    const content = `Payé : Règlement total de la facture ${documentNumber} par ${methodLabel} de ${amount.toLocaleString('fr-TN', { minimumFractionDigits: 3 })} TND`;

    const newRemark: ClientRemark = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      clientName: debt.clientName,
      content,
      date: new Date().toISOString(),
      user: user?.email || 'Utilisateur inconnu',
      promiseAmount: amount
    };

    const currentRemarks = clientRemarks[debt.clientName] || [];
    const updatedRemarks = {
      ...clientRemarks,
      [debt.clientName]: [newRemark, ...currentRemarks].slice(0, 50)
    };

    setClientRemarks(updatedRemarks);

    // 3. Save to Firestore
    await saveToFirestore(updatedDebts, recoveryActions, updatedRemarks, rawArchiveDebts, manualContentiousInvoices);

    // 4. Notifications
    const sendNotification = async (type: 'payment', messageText: string) => {
      try {
        const subsSnapshot = await getDocs(collection(db, 'push_subscriptions'));
        const subscriptions = subsSnapshot.docs.map(subDoc => ({
          id: subDoc.id,
          subscription: subDoc.data().subscription
        }));
        await fetch('/api/webpush/notify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ clientName: debt.clientName, content, promiseAmount: amount, user: user?.email, type, subscriptions })
        });
      } catch (e) {
        console.error(`[DebtContext] Erreur notification payment:`, e);
      }
    };

    // Save pending payment to Firestore
    addDoc(collection(db, 'pending_payments'), {
      clientName: debt.clientName,
      content,
      promiseAmount: amount,
      user: user?.email || 'Utilisateur inconnu',
      createdAt: new Date().toISOString(),
      status: 'pending'
    }).catch(e => console.error('[DebtContext] Erreur pending_payments:', e));

    const userShort = user?.email?.split('@')[0] || 'Un utilisateur';
    const messageText = `${userShort} a marqué la facture ${documentNumber} de ${debt.clientName} comme PAYÉE (${amount.toLocaleString('fr-TN', { minimumFractionDigits: 3 })} TND).`;

    // Collaborative in-app notification
    addDoc(collection(db, 'notifications'), {
      type: 'payment',
      message: messageText,
      severity: 'low',
      createdAt: new Date().toISOString(),
      status: 'pending',
      metadata: { clientName: debt.clientName }
    }).catch(e => console.error('[DebtContext] Erreur notification in-app payment:', e));

    // Send push notification
    sendNotification('payment', messageText);

    // 5. Audit log
    await logAction('Paiement Facture', `Facture ${documentNumber} marquée comme payée (${amount} TND) via ${methodLabel}`);
  };

  const markClientAsPaid = async (clientName: string, paymentMethod: 'versement' | 'espece' | 'traite' | 'cheque') => {
    const clientActiveDebts = rawDebts.filter(d => d.clientName === clientName && d.balance > 0);
    if (clientActiveDebts.length === 0) return;

    const totalBalance = clientActiveDebts.reduce((sum, d) => sum + d.balance, 0);

    // 1. Update all active debts of client in rawDebts
    const updatedDebts = rawDebts.map(d => {
      if (d.clientName === clientName && d.balance > 0) {
        return {
          ...d,
          settlement: d.amount,
          balance: 0,
          paymentStatus: 'paid' as const,
          riskLevel: 'healthy' as const
        };
      }
      return d;
    });

    setRawDebts(updatedDebts);

    // 2. Add client remark
    const methodLabels: Record<string, string> = {
      versement: 'versement',
      espece: 'espèce',
      traite: 'traite',
      cheque: 'chèque'
    };
    const methodLabel = methodLabels[paymentMethod] || paymentMethod;
    const content = `Payé : Règlement total du client par ${methodLabel} de ${totalBalance.toLocaleString('fr-TN', { minimumFractionDigits: 3 })} TND`;

    const newRemark: ClientRemark = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      clientName,
      content,
      date: new Date().toISOString(),
      user: user?.email || 'Utilisateur inconnu',
      promiseAmount: totalBalance
    };

    const currentRemarks = clientRemarks[clientName] || [];
    const updatedRemarks = {
      ...clientRemarks,
      [clientName]: [newRemark, ...currentRemarks].slice(0, 50)
    };

    setClientRemarks(updatedRemarks);

    // 3. Save to Firestore
    await saveToFirestore(updatedDebts, recoveryActions, updatedRemarks, rawArchiveDebts, manualContentiousInvoices);

    // 4. Notifications
    const sendNotification = async (type: 'payment', messageText: string) => {
      try {
        const subsSnapshot = await getDocs(collection(db, 'push_subscriptions'));
        const subscriptions = subsSnapshot.docs.map(subDoc => ({
          id: subDoc.id,
          subscription: subDoc.data().subscription
        }));
        await fetch('/api/webpush/notify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ clientName, content, promiseAmount: totalBalance, user: user?.email, type, subscriptions })
        });
      } catch (e) {
        console.error(`[DebtContext] Erreur notification payment:`, e);
      }
    };

    // Save pending payment to Firestore
    addDoc(collection(db, 'pending_payments'), {
      clientName,
      content,
      promiseAmount: totalBalance,
      user: user?.email || 'Utilisateur inconnu',
      createdAt: new Date().toISOString(),
      status: 'pending'
    }).catch(e => console.error('[DebtContext] Erreur pending_payments:', e));

    const userShort = user?.email?.split('@')[0] || 'Un utilisateur';
    const messageText = `${userShort} a marqué le client ${clientName} comme PAYÉ (${totalBalance.toLocaleString('fr-TN', { minimumFractionDigits: 3 })} TND).`;

    // Collaborative in-app notification
    addDoc(collection(db, 'notifications'), {
      type: 'payment',
      message: messageText,
      severity: 'low',
      createdAt: new Date().toISOString(),
      status: 'pending',
      metadata: { clientName }
    }).catch(e => console.error('[DebtContext] Erreur notification in-app payment:', e));

    // Send push notification
    sendNotification('payment', messageText);

    // 5. Audit log
    await logAction('Paiement Client', `Client ${clientName} marqué comme payé (${totalBalance} TND) via ${methodLabel}`);
  };

  return (
    <DebtContext.Provider value={{ 
      debts, 
      archiveDebts,
      analysis, 
      recoveryActions,
      clientRemarks,
      setDebts, 
      setAnalysis, 
      addDebts, 
      updateDebtsFromFile, 
      updateDebtsFromFiles,
      addRecoveryAction,
      addClientRemark,
      updateClientRemark,
      deleteClientRemark,
      clearAll, 
      deleteFileDebts,
      lastUpdatedBy,
      readAlertIds,
      markAllNotificationsAsRead,
      history,
      clearHistory,
      settings,
      updateSettings,
      logAudit: logAction,
      toggleManualContentious,
      markInvoiceAsPaid,
      markClientAsPaid
    }}>
      {children}
    </DebtContext.Provider>
  );
}

export function useDebtContext() {
  const context = useContext(DebtContext);
  if (context === undefined) {
    throw new Error('useDebtContext must be used within a DebtProvider');
  }
  return context;
}
