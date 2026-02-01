import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { formatCurrency, formatPercentage, formatNumber } from '@/lib/utils/formatters';
import { InfoCircledIcon } from '@radix-ui/react-icons';
import { TooltipProvider, Tooltip as UITooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface ShockResultsProps {
  results: {
    shock_results: {
      shock_type: string;
      magnitude: number;
      impact: {
        wealth_reduction: number;
        recovery_time: number;
      };
    };
    recovery_metrics: {
      recovery_rate: number;
      resilience_score: number;
    };
    recommendations?: string[];
  };
}

export function ShockResults({ results }: ShockResultsProps) {
  if (!results) return null;

  const { shock_results, recovery_metrics, recommendations } = results;

  // Generate mock recovery data for the chart
  const recoveryData = Array.from({ length: shock_results.impact.recovery_time + 1 }, (_, i) => {
    const recoveryPercent = i === 0
      ? 0
      : i >= shock_results.impact.recovery_time
        ? 100
        : Math.round((i / shock_results.impact.recovery_time) * 100);

    return {
      week: i,
      recovery: recoveryPercent,
    };
  });

  return (
    <TooltipProvider>
      <div className="space-y-6">
        <div className="bg-amber-50 p-4 rounded-lg border border-amber-200 mb-6">
          <h3 className="text-lg font-semibold mb-2 text-amber-800">Understanding Shock Testing</h3>
          <p className="text-sm text-amber-700 mb-2">
            Shock testing simulates sudden economic disruptions to evaluate how well the economic system recovers.
            This helps identify vulnerabilities and resilience factors in different economic models.
          </p>
          <p className="text-sm text-amber-700">
            <span className="font-medium">Current Test:</span> A {formatPercentage(shock_results.magnitude)} {formatShockType(shock_results.shock_type)} shock
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              Shock Test Results: {formatShockType(shock_results.shock_type)}
              <UITooltip>
                <TooltipTrigger asChild>
                  <InfoCircledIcon className="h-4 w-4 ml-2 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent>
                  <p className="max-w-xs">This analysis shows how the economic system responds to and recovers from a sudden economic disruption.</p>
                </TooltipContent>
              </UITooltip>
            </CardTitle>
            <CardDescription>Analysis of system response to economic shock</CardDescription>
          </CardHeader>
        <CardContent>
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center">
                    Shock Magnitude
                    <UITooltip>
                      <TooltipTrigger asChild>
                        <InfoCircledIcon className="h-4 w-4 ml-1 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="max-w-xs">The severity of the economic disruption, expressed as a percentage. Higher values represent more severe shocks.</p>
                      </TooltipContent>
                    </UITooltip>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {formatPercentage(shock_results.magnitude)}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Severity of the economic shock
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center">
                    Wealth Impact
                    <UITooltip>
                      <TooltipTrigger asChild>
                        <InfoCircledIcon className="h-4 w-4 ml-1 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="max-w-xs">The percentage reduction in total community wealth caused by the shock. This measures the immediate economic damage.</p>
                      </TooltipContent>
                    </UITooltip>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-red-500">
                    -{formatPercentage(shock_results.impact.wealth_reduction)}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Reduction in average wealth
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center">
                    Recovery Time
                    <UITooltip>
                      <TooltipTrigger asChild>
                        <InfoCircledIcon className="h-4 w-4 ml-1 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="max-w-xs">The number of weeks required for the economy to return to pre-shock wealth levels. Shorter times indicate greater resilience.</p>
                      </TooltipContent>
                    </UITooltip>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {shock_results.impact.recovery_time} weeks
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Estimated time to full recovery
                  </p>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center">
                  Recovery Projection
                  <UITooltip>
                    <TooltipTrigger asChild>
                      <InfoCircledIcon className="h-4 w-4 ml-1 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="max-w-xs">This chart shows how quickly the economy recovers from the shock over time. Steeper curves indicate faster recovery rates.</p>
                    </TooltipContent>
                  </UITooltip>
                </CardTitle>
              </CardHeader>
              <CardContent className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={recoveryData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="week" label={{ value: 'Weeks', position: 'insideBottom', offset: -5 }} />
                    <YAxis label={{ value: 'Recovery %', angle: -90, position: 'insideLeft' }} />
                    <Tooltip formatter={(value) => [formatPercentage((value as number) / 100), 'Recovery']} />
                    <Legend />
                    <Line type="monotone" dataKey="recovery" name="Recovery %" stroke="#82ca9d" />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center">
                    Recovery Rate
                    <UITooltip>
                      <TooltipTrigger asChild>
                        <InfoCircledIcon className="h-4 w-4 ml-1 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="max-w-xs">The average percentage of wealth recovered each week after the shock. Higher rates indicate faster economic healing.</p>
                      </TooltipContent>
                    </UITooltip>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {formatPercentage(recovery_metrics.recovery_rate)} per week
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Average rate of economic recovery
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center">
                    Resilience Score
                    <UITooltip>
                      <TooltipTrigger asChild>
                        <InfoCircledIcon className="h-4 w-4 ml-1 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="max-w-xs">A composite score measuring the system&apos;s overall ability to withstand and recover from economic shocks. Considers both impact severity and recovery speed.</p>
                      </TooltipContent>
                    </UITooltip>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {formatPercentage(recovery_metrics.resilience_score)}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    System&apos;s ability to withstand shocks
                  </p>
                </CardContent>
              </Card>
            </div>

            {recommendations && recommendations.length > 0 && (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
                <h4 className="font-medium text-blue-800 mb-1 flex items-center">
                  Recommendations
                  <UITooltip>
                    <TooltipTrigger asChild>
                      <InfoCircledIcon className="h-4 w-4 ml-1 text-blue-600 cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="max-w-xs">Suggested actions to improve the system&apos;s resilience based on the shock test results.</p>
                    </TooltipContent>
                  </UITooltip>
                </h4>
                <ul className="list-disc list-inside text-sm text-blue-700">
                  {recommendations.map((recommendation: string, index: number) => (
                    <li key={`shock-recommendation-${index}`}>{recommendation}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </CardContent>
        <CardFooter className="bg-slate-50 text-xs text-slate-500 italic">
          Shock testing helps identify economic vulnerabilities and resilience factors
        </CardFooter>
      </Card>
    </div>
  </TooltipProvider>
  );
}

function formatShockType(type: string): string {
  switch (type) {
    case 'income_reduction':
      return 'Income Reduction';
    case 'spending_increase':
      return 'Spending Increase';
    case 'market_disruption':
      return 'Market Disruption';
    default:
      return type.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  }
}
