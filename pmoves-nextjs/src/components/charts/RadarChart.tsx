/**
 * Radar Chart Component
 * Displays multi-dimensional analysis in a radar format
 */

'use client';

import React from 'react';
import { 
  RadarChart as RechartsRadarChart, 
  PolarGrid, 
  PolarAngleAxis, 
  PolarRadiusAxis, 
  Radar, 
  Tooltip as RechartsTooltip, 
  Legend, 
  ResponsiveContainer 
} from 'recharts';

interface RadarChartProps {
  data: Array<{
    [key: string]: any;
  }>;
  metrics: Array<{
    dataKey: string;
    name: string;
    color: string;
  }>;
  title?: string;
  description?: string;
  height?: number;
  className?: string;
}

export function RadarChart({
  data,
  metrics,
  title = "Multi-dimensional Analysis",
  description,
  height = 400,
  className
}: RadarChartProps) {
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-background border border-border rounded-md p-3 shadow-lg">
          {payload.map((entry: any, index: number) => (
            <p key={index} className="text-sm" style={{ color: entry.color }}>
              {entry.name}: {typeof entry.value === 'number' ? entry.value.toFixed(2) : entry.value}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className={className}>
      {title && (
        <h3 className="text-lg font-semibold mb-2">{title}</h3>
      )}
      {description && (
        <p className="text-sm text-muted-foreground mb-4">{description}</p>
      )}
      <div style={{ height: `${height}px` }}>
        <ResponsiveContainer width="100%" height="100%">
          <RechartsRadarChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <PolarGrid 
              gridType="polygon" 
              radialLines={true}
              stroke="#e5e7eb"
              strokeWidth={1}
            />
            <PolarAngleAxis 
              type="number"
              domain={[0, 360]}
              tick={{ fontSize: 12 }}
            />
            <PolarRadiusAxis 
              angle={90}
              domain={[0, 'auto']}
              tick={{ fontSize: 12 }}
            />
            <RechartsTooltip content={<CustomTooltip />} />
            <Legend />
            {metrics.map((metric, index) => (
              <Radar
                key={metric.dataKey}
                name={metric.name}
                dataKey={metric.dataKey}
                stroke={metric.color}
                fill={metric.color}
                fillOpacity={0.3}
                strokeWidth={2}
                animationDuration={1000}
                animationEasing="ease-in-out"
              />
            ))}
          </RechartsRadarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}