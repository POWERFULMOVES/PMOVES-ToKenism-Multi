/**
 * Waterfall Chart Component
 * Displays cumulative wealth flow (income → spending → savings → tokens)
 */

'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

interface WaterfallDataPoint {
  category: string;
  value: number;
  isTotal?: boolean;
  color?: string;
}

interface WaterfallChartProps {
  data: WaterfallDataPoint[];
  title?: string;
  description?: string;
  yLabel?: string;
  height?: number;
  showConnectors?: boolean;
}

function EmptyChartState({ message = "No data available" }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-[300px] text-muted-foreground">
      <svg className="h-12 w-12 mb-3 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
      <p className="text-sm">{message}</p>
      <p className="text-xs mt-1">Run a simulation to see the wealth flow analysis.</p>
    </div>
  );
}

export function WaterfallChart({
  data,
  title = "Wealth Flow Analysis",
  description,
  yLabel = "Amount ($)",
  height = 400,
  showConnectors = true,
}: WaterfallChartProps) {
  // Handle empty data
  if (!data || data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          {description && <CardDescription>{description}</CardDescription>}
        </CardHeader>
        <CardContent>
          <EmptyChartState message="No wealth flow data available" />
        </CardContent>
      </Card>
    );
  }

  // Calculate cumulative positions
  let runningTotal = 0;
  const chartData = data.map((point) => {
    const start = point.isTotal ? 0 : runningTotal;
    const end = point.isTotal ? point.value : runningTotal + point.value;
    runningTotal = point.isTotal ? point.value : end;

    return {
      ...point,
      start,
      end,
      height: Math.abs(point.value),
      isPositive: point.value >= 0,
    };
  });

  // Calculate scale
  const allValues = chartData.flatMap(d => [d.start, d.end]);
  const minValue = Math.min(...allValues, 0);
  const maxValue = Math.max(...allValues);
  const valueRange = maxValue - minValue;

  // SVG dimensions
  const width = 800;
  const margin = { top: 20, right: 30, bottom: 80, left: 80 };
  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;

  // Scales
  const xScale = (index: number) => {
    return margin.left + (index + 0.5) * (plotWidth / data.length);
  };

  const yScale = (value: number) => {
    return margin.top + plotHeight - ((value - minValue) / valueRange) * plotHeight;
  };

  // Default colors
  const getColor = (point: any) => {
    if (point.color) return point.color;
    if (point.isTotal) return '#6366f1'; // Indigo for totals
    return point.isPositive ? '#10b981' : '#ef4444'; // Green for positive, red for negative
  };

  // Bar width
  const barWidth = (plotWidth / data.length) * 0.6;

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
            x={margin.left - 50}
            y={margin.top + plotHeight / 2}
            textAnchor="middle"
            transform={`rotate(-90 ${margin.left - 50} ${margin.top + plotHeight / 2})`}
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

          {/* Zero line */}
          {minValue < 0 && (
            <line
              x1={margin.left}
              y1={yScale(0)}
              x2={width - margin.right}
              y2={yScale(0)}
              stroke="currentColor"
              strokeWidth="1"
              strokeDasharray="4,4"
              opacity="0.5"
            />
          )}

          {/* X-axis */}
          <line
            x1={margin.left}
            y1={height - margin.bottom}
            x2={width - margin.right}
            y2={height - margin.bottom}
            stroke="currentColor"
            strokeWidth="1"
          />

          {/* Waterfall bars and connectors */}
          {chartData.map((point, index) => {
            const centerX = xScale(index);
            const nextCenterX = index < chartData.length - 1 ? xScale(index + 1) : centerX;
            const barTop = yScale(Math.max(point.start, point.end));
            const barBottom = yScale(Math.min(point.start, point.end));
            const barHeight = barBottom - barTop;
            const color = getColor(point);

            return (
              <g key={index}>
                {/* Bar */}
                <rect
                  x={centerX - barWidth / 2}
                  y={barTop}
                  width={barWidth}
                  height={barHeight}
                  fill={color}
                  fillOpacity="0.7"
                  stroke={color}
                  strokeWidth="2"
                  className="transition-opacity hover:opacity-100"
                />

                {/* Connector to next bar */}
                {showConnectors && index < chartData.length - 1 && !chartData[index + 1].isTotal && (
                  <line
                    x1={centerX + barWidth / 2}
                    y1={yScale(point.end)}
                    x2={nextCenterX - barWidth / 2}
                    y2={yScale(point.end)}
                    stroke="currentColor"
                    strokeWidth="1"
                    strokeDasharray="3,3"
                    opacity="0.4"
                  />
                )}

                {/* Value label */}
                <text
                  x={centerX}
                  y={barTop - 5}
                  textAnchor="middle"
                  className="text-xs fill-current font-semibold"
                >
                  {point.value >= 0 ? '+' : ''}{point.value.toFixed(0)}
                </text>

                {/* Running total at top of bar (for totals) */}
                {point.isTotal && (
                  <text
                    x={centerX}
                    y={yScale(point.end) - 15}
                    textAnchor="middle"
                    className="text-xs fill-current font-bold"
                  >
                    Total: {point.end.toFixed(0)}
                  </text>
                )}

                {/* Category label */}
                <text
                  x={centerX}
                  y={height - margin.bottom + 20}
                  textAnchor="end"
                  transform={`rotate(-45 ${centerX} ${height - margin.bottom + 20})`}
                  className="text-sm fill-current"
                >
                  {point.category}
                </text>

                {/* Tooltip */}
                <title>
                  {`${point.category}\nValue: ${point.value.toFixed(2)}\nRunning Total: ${point.end.toFixed(2)}`}
                </title>
              </g>
            );
          })}
        </svg>

        {/* Legend */}
        <div className="mt-4 flex flex-wrap items-center justify-center gap-4 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-green-500 opacity-70" />
            <span>Positive (Income/Gains)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-red-500 opacity-70" />
            <span>Negative (Spending/Losses)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-indigo-500 opacity-70" />
            <span>Total/Subtotal</span>
          </div>
          {showConnectors && (
            <div className="flex items-center gap-2">
              <div className="w-8 h-0.5 border-t border-dashed border-gray-400" />
              <span>Flow connector</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Helper to prepare wealth flow data from simulation results
 */
export function prepareWealthFlowData(member: any): WaterfallDataPoint[] {
  // Example wealth flow: Income → Spending → Savings → GroTokens → Final Wealth
  const income = member.weekly_income || 1000;
  const spending = -(member.weekly_spending || 600);
  const savings = member.total_savings || 0;
  const groTokenValue = (member.grotoken_balance || 0) * 2; // $2 per token
  const cooperativeSavings = member.cooperative_savings || 0;

  return [
    {
      category: 'Weekly Income',
      value: income,
      isTotal: false,
      color: '#10b981',
    },
    {
      category: 'Spending',
      value: spending,
      isTotal: false,
      color: '#ef4444',
    },
    {
      category: 'Net Cash',
      value: 0,
      isTotal: true,
      color: '#6366f1',
    },
    {
      category: 'Savings',
      value: savings,
      isTotal: false,
      color: '#10b981',
    },
    {
      category: 'GroTokens',
      value: groTokenValue,
      isTotal: false,
      color: '#8b5cf6',
    },
    {
      category: 'Coop Savings',
      value: cooperativeSavings,
      isTotal: false,
      color: '#14b8a6',
    },
    {
      category: 'Total Wealth',
      value: 0,
      isTotal: true,
      color: '#6366f1',
    },
  ];
}

/**
 * Helper to prepare scenario comparison waterfall
 */
export function prepareScenarioComparison(
  memberA: any,
  memberB: any
): WaterfallDataPoint[] {
  const wealthA = memberA.Wealth_A || memberA.total_wealth || 0;
  const wealthB = memberB.Wealth_B || memberB.total_wealth || 0;
  const difference = wealthB - wealthA;

  const groupBuyingSavings = (memberB.cooperative_savings || 0) - (memberA.cooperative_savings || 0);
  const tokenGains = ((memberB.grotoken_balance || 0) * 2) - ((memberA.grotoken_balance || 0) * 2);
  const otherDifference = difference - groupBuyingSavings - tokenGains;

  return [
    {
      category: 'Traditional Wealth',
      value: wealthA,
      isTotal: true,
      color: '#8884d8',
    },
    {
      category: 'Group Buying Savings',
      value: groupBuyingSavings,
      isTotal: false,
      color: '#10b981',
    },
    {
      category: 'GroToken Value',
      value: tokenGains,
      isTotal: false,
      color: '#8b5cf6',
    },
    {
      category: 'Other Effects',
      value: otherDifference,
      isTotal: false,
      color: otherDifference >= 0 ? '#10b981' : '#ef4444',
    },
    {
      category: 'Cooperative Wealth',
      value: 0,
      isTotal: true,
      color: '#82ca9d',
    },
  ];
}
