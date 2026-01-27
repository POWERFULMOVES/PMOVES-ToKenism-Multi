/**
 * Economic Indicators Chart Component
 * Displays key performance metrics in a bar chart format
 */

'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { formatPercentage } from '@/lib/utils/formatters';

interface EconomicIndicatorsChartProps {
  healthScore: number;
  marketEfficiency: number;
  resilienceScore: number;
}

export function EconomicIndicatorsChart({ 
  healthScore, 
  marketEfficiency, 
  resilienceScore 
}: EconomicIndicatorsChartProps) {
  const data = [
    { name: 'Health', value: healthScore * 100 },
    { name: 'Efficiency', value: marketEfficiency * 100 },
    { name: 'Resilience', value: resilienceScore * 100 },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Economic Indicators</CardTitle>
        <CardDescription>Key performance metrics</CardDescription>
      </CardHeader>
      <CardContent className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis domain={[0, 100]} />
            <Tooltip formatter={(value) => [formatPercentage((value as number) / 100), '']} />
            <Bar dataKey="value" fill="#82ca9d" />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}