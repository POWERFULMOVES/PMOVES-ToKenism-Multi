/**
 * Sankey Diagram Component
 * Displays flow of money through the economic system
 */

'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

export interface SankeyNode {
  id: string;
  label: string;
  color?: string;
}

export interface SankeyLink {
  source: string;
  target: string;
  value: number;
  color?: string;
}

export interface SankeyDiagramProps {
  nodes: SankeyNode[];
  links: SankeyLink[];
  title?: string;
  description?: string;
  height?: number;
}

function EmptyChartState({ message = "No data available" }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-[300px] text-muted-foreground">
      <svg className="h-12 w-12 mb-3 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
      </svg>
      <p className="text-sm">{message}</p>
      <p className="text-xs mt-1">Run a simulation to see the economic flow diagram.</p>
    </div>
  );
}

export function SankeyDiagram({
  nodes,
  links,
  title = "Economic Flow Diagram",
  description,
  height = 500,
}: SankeyDiagramProps) {
  // Handle empty data
  if (!nodes || nodes.length === 0 || !links || links.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          {description && <CardDescription>{description}</CardDescription>}
        </CardHeader>
        <CardContent>
          <EmptyChartState message="No flow data available" />
        </CardContent>
      </Card>
    );
  }

  // SVG dimensions
  const width = 900;
  const margin = { top: 20, right: 150, bottom: 20, left: 150 };
  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;

  // Calculate node positions and heights
  const nodeMap = new Map<string, any>();
  const nodeColumns = new Map<number, string[]>();

  // Assign nodes to columns based on their position in the flow
  nodes.forEach((node, index) => {
    const column = Math.floor((index / nodes.length) * 3); // Simple 3-column layout
    if (!nodeColumns.has(column)) {
      nodeColumns.set(column, []);
    }
    nodeColumns.get(column)!.push(node.id);
  });

  // Calculate node metrics
  const nodeValues = new Map<string, { incoming: number; outgoing: number }>();
  links.forEach(link => {
    const source = nodeValues.get(link.source) || { incoming: 0, outgoing: 0 };
    const target = nodeValues.get(link.target) || { incoming: 0, outgoing: 0 };

    source.outgoing += link.value;
    target.incoming += link.value;

    nodeValues.set(link.source, source);
    nodeValues.set(link.target, target);
  });

  // Position nodes
  let yOffset = margin.top;
  const nodeHeight = plotHeight / Math.max(...Array.from(nodeColumns.values()).map(col => col.length));
  const columnWidth = plotWidth / (nodeColumns.size - 1 || 1);

  nodeColumns.forEach((nodeIds, column) => {
    const x = margin.left + column * columnWidth;
    let y = margin.top;

    nodeIds.forEach(nodeId => {
      const node = nodes.find(n => n.id === nodeId)!;
      const values = nodeValues.get(nodeId) || { incoming: 0, outgoing: 0 };
      const totalValue = Math.max(values.incoming, values.outgoing, 1);
      const height = Math.max((totalValue / 10000) * plotHeight, 30); // Scale based on value

      nodeMap.set(nodeId, {
        ...node,
        x,
        y,
        width: 20,
        height,
        totalValue,
      });

      y += height + 20; // Spacing between nodes
    });
  });

  // Generate link paths (Bezier curves)
  const generatePath = (link: SankeyLink): string => {
    const sourceNode = nodeMap.get(link.source);
    const targetNode = nodeMap.get(link.target);

    if (!sourceNode || !targetNode) return '';

    const x0 = sourceNode.x + sourceNode.width;
    const x1 = targetNode.x;
    const y0 = sourceNode.y + sourceNode.height / 2;
    const y1 = targetNode.y + targetNode.height / 2;

    const curvature = 0.5;
    const xi = (x0 + x1) / 2;
    const x2 = xi;
    const x3 = xi;

    return `M${x0},${y0} C${x2},${y0} ${x3},${y1} ${x1},${y1}`;
  };

  // Calculate max link value for stroke width scaling
  const maxLinkValue = Math.max(...links.map(l => l.value), 1);

  // Default colors
  const defaultNodeColor = '#6366f1';
  const defaultLinkColor = '#94a3b8';

  return (
    <Card>
      {(title || description) && (
        <CardHeader>
          {title && <CardTitle>{title}</CardTitle>}
          {description && <CardDescription>{description}</CardDescription>}
        </CardHeader>
      )}
      <CardContent>
        <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}>
          {/* Links (draw first so they appear behind nodes) */}
          {links.map((link, index) => {
            const strokeWidth = Math.max((link.value / maxLinkValue) * 30, 2);
            const path = generatePath(link);

            return (
              <g key={`link-${index}`}>
                <path
                  d={path}
                  fill="none"
                  stroke={link.color || defaultLinkColor}
                  strokeWidth={strokeWidth}
                  opacity="0.4"
                  className="transition-opacity hover:opacity-70"
                >
                  <title>
                    {`${link.source} → ${link.target}\nValue: $${link.value.toFixed(2)}`}
                  </title>
                </path>
              </g>
            );
          })}

          {/* Nodes */}
          {Array.from(nodeMap.entries()).map(([id, node]) => (
            <g key={id}>
              {/* Node rectangle */}
              <rect
                x={node.x}
                y={node.y}
                width={node.width}
                height={node.height}
                fill={node.color || defaultNodeColor}
                stroke="white"
                strokeWidth="2"
                className="transition-opacity hover:opacity-100"
                opacity="0.9"
              >
                <title>
                  {`${node.label}\nTotal Flow: $${node.totalValue.toFixed(2)}`}
                </title>
              </rect>

              {/* Node label */}
              <text
                x={node.x + node.width + 10}
                y={node.y + node.height / 2}
                dominantBaseline="middle"
                className="text-sm fill-current font-medium"
              >
                {node.label}
              </text>

              {/* Value label */}
              <text
                x={node.x + node.width + 10}
                y={node.y + node.height / 2 + 15}
                dominantBaseline="middle"
                className="text-xs fill-current opacity-70"
              >
                ${node.totalValue.toFixed(0)}
              </text>
            </g>
          ))}
        </svg>

        {/* Legend */}
        <div className="mt-4 text-sm text-muted-foreground text-center">
          <p>Flow width represents transaction volume. Hover over nodes and flows for details.</p>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Helper to prepare economic system flow data from simulation
 */
export function prepareEconomicFlowData(
  results: any,
  weekIndex: number = -1 // -1 for final week
): { nodes: SankeyNode[]; links: SankeyLink[] } {
  const week = weekIndex === -1
    ? results.history[results.history.length - 1]
    : results.history[weekIndex];

  const members = results.final_members || [];

  // Calculate aggregate values
  const totalIncome = members.reduce((sum: number, m: any) => sum + (m.weekly_income || 0), 0);
  const totalSpending = members.reduce((sum: number, m: any) => sum + (m.weekly_spending || 0), 0);
  const totalSavings = members.reduce((sum: number, m: any) => sum + (m.total_savings || 0), 0);
  const cooperativeSpending = members.reduce((sum: number, m: any) => sum + (m.cooperative_spending || 0), 0);
  const traditionalSpending = totalSpending - cooperativeSpending;
  const groupBuyingSavings = members.reduce((sum: number, m: any) => sum + (m.cooperative_savings || 0), 0);
  const tokenValue = members.reduce((sum: number, m: any) => sum + (m.grotoken_balance || 0) * 2, 0);

  const nodes: SankeyNode[] = [
    { id: 'income', label: 'Income', color: '#10b981' },
    { id: 'members', label: 'Community Members', color: '#6366f1' },
    { id: 'traditional', label: 'Traditional Market', color: '#8b5cf6' },
    { id: 'cooperative', label: 'Cooperative Market', color: '#14b8a6' },
    { id: 'savings', label: 'Savings', color: '#f59e0b' },
    { id: 'tokens', label: 'GroTokens', color: '#ec4899' },
    { id: 'wealth', label: 'Total Wealth', color: '#3b82f6' },
  ];

  const links: SankeyLink[] = [
    {
      source: 'income',
      target: 'members',
      value: totalIncome,
      color: '#10b981',
    },
    {
      source: 'members',
      target: 'traditional',
      value: traditionalSpending,
      color: '#8b5cf6',
    },
    {
      source: 'members',
      target: 'cooperative',
      value: cooperativeSpending,
      color: '#14b8a6',
    },
    {
      source: 'members',
      target: 'savings',
      value: totalSavings,
      color: '#f59e0b',
    },
    {
      source: 'cooperative',
      target: 'tokens',
      value: tokenValue,
      color: '#ec4899',
    },
    {
      source: 'savings',
      target: 'wealth',
      value: totalSavings,
      color: '#f59e0b',
    },
    {
      source: 'tokens',
      target: 'wealth',
      value: tokenValue,
      color: '#ec4899',
    },
  ];

  return { nodes, links };
}

/**
 * Helper to prepare individual member flow
 */
export function prepareMemberFlowData(member: any): { nodes: SankeyNode[]; links: SankeyLink[] } {
  const income = member.weekly_income || 1000;
  const spending = member.weekly_spending || 600;
  const cooperativeSpending = member.cooperative_spending || 0;
  const traditionalSpending = spending - cooperativeSpending;
  const savings = member.total_savings || 0;
  const cooperativeSavings = member.cooperative_savings || 0;
  const tokenValue = (member.grotoken_balance || 0) * 2;

  const nodes: SankeyNode[] = [
    { id: 'income', label: 'Weekly Income', color: '#10b981' },
    { id: 'spending', label: 'Total Spending', color: '#ef4444' },
    { id: 'traditional', label: 'Traditional Purchases', color: '#8b5cf6' },
    { id: 'cooperative', label: 'Cooperative Purchases', color: '#14b8a6' },
    { id: 'savings', label: 'Cash Savings', color: '#f59e0b' },
    { id: 'coop_savings', label: 'Coop Savings', color: '#14b8a6' },
    { id: 'tokens', label: 'GroTokens', color: '#ec4899' },
    { id: 'wealth', label: 'Net Wealth', color: '#3b82f6' },
  ];

  const links: SankeyLink[] = [
    {
      source: 'income',
      target: 'spending',
      value: spending,
      color: '#ef4444',
    },
    {
      source: 'spending',
      target: 'traditional',
      value: traditionalSpending,
      color: '#8b5cf6',
    },
    {
      source: 'spending',
      target: 'cooperative',
      value: cooperativeSpending,
      color: '#14b8a6',
    },
    {
      source: 'income',
      target: 'savings',
      value: savings,
      color: '#f59e0b',
    },
    {
      source: 'cooperative',
      target: 'coop_savings',
      value: cooperativeSavings,
      color: '#14b8a6',
    },
    {
      source: 'cooperative',
      target: 'tokens',
      value: tokenValue,
      color: '#ec4899',
    },
    {
      source: 'savings',
      target: 'wealth',
      value: savings,
      color: '#f59e0b',
    },
    {
      source: 'coop_savings',
      target: 'wealth',
      value: cooperativeSavings,
      color: '#14b8a6',
    },
    {
      source: 'tokens',
      target: 'wealth',
      value: tokenValue,
      color: '#ec4899',
    },
  ];

  return { nodes, links };
}
