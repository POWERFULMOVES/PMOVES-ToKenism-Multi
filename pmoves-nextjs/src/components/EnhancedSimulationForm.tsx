"use client";

import { useState, useEffect, useCallback, useMemo, memo } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { InfoCircledIcon } from '@radix-ui/react-icons';
import { TooltipProvider, Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { SimulationParams } from '@/lib/simulation/types';
import { DEFAULT_PARAMS } from '@/lib/simulation';
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

interface FieldConfig {
  id: string;
  label: string;
  description: string;
  min: number;
  max: number;
  step: number;
  errorUnit: string;
  format?: 'currency' | 'percent' | 'plain' | 'dollars';
}

const FIELDS: Record<'basic' | 'members' | 'cooperative', FieldConfig[]> = {
  basic: [
    { id: 'NUM_MEMBERS', label: 'Number of Members', description: 'Total number of participants in the simulation. Larger communities may show different dynamics.', min: 10, max: 200, step: 10, errorUnit: 'members', format: 'plain' },
    { id: 'SIMULATION_WEEKS', label: 'Simulation Duration (Weeks)', description: 'Length of the simulation in weeks. Longer simulations show long-term trends (52 weeks = 1 year).', min: 12, max: 520, step: 12, errorUnit: 'weeks', format: 'plain' },
    { id: 'INITIAL_WEALTH_MEAN_LOG', label: 'Starting Wealth (Log Mean)', description: 'Controls the average initial wealth. Higher values mean members start with more money (6.9 ≈ $1000).', min: 5.0, max: 8.0, step: 0.1, errorUnit: 'value', format: 'dollars' },
    { id: 'INITIAL_WEALTH_SIGMA_LOG', label: 'Initial Wealth Inequality', description: 'Controls the spread of initial wealth. Higher values mean more initial inequality (0.6 is moderate, 1.0 is high).', min: 0.2, max: 1.2, step: 0.1, errorUnit: 'value', format: 'plain' },
  ],
  members: [
    { id: 'WEEKLY_INCOME_AVG', label: 'Average Weekly Income', description: 'Average income earned per member per week. Higher values mean more money flowing into the system.', min: 0, max: 500, step: 10, errorUnit: 'income', format: 'currency' },
    { id: 'WEEKLY_INCOME_STDDEV', label: 'Income Variation', description: 'How much incomes vary between members. Higher values create a wider spread of wealth outcomes.', min: 0, max: 200, step: 5, errorUnit: 'value', format: 'currency' },
    { id: 'WEEKLY_FOOD_BUDGET_AVG', label: 'Average Weekly Budget', description: 'Average amount each member spends on food per week. This drives demand in the local economy.', min: 0, max: 400, step: 10, errorUnit: 'value', format: 'currency' },
    { id: 'WEEKLY_FOOD_BUDGET_STDDEV', label: 'Budget Variation', description: 'How much food budgets vary between members. Higher values mean more diverse spending patterns.', min: 0, max: 150, step: 5, errorUnit: 'value', format: 'currency' },
  ],
  cooperative: [
    { id: 'PERCENT_SPEND_INTERNAL_AVG', label: 'Percent Spent Internally', description: 'Share of food spending that stays inside the cooperative. Higher values keep more money circulating locally.', min: 0, max: 1, step: 0.05, errorUnit: 'value', format: 'percent' },
    { id: 'GROUP_BUY_SAVINGS_PERCENT', label: 'Group Buy Savings', description: 'Discount members get by buying food together in bulk. Savings from collective purchasing power.', min: 0, max: 30, step: 1, errorUnit: 'value', format: 'percent' },
    { id: 'LOCAL_PRODUCTION_SAVINGS_PERCENT', label: 'Local Production Savings', description: 'Additional savings from food produced locally by the cooperative itself, cutting out middlemen.', min: 0, max: 30, step: 1, errorUnit: 'value', format: 'percent' },
    { id: 'GROTOKEN_REWARD_PER_WEEK_AVG', label: 'Weekly GroToken Reward', description: 'GroTokens earned per member per week for participating in the cooperative economy.', min: 0, max: 50, step: 1, errorUnit: 'value', format: 'plain' },
    { id: 'GROTOKEN_USD_VALUE', label: 'GroToken Value', description: 'USD value of one GroToken. This determines how much the token rewards add to member wealth.', min: 0, max: 10, step: 0.1, errorUnit: 'value', format: 'currency' },
    { id: 'WEEKLY_COOP_FEE_B', label: 'Weekly Coop Fee', description: 'Weekly fee members pay to cover cooperative operating costs like storage and coordination.', min: 0, max: 50, step: 1, errorUnit: 'value', format: 'currency' },
  ],
};

function formatFieldValue(value: number, format?: FieldConfig['format']): string {
  switch (format) {
    case 'currency': return formatCurrency(value);
    case 'percent': return formatPercentage(value);
    case 'dollars': return `≈ ${formatCurrency(Math.exp(value))}`;
    default: return String(value);
  }
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
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [rawValues, setRawValues] = useState<Record<string, string>>({});
  const [activeTab, setActiveTab] = useState<string>('basic');
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
    setErrors({});
    setRawValues({});
  }, [params]);

  // Generate preview data when parameters change
  const generatePreviewData = useCallback(() => {
    const weeks = Math.min(52, Math.max(1, localParams.SIMULATION_WEEKS)); // Use simulation weeks but cap at 52 for preview
    const data: PreviewDataPoint[] = [];

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

  const validateField = useCallback((id: string, value: number): string | undefined => {
    const field = Object.values(FIELDS).flat().find((f) => f.id === id);
    if (!field) return undefined;
    if (!Number.isFinite(value)) {
      return `A valid number is required for ${field.label}`;
    }
    if (value < field.min) {
      return `Minimum ${field.min} ${field.errorUnit} required`;
    }
    if (value > field.max) {
      return `Maximum ${field.max} ${field.errorUnit} allowed`;
    }
    return undefined;
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    const parsedValue = Number.parseFloat(value);

    // Keep the raw text in the field; commit only finite parses to the model
    setRawValues((prev) => ({ ...prev, [name]: value }));
    if (Number.isFinite(parsedValue)) {
      setLocalParams((prev) => ({
        ...prev,
        [name]: parsedValue,
      } as SimulationParams));
    }

    const error = validateField(name, parsedValue);
    setErrors((prev) => {
      const next = { ...prev };
      if (error) next[name] = error;
      else delete next[name];
      return next;
    });
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    const parsedValue = Number.parseFloat(value);
    const error = validateField(name, parsedValue);
    setErrors((prev) => {
      const next = { ...prev };
      if (error) next[name] = error;
      else delete next[name];
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Update global params with local params
    onParamsChange(localParams);
    onSubmit();
  };

  const handleReset = () => {
    setLocalParams(DEFAULT_PARAMS);
    setErrors({});
    onParamsChange(DEFAULT_PARAMS);
    onReset();
  };

  const handleSliderKeyDown = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    // Explicit slider semantics: arrows/home/end are announced but values change
    // through direct input; prevent native interference with typed values.
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End', 'PageUp', 'PageDown'].includes(e.key)) {
      e.preventDefault();
    }
  };

  const renderField = (field: FieldConfig, tabbable: boolean) => {
    const value = localParams[field.id as keyof SimulationParams] as number;
    const error = errors[field.id];
    const describedBy = error ? `${field.id}-error ${field.id}-description` : `${field.id}-description`;

    return (
      <div className="space-y-2" key={field.id}>
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <Label htmlFor={field.id} className="flex items-center">
              {field.label}
            </Label>
            <span aria-hidden="true" className="text-destructive ml-0.5">*</span>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  tabIndex={-1}
                  aria-label="More information"
                  className="ml-1 text-muted-foreground cursor-help"
                >
                  <InfoCircledIcon className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent forceMount>
                <p className="max-w-xs">{field.description}</p>
              </TooltipContent>
            </Tooltip>
          </div>
          <span className="text-sm text-muted-foreground">{formatFieldValue(value, field.format)}</span>
        </div>
        <Input
          id={field.id}
          name={field.id}
          type="text"
          inputMode="decimal"
          role="slider"
          tabIndex={tabbable ? 0 : -1}
          min={field.min}
          max={field.max}
          step={field.step}
          value={rawValues[field.id] ?? (Number.isFinite(value) ? String(value) : '')}
          disabled={isLoading}
          onChange={handleInputChange}
          onBlur={handleBlur}
          onKeyDown={handleSliderKeyDown}
          onFocus={(e) => e.target.select()}
          aria-valuemin={field.min}
          aria-valuemax={field.max}
          aria-valuenow={Number.isFinite(value) ? value : undefined}
          aria-valuetext={formatFieldValue(value, field.format)}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
        />
        {error && (
          <p id={`${field.id}-error`} role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <p id={`${field.id}-description`} className="sr-only">
          {field.description}
        </p>
      </div>
    );
  };

  return (
    <TooltipProvider>
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-6">
            <form onSubmit={handleSubmit} aria-label="Simulation Parameters">
              <Card>
                <CardHeader>
                  <CardTitle role="heading" aria-level={2} className="flex items-center">
                    Simulation Parameters
                    {presetName && (
                      <span className="ml-2 text-sm font-normal text-muted-foreground">
                        (Based on preset: {presetName})
                      </span>
                    )}
                  </CardTitle>
                  <CardDescription>
                    Configure the economic simulation parameters. Fields marked with * are required.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
                    <TabsList className="grid grid-cols-3">
                      <TabsTrigger value="basic">Basic</TabsTrigger>
                      <TabsTrigger value="members">Members</TabsTrigger>
                      <TabsTrigger value="cooperative">Cooperative</TabsTrigger>
                    </TabsList>

                    <TabsContent forceMount tabIndex={-1} value="basic" className="space-y-4">
                      <div className="grid grid-cols-1 gap-4">
                        {FIELDS.basic.map((f) => renderField(f, activeTab === 'basic'))}
                      </div>
                    </TabsContent>

                    <TabsContent forceMount tabIndex={-1} value="members" className="space-y-4">
                      <div className="grid grid-cols-1 gap-4">
                        {FIELDS.members.map((f) => renderField(f, activeTab === 'members'))}
                      </div>
                    </TabsContent>

                    <TabsContent forceMount tabIndex={-1} value="cooperative" className="space-y-4">
                      <div className="grid grid-cols-1 gap-4">
                        {FIELDS.cooperative.map((f) => renderField(f, activeTab === 'cooperative'))}
                      </div>
                    </TabsContent>
                  </Tabs>
                </CardContent>
                <CardFooter className="flex justify-between">
                  <ExpectedBenefits params={localParams as Record<string, number>} />
                </CardFooter>
                <CardFooter className="flex justify-between">
                  <Button variant="outline" type="button" onClick={handleReset} disabled={isLoading}>
                    Reset
                  </Button>
                  <Button type="submit" disabled={isLoading} aria-disabled={isLoading || undefined} aria-live="polite">
                    {isLoading ? 'Running…' : 'Run Simulation'}
                  </Button>
                </CardFooter>
              </Card>
            </form>
          </div>

          {showPreview && (
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle role="heading" aria-level={2}>Parameter Preview</CardTitle>
                  <CardDescription>
                    Projected wealth trajectories based on current parameters
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div title="Parameter Preview" role="img" aria-label="Projected wealth trajectories preview chart" className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={previewData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="week" />
                        <YAxis />
                        <RechartsTooltip />
                        <Legend />
                        <Line type="monotone" dataKey="wealthA" stroke="#8884d8" name="Traditional" />
                        <Line type="monotone" dataKey="wealthB" stroke="#82ca9d" name="Cooperative" />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                  <p className="text-sm text-muted-foreground mt-2">
                    See how changes affect the simulation before execution.
                  </p>
                </CardContent>
              </Card>
            </div>
          )}
        </div>

        <ModelExplanation />
      </div>
    </TooltipProvider>
  );
});
