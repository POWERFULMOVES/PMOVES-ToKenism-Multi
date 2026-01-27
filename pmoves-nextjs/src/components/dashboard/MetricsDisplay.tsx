/**
 * Metrics Display Component
 * Displays current metrics with trend indicators and detailed information
 */

'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { InfoCircledIcon } from '@radix-ui/react-icons';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { formatPercentage } from '@/lib/utils/formatters';
import { EconomicIndicatorsChart } from './EconomicIndicatorsChart';
import { SystemBalanceChart } from './SystemBalanceChart';

interface MetricTrend {
  health_trend: number;
  efficiency_trend: number;
  resilience_trend: number;
}

interface CurrentMetrics {
  health_score: number;
  market_efficiency: number;
  resilience_score: number;
  trends: MetricTrend;
  warnings: string[];
  recommendations: string[];
}

interface MetricsDisplayProps {
  metrics: CurrentMetrics;
}

export function MetricsDisplay({ metrics }: MetricsDisplayProps) {
  const getTrendIcon = (trend: number) => {
    if (trend > 0) return '↑';
    if (trend < 0) return '↓';
    return '→';
  };

  const getTrendColor = (trend: number) => {
    if (trend > 0) return 'text-green-500';
    if (trend < 0) return 'text-red-500';
    return 'text-gray-500';
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center">
              System Health
              <Tooltip>
                <TooltipTrigger asChild>
                  <InfoCircledIcon className="h-4 w-4 ml-1 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent>
                  <p className="max-w-xs">A composite score (0-100%) measuring overall economic health based on wealth levels, distribution, and growth trends.</p>
                </TooltipContent>
              </Tooltip>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold mb-2">
              {formatPercentage(metrics.health_score)}
              <span className={`text-sm ml-2 ${getTrendColor(metrics.trends.health_trend)}`}>
                {getTrendIcon(metrics.trends.health_trend)}
              </span>
            </div>
            <p className="text-sm text-muted-foreground">
              Overall economic system health
            </p>
            <div className="text-xs text-muted-foreground mt-2">
              <p>Calculated from: wealth levels, inequality, poverty rate, and resilience</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center">
              Market Efficiency
              <Tooltip>
                <TooltipTrigger asChild>
                  <InfoCircledIcon className="h-4 w-4 ml-1 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent>
                  <p className="max-w-xs">Measures how effectively resources are allocated within the economy. Higher values indicate better matching of resources to needs.</p>
                </TooltipContent>
              </Tooltip>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold mb-2">
              {formatPercentage(metrics.market_efficiency)}
              <span className={`text-sm ml-2 ${getTrendColor(metrics.trends.efficiency_trend)}`}>
                {getTrendIcon(metrics.trends.efficiency_trend)}
              </span>
            </div>
            <p className="text-sm text-muted-foreground">
              Resource allocation efficiency
            </p>
            <div className="text-xs text-muted-foreground mt-2">
              <p>Calculated from: internal transaction volume, price stability, and distribution effectiveness</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center">
              Resilience Score
              <Tooltip>
                <TooltipTrigger asChild>
                  <InfoCircledIcon className="h-4 w-4 ml-1 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent>
                  <p className="max-w-xs">Measures the economy's ability to withstand and recover from economic shocks. Higher values indicate greater resilience.</p>
                </TooltipContent>
              </Tooltip>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold mb-2">
              {formatPercentage(metrics.resilience_score)}
              <span className={`text-sm ml-2 ${getTrendColor(metrics.trends.resilience_trend)}`}>
                {getTrendIcon(metrics.trends.resilience_trend)}
              </span>
            </div>
            <p className="text-sm text-muted-foreground">
              Ability to withstand economic shocks
            </p>
            <div className="text-xs text-muted-foreground mt-2">
              <p>Calculated from: wealth reserves, diversity of income sources, and community support mechanisms</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <EconomicIndicatorsChart 
          healthScore={metrics.health_score}
          marketEfficiency={metrics.market_efficiency}
          resilienceScore={metrics.resilience_score}
        />
        <SystemBalanceChart />
      </div>

      <div className="grid grid-cols-1 gap-4">
        {metrics.warnings && metrics.warnings.length > 0 && (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-md">
            <h4 className="font-medium text-amber-800 mb-1">Warnings</h4>
            <ul className="list-disc list-inside text-sm text-amber-700">
              {metrics.warnings.map((warning: string) => (
                <li key={warning.substring(0, 20)}>{warning}</li>
              ))}
            </ul>
          </div>
        )}

        {metrics.recommendations && metrics.recommendations.length > 0 && (
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
            <h4 className="font-medium text-blue-800 mb-1">Recommendations</h4>
            <ul className="list-disc list-inside text-sm text-blue-700">
              {metrics.recommendations.map((recommendation: string) => (
                <li key={recommendation.substring(0, 20)}>{recommendation}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}