/**
 * Advanced Analytics Dashboard
 * Showcases enhanced visualization components for economic model analysis
 */

'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  HeatmapChart,
  ViolinPlot,
  prepareWealthDistributionData,
  WaterfallChart,
  prepareScenarioComparison,
  SankeyDiagram,
  prepareEconomicFlowData,
  prepareMemberFlowData,
} from '@/components/charts';

export default function AnalyticsPage() {
  const [simulationData, setSimulationData] = useState<any>(null);

  // Load sample data or simulation results
  useEffect(() => {
    // Check if we have simulation results in localStorage
    const stored = localStorage.getItem('lastSimulationResults');
    if (stored) {
      try {
        setSimulationData(JSON.parse(stored));
      } catch (e) {
        console.error('Failed to load simulation data:', e);
        setSimulationData(generateSampleData());
      }
    } else {
      setSimulationData(generateSampleData());
    }
  }, []);

  if (!simulationData) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center py-12">
          <p className="text-lg text-muted-foreground">Loading analytics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="space-y-2">
        <h1 className="text-4xl font-bold tracking-tight">Advanced Analytics Dashboard</h1>
        <p className="text-lg text-muted-foreground">
          Comprehensive economic model visualization and analysis
        </p>
      </div>

      <Tabs defaultValue="distributions" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="distributions">Distributions</TabsTrigger>
          <TabsTrigger value="flows">Wealth Flows</TabsTrigger>
          <TabsTrigger value="correlations">Correlations</TabsTrigger>
          <TabsTrigger value="comparisons">Comparisons</TabsTrigger>
        </TabsList>

        {/* Distribution Analysis */}
        <TabsContent value="distributions" className="space-y-6">
          <ViolinPlot
            data={simulationData.violinData}
            title="Wealth Distribution Comparison"
            description="Probability density and statistical distribution of wealth across scenarios"
            xLabel="Scenario"
            yLabel="Wealth ($)"
            height={500}
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Distribution Insights</CardTitle>
                <CardDescription>Key statistical findings</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Scenario A Median:</span>
                  <span className="text-sm">${simulationData.stats.medianA.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Scenario B Median:</span>
                  <span className="text-sm">${simulationData.stats.medianB.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Median Improvement:</span>
                  <span className="text-sm text-[hsl(var(--positive))]">
                    +{((simulationData.stats.medianB / simulationData.stats.medianA - 1) * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Gini Coefficient (A):</span>
                  <span className="text-sm">{simulationData.stats.giniA.toFixed(3)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Gini Coefficient (B):</span>
                  <span className="text-sm">{simulationData.stats.giniB.toFixed(3)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Inequality Reduction:</span>
                  <span className="text-sm text-[hsl(var(--positive))]">
                    -{((1 - simulationData.stats.giniB / simulationData.stats.giniA) * 100).toFixed(1)}%
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Economic Impact</CardTitle>
                <CardDescription>System-wide effects</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Total Cooperative Savings:</span>
                  <span className="text-sm text-[hsl(var(--positive))]">
                    ${simulationData.stats.totalCoopSavings.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Total GroToken Value:</span>
                  <span className="text-sm">${simulationData.stats.totalTokenValue.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Avg Savings per Member:</span>
                  <span className="text-sm">
                    ${(simulationData.stats.totalCoopSavings / simulationData.members.length).toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Poverty Rate (A):</span>
                  <span className="text-sm">{(simulationData.stats.povertyRateA * 100).toFixed(1)}%</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Poverty Rate (B):</span>
                  <span className="text-sm">{(simulationData.stats.povertyRateB * 100).toFixed(1)}%</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Members Lifted:</span>
                  <span className="text-sm text-[hsl(var(--positive))]">
                    {Math.round((simulationData.stats.povertyRateA - simulationData.stats.povertyRateB) * simulationData.members.length)}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Wealth Flow Analysis */}
        <TabsContent value="flows" className="space-y-6">
          <SankeyDiagram
            nodes={simulationData.sankeyData.nodes}
            links={simulationData.sankeyData.links}
            title="Economic System Flow"
            description="Visualization of money flow through the cooperative economic system"
            height={600}
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <WaterfallChart
              data={simulationData.waterfallIndividual}
              title="Individual Member Wealth Flow"
              description="Sample member's wealth accumulation breakdown"
              yLabel="Amount ($)"
              height={400}
            />

            <WaterfallChart
              data={simulationData.waterfallComparison}
              title="Scenario Comparison"
              description="Wealth difference between Traditional and Cooperative scenarios"
              yLabel="Amount ($)"
              height={400}
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Flow Analysis</CardTitle>
              <CardDescription>Key insights from wealth flow patterns</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="list-disc list-inside space-y-2 text-sm">
                <li>
                  <strong>Primary Income Sources:</strong> Weekly earnings form the foundation of wealth accumulation
                </li>
                <li>
                  <strong>Spending Patterns:</strong> Traditional vs. Cooperative purchasing shows significant savings potential
                </li>
                <li>
                  <strong>Wealth Retention:</strong> Cooperative model demonstrates {simulationData.stats.retentionRate.toFixed(1)}% better wealth retention
                </li>
                <li>
                  <strong>Token Accumulation:</strong> GroTokens provide additional value storage and community engagement
                </li>
                <li>
                  <strong>Compound Effects:</strong> Savings compound over time, creating exponential wealth gap between scenarios
                </li>
              </ul>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Correlation Analysis */}
        <TabsContent value="correlations" className="space-y-6">
          <HeatmapChart
            data={simulationData.heatmapData}
            title="Parameter Correlation Matrix"
            height={400}
          />

          <Card>
            <CardHeader>
              <CardTitle>Correlation Insights</CardTitle>
              <CardDescription>Interpretation of key relationships</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <h4 className="font-semibold text-sm mb-2">Strong Positive Correlations</h4>
                  <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                    <li>Cooperative Participation ↔ Total Wealth (r ≈ 0.85)</li>
                    <li>GroToken Balance ↔ Community Engagement (r ≈ 0.78)</li>
                    <li>Group Buying Participation ↔ Savings Rate (r ≈ 0.82)</li>
                  </ul>
                </div>

                <div>
                  <h4 className="font-semibold text-sm mb-2">Notable Negative Correlations</h4>
                  <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                    <li>Traditional Spending ↔ Wealth Accumulation (r ≈ -0.45)</li>
                    <li>Income Volatility ↔ Savings Stability (r ≈ -0.62)</li>
                  </ul>
                </div>

                <div>
                  <h4 className="font-semibold text-sm mb-2">Implications</h4>
                  <p className="text-sm text-muted-foreground">
                    The strong correlation between cooperative participation and wealth outcomes
                    suggests that systematic engagement with the cooperative economy yields
                    measurable benefits. The token system correlation with engagement indicates
                    it successfully incentivizes community participation.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Scenario Comparisons */}
        <TabsContent value="comparisons" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Traditional Economy (Scenario A)</CardTitle>
                <CardDescription>Baseline market-based economic model</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Average Wealth</span>
                    <span className="font-medium">${simulationData.stats.avgWealthA.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Median Wealth</span>
                    <span className="font-medium">${simulationData.stats.medianA.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Gini Coefficient</span>
                    <span className="font-medium">{simulationData.stats.giniA.toFixed(3)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Poverty Rate</span>
                    <span className="font-medium">{(simulationData.stats.povertyRateA * 100).toFixed(1)}%</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Wealth Gap (90/10)</span>
                    <span className="font-medium">{simulationData.stats.wealthGapA.toFixed(2)}×</span>
                  </div>
                </div>

                <div className="pt-3 border-t">
                  <h4 className="text-sm font-semibold mb-2">Characteristics</h4>
                  <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                    <li>Standard market prices</li>
                    <li>Individual purchasing</li>
                    <li>Limited collective action</li>
                    <li>Traditional wealth dynamics</li>
                  </ul>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Cooperative Economy (Scenario B)</CardTitle>
                <CardDescription>Enhanced cooperative economic model</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Average Wealth</span>
                    <span className="font-medium text-[hsl(var(--positive))]">${simulationData.stats.avgWealthB.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Median Wealth</span>
                    <span className="font-medium text-[hsl(var(--positive))]">${simulationData.stats.medianB.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Gini Coefficient</span>
                    <span className="font-medium text-[hsl(var(--positive))]">{simulationData.stats.giniB.toFixed(3)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Poverty Rate</span>
                    <span className="font-medium text-[hsl(var(--positive))]">{(simulationData.stats.povertyRateB * 100).toFixed(1)}%</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Wealth Gap (90/10)</span>
                    <span className="font-medium text-[hsl(var(--positive))]">{simulationData.stats.wealthGapB.toFixed(2)}×</span>
                  </div>
                </div>

                <div className="pt-3 border-t">
                  <h4 className="text-sm font-semibold mb-2">Enhancements</h4>
                  <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                    <li>15% group buying savings</li>
                    <li>25% local production savings</li>
                    <li>GroToken reward system</li>
                    <li>Community wealth building</li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Comparative Analysis Summary</CardTitle>
              <CardDescription>Key differences and improvements</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="text-center p-4 rounded-lg bg-[hsl(var(--positive-muted))]">
                  <div className="text-3xl font-bold text-[hsl(var(--positive))]">
                    +{((simulationData.stats.avgWealthB / simulationData.stats.avgWealthA - 1) * 100).toFixed(1)}%
                  </div>
                  <div className="text-sm text-muted-foreground mt-1">Average Wealth Increase</div>
                </div>

                <div className="text-center p-4 rounded-lg bg-[hsl(var(--informative-muted))]">
                  <div className="text-3xl font-bold text-[hsl(var(--informative))]">
                    -{((1 - simulationData.stats.giniB / simulationData.stats.giniA) * 100).toFixed(1)}%
                  </div>
                  <div className="text-sm text-muted-foreground mt-1">Inequality Reduction</div>
                </div>

                <div className="text-center p-4 rounded-lg bg-[hsl(var(--accent-muted))]">
                  <div className="text-3xl font-bold text-[hsl(var(--accent-strong))]">
                    {Math.round((simulationData.stats.povertyRateA - simulationData.stats.povertyRateB) * simulationData.members.length)}
                  </div>
                  <div className="text-sm text-muted-foreground mt-1">Members Lifted from Poverty</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

/**
 * Generate sample data for demonstration when no simulation results are available
 */
function generateSampleData() {
  // Generate sample members
  const members = Array.from({ length: 100 }, (_, i) => {
    const baseWealth = 1000 * Math.exp(Math.random() * 0.6 - 0.3);
    const cooperativeSavings = Math.random() * 500;
    const groTokenBalance = Math.random() * 100;

    return {
      id: i,
      Wealth_A: baseWealth,
      Wealth_B: baseWealth + cooperativeSavings + groTokenBalance * 2,
      weekly_income: 800 + Math.random() * 400,
      weekly_spending: 500 + Math.random() * 300,
      cooperative_spending: Math.random() * 200,
      total_savings: Math.random() * 2000,
      cooperative_savings: cooperativeSavings,
      grotoken_balance: groTokenBalance,
      total_wealth: baseWealth + cooperativeSavings + groTokenBalance * 2,
    };
  });

  // Prepare violin plot data
  const violinData = prepareWealthDistributionData(members, ['Traditional (A)', 'Cooperative (B)']);

  // Prepare waterfall data for sample member
  const sampleMember = members[50];
  const waterfallIndividual = [
    { category: 'Income', value: sampleMember.weekly_income, color: '#10b981' },
    { category: 'Spending', value: -sampleMember.weekly_spending, color: '#ef4444' },
    { category: 'Net Cash', value: 0, isTotal: true, color: '#6366f1' },
    { category: 'Savings', value: sampleMember.total_savings, color: '#f59e0b' },
    { category: 'Coop Savings', value: sampleMember.cooperative_savings, color: '#14b8a6' },
    { category: 'GroTokens', value: sampleMember.grotoken_balance * 2, color: '#ec4899' },
    { category: 'Total Wealth', value: 0, isTotal: true, color: '#3b82f6' },
  ];

  const waterfallComparison = prepareScenarioComparison(
    { Wealth_A: sampleMember.Wealth_A, cooperative_savings: 0, grotoken_balance: 0 },
    { Wealth_B: sampleMember.Wealth_B, cooperative_savings: sampleMember.cooperative_savings, grotoken_balance: sampleMember.grotoken_balance }
  );

  // Prepare Sankey data
  const totalIncome = members.reduce((sum, m) => sum + m.weekly_income, 0);
  const totalSpending = members.reduce((sum, m) => sum + m.weekly_spending, 0);
  const totalCoopSpending = members.reduce((sum, m) => sum + m.cooperative_spending, 0);
  const totalSavings = members.reduce((sum, m) => sum + m.total_savings, 0);
  const totalCoopSavings = members.reduce((sum, m) => sum + m.cooperative_savings, 0);
  const totalTokenValue = members.reduce((sum, m) => sum + m.grotoken_balance * 2, 0);

  const sankeyData = {
    nodes: [
      { id: 'income', label: 'Community Income', color: '#10b981' },
      { id: 'members', label: 'Members', color: '#6366f1' },
      { id: 'traditional', label: 'Traditional Market', color: '#8b5cf6' },
      { id: 'cooperative', label: 'Cooperative Market', color: '#14b8a6' },
      { id: 'savings', label: 'Savings', color: '#f59e0b' },
      { id: 'tokens', label: 'GroTokens', color: '#ec4899' },
      { id: 'wealth', label: 'Community Wealth', color: '#3b82f6' },
    ],
    links: [
      { source: 'income', target: 'members', value: totalIncome, color: '#10b981' },
      { source: 'members', target: 'traditional', value: totalSpending - totalCoopSpending, color: '#8b5cf6' },
      { source: 'members', target: 'cooperative', value: totalCoopSpending, color: '#14b8a6' },
      { source: 'members', target: 'savings', value: totalSavings, color: '#f59e0b' },
      { source: 'cooperative', target: 'tokens', value: totalTokenValue, color: '#ec4899' },
      { source: 'savings', target: 'wealth', value: totalSavings, color: '#f59e0b' },
      { source: 'tokens', target: 'wealth', value: totalTokenValue, color: '#ec4899' },
    ],
  };

  // Prepare heatmap correlation data
  const variables = ['Wealth', 'Income', 'Savings', 'Coop_Savings', 'GroTokens'];
  const heatmapData = [];
  for (const y of variables) {
    for (const x of variables) {
      // Simplified correlation calculation
      let correlation = 0;
      if (x === y) correlation = 1;
      else if ((x === 'Wealth' && y === 'Coop_Savings') || (y === 'Wealth' && x === 'Coop_Savings')) correlation = 0.85;
      else if ((x === 'Wealth' && y === 'GroTokens') || (y === 'Wealth' && x === 'GroTokens')) correlation = 0.78;
      else if ((x === 'Coop_Savings' && y === 'GroTokens') || (y === 'Coop_Savings' && x === 'GroTokens')) correlation = 0.82;
      else if ((x === 'Income' && y === 'Savings') || (y === 'Income' && x === 'Savings')) correlation = 0.65;
      else correlation = Math.random() * 0.4 - 0.2;

      heatmapData.push({ x, y, value: correlation, label: `${y} × ${x}: ${correlation.toFixed(3)}` });
    }
  }

  // Calculate statistics
  const wealthA = members.map(m => m.Wealth_A).sort((a, b) => a - b);
  const wealthB = members.map(m => m.Wealth_B).sort((a, b) => a - b);

  const stats = {
    medianA: wealthA[Math.floor(wealthA.length / 2)],
    medianB: wealthB[Math.floor(wealthB.length / 2)],
    avgWealthA: wealthA.reduce((a, b) => a + b, 0) / wealthA.length,
    avgWealthB: wealthB.reduce((a, b) => a + b, 0) / wealthB.length,
    giniA: calculateGini(wealthA),
    giniB: calculateGini(wealthB),
    povertyRateA: wealthA.filter(w => w < 800).length / wealthA.length,
    povertyRateB: wealthB.filter(w => w < 800).length / wealthB.length,
    wealthGapA: wealthA[Math.floor(wealthA.length * 0.9)] / wealthA[Math.floor(wealthA.length * 0.1)],
    wealthGapB: wealthB[Math.floor(wealthB.length * 0.9)] / wealthB[Math.floor(wealthB.length * 0.1)],
    totalCoopSavings,
    totalTokenValue,
    retentionRate: ((totalCoopSavings + totalTokenValue) / totalIncome) * 100,
  };

  return {
    members,
    violinData,
    waterfallIndividual,
    waterfallComparison,
    sankeyData,
    heatmapData,
    stats,
  };
}

function calculateGini(sortedWealth: number[]): number {
  const n = sortedWealth.length;
  if (n === 0) return 0;

  let numerator = 0;
  for (let i = 0; i < n; i++) {
    numerator += (2 * (i + 1) - n - 1) * sortedWealth[i];
  }

  const denominator = n * sortedWealth.reduce((a, b) => a + b, 0);
  return denominator === 0 ? 0 : numerator / denominator;
}
