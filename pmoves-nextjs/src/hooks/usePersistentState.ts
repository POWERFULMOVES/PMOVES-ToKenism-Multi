/**
 * Persistent State Hook
 * Provides state that persists to localStorage and syncs across tabs
 */

'use client';

import { useState, useEffect } from 'react';

interface PersistentStateOptions<T> {
  key: string;
  defaultValue: T;
  serialize?: (value: T) => string;
  deserialize?: (value: string) => T;
  onSync?: (value: T) => void;
}

export function usePersistentState<T>(
  key: string,
  defaultValue: T,
  options: PersistentStateOptions<T> = {}
): [T, (value: T) => void] {
  const {
    serialize = JSON.stringify,
    deserialize = JSON.parse,
    onSync
  } = options;

  const [state, setState] = useState<T>(() => {
    // Only access localStorage on client side
    if (typeof window === 'undefined') {
      return defaultValue;
    }

    try {
      const stored = window.localStorage.getItem(key);
      return stored ? deserialize(stored) : defaultValue;
    } catch (error) {
      console.error(`Error loading persistent state for key "${key}":`, error);
      return defaultValue;
    }
  });

  // Save to localStorage whenever state changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(key, serialize(state));
        
        // Notify other tabs of state change
        if (onSync) {
          onSync(state);
        }
      } catch (error) {
        console.error(`Error saving persistent state for key "${key}":`, error);
      }
    }
  }, [key, state, serialize]);

  // Listen for storage events from other tabs
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const handleStorageChange = (event: StorageEvent) => {
        if (event.key === key) {
          try {
            const newValue = event.newValue ? deserialize(event.newValue) : defaultValue;
            setState(newValue);
          } catch (error) {
            console.error(`Error syncing persistent state for key "${key}":`, error);
          }
        }
      };

      window.addEventListener('storage', handleStorageChange);

      return () => {
        window.removeEventListener('storage', handleStorageChange);
      };
    }
  }, [key, deserialize]);

  return [state, setState];
}

/**
 * Hook for managing user preferences with defaults
 */
export function useUserPreferences<T extends Record<string, any>>(
  defaultPreferences: T
): [T, (preferences: T) => void] {
  return usePersistentState('user-preferences', defaultPreferences, {
    serialize: JSON.stringify,
    deserialize: JSON.parse,
    onSync: (preferences) => {
      // Apply preferences immediately when synced
      Object.entries(preferences).forEach(([key, value]) => {
        if (key === 'theme') {
          document.documentElement.classList.toggle('dark', value === 'dark');
        }
      });
    }
  });
}

/**
 * Hook for managing simulation history
 */
export function useSimulationHistory(): {
  simulations: Array<{
    id: string;
    name: string;
    timestamp: number;
    params: Record<string, any>;
  }>;
  addSimulation: (simulation: any) => void;
  clearHistory: () => void;
} {
  return usePersistentState('simulation-history', {
    simulations: [],
    serialize: JSON.stringify,
    deserialize: JSON.parse
  });
}