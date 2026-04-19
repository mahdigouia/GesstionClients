'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { ClientDebt, AnalysisResult } from '@/types/debt';
import { AnalysisService } from '@/lib/analysis';

interface DebtContextType {
  debts: ClientDebt[];
  analysis: AnalysisResult | null;
  setDebts: (debts: ClientDebt[]) => void;
  setAnalysis: (analysis: AnalysisResult | null) => void;
  addDebts: (newDebts: ClientDebt[]) => void;
  clearAll: () => void;
}

const DebtContext = createContext<DebtContextType | undefined>(undefined);

export function DebtProvider({ children }: { children: ReactNode }) {
  const [debts, setDebts] = useState<ClientDebt[]>([]);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);

  // Charger depuis localStorage au démarrage
  useEffect(() => {
    try {
      const savedDebts = localStorage.getItem('gc_debts');
      const savedAnalysis = localStorage.getItem('gc_analysis');
      if (savedDebts) {
        setDebts(JSON.parse(savedDebts));
      }
      if (savedAnalysis) {
        setAnalysis(JSON.parse(savedAnalysis));
      }
    } catch (e) {
      console.warn('Erreur chargement données sauvegardées:', e);
    }
  }, []);

  // Sauvegarder dans localStorage à chaque changement
  useEffect(() => {
    if (debts.length > 0) {
      localStorage.setItem('gc_debts', JSON.stringify(debts));
    }
  }, [debts]);

  useEffect(() => {
    if (analysis) {
      localStorage.setItem('gc_analysis', JSON.stringify(analysis));
    }
  }, [analysis]);

  const addDebts = (newDebts: ClientDebt[]) => {
    const updatedDebts = [...debts, ...newDebts];
    setDebts(updatedDebts);
    const newAnalysis = AnalysisService.analyzeDebts(updatedDebts);
    setAnalysis(newAnalysis);
  };

  const clearAll = () => {
    setDebts([]);
    setAnalysis(null);
    localStorage.removeItem('gc_debts');
    localStorage.removeItem('gc_analysis');
  };

  return (
    <DebtContext.Provider value={{ debts, analysis, setDebts, setAnalysis, addDebts, clearAll }}>
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
