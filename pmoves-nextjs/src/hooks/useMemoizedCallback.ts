/**
 * Memoized Callback Hook
 * Provides a stable callback reference that only changes when dependencies change
 */

import { useCallback, useEffect, useRef } from 'react';

export function useMemoizedCallback<T extends (...args: any[]) => any>(
  callback: T
): T {
  const callbackRef = useRef(callback);

  // Update ref when callback changes
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  // Stable callback identity with latest callback implementation
  return useCallback((...args: Parameters<T>) => callbackRef.current(...args), []) as T;
}

/**
 * Memoized Value Hook
 * Similar to useMemo with explicit dependency comparison
 */
export function useMemoizedValue<T>(
  factory: () => T,
  deps: React.DependencyList
): T {
  const ref = useRef<{ value: T; deps: React.DependencyList }>({
    value: factory(),
    deps: []
  });

  if (!ref.current || depsChanged(ref.current.deps, deps)) {
    ref.current = { value: factory(), deps };
  }

  return ref.current.value;
}

/**
 * Check if dependencies have changed
 */
function depsChanged(prevDeps: React.DependencyList, nextDeps: React.DependencyList): boolean {
  if (prevDeps.length !== nextDeps.length) return true;
  
  return nextDeps.some((dep, index) => dep !== prevDeps[index]);
}
