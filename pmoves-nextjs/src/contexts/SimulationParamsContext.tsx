/**
 * Simulation Parameters Context
 * Manages simulation parameters across the application
 */

'use client';

import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import type { SimulationParams } from '@/lib/simulation/types';
import { DEFAULT_PARAMS } from '@/lib/simulation';

interface SimulationParamsContextType {
  params: SimulationParams;
  setParams: (params: SimulationParams) => void;
  updateParam: (key: keyof SimulationParams, value: any) => void;
  resetParams: () => void;
  isDirty: boolean;
  setIsDirty: (dirty: boolean) => void;
}

const SimulationParamsContext = createContext<SimulationParamsContextType | undefined>(undefined);

interface SimulationParamsProviderProps {
  children: ReactNode;
  initialParams?: SimulationParams;
}

export function SimulationParamsProvider({ 
  children, 
  initialParams = DEFAULT_PARAMS 
}: SimulationParamsProviderProps) {
  const [params, setParams] = useState<SimulationParams>(initialParams);
  const [isDirty, setIsDirty] = useState(false);

  const updateParam = useCallback((key: keyof SimulationParams, value: any) => {
    setParams(prev => ({
      ...prev,
      [key]: value
    }));
    setIsDirty(true);
  }, []);

  const resetParams = useCallback(() => {
    setParams(DEFAULT_PARAMS);
    setIsDirty(false);
  }, []);

  const contextValue: SimulationParamsContextType = {
    params,
    setParams,
    updateParam,
    resetParams,
    isDirty,
    setIsDirty
  };

  return (
    <SimulationParamsContext.Provider value={contextValue}>
      {children}
    </SimulationParamsContext.Provider>
  );
}

export function useSimulationParams() {
  const context = useContext(SimulationParamsContext);
  if (context === undefined) {
    throw new Error('useSimulationParams must be used within a SimulationParamsProvider');
  }
  return context;
}

export { SimulationParamsContext };