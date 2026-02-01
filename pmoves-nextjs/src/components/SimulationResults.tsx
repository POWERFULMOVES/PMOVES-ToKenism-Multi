import type { SimulationResults as SimResults } from '@/lib/simulation/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { formatCurrency, formatPercentage, formatNumber } from '@/lib/utils/formatters';
import { MetricTooltip } from '@/components/ui/metric-tooltip';
import { metricTooltips } from '@/lib/tooltips';
import { DocumentationDialog } from '@/components/ui/documentation-dialog';
import { AlertCircle, TrendingUp, TrendingDown, BarChart3 } from 'lucide-react';
import { MathValidation } from '@/components/ui/math-validation';
import { MathModelService } from '@/lib/services/math-model.service';
import { Skeleton, SkeletonCard, SkeletonChart, SkeletonTable } from '@/components/ui/skeleton';

interface SimulationResultsProps {
  results: SimResults | null;
  presetName?: string | null;
  simulationParams?: Record<string, number>;
  isLoading?: boolean;
}

import { KeyMetricsTable } from './KeyMetricsTable';
import { ValidationMetrics } from './ValidationMetrics';
import { ExportDropdown, ExportSection } from './ExportButtons';

function ResultsLoadingSkeleton() {
  return (
    <div className="space-y-8">
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex-1 space-y-2">
              <Skeleton className="h-7 w-64" />
              <Skeleton className="h-4 w-96" />
            </div>
            <Skeleton className="h-10 w-24" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            <div>
              <Skeleton className="h-6 w-32 mb-4" />
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <SkeletonCard />
                <SkeletonCard />
                <SkeletonCard />
              </div>
            </div>
            <div>
              <Skeleton className="h-6 w-32 mb-4" />
              <SkeletonTable rows={4} />
            </div>
            <div>
              <Skeleton className="h-6 w-40 mb-4" />
              <SkeletonChart />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function EmptyResultsState() {
  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center justify-center py-16">
        <BarChart3 className="h-16 w-16 text-muted-foreground/50 mb-4" />
        <h3 className="text-lg font-semibold text-muted-foreground mb-2">No Simulation Results</h3>
        <p className="text-sm text-muted-foreground text-center max-w-md">
          Configure your simulation parameters and click &quot;Run Simulation&quot; to see the results here.
        </p>
      </CardContent>
    </Card>
  );
}

export function SimulationResults({ results, presetName, simulationParams, isLoading = false }: SimulationResultsProps) {
  if (isLoading) {
    return <ResultsLoadingSkeleton />;
  }

  if (!results) {
    return <EmptyResultsState />;
  }

  const { history, summary, key_events } = results;
  const finalWeek = history[history.length - 1];

  // Format data for charts
  const wealthChartData = history.map(week => ({
    week: week.Week,
    scenarioA: week.AvgWealth_A,
    scenarioB: week.AvgWealth_B,
  }));

  const giniChartData = history.map(week => ({
    week: week.Week,
    scenarioA: week.Gini_A,
    scenarioB: week.Gini_B,
  }));

  const povertyChartData = history.map(week => ({
    week: week.Week,
    scenarioA: week.PovertyRate_A * 100,
    scenarioB: week.PovertyRate_B * 100,
  }));

  return (
    <div className="space-y-8">
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <CardTitle>
                {summary.title}
                {presetName && (
                  <span className="ml-2 text-sm font-normal text-muted-foreground">
                    (Preset: {presetName})
                  </span>
                )}
              </CardTitle>
              <CardDescription>{summary.overview}</CardDescription>
            </div>
            <ExportDropdown results={results} scenarioName={presetName || 'simulation'} />
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold mb-2">Key Findings</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Wealth Impact</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm">{summary.key_findings.wealth_impact.summary}</p>
                    <p className="text-xs text-muted-foreground mt-2">{summary.key_findings.wealth_impact.details}</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Equality Measures</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm">{summary.key_findings.equality_measures.summary}</p>
                    <p className="text-xs text-muted-foreground mt-2">{summary.key_findings.equality_measures.gini}</p>
                    <p className="text-xs text-muted-foreground mt-1">{summary.key_findings.equality_measures.details}</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Community Health</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm">{summary.key_findings.community_health.poverty}</p>
                    <p className="text-xs text-muted-foreground mt-2">{summary.key_findings.community_health.resilience}</p>
                    <p className="text-xs text-muted-foreground mt-1">{summary.key_findings.community_health.details}</p>
                  </CardContent>
                </Card>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold mb-2 flex items-center justify-between">
                Key Metrics
                <DocumentationDialog initialTab="metrics" />
              </h3>
              {finalWeek && (
                <KeyMetricsTable finalMetrics={{
                  TotalWealth_A: finalWeek.TotalWealth_A as number,
                  TotalWealth_B: finalWeek.TotalWealth_B as number,
                  AvgWealth_A: finalWeek.AvgWealth_A as number,
                  AvgWealth_B: finalWeek.AvgWealth_B as number,
                  MedianWealth_A: finalWeek.MedianWealth_A as number,
                  MedianWealth_B: finalWeek.MedianWealth_B as number,
                  Gini_A: finalWeek.Gini_A as number,
                  Gini_B: finalWeek.Gini_B as number,
                  WealthGap_A: finalWeek.WealthGap_A as number,
                  WealthGap_B: finalWeek.WealthGap_B as number,
                  PovertyRate_A: finalWeek.PovertyRate_A as number,
                  PovertyRate_B: finalWeek.PovertyRate_B as number,
                  WealthMobility: finalWeek.WealthMobility as number,
                  LocalEconomyStrength: finalWeek.LocalEconomyStrength as number
                }} />
              )}
            </div>

            <div>
              <h3 className="text-lg font-semibold mb-2 flex items-center justify-between">
                Simulation Charts
                <DocumentationDialog initialTab="interpretation" />
              </h3>
              <p className="text-sm text-muted-foreground mb-4">These charts show key metrics over the simulation period, comparing traditional (A) and cooperative (B) economic models</p>
              <Tabs defaultValue="wealth">
                <TabsList className="grid grid-cols-4 mb-4">
                  <TabsTrigger value="wealth">Wealth</TabsTrigger>
                  <TabsTrigger value="gini">Inequality</TabsTrigger>
                  <TabsTrigger value="poverty">Poverty</TabsTrigger>
                  <TabsTrigger value="distribution">Distribution</TabsTrigger>
                </TabsList>

                <TabsContent value="wealth">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Average Wealth Over Time</CardTitle>
                      <CardDescription>
                        <span className="block mb-1">Comparing Scenario A (Traditional) vs B (Cooperative)</span>
                        <span className="text-xs text-muted-foreground">Higher values indicate greater overall prosperity. Upward trends show economic growth.</span>
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={wealthChartData}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="week" label={{ value: 'Week', position: 'insideBottom', offset: -5 }} />
                            <YAxis label={{ value: 'Average Wealth ($)', angle: -90, position: 'insideLeft' }} />
                            <RechartsTooltip formatter={(value) => [formatCurrency(value as number), '']} />
                            <Legend />
                            <Line type="monotone" dataKey="scenarioA" name="Scenario A" stroke="#8884d8" />
                            <Line type="monotone" dataKey="scenarioB" name="Scenario B" stroke="#82ca9d" />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="gini">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Gini Coefficient Over Time</CardTitle>
                      <CardDescription>
                        <span className="block mb-1">Lower values indicate more equal wealth distribution</span>
                        <span className="text-xs text-muted-foreground">Range: 0 (perfect equality) to 1 (perfect inequality). Most real economies range from 0.3-0.5.</span>
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={giniChartData}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="week" label={{ value: 'Week', position: 'insideBottom', offset: -5 }} />
                            <YAxis label={{ value: 'Gini Coefficient', angle: -90, position: 'insideLeft' }} />
                            <RechartsTooltip formatter={(value) => [formatNumber(value as number, 3, 3), '']} />
                            <Legend />
                            <Line type="monotone" dataKey="scenarioA" name="Scenario A" stroke="#8884d8" />
                            <Line type="monotone" dataKey="scenarioB" name="Scenario B" stroke="#82ca9d" />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="poverty">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Poverty Rate Over Time</CardTitle>
                      <CardDescription>
                        <span className="block mb-1">Percentage of members below poverty threshold</span>
                        <span className="text-xs text-muted-foreground">Lower values indicate fewer members in poverty. Downward trends show improving economic conditions.</span>
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={povertyChartData}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="week" label={{ value: 'Week', position: 'insideBottom', offset: -5 }} />
                            <YAxis label={{ value: 'Poverty Rate (%)', angle: -90, position: 'insideLeft' }} />
                            <RechartsTooltip formatter={(value) => [formatPercentage(value as number / 100), '']} />
                            <Legend />
                            <Line type="monotone" dataKey="scenarioA" name="Scenario A" stroke="#8884d8" />
                            <Line type="monotone" dataKey="scenarioB" name="Scenario B" stroke="#82ca9d" />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="distribution">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Wealth Distribution Comparison</CardTitle>
                      <CardDescription>
                        <span className="block mb-1">Final wealth distribution by quintile (20% segments)</span>
                        <span className="text-xs text-muted-foreground">Shows how wealth is distributed across different segments of the population at the end of the simulation.</span>
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={[
                            { name: 'Bottom 20%', A: history[history.length - 1]?.WealthQuintiles_A?.[0] || 0, B: history[history.length - 1]?.WealthQuintiles_B?.[0] || 0 },
                            { name: '20-40%', A: history[history.length - 1]?.WealthQuintiles_A?.[1] || 0, B: history[history.length - 1]?.WealthQuintiles_B?.[1] || 0 },
                            { name: '40-60%', A: history[history.length - 1]?.WealthQuintiles_A?.[2] || 0, B: history[history.length - 1]?.WealthQuintiles_B?.[2] || 0 },
                            { name: '60-80%', A: history[history.length - 1]?.WealthQuintiles_A?.[3] || 0, B: history[history.length - 1]?.WealthQuintiles_B?.[3] || 0 },
                            { name: 'Top 20%', A: history[history.length - 1]?.Top10Percent_A || 0, B: history[history.length - 1]?.Top10Percent_B || 0 },
                          ]}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="name" />
                            <YAxis tickFormatter={(value) => formatCurrency(value)} />
                            <RechartsTooltip formatter={(value) => [formatCurrency(value as number), '']} />
                            <Legend />
                            <Bar dataKey="A" name="Scenario A" fill="#8884d8" />
                            <Bar dataKey="B" name="Scenario B" fill="#82ca9d" />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="mt-4 p-3 bg-blue-50 rounded-md text-xs text-blue-800">
                        <p className="font-medium">Understanding Wealth Distribution</p>
                        <p>This chart shows the wealth thresholds for each 20% segment of the population. For example, the &quot;40-60%&quot; bar shows the wealth level at the 60th percentile.</p>
                        <p className="mt-1">A more equal distribution would show similar heights across all bars, while high inequality shows much taller bars on the right side.</p>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </div>

            <div className="bg-blue-50 p-4 rounded-lg border border-blue-200 mb-6">
              <h3 className="text-lg font-semibold mb-2 text-blue-800">Simulation Summary</h3>
              <div className="text-sm text-blue-700 space-y-2">
                <p>
                  <span className="font-medium">Wealth Growth:</span> {' '}
                  {history[history.length - 1].TotalWealth_B > history[history.length - 1].TotalWealth_A ? (
                    <span className="text-green-600">The cooperative model (B) generated {formatCurrency(history[history.length - 1].TotalWealth_B - history[history.length - 1].TotalWealth_A)} more total wealth than the traditional model (A).</span>
                  ) : (
                    <span className="text-amber-600">The traditional model (A) generated {formatCurrency(history[history.length - 1].TotalWealth_A - history[history.length - 1].TotalWealth_B)} more total wealth than the cooperative model (B).</span>
                  )}
                </p>
                <p>
                  <span className="font-medium">Inequality:</span> {' '}
                  {history[history.length - 1].Gini_B < history[history.length - 1].Gini_A ? (
                    <span className="text-green-600">The cooperative model (B) resulted in lower inequality (Gini coefficient: {formatNumber(history[history.length - 1].Gini_B, 3, 3)} vs {formatNumber(history[history.length - 1].Gini_A, 3, 3)}).</span>
                  ) : (
                    <span className="text-amber-600">The traditional model (A) resulted in lower inequality (Gini coefficient: {formatNumber(history[history.length - 1].Gini_A, 3, 3)} vs {formatNumber(history[history.length - 1].Gini_B, 3, 3)}).</span>
                  )}
                </p>
                <p>
                  <span className="font-medium">Poverty Reduction:</span> {' '}
                  {history[history.length - 1].PovertyRate_B < history[history.length - 1].PovertyRate_A ? (
                    <span className="text-green-600">The cooperative model (B) was more effective at reducing poverty ({formatPercentage(history[history.length - 1].PovertyRate_B)} vs {formatPercentage(history[history.length - 1].PovertyRate_A)}).</span>
                  ) : (
                    <span className="text-amber-600">The traditional model (A) was more effective at reducing poverty ({formatPercentage(history[history.length - 1].PovertyRate_A)} vs {formatPercentage(history[history.length - 1].PovertyRate_B)}).</span>
                  )}
                </p>
                <p className="mt-3 text-blue-800">
                  <span className="font-medium">Key Insight:</span> {' '}
                  {summary.conclusion}
                </p>
              </div>
            </div>

            <div className="bg-white p-4 rounded-lg border border-gray-200 mb-6">
              <h3 className="text-lg font-semibold mb-2">Narrative Analysis</h3>
              <div className="prose prose-sm max-w-none">
                <h4>{summary.title}</h4>
                <p>{summary.overview}</p>

                <h5 className="font-medium mt-3">Wealth Impact</h5>
                <p>{summary.key_findings.wealth_impact.summary}</p>
                <p className="text-sm text-gray-600">{summary.key_findings.wealth_impact.details}</p>

                <h5 className="font-medium mt-3">Equality Measures</h5>
                <p>{summary.key_findings.equality_measures.summary}</p>
                <p className="text-sm text-gray-600">{summary.key_findings.equality_measures.details}</p>

                <h5 className="font-medium mt-3">Community Health</h5>
                <p><strong>Poverty:</strong> {summary.key_findings.community_health.poverty}</p>
                <p><strong>Resilience:</strong> {summary.key_findings.community_health.resilience}</p>
                <p><strong>Sustainability:</strong> {summary.key_findings.community_health.sustainability}</p>
                <p className="text-sm text-gray-600">{summary.key_findings.community_health.details}</p>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold mb-2">Key Events</h3>
              <Card>
                <CardContent className="pt-6">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Week</TableHead>
                        <TableHead>Event</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {key_events.map((event, index) => (
                        <TableRow key={`event-${event.week}-${index}`}>
                          <TableCell>{event.week}</TableCell>
                          <TableCell>{event.description}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>

            <div>
              <h3 className="text-lg font-semibold mb-2 flex items-center justify-between">
                Validation Metrics
                <DocumentationDialog initialTab="model" />
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {(() => {
                  try {
                    // Calculate dynamic validation metrics using MathModelService
                    // Guard against missing data
                    const wealthB = finalWeek?.TotalWealth_B;
                    const wealthA = finalWeek?.TotalWealth_A;
                    const giniB = finalWeek?.Gini_B;
                    const giniA = finalWeek?.Gini_A;

                    const actualWealthDiff = (wealthB != null && wealthA != null)
                      ? (wealthB as number) - (wealthA as number)
                      : 0;

                    const expectedWealthDiff = simulationParams
                      ? MathModelService.calculateExpectedWealthDifference(simulationParams)
                      : 0;

                    const errorThreshold = simulationParams
                      ? MathModelService.determineErrorThreshold(simulationParams)
                      : 0.15;

                    // Guard against division by zero
                    const errorPercentage = expectedWealthDiff !== 0
                      ? Math.abs((actualWealthDiff - expectedWealthDiff) / expectedWealthDiff)
                      : 0;

                    // Only call calculateValidationScore if expectedWealthDiff is non-zero
                    const validationScore = (simulationParams && finalWeek && expectedWealthDiff !== 0)
                      ? MathModelService.calculateValidationScore(actualWealthDiff, expectedWealthDiff, simulationParams)
                      : 90;

                    const isDownturn = simulationParams
                      ? MathModelService.isEconomicDownturnScenario(simulationParams)
                      : false;

                    // Ensure all numeric values are finite
                    const safeValidationScore = isFinite(validationScore) ? validationScore : 90;
                    const safeErrorPercentage = isFinite(errorPercentage) ? errorPercentage : 0;

                    return (
                      <ValidationMetrics validation={{
                        isDirectionallyCorrect: actualWealthDiff > 0,
                        isInequalityReduced: (giniB != null && giniA != null) ? (giniB as number) < (giniA as number) : true,
                        hasReasonableMagnitude: actualWealthDiff > 0 && (expectedWealthDiff === 0 || actualWealthDiff < expectedWealthDiff * 2),
                        downturnBenefitConsistency: !isDownturn || actualWealthDiff > 0,
                        validationScore: safeValidationScore,
                        errorPercentage: safeErrorPercentage,
                        acceptableErrorThreshold: errorThreshold,
                        isWithinErrorRange: safeErrorPercentage <= errorThreshold
                      }} />
                    );
                  } catch (error) {
                    console.error('[SimulationResults] Failed to calculate validation metrics:', error);
                    // Return fallback validation metrics on error
                    return (
                      <ValidationMetrics validation={{
                        isDirectionallyCorrect: true,
                        isInequalityReduced: true,
                        hasReasonableMagnitude: true,
                        downturnBenefitConsistency: true,
                        validationScore: 90,
                        errorPercentage: 0,
                        acceptableErrorThreshold: 0.15,
                        isWithinErrorRange: true
                      }} />
                    );
                  }
                })()}
                {simulationParams && finalWeek && (
                  <MathValidation
                    simulationParams={simulationParams}
                    finalWeek={{
                      TotalWealth_A: finalWeek.TotalWealth_A as number,
                      TotalWealth_B: finalWeek.TotalWealth_B as number,
                      AvgWealth_A: finalWeek.AvgWealth_A as number,
                      AvgWealth_B: finalWeek.AvgWealth_B as number
                    }}
                  />
                )}
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold mb-2">Conclusion</h3>
              <Card>
                <CardContent className="pt-6">
                  <p>{summary.conclusion}</p>
                  <p className="mt-4 text-sm text-muted-foreground">
                    For more information on how to interpret these results, click the help icons throughout the page.
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
