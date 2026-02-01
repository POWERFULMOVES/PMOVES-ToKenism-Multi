"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { InfoCircledIcon } from '@radix-ui/react-icons';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { formatCurrency, formatPercentage } from '@/lib/utils/formatters';

export function ModelExplanation() {
  return (
    <TooltipProvider>
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center">
            Mathematical Models Explained
            <Tooltip>
              <TooltipTrigger asChild>
                <InfoCircledIcon className="h-4 w-4 ml-2 text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent>
                <p className="max-w-xs">This section explains the mathematical formulas and assumptions used in both economic models.</p>
              </TooltipContent>
            </Tooltip>
          </CardTitle>
          <CardDescription>
            Understanding the calculations behind the simulation
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <Tabs defaultValue="overview">
            <TabsList className="grid grid-cols-4 mb-4">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="scenario-a">Traditional Model (A)</TabsTrigger>
              <TabsTrigger value="scenario-b">Cooperative Model (B)</TabsTrigger>
              <TabsTrigger value="grotokens">GroTokens</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-4">
              <div className="prose prose-sm max-w-none">
                <h3>Simulation Framework</h3>
                <p>
                  The PMOVES Economic Simulator uses agent-based modeling to simulate two different economic systems:
                </p>
                <ul>
                  <li><strong>Scenario A (Traditional):</strong> A conventional economic system where individuals operate independently</li>
                  <li><strong>Scenario B (Cooperative):</strong> A community-based system with group purchasing, local production, and complementary currency</li>
                </ul>
                <p>
                  Both scenarios start with identical initial conditions:
                </p>
                <ul>
                  <li>Same number of community members</li>
                  <li>Same initial wealth distribution (log-normal distribution)</li>
                  <li>Same weekly income patterns</li>
                  <li>Same basic needs (food budget)</li>
                </ul>
                <p>
                  The key difference is in how money flows through the system and how resources are allocated.
                </p>

                <h4>Key Mathematical Components</h4>
                <ol>
                  <li><strong>Wealth Distribution:</strong> Log-normal distribution with configurable mean and standard deviation</li>
                  <li><strong>Income Generation:</strong> Normal distribution with configurable mean and standard deviation</li>
                  <li><strong>Spending Patterns:</strong> Configurable internal vs. external spending ratios</li>
                  <li><strong>Cooperative Benefits:</strong> Cost savings from group purchasing and local production</li>
                  <li><strong>Complementary Currency:</strong> GroTokens with configurable USD value and distribution</li>
                </ol>

                <h4>Key Metrics Calculated</h4>
                <ul>
                  <li><strong>Gini Coefficient:</strong> Measure of wealth inequality (0-1 scale)</li>
                  <li><strong>Poverty Rate:</strong> Percentage of members below poverty threshold</li>
                  <li><strong>Wealth Quintiles:</strong> Wealth thresholds at 20% population segments</li>
                  <li><strong>Economic Resilience:</strong> Ability to withstand and recover from shocks</li>
                </ul>
              </div>
            </TabsContent>

            <TabsContent value="scenario-a" className="space-y-4">
              <div className="prose prose-sm max-w-none">
                <h3>Traditional Economic Model (Scenario A)</h3>
                <p>
                  The traditional model represents a conventional economic system where individuals operate independently,
                  purchasing goods and services at market rates without coordination.
                </p>

                <h4>Initial Wealth Distribution</h4>
                <div className="bg-slate-50 p-3 rounded-md font-mono text-sm my-2">
                  initial_wealth = exp(normal_random(INITIAL_WEALTH_MEAN_LOG, INITIAL_WEALTH_SIGMA_LOG))
                </div>
                <p className="text-sm text-muted-foreground">
                  Initial wealth follows a log-normal distribution, which is typical of real-world wealth distributions.
                </p>

                <h4>Weekly Income</h4>
                <div className="bg-slate-50 p-3 rounded-md font-mono text-sm my-2">
                  weekly_income = max(MIN_WEEKLY_INCOME, normal_random(WEEKLY_INCOME_AVG, WEEKLY_INCOME_STDDEV))
                </div>
                <p className="text-sm text-muted-foreground">
                  Income is normally distributed with a minimum floor to prevent negative values.
                </p>

                <h4>Weekly Spending</h4>
                <div className="bg-slate-50 p-3 rounded-md font-mono text-sm my-2">
                  weekly_budget = max(MIN_WEEKLY_BUDGET, normal_random(WEEKLY_FOOD_BUDGET_AVG, WEEKLY_FOOD_BUDGET_STDDEV))
                </div>
                <p className="text-sm text-muted-foreground">
                  Each member has a weekly budget for essential spending (food, etc.).
                </p>

                <h4>Wealth Update Formula</h4>
                <div className="bg-slate-50 p-3 rounded-md font-mono text-sm my-2">
                  new_wealth = current_wealth + weekly_income - weekly_budget
                </div>
                <p className="text-sm text-muted-foreground">
                  Wealth changes based on income minus spending each week.
                </p>

                <h4>Key Assumptions</h4>
                <ul>
                  <li>All spending occurs at full market rates</li>
                  <li>No cost savings from collective purchasing</li>
                  <li>Money spent externally leaves the community permanently</li>
                  <li>No complementary currency system</li>
                  <li>No cooperative infrastructure costs</li>
                </ul>
              </div>
            </TabsContent>

            <TabsContent value="scenario-b" className="space-y-4">
              <div className="prose prose-sm max-w-none">
                <h3>Cooperative Economic Model (Scenario B)</h3>
                <p>
                  The cooperative model represents a community-based economic system that incorporates group purchasing power,
                  local production, and a complementary community currency (GroTokens).
                </p>

                <h4>Internal vs. External Spending</h4>
                <div className="bg-slate-50 p-3 rounded-md font-mono text-sm my-2">
                  propensity_to_spend_internal = max(0, min(1, normal_random(PERCENT_SPEND_INTERNAL_AVG, PERCENT_SPEND_INTERNAL_STDDEV)))
                  <br />
                  intended_spend_internal = weekly_budget * propensity_to_spend_internal
                  <br />
                  intended_spend_external = weekly_budget * (1.0 - propensity_to_spend_internal)
                </div>
                <p className="text-sm text-muted-foreground">
                  Each member decides how much of their budget to spend within the community vs. externally.
                </p>

                <h4>Group Purchasing Savings</h4>
                <div className="bg-slate-50 p-3 rounded-md font-mono text-sm my-2">
                  avg_internal_savings_rate = (GROUP_BUY_SAVINGS_PERCENT + LOCAL_PRODUCTION_SAVINGS_PERCENT) / 2
                  <br />
                  effective_cost_internal = intended_spend_internal * (1.0 - avg_internal_savings_rate)
                </div>
                <p className="text-sm text-muted-foreground">
                  Members pay less for goods purchased internally due to group buying power and local production.
                </p>

                <h4>Complementary Currency (GroTokens)</h4>
                <div className="bg-slate-50 p-3 rounded-md font-mono text-sm my-2">
                  weekly_grotoken_reward = max(0, normal_random(GROTOKEN_REWARD_PER_WEEK_AVG, GROTOKEN_REWARD_STDDEV))
                  <br />
                  grotoken_balance += weekly_grotoken_reward
                  <br />
                  grotoken_value_usd = grotoken_balance * GROTOKEN_USD_VALUE
                </div>
                <p className="text-sm text-muted-foreground">
                  Members receive GroTokens weekly, which have a configurable USD value and contribute to total wealth.
                </p>

                <h4>Cooperative Fee</h4>
                <div className="bg-slate-50 p-3 rounded-md font-mono text-sm my-2">
                  actual_coop_fee = min(WEEKLY_COOP_FEE_B, usd_balance)
                  <br />
                  usd_balance = max(0, usd_balance - actual_coop_fee)
                </div>
                <p className="text-sm text-muted-foreground">
                  Members pay a small fee to maintain the cooperative infrastructure.
                </p>

                <h4>Total Wealth Calculation</h4>
                <div className="bg-slate-50 p-3 rounded-md font-mono text-sm my-2">
                  wealth_scenario_B = usd_balance + (grotoken_balance * GROTOKEN_USD_VALUE)
                </div>
                <p className="text-sm text-muted-foreground">
                  Total wealth combines both traditional currency (USD) and community currency (GroTokens).
                </p>

                <h4>Key Mechanisms That Generate Wealth Differences</h4>
                <ol>
                  <li><strong>Cost Efficiency:</strong> Group purchasing and local production reduce costs</li>
                  <li><strong>Wealth Retention:</strong> More money circulates within the community rather than leaving</li>
                  <li><strong>Supplemental Income:</strong> GroTokens provide additional purchasing power</li>
                  <li><strong>Shared Infrastructure:</strong> Cooperative fee funds shared resources that benefit all members</li>
                </ol>
              </div>
            </TabsContent>

            <TabsContent value="grotokens" className="space-y-4">
              <div className="prose prose-sm max-w-none">
                <h3>Dual-Token Economy in Scenario B</h3>
                <p>
                  The cooperative model (Scenario B) operates with a dual-token economy, where both traditional currency (USD)
                  and a complementary community currency (GroTokens) work together to create a more resilient economic system.
                </p>

                <h4>The Two Currencies</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 my-4">
                  <div className="bg-blue-50 p-3 rounded-md">
                    <h5 className="font-medium text-blue-800">USD (Traditional Currency)</h5>
                    <ul className="text-sm text-blue-700 list-disc list-inside space-y-1 mt-2">
                      <li>Enters community through external income</li>
                      <li>Used for external purchases and some internal transactions</li>
                      <li>Tends to &quot;leak&quot; out of the community when spent externally</li>
                      <li>Universal acceptance outside the community</li>
                    </ul>
                  </div>
                  <div className="bg-green-50 p-3 rounded-md">
                    <h5 className="font-medium text-green-800">GroTokens (Community Currency)</h5>
                    <ul className="text-sm text-green-700 list-disc list-inside space-y-1 mt-2">
                      <li>Created within the cooperative system</li>
                      <li>Used primarily for internal transactions</li>
                      <li>Stays within the community, preventing wealth leakage</li>
                      <li>Higher velocity of circulation</li>
                    </ul>
                  </div>
                </div>

                <h4>How GroTokens Work</h4>
                <div className="bg-slate-50 p-3 rounded-md font-mono text-sm my-2">
                  weekly_grotoken_reward = max(0, normal_random(GROTOKEN_REWARD_PER_WEEK_AVG, GROTOKEN_REWARD_STDDEV))<br />
                  grotoken_balance += weekly_grotoken_reward<br />
                  grotoken_value_usd = grotoken_balance * GROTOKEN_USD_VALUE
                </div>
                <p className="text-sm text-muted-foreground">
                  Members receive GroTokens weekly, which have a configurable USD value and contribute to total wealth.
                </p>

                <h4>Where GroTokens Get Their Value</h4>
                <p>
                  Unlike traditional fiat currency, GroTokens derive their value from specific sources within the cooperative system:
                </p>
                <ol>
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
                </ol>

                <h4>How the Dual-Token System Works</h4>
                <p>
                  The dual-token system creates a more resilient local economy through several mechanisms:
                </p>
                <ul>
                  <li>
                    <strong>Complementary Roles:</strong> USD connects to the external economy, while GroTokens facilitate internal exchange.
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
                </ul>

                <h4>Mathematical Representation</h4>
                <p>
                  In the simulation, a member&apos;s total wealth in Scenario B is calculated as:
                </p>
                <div className="bg-slate-50 p-3 rounded-md font-mono text-sm my-2">
                  wealth_scenario_B = usd_balance + (grotoken_balance * GROTOKEN_USD_VALUE)
                </div>
                <p>
                  This formula shows how both currencies contribute to the total wealth in the cooperative model.
                </p>

                <h4>Real-World Parallels</h4>
                <p>
                  This dual-token approach has parallels in real-world complementary currency systems like the WIR Bank in Switzerland,
                  Berkshares in Massachusetts, or various time-banking systems worldwide. These systems have demonstrated that
                  complementary currencies can effectively support local economies, especially during economic downturns.
                </p>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </TooltipProvider>
  );
}
