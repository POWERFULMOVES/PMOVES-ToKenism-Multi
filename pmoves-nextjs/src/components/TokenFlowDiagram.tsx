"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { InfoCircledIcon } from '@radix-ui/react-icons';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { formatCurrency, formatPercentage } from '@/lib/utils/formatters';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip
} from 'recharts';

interface TokenFlowDiagramProps {
  params: {
    WEEKLY_INCOME_AVG?: number;
    WEEKLY_FOOD_BUDGET_AVG?: number;
    PERCENT_SPEND_INTERNAL_AVG?: number;
    GROUP_BUY_SAVINGS_PERCENT?: number;
    LOCAL_PRODUCTION_SAVINGS_PERCENT?: number;
    GROTOKEN_REWARD_PER_WEEK_AVG?: number;
    GROTOKEN_USD_VALUE?: number;
    WEEKLY_COOP_FEE_B?: number;
    [key: string]: number | undefined;
  };
  results?: Record<string, unknown>;
}

export function TokenFlowDiagram({ params, results }: TokenFlowDiagramProps) {
  // Calculate values based on simulation parameters
  const weeklyIncome = params?.WEEKLY_INCOME_AVG || 200;
  const weeklyBudget = params?.WEEKLY_FOOD_BUDGET_AVG || 100;
  const internalSpendRate = params?.PERCENT_SPEND_INTERNAL_AVG || 0.4;
  const groupSavingsRate = params?.GROUP_BUY_SAVINGS_PERCENT || 0.15;
  const localSavingsRate = params?.LOCAL_PRODUCTION_SAVINGS_PERCENT || 0.2;
  const avgSavingsRate = (groupSavingsRate + localSavingsRate) / 2;
  const weeklyGroTokens = params?.GROTOKEN_REWARD_PER_WEEK_AVG || 10;
  const groTokenValue = params?.GROTOKEN_USD_VALUE || 2;
  const coopFee = params?.WEEKLY_COOP_FEE_B || 1;

  // Calculate flows
  const internalSpend = weeklyBudget * internalSpendRate;
  const externalSpend = weeklyBudget * (1 - internalSpendRate);
  const savingsFromInternal = internalSpend * avgSavingsRate;
  const effectiveInternalCost = internalSpend - savingsFromInternal;
  const groTokenValueWeekly = weeklyGroTokens * groTokenValue;

  // We're using a simpler visualization approach with bar charts instead of Sankey diagrams

  // Pie chart data for token backing
  const tokenBackingData = [
    { name: "Cooperative Fund", value: coopFee * 10, color: "#8884d8" },
    { name: "Member Commitments", value: internalSpend * 0.1, color: "#82ca9d" },
    { name: "Local Production", value: internalSpend * localSavingsRate, color: "#ffc658" }
  ];

  // Calculate total token backing
  const totalBacking = tokenBackingData.reduce((sum, item) => sum + item.value, 0);

  return (
    <TooltipProvider>
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center">
            Dual-Token Economy Flow
            <Tooltip>
              <TooltipTrigger asChild>
                <InfoCircledIcon className="h-4 w-4 ml-2 text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent>
                <p className="max-w-xs">This diagram shows how both USD and GroTokens flow through the cooperative system, creating a dual-token economy.</p>
              </TooltipContent>
            </Tooltip>
          </CardTitle>
          <CardDescription>
            Understanding the dual-token economy in the cooperative model (Scenario B)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <Tabs defaultValue="flow">
            <TabsList className="grid grid-cols-4 mb-4">
              <TabsTrigger value="flow">Value Flow</TabsTrigger>
              <TabsTrigger value="dual-token">Dual-Token System</TabsTrigger>
              <TabsTrigger value="backing">Token Backing</TabsTrigger>
              <TabsTrigger value="explanation">Explanation</TabsTrigger>
            </TabsList>

            <TabsContent value="flow" className="space-y-4">
              <div className="h-[400px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={[
                      { name: 'Weekly Income', value: weeklyIncome, fill: '#8884d8' },
                      { name: 'Internal Spending', value: internalSpend, fill: '#82ca9d' },
                      { name: 'External Spending', value: externalSpend, fill: '#ffc658' },
                      { name: 'Savings from Co-op', value: savingsFromInternal, fill: '#ff8042' },
                      { name: 'GroToken Value', value: groTokenValueWeekly, fill: '#00C49F' }
                    ]}
                    layout="vertical"
                    margin={{ top: 20, right: 30, left: 100, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" domain={[0, 'dataMax']} tickFormatter={(value) => formatCurrency(value)} />
                    <YAxis type="category" dataKey="name" />
                    <RechartsTooltip formatter={(value) => [formatCurrency(value as number), '']} />
                    <Bar dataKey="value" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="bg-blue-50 p-3 rounded-md">
                <h4 className="text-sm font-medium text-blue-800">Understanding the Flow</h4>
                <p className="text-xs text-blue-700 mt-1">
                  This diagram shows how money flows through the cooperative system. Members spend part of their budget internally (through the cooperative) and part externally. The cooperative creates savings through group purchasing and local production, and issues GroTokens that add to members&apos; wealth.
                </p>
                <p className="text-xs text-blue-700 mt-1">
                  <strong>Note:</strong> This is a simplified view. The dual-token tab shows how USD and GroTokens interact in the system.
                </p>
              </div>
            </TabsContent>

            <TabsContent value="dual-token" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h3 className="text-lg font-medium">Dual-Token Economy</h3>
                  <p className="text-sm text-muted-foreground">
                    Scenario B operates with two complementary currencies working together:
                  </p>

                  <div className="bg-blue-50 p-3 rounded-md">
                    <h4 className="text-sm font-medium text-blue-800">USD (Traditional Currency)</h4>
                    <ul className="mt-2 text-xs space-y-1 text-blue-700">
                      <li><strong>Source:</strong> External economy (wages, sales, etc.)</li>
                      <li><strong>Primary Uses:</strong> External purchases, some internal transactions</li>
                      <li><strong>Flow:</strong> Enters community through income, exits through external spending</li>
                      <li><strong>Characteristics:</strong> Universal acceptance, but tends to leak out of community</li>
                    </ul>
                  </div>

                  <div className="bg-green-50 p-3 rounded-md">
                    <h4 className="text-sm font-medium text-green-800">GroTokens (Community Currency)</h4>
                    <ul className="mt-2 text-xs space-y-1 text-green-700">
                      <li><strong>Source:</strong> Created by cooperative based on economic activity</li>
                      <li><strong>Primary Uses:</strong> Internal transactions, community services</li>
                      <li><strong>Flow:</strong> Circulates primarily within the community</li>
                      <li><strong>Characteristics:</strong> Higher velocity, stays within community</li>
                    </ul>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-lg font-medium">Token Interaction</h3>
                  <div className="bg-slate-50 p-4 rounded-md">
                    <h4 className="text-sm font-medium mb-2">How the Two Tokens Work Together</h4>

                    <div className="space-y-3">
                      <div className="border-l-4 border-blue-500 pl-3">
                        <h5 className="text-xs font-medium">USD Transactions</h5>
                        <p className="text-xs text-slate-600">Used for external purchases and some internal transactions. Provides connection to the broader economy.</p>
                      </div>

                      <div className="border-l-4 border-green-500 pl-3">
                        <h5 className="text-xs font-medium">GroToken Transactions</h5>
                        <p className="text-xs text-slate-600">Used for internal transactions. Increases local money supply and velocity.</p>
                      </div>

                      <div className="border-l-4 border-purple-500 pl-3">
                        <h5 className="text-xs font-medium">Exchange Mechanism</h5>
                        <p className="text-xs text-slate-600">GroTokens can be exchanged for goods/services at the rate of {formatCurrency(groTokenValue)} per token.</p>
                      </div>

                      <div className="border-l-4 border-amber-500 pl-3">
                        <h5 className="text-xs font-medium">Wealth Calculation</h5>
                        <p className="text-xs text-slate-600">Total wealth = USD Balance + (GroToken Balance × GroToken Value)</p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-amber-50 p-3 rounded-md">
                    <h4 className="text-sm font-medium text-amber-800">Key Benefits of Dual-Token System</h4>
                    <ul className="mt-2 text-xs space-y-1 text-amber-700">
                      <li><strong>Increased Liquidity:</strong> More total currency in circulation</li>
                      <li><strong>Wealth Retention:</strong> GroTokens stay within the community</li>
                      <li><strong>Economic Resilience:</strong> Less dependent on external currency</li>
                      <li><strong>Local Empowerment:</strong> Community has more control over its economy</li>
                    </ul>
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="backing" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={tokenBackingData}
                          cx="50%"
                          cy="50%"
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="value"
                          label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                        >
                          {tokenBackingData.map((entry) => (
                            <Cell key={`cell-${entry.name}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                <div className="space-y-4">
                  <h3 className="text-lg font-medium">GroToken Value Backing</h3>
                  <p className="text-sm text-muted-foreground">
                    GroTokens are backed by real economic value in the cooperative system:
                  </p>
                  <ul className="space-y-2">
                    <li className="flex justify-between text-sm">
                      <span>Cooperative Fund:</span>
                      <span className="font-medium">{formatCurrency(coopFee * 10)}</span>
                    </li>
                    <li className="flex justify-between text-sm">
                      <span>Member Commitments:</span>
                      <span className="font-medium">{formatCurrency(internalSpend * 0.1)}</span>
                    </li>
                    <li className="flex justify-between text-sm">
                      <span>Local Production Value:</span>
                      <span className="font-medium">{formatCurrency(internalSpend * localSavingsRate)}</span>
                    </li>
                    <li className="flex justify-between text-sm border-t pt-2">
                      <span className="font-medium">Total Backing:</span>
                      <span className="font-medium">{formatCurrency(totalBacking)}</span>
                    </li>
                    <li className="flex justify-between text-sm">
                      <span>Weekly GroToken Issuance Value:</span>
                      <span className="font-medium">{formatCurrency(groTokenValueWeekly)}</span>
                    </li>
                    <li className="flex justify-between text-sm">
                      <span>Backing Ratio:</span>
                      <span className="font-medium">{formatPercentage(totalBacking / groTokenValueWeekly)}</span>
                    </li>
                  </ul>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="explanation" className="space-y-4">
              <div className="prose prose-sm max-w-none">
                <h3>The Dual-Token Economy Explained</h3>
                <p>
                  Scenario B operates with a dual-token economy, where both traditional currency (USD) and a complementary community currency (GroTokens) work together. This system creates unique economic dynamics that benefit the community.
                </p>

                <h4>USD in the Cooperative Model</h4>
                <p>
                  USD functions as the primary connection to the external economy. Members receive income in USD, pay for external goods and services in USD, and use USD for some internal transactions. However, USD tends to &quot;leak&quot; out of the community when spent externally.
                </p>

                <h4>GroTokens as Complementary Currency</h4>
                <p>
                  GroTokens are a complementary currency issued by the cooperative. Unlike traditional fiat currency, their value is backed by specific economic activities and commitments within the community:
                </p>

                <ul>
                  <li>
                    <strong>Cooperative Fund:</strong> A portion of the weekly cooperative fees paid by members goes into a fund that backs the value of GroTokens.
                  </li>
                  <li>
                    <strong>Member Commitments:</strong> Members agree to accept GroTokens as payment for goods and services within the community.
                  </li>
                  <li>
                    <strong>Local Production:</strong> The cooperative invests in local production capacity, which creates real economic value that backs the tokens.
                  </li>
                  <li>
                    <strong>Circulation and Velocity:</strong> GroTokens typically circulate faster within the community than traditional currency.
                  </li>
                </ul>

                <h4>How the Two Currencies Interact</h4>
                <p>
                  The dual-token system creates a more resilient local economy through several mechanisms:
                </p>

                <ol>
                  <li>
                    <strong>Complementary Circulation:</strong> USD connects to the external economy, while GroTokens facilitate internal exchange.
                  </li>
                  <li>
                    <strong>Increased Liquidity:</strong> The total money supply (USD + GroTokens) is greater than would be available with USD alone.
                  </li>
                  <li>
                    <strong>Wealth Retention:</strong> While USD can leave the community, GroTokens remain within it, preserving local wealth.
                  </li>
                  <li>
                    <strong>Economic Resilience:</strong> If external USD becomes scarce (during economic downturns), internal GroToken circulation can maintain economic activity.
                  </li>
                </ol>

                <h4>Mathematical Representation</h4>
                <p>
                  In the simulation, a member&apos;s total wealth in Scenario B is calculated as:
                </p>
                <div className="bg-slate-50 p-3 rounded-md font-mono text-sm my-2">
                  wealth_scenario_B = usd_balance + (grotoken_balance * GROTOKEN_USD_VALUE)
                </div>

                <h4>Real-World Parallels</h4>
                <p>
                  This dual-token approach has parallels in real-world complementary currency systems like the WIR Bank in Switzerland, Berkshares in Massachusetts, or various time-banking systems worldwide. These systems have demonstrated that complementary currencies can effectively support local economies, especially during economic downturns.
                </p>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </TooltipProvider>
  );
}
