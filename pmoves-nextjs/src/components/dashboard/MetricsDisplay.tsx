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
    if (trend > 0) return 'text-green-600 dark:text-green-400';
    if (trend < 0) return 'text-red-600 dark:text-red-400';
    return 'text-muted-foreground';
  };

  const getScoreColor = (score: number) => {
    if (score >= 0.8) return 'text-green-600 dark:text-green-400';
    if (score >= 0.6) return 'text-blue-600 dark:text-blue-400';
    if (score >= 0.4) return 'text-amber-600 dark:text-amber-400';
    return 'text-red-600 dark:text-red-400';
  };

  const getScoreBgColor = (score: number) => {
    if (score >= 0.8) return 'bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-900';
    if (score >= 0.6) return 'bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-900';
    if (score >= 0.4) return 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900';
    return 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-900';
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className={`card-hover animate-slide-up stagger-1 transition-all duration-200 ${getScoreBgColor(metrics.health_score)}`}>
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
            <div className="flex items-baseline gap-2 mb-2">
              <span className={`text-3xl font-bold tracking-tight ${getScoreColor(metrics.health_score)}`}>
                {formatPercentage(metrics.health_score)}
              </span>
              <span className={`text-sm font-medium flex items-center gap-0.5 ${getTrendColor(metrics.trends.health_trend)}`}>
                {getTrendIcon(metrics.trends.health_trend)}
                <span className="text-xs">vs last week</span>
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

        <Card className={`card-hover animate-slide-up stagger-2 transition-all duration-200 ${getScoreBgColor(metrics.market_efficiency)}`}>
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
            <div className="flex items-baseline gap-2 mb-2">
              <span className={`text-3xl font-bold tracking-tight ${getScoreColor(metrics.market_efficiency)}`}>
                {formatPercentage(metrics.market_efficiency)}
              </span>
              <span className={`text-sm font-medium flex items-center gap-0.5 ${getTrendColor(metrics.trends.efficiency_trend)}`}>
                {getTrendIcon(metrics.trends.efficiency_trend)}
                <span className="text-xs">vs last week</span>
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

        <Card className={`card-hover animate-slide-up stagger-3 transition-all duration-200 ${getScoreBgColor(metrics.resilience_score)}`}>
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
            <div className="flex items-baseline gap-2 mb-2">
              <span className={`text-3xl font-bold tracking-tight ${getScoreColor(metrics.resilience_score)}`}>
                {formatPercentage(metrics.resilience_score)}
              </span>
              <span className={`text-sm font-medium flex items-center gap-0.5 ${getTrendColor(metrics.trends.resilience_trend)}`}>
                {getTrendIcon(metrics.trends.resilience_trend)}
                <span className="text-xs">vs last week</span>
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {metrics.warnings && metrics.warnings.length > 0 && (
          <div className="p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-lg animate-fade-in" role="alert" aria-label="Warnings">
            <h4 className="font-semibold text-amber-800 dark:text-amber-200 mb-2 flex items-center gap-2">
              <span className="text-lg">⚠️</span>
              Warnings
            </h4>
            <ul className="space-y-1 text-sm text-amber-700 dark:text-amber-300">
              {metrics.warnings.map((warning: string, index: number) => (
                <li key={warning.substring(0, 20)} className={`flex items-start gap-2 stagger-${index + 1}`}>
                  <span className="text-amber-500 mt-0.5">•</span>
                  <span>{warning}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {metrics.recommendations && metrics.recommendations.length > 0 && (
          <div className="p-4 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900 rounded-lg animate-fade-in" role="complementary" aria-label="Recommendations">
            <h4 className="font-semibold text-blue-800 dark:text-blue-200 mb-2 flex items-center gap-2">
              <span className="text-lg">💡</span>
              Recommendations
            </h4>
            <ul className="space-y-1 text-sm text-blue-700 dark:text-blue-300">
              {metrics.recommendations.map((recommendation: string, index: number) => (
                <li key={recommendation.substring(0, 20)} className={`flex items-start gap-2 stagger-${index + 1}`}>
                  <span className="text-blue-500 mt-0.5">•</span>
                  <span>{recommendation}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}