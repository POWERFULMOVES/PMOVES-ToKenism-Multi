"use client";

import { useSimulation } from '@/lib/context/SimulationContext';
import { EnhancedSimulationForm } from '@/components/EnhancedSimulationForm';
import { SimulationResults } from '@/components/SimulationResults';
import { Dashboard } from '@/components/Dashboard';
// These components will be used in future updates
// import { ScenarioResults } from '@/components/ScenarioResults';
// import { ShockResults } from '@/components/ShockResults';
import { PresetSelector } from '@/components/PresetSelector';
import { ComparisonResults } from '@/components/ComparisonResults';
import { ModelExplanation } from '@/components/ModelExplanation';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Toaster } from '@/components/ui/sonner';

export default function Home() {
  const {
    params,
    results,
    isLoading,
    activeTab,
    setParams,
    setActiveTab,
    runSimulation,
    applyPresetAndRun,
    resetParams,
    presetName
  } = useSimulation();

  interface PresetData {
    id: string;
    name: string;
    params?: Record<string, unknown>;
  }

  // This matches the expected type in Dashboard component
  interface ScenarioData {
    name: string;
    params?: Record<string, unknown>;
  }

  interface ShockParams {
    type: string;
    magnitude: number;
    duration: number;
  }

  // Handle preset selection from PresetSelector
  const handlePresetSelect = (presetData: PresetData) => {
    if (presetData.id) {
      applyPresetAndRun(presetData.id);
    }
  };

  // Handle scenario selection from Dashboard
  const handleScenarioSelect = (scenarioData: ScenarioData) => {
    console.log("Running scenario:", scenarioData);

    // If the scenario has an ID, it's a preset
    if ('id' in scenarioData && scenarioData.id) {
      applyPresetAndRun(scenarioData.id as string);
      return;
    }

    // Otherwise, just run the simulation with current params
    runSimulation();
  };

  const handleShockTest = (shockParams: ShockParams) => {
    // Handle shock testing
    console.log("Testing shock:", shockParams);
  };

  return (
    <div className="container mx-auto py-8">
      <header className="mb-8 text-center">
        <h1 className="text-3xl font-bold mb-2">PMOVES Economic Simulator</h1>
        <p className="text-muted-foreground mb-4">
          Compare traditional economic systems with cooperative community-based models
        </p>
        <div className="flex justify-center">
          <a href="/documentation" className="text-blue-500 hover:text-blue-700 text-sm">
            View Documentation
          </a>
        </div>
      </header>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="presets">Presets</TabsTrigger>
          <TabsTrigger value="setup">Custom Setup</TabsTrigger>
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="analysis">Analysis</TabsTrigger>
        </TabsList>

        <TabsContent value="presets" className="space-y-4">
          <div className="grid grid-cols-1 gap-6">
            <div className="prose max-w-none">
              <h2>Economic Model Comparison</h2>
              <p className="lead">
                Compare traditional economic models with cooperative community-based approaches to see which performs better under different conditions.
              </p>
              <p>
                This simulator allows you to test how different economic structures affect wealth distribution, inequality, and community resilience.
                Choose a preset scenario below or customize your own parameters in the "Custom Setup" tab.
              </p>
            </div>
            <PresetSelector onSelectPreset={handlePresetSelect} isLoading={isLoading} />
            <ModelExplanation />
          </div>
        </TabsContent>

        <TabsContent value="setup" className="space-y-4">
          <EnhancedSimulationForm
            params={params}
            onParamsChange={setParams}
            onSubmit={runSimulation}
            isLoading={isLoading}
            onReset={resetParams}
            presetName={presetName}
            showPreview={true}
          />
        </TabsContent>

        <TabsContent value="dashboard" className="space-y-4">
          <Dashboard
            onRunScenario={handleScenarioSelect}
            onTestShock={handleShockTest}
          />
        </TabsContent>

        <TabsContent value="analysis" className="space-y-4">
          {results ? (
            <div className="grid grid-cols-1 gap-6">
              <ComparisonResults results={results} />
              <SimulationResults results={results} presetName={presetName} simulationParams={params as Record<string, number>} />
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-64 p-12 text-center border rounded-lg border-dashed">
              <h3 className="text-lg font-medium mb-2">No analysis results</h3>
              <p className="text-muted-foreground mb-4">
                Run a simulation or test a scenario to see results here.
              </p>
            </div>
          )}
        </TabsContent>
      </Tabs>

      <Toaster />
    </div>
  );
}
