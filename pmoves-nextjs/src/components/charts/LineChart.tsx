/**
 * Line Chart Component
 * Displays trend analysis over time
 */

'use client';

import React from 'react';
import {
  LineChart as RechartsLineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';

interface LineChartProps {
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

export function LineChart({
  data,
  lines,
  title = "Trend Analysis",
  description,
  height = 300,
  xDataKey = "week",
  yLabel = "Value",
  xLabel = "Time",
  className
}: LineChartProps) {
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-background border border-border rounded-md p-3 shadow-lg">
          <p className="font-medium mb-2">{`${xLabel}: ${label}`}</p>
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
          <RechartsLineChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
            <XAxis 
              dataKey={xDataKey}
              label={{ value: xLabel, position: 'insideBottom', offset: -5 }}
              tick={{ fontSize: 12 }}
            />
            <YAxis 
              label={{ value: yLabel, angle: -90, position: 'insideLeft' }}
              tick={{ fontSize: 12 }}
              domain={[0, 'auto']}
            />
            <RechartsTooltip content={<CustomTooltip />} />
            <Legend />
            {lines.map((line, index) => (
              <Line
                key={line.dataKey}
                type="monotone"
                dataKey={line.dataKey}
                name={line.name}
                stroke={line.color}
                strokeWidth={line.strokeWidth || 2}
                strokeDasharray={line.strokeDasharray}
                dot={line.dot !== false}
                connectNulls={false}
                animationDuration={1000}
                animationEasing="ease-in-out"
              />
            ))}
          </RechartsLineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}