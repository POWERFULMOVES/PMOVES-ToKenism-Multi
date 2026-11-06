import React from 'react';
import { Card, CardContent } from './card';
import { MathModelService } from '@/lib/services/math-model.service';
import { formatCurrency, formatPercentage } from '@/lib/utils/formatters';
import { InfoCircledIcon } from '@radix-ui/react-icons';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './tooltip';

interface ExpectedBenefitsProps {
  params: Record<string, number>;
}

export function ExpectedBenefits({ params }: ExpectedBenefitsProps) {
  // Calculate expected benefits
  const expectedBenefitPerMember = MathModelService.calculateExpectedBenefitPerMember(params);
  const expectedWeeklyBenefit = MathModelService.calculateExpectedWeeklyBenefit(params);
  const errorThreshold = MathModelService.determineErrorThreshold(params);
  const isDownturn = MathModelService.isEconomicDownturnScenario(params);
  
  return (
    <Card className="mt-4">
      <CardContent className="pt-6">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-medium">Expected Benefits</h3>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  tabIndex={-1}
                  aria-label="More information about expected benefits"
                  className="text-muted-foreground cursor-help"
                >
                  <InfoCircledIcon className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs" forceMount>
                <p>These are the expected benefits based on our mathematical model.</p>
                <p className="text-xs mt-1">The model has a margin of error of {formatPercentage(errorThreshold)}.</p>
                {isDownturn && (
                  <p className="text-xs mt-1 text-blue-500">Note: Economic downturn scenarios often show greater benefits than predicted.</p>
                )}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        
        <div className="text-sm space-y-2">
          <div className="flex justify-between">
            <span>Expected benefit per member:</span>
            <span className="font-medium">{formatCurrency(expectedBenefitPerMember)}</span>
          </div>
          <div className="flex justify-between">
            <span>Expected weekly benefit:</span>
            <span className="font-medium">{formatCurrency(expectedWeeklyBenefit)}</span>
          </div>
          <div className="flex justify-between mt-1">
            <span>Confidence level:</span>
            <span className={`font-medium ${isDownturn ? 'text-blue-500' : ''}`}>
              {isDownturn ? 'Economic Downturn' : MathModelService.getConfidenceLevel(90).toUpperCase()}
            </span>
          </div>
        </div>
        
        {isDownturn && (
          <div className="mt-3 text-xs text-blue-600 bg-blue-50 p-2 rounded">
            Economic downturn scenarios often show greater benefits than predicted due to the increased importance of mutual aid during challenging times.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
