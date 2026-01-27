/**
 * Memoized Callback Hook
 * Provides a stable callback reference that only changes when dependencies change
 */

import { useCallback, useRef } from 'react';

export function useMemoizedCallback<T extends (...args: any[]) => any>(
  callback: T,
  deps: React.DependencyList
): T {
  const callbackRef = useRef(callback);

  // Update ref when callback changes
  useRef(() => {
    callbackRef.current = callback;
  }, [callback]);

  // Return memoized callback
  return useCallback((...args: Parameters<T>) => callbackRef.current(...args), deps);
}

/**
 * Memoized Value Hook
 * Similar to useMemo but with better debugging and type safety
 */
export function useMemoizedValue<T>(
  factory: () => T,
  deps: React.DependencyList,
  debugKey?: string
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