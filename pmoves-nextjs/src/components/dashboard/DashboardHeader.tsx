/**
 * Dashboard Header Component
 * Displays the main dashboard header with title and description
 */

'use client';

import { InfoCircledIcon } from '@radix-ui/react-icons';
import { TooltipProvider, Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface DashboardHeaderProps {
  title?: string;
  description?: string;
}

export function DashboardHeader({ 
  title = "Economic Dashboard", 
  description = "Monitor key economic indicators, run custom scenarios, and test system resilience to economic shocks."
}: DashboardHeaderProps) {
  return (
    <div className="bg-blue-50 p-4 rounded-lg border border-blue-200 mb-6">
      <h3 className="text-lg font-semibold mb-2 text-blue-800 flex items-center">
        {title}
        <Tooltip>
          <TooltipTrigger asChild>
            <InfoCircledIcon className="h-4 w-4 ml-2 text-blue-600 cursor-help" />
          </TooltipTrigger>
          <TooltipContent className="max-w-md">
            <p>This dashboard provides real-time metrics on the economic system, allows you to run custom scenarios, and test economic shocks.</p>
          </TooltipContent>
        </Tooltip>
      </h3>
      <p className="text-sm text-blue-700">
        {description}
      </p>
    </div>
  );
}