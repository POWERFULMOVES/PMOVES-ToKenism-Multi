"use client";

import { useState, useEffect, useCallback, useMemo, memo } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { InfoCircledIcon } from '@radix-ui/react-icons';
import { TooltipProvider, Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { SimulationParams } from '@/lib/simulation/types';
import { formatCurrency, formatPercentage } from '@/lib/utils/formatters';
import { ModelExplanation } from './ModelExplanation';
import { ExpectedBenefits } from './ui/expected-benefits';
import { useMemoizedCallback } from '@/hooks/useMemoizedCallback';

// Preview charts
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer } from 'recharts';

interface EnhancedSimulationFormProps {
  params: SimulationParams;
  onParamsChange: (params: SimulationParams) => void;
  onSubmit: () => void;
  isLoading: boolean;
  onReset: () => void;
  presetName?: string | null;
  showPreview?: boolean;
}

export const EnhancedSimulationForm = memo(function EnhancedSimulationForm({
  params,
  onParamsChange,
  onSubmit,
  isLoading,
  onReset,
  presetName = null,
  showPreview = true
}: EnhancedSimulationFormProps) {
  const [localParams, setLocalParams] = useState<SimulationParams>(params);
  interface PreviewDataPoint {
    week: number;
    wealthA: number;
    wealthB: number;
    usdB: number;
    grotokenValueUSD: number;
  }

  const [previewData, setPreviewData] = useState<PreviewDataPoint[]>([]);

  // Update local params when global params change (e.g., from preset selection)
  useEffect(() => {
    setLocalParams(params);
  }, [params]);

  // Generate preview data when parameters change
  const generatePreviewData = useCallback(() => {
    const weeks = Math.min(52, localParams.SIMULATION_WEEKS); // Use simulation weeks but cap at 52 for preview
    const data = [];

    // Simple model for preview - not the actual simulation
    const initialWealthA = Math.exp(localParams.INITIAL_WEALTH_MEAN_LOG);
    const initialWealthB = initialWealthA;

    let wealthA = initialWealthA;
    let wealthB = initialWealthB;
    let grotokenBalance = 0;

    const weeklyIncomeA = localParams.WEEKLY_INCOME_AVG;
    const weeklyIncomeB = weeklyIncomeA;

    const weeklyBudgetA = localParams.WEEKLY_FOOD_BUDGET_AVG;
    const weeklyBudgetB = weeklyBudgetA;

    const internalSpendRate = localParams.PERCENT_SPEND_INTERNAL_AVG;
    const savingsRate = (localParams.GROUP_BUY_SAVINGS_PERCENT + localParams.LOCAL_PRODUCTION_SAVINGS_PERCENT) / 2;
    const grotokenReward = localParams.GROTOKEN_REWARD_PER_WEEK_AVG;
    const grotokenValue = localParams.GROTOKEN_USD_VALUE;

    for (let week = 0; week < weeks; week++) {
      // Scenario A: Simple income - expenses
      wealthA += weeklyIncomeA - weeklyBudgetA;

      // Scenario B: With cooperative benefits
      const internalSpend = weeklyBudgetB * internalSpendRate;
      const externalSpend = weeklyBudgetB * (1 - internalSpendRate);
      const effectiveInternalCost = internalSpend * (1 - savingsRate);
      const totalCost = effectiveInternalCost + externalSpend;

      // Add weekly income and subtract expenses
      wealthB += weeklyIncomeB - totalCost;

      // Add GroTokens
      grotokenBalance += grotokenReward;
      const grotokenValueUSD = grotokenBalance * grotokenValue;

      // Subtract coop fee
      wealthB -= localParams.WEEKLY_COOP_FEE_B;

      data.push({
        week: week + 1,
        wealthA: Math.max(0, wealthA),
        wealthB: Math.max(0, wealthB + grotokenValueUSD), // Include GroToken value in total wealth
        usdB: Math.max(0, wealthB), // USD-only component of wealth B
        grotokenValueUSD: grotokenValueUSD, // GroToken component of wealth B
      });
    }

    setPreviewData(data);
  }, [localParams]);

  // Generate preview data when parameters change
  useEffect(() => {
    generatePreviewData();
  }, [generatePreviewData]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type } = e.target;
    const parsedValue = type === 'number' ? Number.parseFloat(value) : value;

    setLocalParams((prev) => ({
      ...prev,
      [name]: parsedValue,
    } as SimulationParams));
  };

  const handleSliderChange = (name: string, value: number[]) => {
    setLocalParams((prev) => ({
      ...prev,
      [name]: value[0],
    } as SimulationParams));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Update global params with local params
    onParamsChange(localParams);
    onSubmit();
  };

  const handleReset = () => {
    onReset();
  };


  return (
    <TooltipProvider>
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-6">
            <form onSubmit={handleSubmit}>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    Simulation Parameters
                    {presetName && (
                      <span className="ml-2 text-sm font-normal text-muted-foreground">
                        (Based on preset: {presetName})
                      </span>
                    )}
                  </CardTitle>
                  <CardDescription>
                    Configure the economic simulation parameters
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Tabs defaultValue="basic" className="space-y-4">
                    <TabsList className="grid grid-cols-3">
                      <TabsTrigger value="basic">Basic</TabsTrigger>
                      <TabsTrigger value="members">Members</TabsTrigger>
                      <TabsTrigger value="cooperative">Cooperative</TabsTrigger>
                    </TabsList>

                    <TabsContent value="basic" className="space-y-4">
                      <div className="grid grid-cols-1 gap-4">
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <Label htmlFor="NUM_MEMBERS" className="flex items-center">
                              Number of Members
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <button
                                    type="button"
                                    aria-label="More information about number of members"
                                    className="ml-1 text-muted-foreground cursor-help"
                                  >
                                    <InfoCircledIcon className="h-4 w-4" />
                                  </button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p className="max-w-xs">Total number of participants in the simulation. Larger communities may show different dynamics.</p>
                                </TooltipContent>
                              </Tooltip>
                            </Label>
                            <span className="text-sm text-muted-foreground">{localParams.NUM_MEMBERS}</span>
                          </div>
                          <Slider
                            id="NUM_MEMBERS"
                            min={10}
                            max={200}
                            step={10}
                            value={[localParams.NUM_MEMBERS]}
                            onValueChange={(value) => handleSliderChange('NUM_MEMBERS', value)}
                            aria-describedby="num-members-tooltip"
                          />
                        </div>

                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <Label htmlFor="SIMULATION_WEEKS" className="flex items-center">
                              Simulation Duration (Weeks)
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <InfoCircledIcon className="h-4 w-4 ml-1 text-muted-foreground cursor-help" />
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p className="max-w-xs">Length of the simulation in weeks. Longer simulations show long-term trends (52 weeks = 1 year).</p>
                                </TooltipContent>
                              </Tooltip>
                            </Label>
                            <span className="text-sm text-muted-foreground">{localParams.SIMULATION_WEEKS} weeks</span>
                          </div>
                          <Slider
                            id="SIMULATION_WEEKS"
                            min={12}
                            max={520}
                            step={12}
                            value={[localParams.SIMULATION_WEEKS]}
                            onValueChange={(value) => handleSliderChange('SIMULATION_WEEKS', value)}
                          />
                        </div>

                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <Label htmlFor="INITIAL_WEALTH_MEAN_LOG" className="flex items-center">
                              Initial Wealth (Log Mean)
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <InfoCircledIcon className="h-4 w-4 ml-1 text-muted-foreground cursor-help" />
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p className="max-w-xs">Controls the average initial wealth. Higher values mean members start with more money (6.9 ≈ $1000).</p>
                                </TooltipContent>
                              </Tooltip>
                            </Label>
                            <span className="text-sm text-muted-foreground">≈ {formatCurrency(Math.exp(localParams.INITIAL_WEALTH_MEAN_LOG))}</span>
                          </div>
                          <Slider
                            id="INITIAL_WEALTH_MEAN_LOG"
                            min={5.0}
                            max={8.0}
                            step={0.1}
                            value={[localParams.INITIAL_WEALTH_MEAN_LOG]}
                            onValueChange={(value) => handleSliderChange('INITIAL_WEALTH_MEAN_LOG', value)}
                          />
                        </div>

                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <Label htmlFor="INITIAL_WEALTH_SIGMA_LOG" className="flex items-center">
                              Initial Wealth Inequality
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <InfoCircledIcon className="h-4 w-4 ml-1 text-muted-foreground cursor-help" />
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p className="max-w-xs">Controls the spread of initial wealth. Higher values mean more initial inequality (0.6 is moderate, 1.0 is high).</p>
                                </TooltipContent>
                              </Tooltip>
                            </Label>
                            <span className="text-sm text-muted-foreground">{localParams.INITIAL_WEALTH_SIGMA_LOG.toFixed(1)}</span>
                          </div>
                          <Slider
                            id="INITIAL_WEALTH_SIGMA_LOG"
                            min={0.2}
                            max={1.2}
                            step={0.1}
                            value={[localParams.INITIAL_WEALTH_SIGMA_LOG]}
                            onValueChange={(value) => handleSliderChange('INITIAL_WEALTH_SIGMA_LOG', value)}
                          />
                        </div>
                      </div>
                    </TabsContent>

                    <TabsContent value="members" className="space-y-4">
                      <div className="grid grid-cols-1 gap-4">
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <Label htmlFor="WEEKLY_INCOME_AVG" className="flex items-center">
                              Average Weekly Income
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <InfoCircledIcon className="h-4 w-4 ml-1 text-muted-foreground cursor-help" />
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p className="max-w-xs">Average income earned per member per week. Higher values mean more money flowing into the system.</p>
                                </TooltipContent>
                              </Tooltip>
                            </Label>
                            <span className="text-sm text-muted-foreground">{formatCurrency(localParams.WEEKLY_INCOME_AVG)}</span>
                          </div>
                          <Slider
                            id="WEEKLY_INCOME_AVG"
                            min={50}
                            max={500}
                            step={10}
                            value={[localParams.WEEKLY_INCOME_AVG]}
                            onValueChange={(value) => handleSliderChange('WEEKLY_INCOME_AVG', value)}
                          />
                        </div>

                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <Label htmlFor="WEEKLY_INCOME_STDDEV" className="flex items-center">
                              Income Variation
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <InfoCircledIcon className="h-4 w-4 ml-1 text-muted-foreground cursor-help" />
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p className="max-w-xs">Standard deviation of weekly income. Higher values mean more income inequality between members.</p>
                                </TooltipContent>
                              </Tooltip>
                            </Label>
                            <span className="text-sm text-muted-foreground">{formatCurrency(localParams.WEEKLY_INCOME_STDDEV)}</span>
                          </div>
                          <Slider
                            id="WEEKLY_INCOME_STDDEV"
                            min={10}
                            max={200}
                            step={5}
                            value={[localParams.WEEKLY_INCOME_STDDEV]}
                            onValueChange={(value) => handleSliderChange('WEEKLY_INCOME_STDDEV', value)}
                          />
                        </div>

                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <Label htmlFor="WEEKLY_FOOD_BUDGET_AVG" className="flex items-center">
                              Average Weekly Budget
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <InfoCircledIcon className="h-4 w-4 ml-1 text-muted-foreground cursor-help" />
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p className="max-w-xs">Average amount needed for food/essentials per member per week. This is the basic spending requirement.</p>
                                </TooltipContent>
                              </Tooltip>
                            </Label>
                            <span className="text-sm text-muted-foreground">{formatCurrency(localParams.WEEKLY_FOOD_BUDGET_AVG)}</span>
                          </div>
                          <Slider
                            id="WEEKLY_FOOD_BUDGET_AVG"
                            min={20}
                            max={200}
                            step={5}
                            value={[localParams.WEEKLY_FOOD_BUDGET_AVG]}
                            onValueChange={(value) => handleSliderChange('WEEKLY_FOOD_BUDGET_AVG', value)}
                          />
                        </div>

                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <Label htmlFor="PERCENT_SPEND_INTERNAL_AVG" className="flex items-center">
                              % Spent Internally (Co-op)
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <InfoCircledIcon className="h-4 w-4 ml-1 text-muted-foreground cursor-help" />
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p className="max-w-xs">Average proportion of budget spent via co-op in Scenario B. Higher values mean more money stays in the community.</p>
                                </TooltipContent>
                              </Tooltip>
                            </Label>
                            <span className="text-sm text-muted-foreground">{formatPercentage(localParams.PERCENT_SPEND_INTERNAL_AVG)}</span>
                          </div>
                          <Slider
                            id="PERCENT_SPEND_INTERNAL_AVG"
                            min={0.1}
                            max={0.9}
                            step={0.05}
                            value={[localParams.PERCENT_SPEND_INTERNAL_AVG]}
                            onValueChange={(value) => handleSliderChange('PERCENT_SPEND_INTERNAL_AVG', value)}
                          />
                        </div>
                      </div>
                    </TabsContent>

                    <TabsContent value="cooperative" className="space-y-4">
                      <div className="grid grid-cols-1 gap-4">
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <Label htmlFor="GROUP_BUY_SAVINGS_PERCENT" className="flex items-center">
                              Group Buy Savings
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <InfoCircledIcon className="h-4 w-4 ml-1 text-muted-foreground cursor-help" />
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p className="max-w-xs">Savings rate for group purchases. Higher values mean more cost reduction from bulk buying (0.15 = 15% savings).</p>
                                </TooltipContent>
                              </Tooltip>
                            </Label>
                            <span className="text-sm text-muted-foreground">{formatPercentage(localParams.GROUP_BUY_SAVINGS_PERCENT)}</span>
                          </div>
                          <Slider
                            id="GROUP_BUY_SAVINGS_PERCENT"
                            min={0.05}
                            max={0.3}
                            step={0.01}
                            value={[localParams.GROUP_BUY_SAVINGS_PERCENT]}
                            onValueChange={(value) => handleSliderChange('GROUP_BUY_SAVINGS_PERCENT', value)}
                          />
                        </div>

                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <Label htmlFor="LOCAL_PRODUCTION_SAVINGS_PERCENT" className="flex items-center">
                              Local Production Savings
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <InfoCircledIcon className="h-4 w-4 ml-1 text-muted-foreground cursor-help" />
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p className="max-w-xs">Savings rate for locally produced goods. Higher values mean more cost reduction from local production (0.25 = 25% savings).</p>
                                </TooltipContent>
                              </Tooltip>
                            </Label>
                            <span className="text-sm text-muted-foreground">{formatPercentage(localParams.LOCAL_PRODUCTION_SAVINGS_PERCENT)}</span>
                          </div>
                          <Slider
                            id="LOCAL_PRODUCTION_SAVINGS_PERCENT"
                            min={0.05}
                            max={0.4}
                            step={0.01}
                            value={[localParams.LOCAL_PRODUCTION_SAVINGS_PERCENT]}
                            onValueChange={(value) => handleSliderChange('LOCAL_PRODUCTION_SAVINGS_PERCENT', value)}
                          />
                        </div>

                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <Label htmlFor="GROTOKEN_REWARD_PER_WEEK_AVG" className="flex items-center">
                              Weekly GroToken Reward
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <InfoCircledIcon className="h-4 w-4 ml-1 text-muted-foreground cursor-help" />
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p className="max-w-xs">Average GroTokens earned per member per week. These tokens add to total wealth in Scenario B.</p>
                                </TooltipContent>
                              </Tooltip>
                            </Label>
                            <span className="text-sm text-muted-foreground">{localParams.GROTOKEN_REWARD_PER_WEEK_AVG.toFixed(1)} tokens</span>
                          </div>
                          <Slider
                            id="GROTOKEN_REWARD_PER_WEEK_AVG"
                            min={0.1}
                            max={20}
                            step={0.5}
                            value={[localParams.GROTOKEN_REWARD_PER_WEEK_AVG]}
                            onValueChange={(value) => handleSliderChange('GROTOKEN_REWARD_PER_WEEK_AVG', value)}
                          />
                        </div>

                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <Label htmlFor="GROTOKEN_USD_VALUE" className="flex items-center">
                              GroToken Value ($)
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <InfoCircledIcon className="h-4 w-4 ml-1 text-muted-foreground cursor-help" />
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p className="max-w-xs">USD value per GroToken for wealth calculation. Higher values increase the impact of the community currency.</p>
                                </TooltipContent>
                              </Tooltip>
                            </Label>
                            <span className="text-sm text-muted-foreground">{formatCurrency(localParams.GROTOKEN_USD_VALUE)}</span>
                          </div>
                          <Slider
                            id="GROTOKEN_USD_VALUE"
                            min={0.5}
                            max={5}
                            step={0.1}
                            value={[localParams.GROTOKEN_USD_VALUE]}
                            onValueChange={(value) => handleSliderChange('GROTOKEN_USD_VALUE', value)}
                          />
                        </div>

                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <Label htmlFor="WEEKLY_COOP_FEE_B" className="flex items-center">
                              Weekly Co-op Fee
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <InfoCircledIcon className="h-4 w-4 ml-1 text-muted-foreground cursor-help" />
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p className="max-w-xs">Weekly fee per member for co-op upkeep in Scenario B. This represents the cost of maintaining the cooperative infrastructure.</p>
                                </TooltipContent>
                              </Tooltip>
                            </Label>
                            <span className="text-sm text-muted-foreground">{formatCurrency(localParams.WEEKLY_COOP_FEE_B)}</span>
                          </div>
                          <Slider
                            id="WEEKLY_COOP_FEE_B"
                            min={0.1}
                            max={5}
                            step={0.1}
                            value={[localParams.WEEKLY_COOP_FEE_B]}
                            onValueChange={(value) => handleSliderChange('WEEKLY_COOP_FEE_B', value)}
                          />
                        </div>
                      </div>
                    </TabsContent>
                  </Tabs>
                  <ExpectedBenefits params={localParams as Record<string, number>} />
                </CardContent>
                <CardFooter className="flex justify-between">
                  <Button variant="outline" type="button" onClick={handleReset}>
                    Reset
                  </Button>
                  <Button type="submit" disabled={isLoading}>
                    {isLoading ? 'Running...' : 'Run Simulation'}
                  </Button>
                </CardFooter>
              </Card>
            </form>
          </div>

          {showPreview && (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Parameter Preview</CardTitle>
                  <CardDescription>
                    See how changes affect the simulation (simplified model)
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={previewData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis
                          dataKey="week"
                          label={{ value: 'Week', position: 'insideBottom', offset: -5 }}
                          domain={[1, 'dataMax']}
                        />
                        <YAxis
                          label={{ value: 'Wealth ($)', angle: -90, position: 'insideLeft' }}
                          domain={[0, 'auto']} // Start at 0, auto-scale the max
                          tickFormatter={(value) => formatCurrency(value, true)} // Simplified currency format
                        />
                        <RechartsTooltip
                          formatter={(value, name) => {
                            if (name === 'Traditional (A)' || name === 'Cooperative (B)') {
                              return [formatCurrency(value as number), name];
                            }
                            return [value, name];
                          }}
                          labelFormatter={(label) => `Week ${label}`}
                        />
                        <Legend />
                        <Line type="monotone" dataKey="wealthA" name="Traditional (A)" stroke="#8884d8" />
                        <Line type="monotone" dataKey="wealthB" name="Cooperative (B)" stroke="#82ca9d" />
                        <Line type="monotone" dataKey="usdB" name="USD Component (B)" stroke="#82ca9d" strokeDasharray="3 3" strokeWidth={1} dot={false} />
                        <Line type="monotone" dataKey="grotokenValueUSD" name="GroToken Value (B)" stroke="#ffc658" strokeDasharray="3 3" strokeWidth={1} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-4">
                    <div className="bg-blue-50 p-3 rounded-md">
                      <h4 className="text-sm font-medium text-blue-800">Key Parameters</h4>
                      <ul className="mt-2 text-xs space-y-1 text-blue-700">
                        <li>Members: {localParams.NUM_MEMBERS}</li>
                        <li>Weeks: {localParams.SIMULATION_WEEKS}</li>
                        <li>Avg Income: {formatCurrency(localParams.WEEKLY_INCOME_AVG)}</li>
                        <li>Avg Budget: {formatCurrency(localParams.WEEKLY_FOOD_BUDGET_AVG)}</li>
                      </ul>
                    </div>
                    <div className="bg-green-50 p-3 rounded-md">
                      <h4 className="text-sm font-medium text-green-800">Cooperative Benefits</h4>
                      <ul className="mt-2 text-xs space-y-1 text-green-700">
                        <li>Internal Spending: {formatPercentage(localParams.PERCENT_SPEND_INTERNAL_AVG)}</li>
                        <li>Group Savings: {formatPercentage(localParams.GROUP_BUY_SAVINGS_PERCENT)}</li>
                        <li>Local Savings: {formatPercentage(localParams.LOCAL_PRODUCTION_SAVINGS_PERCENT)}</li>
                        <li>GroToken Value: {formatCurrency(localParams.GROTOKEN_USD_VALUE)}</li>
                      </ul>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <ModelExplanation />
            </div>
          )}
        </div>
      </div>
    </TooltipProvider>
  );
});
