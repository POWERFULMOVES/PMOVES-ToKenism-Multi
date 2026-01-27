/**
 * Chart Components Index
 * Exports all visualization components and their helper functions
 */

// Heatmap
export {
  HeatmapChart,
} from './HeatmapChart';
export type { HeatmapChartProps } from './HeatmapChart';

// Violin Plot
export {
  ViolinPlot,
  prepareWealthDistributionData,
} from './ViolinPlot';
export type { ViolinData, ViolinPlotProps } from './ViolinPlot';

// Waterfall Chart
export {
  WaterfallChart,
  prepareWealthFlowData,
  prepareScenarioComparison,
} from './WaterfallChart';
export type { WaterfallDataPoint, WaterfallChartProps } from './WaterfallChart';

// Sankey Diagram
export {
  SankeyDiagram,
  prepareEconomicFlowData,
  prepareMemberFlowData,
} from './SankeyDiagram';
export type { SankeyNode, SankeyLink, SankeyDiagramProps } from './SankeyDiagram';
