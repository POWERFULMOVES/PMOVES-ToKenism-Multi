/**
 * System Balance Chart Component
 * Displays economic system characteristics in a radar chart format
 */

'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Legend } from 'recharts';

interface SystemBalanceChartProps {
  data?: Array<{
    subject: string;
    A: number;
    B: number;
  }>;
}

export function SystemBalanceChart({ 
  data = [
    { subject: 'Wealth', A: 65, B: 85 },
    { subject: 'Equality', A: 45, B: 75 },
    { subject: 'Resilience', A: 55, B: 80 },
    { subject: 'Efficiency', A: 70, B: 65 },
    { subject: 'Sustainability', A: 50, B: 85 },
  ]
}: SystemBalanceChartProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">System Balance</CardTitle>
        <CardDescription>Economic system characteristics</CardDescription>
      </CardHeader>
      <CardContent className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart outerRadius={90} data={data}>
            <PolarGrid />
            <PolarAngleAxis dataKey="subject" />
            <PolarRadiusAxis angle={30} domain={[0, 100]} />
            <Radar name="Traditional (A)" dataKey="A" stroke="#8884d8" fill="#8884d8" fillOpacity={0.2} />
            <Radar name="Cooperative (B)" dataKey="B" stroke="#82ca9d" fill="#82ca9d" fillOpacity={0.2} />
            <Legend />
          </RadarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}