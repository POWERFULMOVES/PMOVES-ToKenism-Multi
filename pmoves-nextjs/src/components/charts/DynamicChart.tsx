/**
 * Dynamic Chart Component
 * Loads chart components on-demand to improve initial bundle size
 */

'use client';

import dynamic from 'next/dynamic';
import { ChartWrapper } from './ChartWrapper';

// Simple interfaces for dynamic chart props
interface BaseChartProps {
  title: string;
  description?: string;
  height?: number;
  className?: string;
}

interface HeatmapChartProps extends BaseChartProps {
  data: Array<{
    parameter: string;
    value: number;
    impact: 'low' | 'medium' | 'high';
  }>;
}

interface LineChartProps extends BaseChartProps {
  data: Array<{
    [key: string]: any;
  }>;
  lines?: Array<{
    dataKey: string;
    name: string;
    color: string;
    strokeDasharray?: string;
    strokeWidth?: number;
    dot?: boolean;
  }>;
  xDataKey?: string;
  yLabel?: string;
  xLabel?: string;
}

interface BarChartProps extends BaseChartProps {
  data: Array<{
    [key: string]: any;
  }>;
  bars?: Array<{
    dataKey: string;
    name: string;
    color: string;
  }>;
  xDataKey?: string;
  yLabel?: string;
  xLabel?: string;
}

interface RadarChartProps extends BaseChartProps {
  data: Array<{
    [key: string]: any;
  }>;
  metrics?: Array<{
    dataKey: string;
    name: string;
    color: string;
  }>;
}

export function DynamicHeatmapChart(props: HeatmapChartProps) {
  const DynamicComponent = dynamic(
    () => import('./HeatmapChart').then(mod => ({ default: mod.HeatmapChart })),
    {
      loading: () => (
        <ChartWrapper title={props.title || ""} description={props.description} height={props.height} loading={true}>
          <div />
        </ChartWrapper>
      ),
      ssr: false
    }
  );

  return <DynamicComponent {...props} />;
}

export function DynamicLineChart(props: LineChartProps) {
  const DynamicComponent = dynamic(
    () => import('./LineChart').then(mod => ({ default: mod.LineChart })),
    {
      loading: () => (
        <ChartWrapper title={props.title || ""} description={props.description} height={props.height} loading={true}>
          <div />
        </ChartWrapper>
      ),
      ssr: false
    }
  );

  return <DynamicComponent {...(props as any)} />;
}

export function DynamicBarChart(props: BarChartProps) {
  const DynamicComponent = dynamic(
    () => import('./BarChart').then(mod => ({ default: mod.BarChart })),
    {
      loading: () => (
        <ChartWrapper title={props.title} description={props.description} height={props.height} loading={true}>
          <div />
        </ChartWrapper>
      ),
      ssr: false
    }
  );

  return <DynamicComponent {...(props as any)} />;
}

export function DynamicRadarChart(props: RadarChartProps) {
  const DynamicComponent = dynamic(
    () => import('./RadarChart').then(mod => ({ default: mod.RadarChart })),
    {
      loading: () => (
        <ChartWrapper title={props.title} description={props.description} height={props.height} loading={true}>
          <div />
        </ChartWrapper>
      ),
      ssr: false
    }
  );

  return <DynamicComponent {...(props as any)} />;
}