/**
 * Heatmap Chart Component
 * Displays parameter sensitivity analysis in a heatmap format
 */

'use client';

import React from 'react';
import { ResponsiveContainer } from 'recharts';

export interface HeatmapChartProps {
  data: Array<{
    parameter: string;
    value: number;
    impact: 'low' | 'medium' | 'high';
  }>;
  title?: string;
  height?: number;
  className?: string;
}

export function HeatmapChart({ 
  data, 
  title = "Parameter Sensitivity", 
  height = 400,
  className 
}: HeatmapChartProps) {
  const getColor = (impact: string) => {
    switch (impact) {
      case 'high': return '#ef4444';
      case 'medium': return '#f59e0b';
      case 'low': return '#22c55e';
      default: return '#e5e7eb';
    }
  };

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-background border border-border rounded-md p-3 shadow-lg">
          <p className="font-medium">{data.parameter}</p>
          <p className="text-sm text-muted-foreground">Impact: {data.impact}</p>
          <p className="text-sm">Value: {data.value.toFixed(2)}</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className={className}>
      {title && (
        <h3 className="text-lg font-semibold mb-4">{title}</h3>
      )}
      <div 
        className="grid gap-1 p-4 bg-card rounded-lg border"
        style={{ 
          height: `${height}px`,
          gridTemplateColumns: `repeat(${Math.ceil(Math.sqrt(data.length))}, 1fr)`
        }}
      >
        {data.map((item, index) => (
          <div
            key={index}
            className="relative group cursor-pointer rounded transition-all hover:scale-105"
            style={{
              backgroundColor: getColor(item.impact),
              aspectRatio: '1',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              fontWeight: 'bold',
              fontSize: '0.75rem'
            }}
            >
            <div className="text-center w-full h-full flex flex-col items-center justify-center">
              <div className="text-xs">{item.parameter}</div>
              <div className="text-lg">{item.value.toFixed(1)}</div>
            </div>
          </div>
        ))}
      </div>
      
      {/* Legend */}
      <div className="flex items-center justify-center gap-4 mt-4 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded" style={{ backgroundColor: '#22c55e' }} />
          <span>Low Impact</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded" style={{ backgroundColor: '#f59e0b' }} />
          <span>Medium Impact</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded" style={{ backgroundColor: '#ef4444' }} />
          <span>High Impact</span>
        </div>
      </div>
    </div>
  );
}
