/**
 * Violin Plot Component
 * Displays wealth distribution density over time or across scenarios
 */

'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

interface ViolinData {
  category: string;
  values: number[];
  color?: string;
}

interface ViolinPlotProps {
  data: ViolinData[];
  title?: string;
  description?: string;
  xLabel?: string;
  yLabel?: string;
  height?: number;
}

function EmptyChartState({ message = "No data available" }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-[300px] text-muted-foreground">
      <svg className="h-12 w-12 mb-3 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
      <p className="text-sm">{message}</p>
      <p className="text-xs mt-1">Run a simulation to see the distribution analysis.</p>
    </div>
  );
}

export function ViolinPlot({
  data,
  title = "Distribution Analysis",
  description,
  xLabel = "Category",
  yLabel = "Value",
  height = 400,
}: ViolinPlotProps) {
  // Handle empty data
  if (!data || data.length === 0 || data.every(d => !d.values || d.values.length === 0)) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          {description && <CardDescription>{description}</CardDescription>}
        </CardHeader>
        <CardContent>
          <EmptyChartState message="No distribution data available" />
        </CardContent>
      </Card>
    );
  }

  // Calculate statistics for each category
  const stats = data.map(item => {
    const sorted = [...item.values].sort((a, b) => a - b);
    const n = sorted.length;

    return {
      category: item.category,
      min: sorted[0],
      q1: sorted[Math.floor(n * 0.25)],
      median: sorted[Math.floor(n * 0.5)],
      q3: sorted[Math.floor(n * 0.75)],
      max: sorted[n - 1],
      mean: item.values.reduce((a, b) => a + b, 0) / n,
      values: item.values,
      color: item.color || '#8884d8',
    };
  });

  // Calculate overall value range for scaling
  const allValues = data.flatMap(d => d.values);
  const minValue = Math.min(...allValues);
  const maxValue = Math.max(...allValues);
  const rawValueRange = maxValue - minValue;
  const valueRange = rawValueRange === 0 ? 1 : rawValueRange;

  // SVG dimensions
  const width = 800;
  const margin = { top: 20, right: 30, bottom: 60, left: 60 };
  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;

  // Scales
  const xScale = (index: number) => margin.left + (index + 0.5) * (plotWidth / stats.length);
  const yScale = (value: number) => {
    return margin.top + plotHeight - ((value - minValue) / valueRange) * plotHeight;
  };

  // Calculate kernel density estimation for violin shape
  const kde = (values: number[], bandwidth?: number) => {
    const safeBandwidth = bandwidth ?? valueRange * 0.1;
    const effectiveBandwidth = safeBandwidth === 0 ? 1 : safeBandwidth;
    const points: { y: number; density: number }[] = [];
    const nPoints = 50;

    for (let i = 0; i < nPoints; i++) {
      const y = minValue + (i / (nPoints - 1)) * valueRange;
      let density = 0;

      for (const value of values) {
        const u = (y - value) / effectiveBandwidth;
        density += Math.exp(-0.5 * u * u);
      }

      density /= (values.length * effectiveBandwidth * Math.sqrt(2 * Math.PI));
      points.push({ y, density });
    }

    return points;
  };

  return (
    <Card>
      {(title || description) && (
        <CardHeader>
          {title && <CardTitle>{title}</CardTitle>}
          {description && <CardDescription>{description}</CardDescription>}
        </CardHeader>
      )}
      <CardContent>
        <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}>
          {/* Y-axis */}
          <line
            x1={margin.left}
            y1={margin.top}
            x2={margin.left}
            y2={height - margin.bottom}
            stroke="currentColor"
            strokeWidth="1"
          />

          {/* Y-axis label */}
          <text
            x={margin.left - 40}
            y={margin.top + plotHeight / 2}
            textAnchor="middle"
            transform={`rotate(-90 ${margin.left - 40} ${margin.top + plotHeight / 2})`}
            className="text-sm fill-current"
          >
            {yLabel}
          </text>

          {/* Y-axis ticks */}
          {[0, 0.25, 0.5, 0.75, 1].map(pct => {
            const value = minValue + pct * valueRange;
            const y = yScale(value);
            return (
              <g key={pct}>
                <line
                  x1={margin.left - 5}
                  y1={y}
                  x2={margin.left}
                  y2={y}
                  stroke="currentColor"
                  strokeWidth="1"
                />
                <text
                  x={margin.left - 10}
                  y={y}
                  textAnchor="end"
                  dominantBaseline="middle"
                  className="text-xs fill-current"
                >
                  {value.toFixed(0)}
                </text>
              </g>
            );
          })}

          {/* X-axis */}
          <line
            x1={margin.left}
            y1={height - margin.bottom}
            x2={width - margin.right}
            y2={height - margin.bottom}
            stroke="currentColor"
            strokeWidth="1"
          />

          {/* X-axis label */}
          <text
            x={margin.left + plotWidth / 2}
            y={height - 10}
            textAnchor="middle"
            className="text-sm fill-current"
          >
            {xLabel}
          </text>

          {/* Violin plots */}
          {stats.map((stat, index) => {
            const centerX = xScale(index);
            const violinWidth = plotWidth / stats.length * 0.8;
            const density = kde(stat.values);
            const maxDensity = Math.max(...density.map(p => p.density));

            // Create violin shape path
            const leftPath = density
              .map(p => {
                const y = yScale(p.y);
                const x = centerX - (p.density / maxDensity) * (violinWidth / 2);
                return `${x},${y}`;
              })
              .join(' L');

            const rightPath = density
              .map(p => {
                const y = yScale(p.y);
                const x = centerX + (p.density / maxDensity) * (violinWidth / 2);
                return `${x},${y}`;
              })
              .reverse()
              .join(' L');

            const violinPath = `M${leftPath} L${rightPath} Z`;

            return (
              <g key={index}>
                {/* Violin shape */}
                <path
                  d={violinPath}
                  fill={stat.color}
                  fillOpacity="0.3"
                  stroke={stat.color}
                  strokeWidth="2"
                />

                {/* Box plot overlay */}
                <line
                  x1={centerX}
                  y1={yScale(stat.min)}
                  x2={centerX}
                  y2={yScale(stat.max)}
                  stroke={stat.color}
                  strokeWidth="1"
                  strokeDasharray="2,2"
                />

                {/* IQR box */}
                <rect
                  x={centerX - 10}
                  y={yScale(stat.q3)}
                  width={20}
                  height={yScale(stat.q1) - yScale(stat.q3)}
                  fill={stat.color}
                  fillOpacity="0.5"
                  stroke={stat.color}
                  strokeWidth="2"
                />

                {/* Median line */}
                <line
                  x1={centerX - 10}
                  y1={yScale(stat.median)}
                  x2={centerX + 10}
                  y2={yScale(stat.median)}
                  stroke="white"
                  strokeWidth="2"
                />

                {/* Mean point */}
                <circle
                  cx={centerX}
                  cy={yScale(stat.mean)}
                  r="3"
                  fill="white"
                  stroke={stat.color}
                  strokeWidth="2"
                />

                {/* Category label */}
                <text
                  x={centerX}
                  y={height - margin.bottom + 20}
                  textAnchor="middle"
                  className="text-sm fill-current"
                >
                  {stat.category}
                </text>

                {/* Tooltip on hover (simplified) */}
                <title>
                  {`${stat.category}\nMin: ${stat.min.toFixed(2)}\nQ1: ${stat.q1.toFixed(2)}\nMedian: ${stat.median.toFixed(2)}\nMean: ${stat.mean.toFixed(2)}\nQ3: ${stat.q3.toFixed(2)}\nMax: ${stat.max.toFixed(2)}\nN: ${stat.values.length}`}
                </title>
              </g>
            );
          })}
        </svg>

        {/* Legend */}
        <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 border-2" style={{ borderColor: '#8884d8' }} />
            <span>Violin: Distribution density</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-blue-500 opacity-50" />
            <span>Box: IQR (Q1-Q3)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-0.5 bg-white border border-gray-400" />
            <span>Line: Median</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-white border-2 border-blue-500" />
            <span>Dot: Mean</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Helper to prepare wealth distribution data for violin plot
 */
export function prepareWealthDistributionData(
  members: any[],
  scenarios: string[] = ['Scenario A', 'Scenario B']
): ViolinData[] {
  return scenarios.map((scenario, index) => {
    const wealthKey = index === 0 ? 'Wealth_A' : 'Wealth_B';
    const values = members.map(m => m[wealthKey]).filter(v => v !== undefined);

    return {
      category: scenario,
      values,
      color: index === 0 ? '#8884d8' : '#82ca9d'
    };
  });
}
