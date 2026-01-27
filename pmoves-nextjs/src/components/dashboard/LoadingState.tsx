/**
 * Loading State Component
 * Displays a loading spinner for dashboard data
 */

'use client';

export function LoadingState() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
    </div>
  );
}