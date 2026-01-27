/**
 * Dynamic Heatmap Chart Component
 * Loads HeatmapChart on-demand to reduce initial bundle size
 */

'use client';

import dynamic from 'next/dynamic';
import { ChartWrapper } from './ChartWrapper';

const HeatmapChart = dynamic(
  () => import('./HeatmapChart').then(mod => mod.HeatmapChart),
  {
    loading: () => (
      <ChartWrapper title="Parameter Sensitivity" description="Shows how parameter changes affect simulation results" height={400} loading={true}>
        <div />
      </ChartWrapper>
    ),
    ssr: false
  }
);

interface DynamicHeatmapChartProps {
  data: Array<{
    parameter: string;
    value: number;
    impact: 'low' | 'medium' | 'high';
  }>;
  title?: string;
  height?: number;
  className?: string;
}

export function DynamicHeatmapChart({ 
  data, 
  title = "Parameter Sensitivity",
  height = 400,
  className 
}: DynamicHeatmapChartProps) {
  return (
    <ChartWrapper title={title} height={height} className={className}>
      <HeatmapChart data={data} title={title} height={height} className={className} />
    </ChartWrapper>
  );
}