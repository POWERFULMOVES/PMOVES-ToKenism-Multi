/**
 * UI State Context
 * Manages UI-related state like theme, layout, and user preferences
 */

'use client';

import { createContext, useContext, useState, useCallback, ReactNode } from 'react';

interface UIState {
  theme: 'light' | 'dark' | 'system';
  sidebarOpen: boolean;
  activeTab: string;
  notifications: Array<{
    id: string;
    message: string;
    type: 'info' | 'success' | 'warning' | 'error';
    timestamp: number;
  }>;
  loading: {
    simulation: boolean;
    charts: boolean;
  };
}

interface UIStateContextType {
  state: UIState;
  setTheme: (theme: UIState['theme']) => void;
  setSidebarOpen: (open: boolean) => void;
  setActiveTab: (tab: string) => void;
  addNotification: (notification: Omit<UIState['notifications'][0], 'id' | 'timestamp'>) => void;
  removeNotification: (id: string) => void;
  clearNotifications: () => void;
  setLoading: (key: keyof UIState['loading'], value: boolean) => void;
}

const UIStateContext = createContext<UIStateContextType | undefined>(undefined);

interface UIStateProviderProps {
  children: ReactNode;
  initialTheme?: UIState['theme'];
}

export function UIStateProvider({ 
  children, 
  initialTheme = 'system' 
}: UIStateProviderProps) {
  const [state, setState] = useState<UIState>({
    theme: initialTheme,
    sidebarOpen: true,
    activeTab: 'dashboard',
    notifications: [],
    loading: {
      simulation: false,
      charts: false
    }
  });

  const setTheme = useCallback((theme: UIState['theme']) => {
    setState(prev => ({ ...prev, theme }));
  }, []);

  const setSidebarOpen = useCallback((open: boolean) => {
    setState(prev => ({ ...prev, sidebarOpen: open }));
  }, []);

  const setActiveTab = useCallback((tab: string) => {
    setState(prev => ({ ...prev, activeTab: tab }));
  }, []);

  const addNotification = useCallback((
    notification: Omit<UIState['notifications'][0], 'id' | 'timestamp'>
  ) => {
    const newNotification = {
      ...notification,
      id: Date.now().toString(),
      timestamp: Date.now()
    };
    setState(prev => ({
      ...prev,
      notifications: [...prev.notifications, newNotification]
    }));
  }, []);

  const removeNotification = useCallback((id: string) => {
    setState(prev => ({
      ...prev,
      notifications: prev.notifications.filter(n => n.id !== id)
    }));
  }, []);

  const clearNotifications = useCallback(() => {
    setState(prev => ({ ...prev, notifications: [] }));
  }, []);

  const setLoading = useCallback((
    key: keyof UIState['loading'], 
    value: boolean
  ) => {
    setState(prev => ({
      ...prev,
      loading: {
        ...prev.loading,
        [key]: value
      }
    }));
  }, []);

  const contextValue: UIStateContextType = {
    state,
    setTheme,
    setSidebarOpen,
    setActiveTab,
    addNotification,
    removeNotification,
    clearNotifications,
    setLoading
  };

  return (
    <UIStateContext.Provider value={contextValue}>
      {children}
    </UIStateContext.Provider>
  );
}

export function useUIState() {
  const context = useContext(UIStateContext);
  if (context === undefined) {
    throw new Error('useUIState must be used within a UIStateProvider');
  }
  return context;
}

export { UIStateContext };