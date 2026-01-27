/**
 * Dynamic Line Chart Component
 * Loads LineChart on-demand to reduce initial bundle size
 */

'use client';

import dynamic from 'next/dynamic';
import { ChartWrapper } from './ChartWrapper';

const LineChart = dynamic(
  () => import('./LineChart').then(mod => mod.LineChart),
  {
    loading: () => (
      <ChartWrapper title="Trend Analysis" description="Displays trends over time" height={300} loading={true}>
        <div />
      </ChartWrapper>
    ),
    ssr: false
  }
);

interface DynamicLineChartProps {
  data: Array<{
    [key: string]: any;
  }>;
  lines: Array<{
    dataKey: string;
    name: string;
    color: string;
    strokeDasharray?: string;
    strokeWidth?: number;
    dot?: boolean;
  }>;
  title?: string;
  description?: string;
  height?: number;
  xDataKey?: string;
  yLabel?: string;
  xLabel?: string;
  className?: string;
}

export function DynamicLineChart({ 
  data,
  lines,
  title = "Trend Analysis",
  description,
  height = 300,
  xDataKey = "week",
  yLabel = "Value",
  xLabel = "Time",
  className
}: DynamicLineChartProps) {
  return (
    <ChartWrapper title={title} description={description} height={height} className={className}>
      <LineChart 
        data={data}
        lines={lines}
        title={title}
        description={description}
        height={height}
        xDataKey={xDataKey}
        yLabel={yLabel}
        xLabel={xLabel}
        className={className}
      />
    </ChartWrapper>
  );
}