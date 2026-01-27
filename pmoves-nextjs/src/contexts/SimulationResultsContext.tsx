/**
 * Simulation Results Context
 * Manages simulation results and loading states
 */

'use client';

import { createContext, useContext, useState, useCallback, ReactNode } from 'react';

interface SimulationResult {
  id: string;
  timestamp: number;
  params: Record<string, any>;
  results: {
    wealthData: Array<any>;
    comparisonData: Array<any>;
    metrics: Record<string, number>;
  };
  status: 'running' | 'completed' | 'error';
  error?: string;
}

interface SimulationResultsContextType {
  results: SimulationResult[];
  currentResult: SimulationResult | null;
  isLoading: boolean;
  setResults: (results: SimulationResult[]) => void;
  addResult: (result: SimulationResult) => void;
  clearResults: () => void;
  setCurrentResult: (result: SimulationResult | null) => void;
  setLoading: (loading: boolean) => void;
}

const SimulationResultsContext = createContext<SimulationResultsContextType | undefined>(undefined);

interface SimulationResultsProviderProps {
  children: ReactNode;
}

export function SimulationResultsProvider({ children }: SimulationResultsProviderProps) {
  const [results, setResults] = useState<SimulationResult[]>([]);
  const [currentResult, setCurrentResult] = useState<SimulationResult | null>(null);
  const [isLoading, setLoading] = useState(false);

  const addResult = useCallback((result: SimulationResult) => {
    setResults(prev => [...prev, result]);
    setCurrentResult(result);
  }, []);

  const clearResults = useCallback(() => {
    setResults([]);
    setCurrentResult(null);
  }, []);

  const contextValue: SimulationResultsContextType = {
    results,
    currentResult,
    isLoading,
    setResults,
    addResult,
    clearResults,
    setCurrentResult,
    setLoading
  };

  return (
    <SimulationResultsContext.Provider value={contextValue}>
      {children}
    </SimulationResultsContext.Provider>
  );
}

export function useSimulationResults() {
  const context = useContext(SimulationResultsContext);
  if (context === undefined) {
    throw new Error('useSimulationResults must be used within a SimulationResultsProvider');
  }
  return context;
}

export { SimulationResultsContext };