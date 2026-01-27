/**
 * Dashboard Overview Component
 * Main dashboard content with tabs for different sections
 */

'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MetricsDisplay } from './MetricsDisplay';
import { ScenarioSelector } from './ScenarioSelector';
import { ShockTestingPanel } from './ShockTestingPanel';

interface MetricTrend {
  health_trend: number;
  efficiency_trend: number;
  resilience_trend: number;
}

interface CurrentMetrics {
  health_score: number;
  market_efficiency: number;
  resilience_score: number;
  trends: MetricTrend;
  warnings: string[];
  recommendations: string[];
}

interface DashboardOverviewProps {
  metrics: CurrentMetrics;
  selectedPresetId: string | null;
  onPresetSelect: (presetId: string | null) => void;
  onRunScenario: () => void;
  customScenarioName: string;
  onCustomScenarioNameChange: (name: string) => void;
  onTestShock: (shockParams: {
    type: string;
    magnitude: number;
    duration: number;
  }) => void;
}

export function DashboardOverview({
  metrics,
  selectedPresetId,
  onPresetSelect,
  onRunScenario,
  customScenarioName,
  onCustomScenarioNameChange,
  onTestShock
}: DashboardOverviewProps) {
  return (
    <Card>
      <CardContent className="p-6">
        <Tabs defaultValue="overview">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="scenarios">Scenarios</TabsTrigger>
            <TabsTrigger value="shocks">Shock Testing</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6 pt-6">
            <MetricsDisplay metrics={metrics} />
          </TabsContent>

          <TabsContent value="scenarios" className="space-y-6 pt-6">
            <ScenarioSelector
              selectedPresetId={selectedPresetId}
              onPresetSelect={onPresetSelect}
              onRunScenario={onRunScenario}
              customScenarioName={customScenarioName}
              onCustomScenarioNameChange={onCustomScenarioNameChange}
            />
          </TabsContent>

          <TabsContent value="shocks" className="space-y-6 pt-6">
            <ShockTestingPanel onTestShock={onTestShock} />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}