/**
 * Scenario Selector Component
 * Allows users to select preset scenarios or run custom scenarios
 */

'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { InfoCircledIcon } from '@radix-ui/react-icons';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { PRESET_SCENARIOS } from '@/lib/presets';
import { ModelExplanation } from '@/components/ModelExplanation';

interface ScenarioSelectorProps {
  selectedPresetId: string | null;
  onPresetSelect: (presetId: string | null) => void;
  onRunScenario: () => void;
  customScenarioName: string;
  onCustomScenarioNameChange: (name: string) => void;
}

export function ScenarioSelector({
  selectedPresetId,
  onPresetSelect,
  onRunScenario,
  customScenarioName,
  onCustomScenarioNameChange
}: ScenarioSelectorProps) {
  const handleRunCustomScenario = () => {
    onPresetSelect(null);
    onRunScenario();
  };

  return (
    <div className="grid grid-cols-1 gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center">
            Select Scenario
            <Tooltip>
              <TooltipTrigger asChild>
                <InfoCircledIcon className="h-4 w-4 ml-1 text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent>
                <p className="max-w-xs">Run a simulation with preset or custom parameters to test different economic conditions.</p>
              </TooltipContent>
            </Tooltip>
          </CardTitle>
          <CardDescription>Test different economic scenarios</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="presets" className="space-y-4">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="presets">Preset Scenarios</TabsTrigger>
              <TabsTrigger value="custom">Custom Scenario</TabsTrigger>
            </TabsList>

            <TabsContent value="presets" className="space-y-4">
              <div className="grid grid-cols-1 gap-3">
                {PRESET_SCENARIOS.map(preset => (
                  <div
                    key={preset.id}
                    className={`p-3 border rounded-md cursor-pointer transition-all ${selectedPresetId === preset.id ? 'border-primary bg-primary/5' : 'hover:border-primary/50'}`}
                    onClick={() => onPresetSelect(preset.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        onPresetSelect(preset.id);
                      }
                    }}
                    tabIndex={0}
                    role="button"
                    aria-pressed={selectedPresetId === preset.id}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-medium text-sm">{preset.name}</h4>
                        <p className="text-xs text-muted-foreground mt-1">{preset.description}</p>
                      </div>
                      {selectedPresetId === preset.id && (
                        <Badge variant="outline" className="ml-2 bg-primary/10">Selected</Badge>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {preset.tags.map(tag => (
                        <Badge key={tag} variant="secondary" className="text-xs">
                          {tag.replace('-', ' ')}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <Button
                onClick={onRunScenario}
                disabled={!selectedPresetId}
                className="w-full"
              >
                {selectedPresetId ? 'Run Selected Scenario' : 'Select a Scenario'}
              </Button>
            </TabsContent>

            <TabsContent value="custom" className="space-y-4">
              <div>
                <label htmlFor="scenario-name" className="block text-sm font-medium mb-1">Custom Scenario Name</label>
                <Input
                  id="scenario-name"
                  value={customScenarioName}
                  onChange={(e) => onCustomScenarioNameChange(e.target.value)}
                  className="w-full"
                  placeholder="Enter scenario name"
                />
              </div>
              <div className="bg-amber-50 p-3 rounded-md">
                <p className="text-xs text-amber-700">
                  Custom scenarios use the parameters you've configured in the Custom Setup tab.
                  Make sure to set up your parameters before running a custom scenario.
                </p>
              </div>
              <Button
                onClick={handleRunCustomScenario}
                className="w-full"
              >
                Run Custom Scenario
              </Button>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <ModelExplanation />
    </div>
  );
}