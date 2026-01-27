/**
 * Shock Testing Panel Component
 * Allows users to test economic shocks and evaluate system resilience
 */

'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { QuestionMarkCircledIcon } from '@radix-ui/react-icons';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { formatPercentage } from '@/lib/utils/formatters';

interface ShockTestingPanelProps {
  onTestShock: (shockParams: {
    type: string;
    magnitude: number;
    duration: number;
  }) => void;
}

export function ShockTestingPanel({ onTestShock }: ShockTestingPanelProps) {
  const [shockType, setShockType] = useState('income_reduction');
  const [shockMagnitude, setShockMagnitude] = useState(0.2);
  const [shockDuration, setShockDuration] = useState(4);

  const handleTestShock = () => {
    const shockParams = {
      type: shockType,
      magnitude: Number.parseFloat(shockMagnitude.toString()),
      duration: Number.parseInt(shockDuration.toString())
    };

    onTestShock(shockParams);

    // Show toast with shock details
    const shockTypeDisplay = shockType.replace('_', ' ');
    // Note: toast would be called from parent component
    console.log(
      `Testing ${shockTypeDisplay} shock (${formatPercentage(shockParams.magnitude)} magnitude, ${shockParams.duration} weeks)...`
    );
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center">
            Test Economic Shock
            <Tooltip>
              <TooltipTrigger asChild>
                <QuestionMarkCircledIcon className="h-4 w-4 ml-1 text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent>
                <p className="max-w-xs">Simulate sudden economic disruptions to test how well the system recovers.</p>
              </TooltipContent>
            </Tooltip>
          </CardTitle>
          <CardDescription>Evaluate system resilience to disruptions</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <label htmlFor="shock-type" className="block text-sm font-medium mb-1 flex items-center">
                Shock Type
                <Tooltip>
                  <TooltipTrigger asChild>
                    <QuestionMarkCircledIcon className="h-4 w-4 ml-1 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <div className="space-y-2 max-w-xs">
                      <p><strong>Income Reduction:</strong> Simulates job losses or wage cuts</p>
                      <p><strong>Spending Increase:</strong> Simulates rising costs of essential goods</p>
                      <p><strong>Market Disruption:</strong> Simulates supply chain or market access issues</p>
                    </div>
                  </TooltipContent>
                </Tooltip>
              </label>
              <select
                id="shock-type"
                className="w-full p-2 border rounded-md"
                value={shockType}
                onChange={(e) => setShockType(e.target.value)}
              >
                <option value="income_reduction">Income Reduction</option>
                <option value="spending_increase">Spending Increase</option>
                <option value="market_disruption">Market Disruption</option>
              </select>
            </div>
            <div>
              <label htmlFor="shock-magnitude" className="block text-sm font-medium mb-1 flex items-center">
                Magnitude (0-1)
                <Tooltip>
                  <TooltipTrigger asChild>
                    <QuestionMarkCircledIcon className="h-4 w-4 ml-1 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="max-w-xs">The severity of the shock. 0.1 = mild (10% effect), 0.5 = severe (50% effect), 1.0 = extreme (100% effect).</p>
                  </TooltipContent>
                </Tooltip>
              </label>
              <Input
                id="shock-magnitude"
                type="number"
                min="0"
                max="1"
                step="0.1"
                value={shockMagnitude}
                onChange={(e) => setShockMagnitude(Number.parseFloat(e.target.value))}
              />
            </div>
            <div>
              <label htmlFor="shock-duration" className="block text-sm font-medium mb-1 flex items-center">
                Duration (weeks)
                <Tooltip>
                  <TooltipTrigger asChild>
                    <QuestionMarkCircledIcon className="h-4 w-4 ml-1 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="max-w-xs">How long the shock lasts. Shorter durations (1-4 weeks) simulate temporary disruptions, longer durations (12+ weeks) simulate prolonged crises.</p>
                  </TooltipContent>
                </Tooltip>
              </label>
              <Input
                id="shock-duration"
                type="number"
                min="1"
                max="52"
                value={shockDuration}
                onChange={(e) => setShockDuration(Number.parseInt(e.target.value))}
              />
            </div>
            <Button onClick={handleTestShock}>Test Shock</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Understanding Economic Shocks</CardTitle>
          <CardDescription>How shocks affect the economic system</CardDescription>
        </CardHeader>
        <CardContent className="prose prose-sm max-w-none">
          <p>
            Economic shocks are sudden disruptions that test the resilience of an economic system.
            The simulator models three types of shocks:
          </p>
          <ul>
            <li>
              <strong>Income Reduction:</strong> Simulates events like job losses, wage cuts, or recession.
              This reduces the weekly income of community members for the specified duration.
            </li>
            <li>
              <strong>Spending Increase:</strong> Simulates events like inflation, supply shortages, or price gouging.
              This increases the essential spending needs of community members for the specified duration.
            </li>
            <li>
              <strong>Market Disruption:</strong> Simulates events like supply chain breakdowns, trade barriers, or market access issues.
              This affects both income and spending patterns for the specified duration.
            </li>
          </ul>
          <p>
            The shock test measures how quickly the economy recovers to pre-shock levels and calculates a resilience score.
            Higher resilience scores indicate better ability to withstand and recover from economic disruptions.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}