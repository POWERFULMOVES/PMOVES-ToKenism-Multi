"use client";

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PRESET_SCENARIOS, type PresetScenario, applyPreset } from '@/lib/presets';
import { formatCurrency, formatPercentage } from '@/lib/utils/formatters';
import { Badge } from '@/components/ui/badge';
import { InfoCircledIcon, ArrowRightIcon } from '@radix-ui/react-icons';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface PresetData {
  id: string;
  name: string;
  params: Record<string, unknown>;
}

interface PresetSelectorProps {
  onSelectPreset: (data: PresetData) => void;
  isLoading?: boolean;
}

export function PresetSelector({ onSelectPreset, isLoading = false }: PresetSelectorProps) {
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null);
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [presetDetails, setPresetDetails] = useState<PresetScenario | null>(null);
  const [presetParams, setPresetParams] = useState<Record<string, unknown>>(null as unknown as Record<string, unknown>);

  // Get all unique tags
  const allTags = Array.from(
    new Set(PRESET_SCENARIOS.flatMap(preset => preset.tags))
  ).sort();

  // Filter presets by active tag
  const filteredPresets = activeTag
    ? PRESET_SCENARIOS.filter(preset => preset.tags.includes(activeTag))
    : PRESET_SCENARIOS;

  const handleSelectPreset = (preset: PresetScenario) => {
    setSelectedPreset(preset.id);
    setPresetDetails(preset);
    const params = applyPreset(preset.id);
    setPresetParams(params);
  };

  // Format parameter names for display
  const formatParameterName = (key: string): string => {
    return key
      .replace(/_/g, ' ')
      .toLowerCase()
      .replace(/\b\w/g, c => c.toUpperCase());
  };

  // Format parameter values based on their type
  const formatParameterValue = (key: string, value: number): string => {
    if (key.includes('PERCENT')) {
      return formatPercentage(value);
    } else if (key.includes('INCOME') || key.includes('BUDGET') || key.includes('FEE') || key.includes('VALUE')) {
      return formatCurrency(value);
    } else {
      return value.toString();
    }
  };

  const handleRunSimulation = () => {
    if (!selectedPreset || !presetParams) return;

    onSelectPreset({
      id: selectedPreset,
      name: presetDetails?.name || '',
      params: presetParams
    });
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center">
          Preset Scenarios
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <InfoCircledIcon className="h-4 w-4 ml-2 text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent className="max-w-sm">
                <p>These presets configure the simulation with parameters designed to test specific economic conditions.</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </CardTitle>
        <CardDescription>
          Choose a preset to quickly test different economic scenarios
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2 mb-4">
          <Badge
            variant={activeTag === null ? "default" : "outline"}
            className="cursor-pointer"
            onClick={() => setActiveTag(null)}
          >
            All
          </Badge>
          {allTags.map(tag => (
            <Badge
              key={tag}
              variant={activeTag === tag ? "default" : "outline"}
              className="cursor-pointer"
              onClick={() => setActiveTag(tag)}
            >
              {tag.replace('-', ' ')}
            </Badge>
          ))}
        </div>

        <Tabs defaultValue="select" className="space-y-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="select">Select Preset</TabsTrigger>
            <TabsTrigger value="preview" disabled={!selectedPreset}>Preview & Run</TabsTrigger>
          </TabsList>

          <TabsContent value="select" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredPresets.map(preset => (
                <Card
                  key={preset.id}
                  className={`cursor-pointer transition-all ${selectedPreset === preset.id ? 'border-primary' : 'hover:border-primary/50'}`}
                  onClick={() => handleSelectPreset(preset)}
                >
                  <CardHeader className="p-4 pb-2">
                    <CardTitle className="text-base">{preset.name}</CardTitle>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {preset.tags.map(tag => (
                        <Badge key={tag} variant="secondary" className="text-xs">
                          {tag.replace('-', ' ')}
                        </Badge>
                      ))}
                    </div>
                  </CardHeader>
                  <CardContent className="p-4 pt-2">
                    <p className="text-sm text-muted-foreground">{preset.description}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="preview" className="space-y-4">
            {selectedPreset && presetDetails && (
              <Card>
                <CardHeader>
                  <CardTitle>{presetDetails.name}</CardTitle>
                  <CardDescription>{presetDetails.description}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="bg-slate-50 p-4 rounded-md">
                    <h3 className="text-sm font-medium mb-2">Key Parameters</h3>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                      {presetParams && Object.entries(presetParams).filter(([key]) =>
                        ['NUM_MEMBERS', 'SIMULATION_WEEKS', 'WEEKLY_INCOME_AVG', 'WEEKLY_FOOD_BUDGET_AVG',
                         'PERCENT_SPEND_INTERNAL_AVG', 'GROUP_BUY_SAVINGS_PERCENT', 'GROTOKEN_USD_VALUE',
                         'INITIAL_WEALTH_SIGMA_LOG', 'LOCAL_PRODUCTION_SAVINGS_PERCENT'].includes(key)
                      ).map(([key, value]) => {
                        // Highlight parameters that are different from defaults
                        const isModified = presetDetails.params && key in presetDetails.params;
                        return (
                          <div key={key} className="flex justify-between">
                            <span className="text-xs text-slate-600">{formatParameterName(key)}:</span>
                            <span className={`text-xs font-medium ${isModified ? 'text-primary' : ''}`}>
                              {formatParameterValue(key, value as number)}
                              {isModified && ' *'}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                    <p className="text-xs text-slate-500 mt-2">* Parameters modified from defaults</p>
                  </div>

                  <div className="bg-blue-50 p-4 rounded-md">
                    <h3 className="text-sm font-medium text-blue-800 mb-2">What This Tests</h3>
                    <p className="text-xs text-blue-700">
                      This preset tests how the cooperative model (B) compares to the traditional model (A) under
                      {presetDetails.tags.map(tag => ` ${tag.replace('-', ' ')}`)} conditions.
                    </p>
                    <p className="text-xs text-blue-700 mt-2">
                      After running the simulation, you&apos;ll see detailed results in the Analysis tab, including wealth distribution,
                      inequality metrics, and economic resilience comparisons.
                    </p>
                  </div>
                </CardContent>
                <CardFooter className="flex justify-between">
                  <Button variant="outline" onClick={() => setSelectedPreset(null)}>Back to Selection</Button>
                  <Button
                    onClick={handleRunSimulation}
                    disabled={isLoading}
                    className="gap-2"
                  >
                    {isLoading ? 'Running...' : 'Run Simulation'}
                    {!isLoading && <ArrowRightIcon className="h-4 w-4" />}
                  </Button>
                </CardFooter>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
      <CardFooter className="bg-muted/50 text-xs text-muted-foreground p-4">
        <p>
          {selectedPreset
            ? 'Review the preset details and click "Run Simulation" to see results in the Analysis tab'
            : 'Select a preset to automatically configure simulation parameters for specific scenarios'}
        </p>
      </CardFooter>
    </Card>
  );
}
