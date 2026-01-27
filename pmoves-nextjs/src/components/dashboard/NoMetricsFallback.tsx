/**
 * No Metrics Fallback Component
 * Displays when no metrics are available with retry functionality
 */

'use client';

import { Button } from '@/components/ui/button';

interface NoMetricsFallbackProps {
  onRetry: () => void;
}

export function NoMetricsFallback({ onRetry }: NoMetricsFallbackProps) {
  return (
    <div className="flex flex-col items-center justify-center h-64 p-12 text-center border rounded-lg border-dashed">
      <h3 className="text-lg font-medium mb-2">No metrics available</h3>
      <p className="text-muted-foreground mb-4">
        Unable to fetch current economic metrics.
      </p>
      <Button onClick={onRetry}>Retry</Button>
    </div>
  );
}