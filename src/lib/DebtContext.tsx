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
  setDebts: (debts: ClientDebt[]) => void;
  setAnalysis: (analysis: AnalysisResult | null) => void;
  addDebts: (newDebts: ClientDebt[]) => void;
  addRecoveryAction: (action: Omit<RecoveryAction, 'id' | 'date' | 'user'>) => void;
  updateDebtsFromFile: (filename: string, newDebts: ClientDebt[]) => { 
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
}

export interface HistoryPoint {
  date: string;
  totalBalance: number;
  totalPaid: number;
  recoveryRate: number;
  debtCount: number;
}

const DebtContext = createContext<DebtContextType | undefined>(undefined);

const FIRESTORE_COLLECTION = 'shared_data';
const FIRESTORE_DOC = 'current_debts';

export function DebtProvider({ children }: { children: ReactNode }) {
  const [debts, setDebtsState] = useState<ClientDebt[]>([]);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [recoveryActions, setRecoveryActions] = useState<RecoveryAction[]>([]);
  const [lastUpdatedBy, setLastUpdatedBy] = useState<string | null>(null);
  const [readAlertIds, setReadAlertIds] = useState<string[]>([]);
  const [history, setHistory] = useState<HistoryPoint[]>([]);
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
          setLastUpdatedBy(data.updatedBy || null);
          setReadAlertIds(data.readAlertIds || []);
          let historyData = data.history || [];
          
          // Seed data for demonstration if empty and we have debts
          if (historyData.length === 0 && firestoreDebts.length > 0) {
            const now = new Date();
            historyData = [
              { 
                date: new Date(now.getTime() - 86400000 * 3).toISOString(), 
                totalBalance: 450000, 
                totalPaid: 320000, 
                recoveryRate: 71, 
                debtCount: 120 
              },
              { 
                date: new Date(now.getTime() - 86400000 * 2).toISOString(), 
                totalBalance: 480000, 
                totalPaid: 350000, 
                recoveryRate: 73, 
                debtCount: 125 
              },
              { 
                date: new Date(now.getTime() - 86400000 * 1).toISOString(), 
                totalBalance: 470000, 
                totalPaid: 380000, 
                recoveryRate: 80, 
                debtCount: 122 
              }
            ];
          }
          setHistory(historyData);
          
          if (firestoreDebts.length > 0) {
            const newAnalysis = AnalysisService.analyzeDebts(firestoreDebts);
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
    } catch (e) {
      console.warn('Erreur chargement données sauvegardées:', e);
    }
  };

  // Sauvegarder dans Firestore + localStorage
  const saveToFirestore = async (newDebts: ClientDebt[], newActions: RecoveryAction[] = recoveryActions) => {
    // Toujours sauvegarder en local comme fallback
    localStorage.setItem('gc_debts', JSON.stringify(newDebts));
    localStorage.setItem('gc_actions', JSON.stringify(newActions));

    try {
      const docRef = doc(db, FIRESTORE_COLLECTION, FIRESTORE_DOC);
      await setDoc(docRef, {
        debts: newDebts,
        recoveryActions: newActions,
        updatedAt: serverTimestamp(),
        updatedBy: user?.email || 'unknown',
        debtCount: newDebts.length,
        readAlertIds: readAlertIds,
        history: updateHistory(newDebts, history)
      });
      console.log(`[DebtContext] Sauvegardé ${newDebts.length} créances et ${newActions.length} actions dans Firestore par ${user?.email}`);
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

  const updateDebtsFromFile = (filename: string, newDebts: ClientDebt[]) => {
    const normName = filename.toLowerCase();
    const today = new Date().toISOString();
    
    // Filter existing debts by normalized filename
    const existingDebtsForFile = debts.filter(d => (d.sourceFile || '').toLowerCase() === normName);
    const otherDebts = debts.filter(d => (d.sourceFile || '').toLowerCase() !== normName);
    
    const debtsWithDate = newDebts.map(d => ({ 
      ...d, 
      sourceFile: filename, // Keep original casing for display
      lastImportDate: today,
      isRecentlyUpdated: true
    }));

    const otherDebtsReset = otherDebts.map(d => ({ ...d, isRecentlyUpdated: false }));

    // Stats for the user
    let updatedCount = 0;
    let newCount = 0;
    let totalChange = 0;

    debtsWithDate.forEach(newDebt => {
      const existing = existingDebtsForFile.find(d => d.documentNumber === newDebt.documentNumber);
      if (existing) {
        if (existing.balance !== newDebt.balance) {
          updatedCount++;
          totalChange += (newDebt.balance - existing.balance);
        }
      } else {
        newCount++;
        totalChange += newDebt.balance;
      }
    });

    const removedCount = Math.max(0, existingDebtsForFile.length - (newDebts.length - newCount));

    // Update state
    const updatedTotalDebts = [...otherDebtsReset, ...debtsWithDate];
    setDebts(updatedTotalDebts);

    return {
      updated: updatedCount,
      new: newCount,
      removed: removedCount,
      totalChange
    };
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
      debtCount: currentDebts.length
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

  return (
    <DebtContext.Provider value={{ 
      debts, 
      analysis, 
      recoveryActions,
      setDebts, 
      setAnalysis, 
      addDebts, 
      updateDebtsFromFile, 
      addRecoveryAction,
      clearAll, 
      lastUpdatedBy,
      readAlertIds,
      markAllNotificationsAsRead,
      history
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
