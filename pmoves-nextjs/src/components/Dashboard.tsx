/**
 * Dashboard Component (Refactored)
 * Main dashboard with modular architecture and improved maintainability
 */

"use client";

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { DashboardHeader } from './dashboard/DashboardHeader';
import { LoadingState } from './dashboard/LoadingState';
import { NoMetricsFallback } from './dashboard/NoMetricsFallback';
import { DashboardOverview } from './dashboard/DashboardOverview';
import { PRESET_SCENARIOS } from '@/lib/presets';
import { formatPercentage } from '@/lib/utils/formatters';

interface ScenarioData {
  id?: string;
  name: string;
  params?: Record<string, number>;
}

interface ShockParams {
  type: string;
  magnitude: number;
  duration: number;
}

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

interface DashboardProps {
  onRunScenario: (scenarioData: ScenarioData) => void;
  onTestShock: (shockParams: ShockParams) => void;
}

export function Dashboard({ onRunScenario, onTestShock }: DashboardProps) {
  const [currentMetrics, setCurrentMetrics] = useState<CurrentMetrics | null>(null);
  const [loading, setLoading] = useState(false);
  const [scenarioName, setScenarioName] = useState('Custom Scenario');
  const [selectedPresetId, setSelectedPresetId] = useState<string | null>(null);

  useEffect(() => {
    fetchCurrentMetrics();
  }, []);

  async function fetchCurrentMetrics() {
    setLoading(true);
    try {
      const response = await fetch('/api/current-metrics');
      if (!response.ok) {
        throw new Error('Failed to fetch current metrics');
      }
      const data = await response.json();
      setCurrentMetrics(data);
    } catch (error) {
      console.error('Error fetching current metrics:', error);
      toast.error('Failed to fetch current metrics');
    } finally {
      setLoading(false);
    }
  }

  function handleRunScenario() {
    // If a preset is selected, use that
    if (selectedPresetId) {
      const selectedPreset = PRESET_SCENARIOS.find((p: any) => p.id === selectedPresetId);
      if (selectedPreset) {
        onRunScenario({
          id: selectedPresetId,
          name: selectedPreset.name
        });
        toast.success(`Running ${selectedPreset.name} scenario...`);
        return;
      }
    }

    // Otherwise use the custom scenario name
    onRunScenario({ name: scenarioName });
    toast.success(`Running ${scenarioName}...`);
  }

  function handleTestShock() {
    // Default shock parameters for testing
    const shockParams = {
      type: 'income_reduction',
      magnitude: 0.2,
      duration: 4
    };

    onTestShock(shockParams);

    // Show toast with shock details
    const shockTypeDisplay = shockParams.type.replace('_', ' ');
    toast.success(
      `Testing ${shockTypeDisplay} shock (${formatPercentage(shockParams.magnitude)} magnitude, ${shockParams.duration} weeks)...`,
      { duration: 3000 }
    );
  }

  return (
    <TooltipProvider>
      <div className="space-y-6">
        <DashboardHeader />
        
        {loading ? (
          <LoadingState />
        ) : currentMetrics ? (
          <DashboardOverview
            metrics={currentMetrics}
            selectedPresetId={selectedPresetId}
            onPresetSelect={setSelectedPresetId}
            onRunScenario={handleRunScenario}
            customScenarioName={scenarioName}
            onCustomScenarioNameChange={setScenarioName}
            onTestShock={handleTestShock}
          />
        ) : (
          <NoMetricsFallback onRetry={fetchCurrentMetrics} />
        )}
      </div>
    </TooltipProvider>
  );
}
