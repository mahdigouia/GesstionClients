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
}

const DebtContext = createContext<DebtContextType | undefined>(undefined);

const FIRESTORE_COLLECTION = 'shared_data';
const FIRESTORE_DOC = 'current_debts';

export function DebtProvider({ children }: { children: ReactNode }) {
  const [debts, setDebtsState] = useState<ClientDebt[]>([]);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [recoveryActions, setRecoveryActions] = useState<RecoveryAction[]>([]);
  const [lastUpdatedBy, setLastUpdatedBy] = useState<string | null>(null);
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
          
          // Recalculer l'analyse localement
          if (firestoreDebts.length > 0) {
            const newAnalysis = AnalysisService.analyzeDebts(firestoreDebts);
            setAnalysis(newAnalysis);
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
      localStorage.setItem('gc_analysis', JSON.stringify(newAnalysis));
    }
  };

  const addDebts = (newDebts: ClientDebt[]) => {
    const updatedDebts = [...debts, ...newDebts];
    setDebts(updatedDebts);
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
      });
    } catch (error) {
      console.warn('[DebtContext] Erreur suppression Firestore:', error);
    }
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
      lastUpdatedBy 
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
