/**
 * Chart Wrapper Component
 * Provides consistent layout, loading states, and error handling for all charts
 */

'use client';

import React, { ReactNode } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ResponsiveContainer } from 'recharts';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle, RefreshCw } from 'lucide-react';

interface ChartWrapperProps {
  title: string;
  description?: string;
  children: ReactNode;
  height?: number;
  loading?: boolean;
  error?: string;
  className?: string;
}

export function ChartWrapper({
  title,
  description,
  children,
  height = 300,
  loading = false,
  error,
  className
}: ChartWrapperProps) {
  if (loading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="text-base">{title}</CardTitle>
          {description && <CardDescription>{description}</CardDescription>}
        </CardHeader>
        <CardContent>
          <div className={`h-[${height}px] flex items-center justify-center`}>
            <Skeleton className="h-full w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={`border-destructive bg-destructive/5 ${className}`}>
        <CardHeader>
          <CardTitle className="text-base flex items-center text-destructive">
            <AlertCircle className="h-4 w-4 mr-2" />
            Chart Error
          </CardTitle>
          {description && <CardDescription>{description}</CardDescription>}
        </CardHeader>
        <CardContent className="pt-6">
          <div className="flex flex-col items-center justify-center h-[200px] text-center">
            <AlertCircle className="h-12 w-12 text-destructive mb-4" />
            <p className="text-destructive font-medium mb-2">Failed to load chart</p>
            <p className="text-sm text-muted-foreground">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="mt-4 px-4 py-2 bg-background text-foreground border border-border rounded-md hover:bg-accent hover:text-accent-foreground"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry
            </button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent>
        <div className={`h-[${height}px]`}>
          <ResponsiveContainer width="100%" height="100%">
            {children ? (children as React.ReactElement) : <div />}
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}