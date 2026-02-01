import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { SimulationResults as SimResults } from '@/lib/simulation/types';
import { formatCurrency, formatPercentage, formatNumber } from '@/lib/utils/formatters';
import { InfoCircledIcon, ArrowUpIcon, ArrowDownIcon, ArrowRightIcon } from '@radix-ui/react-icons';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer } from 'recharts';
import { TokenFlowDiagram } from './TokenFlowDiagram';

interface ComparisonResultsProps {
  results: SimResults;
}

export function ComparisonResults({ results }: ComparisonResultsProps) {
  if (!results || !results.history || results.history.length === 0) {
    return <div>No results available</div>;
  }

  const finalMetrics = results.history[results.history.length - 1];
  const initialMetrics = results.history[0];

  // Calculate percentage differences between scenarios
  const wealthDiff = (finalMetrics.AvgWealth_B - finalMetrics.AvgWealth_A) / finalMetrics.AvgWealth_A;
  const giniDiff = finalMetrics.Gini_B - finalMetrics.Gini_A;
  const povertyDiff = finalMetrics.PovertyRate_B - finalMetrics.PovertyRate_A;

  // Calculate growth rates within each scenario
  const wealthGrowthA = (finalMetrics.AvgWealth_A - initialMetrics.AvgWealth_A) / initialMetrics.AvgWealth_A;
  const wealthGrowthB = (finalMetrics.AvgWealth_B - initialMetrics.AvgWealth_B) / initialMetrics.AvgWealth_B;

  // Prepare data for the comparison chart
  const comparisonData = [
    {
      metric: 'Average Wealth',
      A: finalMetrics.AvgWealth_A,
      B: finalMetrics.AvgWealth_B,
      diff: wealthDiff * 100,
      format: 'currency'
    },
    {
      metric: 'Wealth Growth',
      A: wealthGrowthA * 100,
      B: wealthGrowthB * 100,
      diff: (wealthGrowthB - wealthGrowthA) * 100,
      format: 'percentage'
    },
    {
      metric: 'Gini Coefficient',
      A: finalMetrics.Gini_A * 100,
      B: finalMetrics.Gini_B * 100,
      diff: -giniDiff * 100, // Negative because lower Gini is better
      format: 'number'
    },
    {
      metric: 'Poverty Rate',
      A: finalMetrics.PovertyRate_A * 100,
      B: finalMetrics.PovertyRate_B * 100,
      diff: -povertyDiff * 100, // Negative because lower poverty is better
      format: 'percentage'
    }
  ];

  // Determine overall winner
  const positiveMetrics = comparisonData.filter(d => d.diff > 0).length;
  const totalMetrics = comparisonData.length;
  const winPercentage = (positiveMetrics / totalMetrics) * 100;

  let overallResult = '';
  if (winPercentage >= 75) {
    overallResult = 'Cooperative model (B) significantly outperforms traditional model (A)';
  } else if (winPercentage >= 50) {
    overallResult = 'Cooperative model (B) moderately outperforms traditional model (A)';
  } else if (winPercentage >= 25) {
    overallResult = 'Traditional model (A) slightly outperforms cooperative model (B)';
  } else {
    overallResult = 'Traditional model (A) significantly outperforms cooperative model (B)';
  }

  return (
    <TooltipProvider>
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              Model Comparison: Traditional (A) vs. Cooperative (B)
              <Tooltip>
                <TooltipTrigger asChild>
                  <InfoCircledIcon className="h-4 w-4 ml-2 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent>
                  <p className="max-w-xs">Direct comparison of key metrics between the traditional economic model (A) and the cooperative model (B).</p>
                </TooltipContent>
              </Tooltip>
            </CardTitle>
            <CardDescription>
              Final results after {results.history.length} weeks of simulation
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="bg-muted p-4 rounded-md">
              <h3 className="text-lg font-semibold mb-2">Overall Result</h3>
              <p className="text-base">{overallResult}</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {comparisonData.map((item) => (
                <Card key={`metric-${item.metric}`} className={item.diff > 0 ? 'border-green-200' : item.diff < 0 ? 'border-red-200' : ''}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center">
                      {item.metric}
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <InfoCircledIcon className="h-4 w-4 ml-1 text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="max-w-xs">
                            {item.metric === 'Average Wealth' && 'The mean wealth across all community members at the end of the simulation.'}
                            {item.metric === 'Wealth Growth' && 'The percentage increase in average wealth from start to end of the simulation.'}
                            {item.metric === 'Gini Coefficient' && 'Measure of wealth inequality (0-100). Lower values indicate more equal wealth distribution.'}
                            {item.metric === 'Poverty Rate' && 'Percentage of members below the poverty threshold. Lower values are better.'}
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <p className="text-xs text-muted-foreground">Model A</p>
                        <p className="text-lg font-semibold">
                          {item.format === 'currency' && formatCurrency(item.A)}
                          {item.format === 'percentage' && formatPercentage(item.A / 100)}
                          {item.format === 'number' && formatNumber(item.A / 100, 3, 3)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Model B</p>
                        <p className="text-lg font-semibold">
                          {item.format === 'currency' && formatCurrency(item.B)}
                          {item.format === 'percentage' && formatPercentage(item.B / 100)}
                          {item.format === 'number' && formatNumber(item.B / 100, 3, 3)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Difference</p>
                        <p className={`text-lg font-semibold flex items-center ${item.diff > 0 ? 'text-green-600' : item.diff < 0 ? 'text-red-600' : 'text-gray-600'}`}>
                          {item.diff > 0 ? (
                            <ArrowUpIcon className="h-4 w-4 mr-1" />
                          ) : item.diff < 0 ? (
                            <ArrowDownIcon className="h-4 w-4 mr-1" />
                          ) : (
                            <ArrowRightIcon className="h-4 w-4 mr-1" />
                          )}
                          {formatPercentage(Math.abs(item.diff) / 100)}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="h-[400px]">
              <h3 className="text-base font-semibold mb-4">Key Metrics Comparison</h3>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={[
                    { name: 'Average Wealth', A: finalMetrics.AvgWealth_A, B: finalMetrics.AvgWealth_B },
                    { name: 'Median Wealth', A: finalMetrics.MedianWealth_A, B: finalMetrics.MedianWealth_B },
                    { name: 'Bottom 20% Wealth', A: finalMetrics.WealthQuintiles_A[0], B: finalMetrics.WealthQuintiles_B[0] },
                    { name: 'Top 20% Wealth', A: finalMetrics.Top10Percent_A, B: finalMetrics.Top10Percent_B }
                  ]}
                  layout="vertical"
                  margin={{ top: 20, right: 30, left: 70, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" tickFormatter={(value) => formatCurrency(value)} />
                  <YAxis dataKey="name" type="category" />
                  <RechartsTooltip formatter={(value) => [formatCurrency(value as number), '']} />
                  <Legend />
                  <Bar dataKey="A" name="Traditional Model (A)" fill="#8884d8" />
                  <Bar dataKey="B" name="Cooperative Model (B)" fill="#82ca9d" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-blue-50 p-4 rounded-md border border-blue-200 mb-6">
              <h3 className="text-sm font-semibold text-blue-800 mb-2">Key Insights</h3>
              <ul className="list-disc list-inside text-sm text-blue-700 space-y-1">
                <li>
                  {wealthDiff > 0
                    ? `The cooperative model generated ${formatPercentage(Math.abs(wealthDiff))} more average wealth than the traditional model.`
                    : `The traditional model generated ${formatPercentage(Math.abs(wealthDiff))} more average wealth than the cooperative model.`
                  }
                </li>
                <li>
                  {giniDiff < 0
                    ? `The cooperative model resulted in ${formatPercentage(Math.abs(giniDiff))} lower inequality (better Gini coefficient).`
                    : `The traditional model resulted in ${formatPercentage(Math.abs(giniDiff))} lower inequality (better Gini coefficient).`
                  }
                </li>
                <li>
                  {povertyDiff < 0
                    ? `The cooperative model reduced poverty by ${formatPercentage(Math.abs(povertyDiff))} compared to the traditional model.`
                    : `The traditional model reduced poverty by ${formatPercentage(Math.abs(povertyDiff))} compared to the cooperative model.`
                  }
                </li>
                <li>
                  {wealthGrowthB > wealthGrowthA
                    ? `The cooperative model showed ${formatPercentage(Math.abs(wealthGrowthB - wealthGrowthA))} stronger wealth growth.`
                    : `The traditional model showed ${formatPercentage(Math.abs(wealthGrowthB - wealthGrowthA))} stronger wealth growth.`
                  }
                </li>
              </ul>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Understanding the Wealth Difference</CardTitle>
                <CardDescription>How the cooperative model (B) generates or retains more wealth</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="prose prose-sm max-w-none">
                  <h4>Sources of Wealth in Both Models</h4>
                  <p>
                    Both models start with identical initial conditions: the same number of members, same initial wealth distribution,
                    and same weekly income patterns. The final wealth difference of {formatCurrency(Math.abs(finalMetrics.TotalWealth_B - finalMetrics.TotalWealth_A))}
                    ({formatPercentage(Math.abs(wealthDiff))}) comes from structural differences in how the economies operate:
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="border rounded-md p-4">
                    <h4 className="font-medium mb-2">Traditional Model (A) Wealth Mechanics:</h4>
                    <ul className="list-disc list-inside text-sm space-y-1">
                      <li>Members spend at full market rates</li>
                      <li>No group purchasing discounts</li>
                      <li>Wealth leaves the community when spent externally</li>
                      <li>No complementary currency system</li>
                      <li>No cooperative infrastructure</li>
                      <li>Total final wealth: {formatCurrency(finalMetrics.TotalWealth_A)}</li>
                    </ul>
                  </div>

                  <div className="border rounded-md p-4 border-green-200 bg-green-50">
                    <h4 className="font-medium mb-2">Cooperative Model (B) Wealth Sources:</h4>
                    <ul className="list-disc list-inside text-sm space-y-1">
                      <li><strong>Group Purchasing:</strong> {formatPercentage(results.summary.key_findings.wealth_impact.details.includes('group purchasing') ? 0.15 : 0.1)} savings on internal spending</li>
                      <li><strong>Local Production:</strong> {formatPercentage(results.summary.key_findings.wealth_impact.details.includes('local production') ? 0.2 : 0.15)} savings on locally produced goods</li>
                      <li><strong>Wealth Retention:</strong> More money stays within the community</li>
                      <li><strong>GroTokens:</strong> Community currency provides additional purchasing power</li>
                      <li><strong>Cooperative Fee:</strong> Small fee supports shared infrastructure</li>
                      <li><strong>Total final wealth:</strong> {formatCurrency(finalMetrics.TotalWealth_B)}</li>
                    </ul>
                  </div>
                </div>

                <div className="bg-amber-50 p-3 rounded-md border border-amber-200">
                  <h4 className="font-medium text-amber-800 mb-1">Where Does the Extra Wealth Come From?</h4>
                  <p className="text-sm text-amber-700">
                    The cooperative model doesn&apos;t create wealth from nothing. Instead, it <strong>retains wealth</strong> that would otherwise leave
                    the community through more efficient spending (group purchasing), local production, and a complementary currency system.
                    The {formatCurrency(Math.abs(finalMetrics.TotalWealth_B - finalMetrics.TotalWealth_A))} difference represents money that would have
                    flowed to external entities in the traditional model but instead remained within the community.
                  </p>
                  <p className="text-xs text-amber-600 mt-2">
                    See the detailed flow diagram below for a visual explanation of how value moves through the system.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <h4 className="font-medium mb-2">Key Wealth Retention Mechanisms:</h4>
                    <ul className="list-disc list-inside text-sm space-y-1">
                      <li><strong>Internal Spending:</strong> {formatPercentage(0.4)} of budget spent within community</li>
                      <li><strong>Cost Savings:</strong> Average of {formatPercentage(0.175)} on internal purchases</li>
                      <li><strong>GroToken Value:</strong> {formatCurrency(2)} per token</li>
                      <li><strong>Weekly GroToken Rewards:</strong> ~{formatNumber(10, 0)} tokens per member</li>
                    </ul>
                  </div>

                  <div>
                    <h4 className="font-medium mb-2">Wealth Distribution Effects:</h4>
                    <ul className="list-disc list-inside text-sm space-y-1">
                      <li><strong>Bottom 20% Wealth:</strong> {formatCurrency(finalMetrics.WealthQuintiles_B[0])} vs {formatCurrency(finalMetrics.WealthQuintiles_A[0])}</li>
                      <li><strong>Median Wealth:</strong> {formatCurrency(finalMetrics.MedianWealth_B)} vs {formatCurrency(finalMetrics.MedianWealth_A)}</li>
                      <li><strong>Top 20% Wealth:</strong> {formatCurrency(finalMetrics.Top10Percent_B)} vs {formatCurrency(finalMetrics.Top10Percent_A)}</li>
                      <li><strong>Poverty Rate:</strong> {formatPercentage(finalMetrics.PovertyRate_B)} vs {formatPercentage(finalMetrics.PovertyRate_A)}</li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="mt-6">
              <h3 className="text-lg font-medium mb-4">Token Flow Visualization</h3>
              <TokenFlowDiagram
                params={results.params || {
                  // Fallback to defaults if params are not available
                  WEEKLY_INCOME_AVG: 200,
                  WEEKLY_FOOD_BUDGET_AVG: 100,
                  PERCENT_SPEND_INTERNAL_AVG: 0.4,
                  GROUP_BUY_SAVINGS_PERCENT: 0.15,
                  LOCAL_PRODUCTION_SAVINGS_PERCENT: 0.2,
                  GROTOKEN_REWARD_PER_WEEK_AVG: 10,
                  GROTOKEN_USD_VALUE: 2,
                  WEEKLY_COOP_FEE_B: 1
                }}
                results={results}
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </TooltipProvider>
  );
}
