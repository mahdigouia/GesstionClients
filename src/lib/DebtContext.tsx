'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { ClientDebt, AnalysisResult, RecoveryAction } from '@/types/debt';
import { AnalysisService } from '@/lib/analysis';
import { db } from '@/lib/firebase';
import { useAuth } from '@/lib/AuthContext';
import { doc, setDoc, onSnapshot, serverTimestamp } from 'firebase/firestore';

interface DebtContextType {
  debts: ClientDebt[];
  analysis: AnalysisResult | null;
  recoveryActions: RecoveryAction[];
  clientRemarks: Record<string, ClientRemark[]>;
  setDebts: (debts: ClientDebt[]) => void;
  setAnalysis: (analysis: AnalysisResult | null) => void;
  addDebts: (newDebts: ClientDebt[]) => void;
  addRecoveryAction: (action: Omit<RecoveryAction, 'id' | 'date' | 'user'>) => void;
  addClientRemark: (clientName: string, content: string, promiseDate?: string) => void;
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
  lastUpdatedBy: string | null;
  readAlertIds: string[];
  markAllNotificationsAsRead: () => void;
  history: HistoryPoint[];
  clearHistory: () => void;
  settings: AppSettings;
  updateSettings: (newSettings: Partial<AppSettings>) => void;
  logAudit: (action: string, details: string) => Promise<void>;
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
  const [debts, setDebtsState] = useState<ClientDebt[]>([]);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [recoveryActions, setRecoveryActions] = useState<RecoveryAction[]>([]);
  const [clientRemarks, setClientRemarks] = useState<Record<string, ClientRemark[]>>({});
  const [lastUpdatedBy, setLastUpdatedBy] = useState<string | null>(null);
  const [readAlertIds, setReadAlertIds] = useState<string[]>([]);
  const [history, setHistory] = useState<HistoryPoint[]>([]);
  const [settings, setSettings] = useState<AppSettings>({ contentiousAgeDays: 365, retentionMin: 0.5, retentionMax: 1.5 });
  const [firestoreReady, setFirestoreReady] = useState(false);
  const { user } = useAuth();

  // Écouter les changements Firestore en temps réel (collaboratif)
  useEffect(() => {
    let unsubscribe: (() => void) | null = null;

    try {
      const docRef = doc(db, FIRESTORE_COLLECTION, FIRESTORE_DOC);
      unsubscribe = onSnapshot(docRef, (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data();
          const firestoreDebts = data.debts || [];
          setDebtsState(firestoreDebts);
          setRecoveryActions(data.recoveryActions || []);
          setClientRemarks(data.clientRemarks || {});
          setLastUpdatedBy(data.updatedBy || null);
          setReadAlertIds(data.readAlertIds || []);
          setHistory(data.history || []);
          if (data.settings) setSettings(data.settings);
          
          if (firestoreDebts.length > 0) {
            const newAnalysis = AnalysisService.analyzeDebts(firestoreDebts, data.settings || settings);
            setAnalysis(newAnalysis);
            // Si l'analyse a produit des créances traitées (avec isContentieux corrigé), les utiliser
            if (newAnalysis.processedDebts) {
              setDebtsState(newAnalysis.processedDebts);
            }
          } else {
            setAnalysis(null);
          }
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
      const savedAnalysis = localStorage.getItem('gc_analysis');
      if (savedDebts) {
        setDebtsState(JSON.parse(savedDebts));
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
    } catch (e) {
      console.warn('Erreur chargement données sauvegardées:', e);
    }
  };

  // Sauvegarder dans Firestore + localStorage
  const saveToFirestore = async (newDebts: ClientDebt[], newActions: RecoveryAction[] = recoveryActions, newRemarks: Record<string, ClientRemark[]> = clientRemarks) => {
    // Toujours sauvegarder en local comme fallback
    localStorage.setItem('gc_debts', JSON.stringify(newDebts));
    localStorage.setItem('gc_actions', JSON.stringify(newActions));
    localStorage.setItem('gc_remarks', JSON.stringify(newRemarks));
    
    try {
      const docRef = doc(db, FIRESTORE_COLLECTION, FIRESTORE_DOC);
      await setDoc(docRef, {
        debts: newDebts,
        recoveryActions: newActions,
        clientRemarks: newRemarks,
        updatedAt: serverTimestamp(),
        updatedBy: user?.email || 'unknown',
        debtCount: newDebts.length,
        readAlertIds: readAlertIds,
        history: updateHistory(newDebts, history)
      });
      console.log(`[DebtContext] Sauvegardé ${newDebts.length} créances et ${newActions.length} actions dans Firestore par ${user?.email}`);
      
      // Journalisation pour l'utilisateur spécifique
      if (user?.email === 'moslem.gouia@gmail.com') {
        logAction('Sync Firestore', `Mise à jour de ${newDebts.length} créances`);
      }
    } catch (error) {
      console.warn('[DebtContext] Erreur sauvegarde Firestore:', error);
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
    saveToFirestore(debts, updatedActions);
    
    if (user?.email === 'moslem.gouia@gmail.com') {
      logAction('Action de recouvrement', `Ajout d'une action pour le client ${actionData.clientName}`);
    }
  };

  const addClientRemark = (clientName: string, content: string, promiseDate?: string) => {
    const newRemark: ClientRemark = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      clientName,
      content,
      date: new Date().toISOString(),
      user: user?.email || 'Utilisateur inconnu',
      promiseDate
    };

    const currentRemarks = clientRemarks[clientName] || [];
    const updatedRemarks = {
      ...clientRemarks,
      [clientName]: [newRemark, ...currentRemarks].slice(0, 50) // Garder les 50 dernières remarques
    };

    setClientRemarks(updatedRemarks);
    saveToFirestore(debts, recoveryActions, updatedRemarks);
    
    if (user?.email === 'moslem.gouia@gmail.com') {
      logAction('Remarque Client', `Ajout d'une remarque pour le client ${clientName}`);
    }
  };

  const setDebts = (newDebts: ClientDebt[]) => {
    setDebtsState(newDebts);
    saveToFirestore(newDebts);
    
    // Analyse locale
    if (newDebts.length > 0) {
      const newAnalysis = AnalysisService.analyzeDebts(newDebts);
      setAnalysis(newAnalysis);
      
      // Mettre à jour l'état local avec les créances enrichies (isContentieux, etc.)
      if (newAnalysis.processedDebts) {
        setDebtsState(newAnalysis.processedDebts);
        // On ne sauvegarde pas forcément les processedDebts dans Firestore ici 
        // pour garder les originaux si besoin, mais l'UI utilisera les versions traitées.
      }
      
      localStorage.setItem('gc_analysis', JSON.stringify(newAnalysis));
    }
  };

  const addDebts = (newDebts: ClientDebt[]) => {
    setDebtsState(prevDebts => {
      const debtMap = new Map<string, ClientDebt>();
      
      // 1. Ajouter les dettes existantes
      prevDebts.forEach(d => debtMap.set(d.id, d));
      
      // 2. Ajouter les nouvelles
      newDebts.forEach(d => debtMap.set(d.id, d));
      
      const updatedDebts = Array.from(debtMap.values());
      
      // Sauvegarder la version finale fusionnée
      saveToFirestore(updatedDebts);

      if (user?.email === 'moslem.gouia@gmail.com') {
        logAction('Import de masse', `Ajout de ${newDebts.length} nouvelles créances`);
      }
      
      // Analyse locale
      if (updatedDebts.length > 0) {
        const newAnalysis = AnalysisService.analyzeDebts(updatedDebts);
        setAnalysis(newAnalysis);
        if (newAnalysis.processedDebts) {
          return newAnalysis.processedDebts;
        }
      }
      
      return updatedDebts;
    });
  };

  const updateDebtsFromFiles = (filesData: { filename: string, debts: ClientDebt[] }[]) => {
    const today = new Date().toISOString();
    
    // We'll work on a copy of the debts
    let currentTotalDebts = [...debts];
    
    let totalUpdated = 0;
    let totalNew = 0;
    let totalRemoved = 0;
    let totalBalanceChange = 0;

    filesData.forEach(({ filename, debts: newDebtsForFile }) => {
      const normName = filename.toLowerCase();
      
      // Filter existing debts for THIS specific file
      const existingDebtsForFile = currentTotalDebts.filter(d => (d.sourceFile || '').toLowerCase() === normName);
      const otherDebts = currentTotalDebts.filter(d => (d.sourceFile || '').toLowerCase() !== normName);
      
      const debtsWithDate = newDebtsForFile.map(d => ({ 
        ...d, 
        sourceFile: filename,
        lastImportDate: today,
        isRecentlyUpdated: true
      }));

      // Calculate stats for this file
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

      totalRemoved += Math.max(0, existingDebtsForFile.length - (newDebtsForFile.length - (debtsWithDate.filter(nd => !existingDebtsForFile.some(ed => ed.documentNumber === nd.documentNumber)).length)));
      
      // Re-assemble currentTotalDebts for the next iteration
      const otherDebtsReset = otherDebts.map(d => ({ ...d, isRecentlyUpdated: false }));
      currentTotalDebts = [...otherDebtsReset, ...debtsWithDate];
    });

    // Final update
    setDebts(currentTotalDebts);

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
    setDebtsState([]);
    setAnalysis(null);
    localStorage.removeItem('gc_debts');
    localStorage.removeItem('gc_analysis');

    try {
      const docRef = doc(db, FIRESTORE_COLLECTION, FIRESTORE_DOC);
      await setDoc(docRef, {
        debts: [],
        updatedAt: serverTimestamp(),
        updatedBy: user?.email || 'unknown',
        debtCount: 0,
        history: []
      });
      if (user?.email === 'moslem.gouia@gmail.com') {
        logAction('Suppression Totale', `L'utilisateur a vidé toutes les données du système`);
      }
    } catch (error) {
      console.warn('[DebtContext] Erreur suppression Firestore:', error);
    }
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
      const newAnalysis = AnalysisService.analyzeDebts(debts, updated);
      setAnalysis(newAnalysis);
      if (newAnalysis.processedDebts) {
        setDebtsState(newAnalysis.processedDebts);
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

  return (
    <DebtContext.Provider value={{ 
      debts, 
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
      clearAll, 
      lastUpdatedBy,
      readAlertIds,
      markAllNotificationsAsRead,
      history,
      clearHistory,
      settings,
      updateSettings,
      logAudit: logAction
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
