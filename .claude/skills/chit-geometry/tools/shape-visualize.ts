#!/usr/bin/env npx ts-node
/**
 * Shape Visualization Helper
 *
 * Generates ASCII and SVG visualizations of CHIT geometry shapes.
 * Part of the chit-geometry skill toolset.
 *
 * Usage:
 *   npx ts-node shape-visualize.ts --input cgp.json --format ascii
 *   npx ts-node shape-visualize.ts --input cgp.json --format svg --output shape.svg
 */

import * as fs from 'fs';
import * as path from 'path';

interface DirichletWeights {
  alpha: number[];
}

interface HyperbolicCoords {
  curvature: number;
  position: [number, number, number];
}

interface ShapeAttribution {
  agent_id: string;
  contribution_weight: number;
  shape_signature: string;
}

interface CGPDocument {
  packet_id: string;
  dirichlet: DirichletWeights;
  hyperbolic: HyperbolicCoords;
  attributions: ShapeAttribution[];
}

type OutputFormat = 'ascii' | 'svg' | 'json';

interface SimplexPoint {
  x: number;
  y: number;
  label: string;
  weight: number;
}

// Convert Dirichlet weights to 2D simplex coordinates (for 3D alpha)
function dirichletToSimplex(alpha: number[]): SimplexPoint[] {
  if (alpha.length < 2) return [];

  // Normalize alpha to get proportions
  const sum = alpha.reduce((a, b) => a + b, 0);
  const proportions = alpha.map((a) => a / sum);

  // For 3D, use barycentric coordinates in equilateral triangle
  if (alpha.length === 3) {
    const [a, b, c] = proportions;
    // Vertices of equilateral triangle centered at origin
    const v1 = { x: 0, y: 1 };       // top
    const v2 = { x: -0.866, y: -0.5 }; // bottom left
    const v3 = { x: 0.866, y: -0.5 };  // bottom right

    return [
      { x: v1.x, y: v1.y, label: 'A', weight: proportions[0] },
      { x: v2.x, y: v2.y, label: 'B', weight: proportions[1] },
      { x: v3.x, y: v3.y, label: 'C', weight: proportions[2] },
      {
        x: a * v1.x + b * v2.x + c * v3.x,
        y: a * v1.y + b * v2.y + c * v3.y,
        label: 'P',
        weight: 1,
      },
    ];
  }

  // For higher dimensions, project to 2D using first two principal components
  return proportions.map((p, i) => ({
    x: Math.cos((2 * Math.PI * i) / alpha.length) * p,
    y: Math.sin((2 * Math.PI * i) / alpha.length) * p,
    label: String.fromCharCode(65 + i),
    weight: p,
  }));
}

// Generate ASCII art visualization
function generateASCII(doc: CGPDocument): string {
  const width = 60;
  const height = 30;
  const grid: string[][] = Array(height).fill(null).map(() => Array(width).fill(' '));

  // Draw border
  for (let x = 0; x < width; x++) {
    grid[0][x] = '-';
    grid[height - 1][x] = '-';
  }
  for (let y = 0; y < height; y++) {
    grid[y][0] = '|';
    grid[y][width - 1] = '|';
  }

  // Get simplex points
  const points = dirichletToSimplex(doc.dirichlet.alpha);
  const centerX = Math.floor(width / 2);
  const centerY = Math.floor(height / 2);
  const scale = Math.min(width, height) / 3;

  // Plot points
  points.forEach((p) => {
    const px = Math.floor(centerX + p.x * scale);
    const py = Math.floor(centerY - p.y * scale); // Flip Y for ASCII
    if (px >= 1 && px < width - 1 && py >= 1 && py < height - 1) {
      grid[py][px] = p.label;
      // Add weight indicator
      const weightStr = (p.weight * 100).toFixed(0) + '%';
      for (let i = 0; i < weightStr.length && px + 1 + i < width - 1; i++) {
        grid[py][px + 1 + i] = weightStr[i];
      }
    }
  });

  // Draw simplex edges (for 3D case)
  if (points.length >= 3) {
    const drawLine = (p1: SimplexPoint, p2: SimplexPoint, char: string) => {
      const steps = 20;
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const x = Math.floor(centerX + (p1.x + t * (p2.x - p1.x)) * scale);
        const y = Math.floor(centerY - (p1.y + t * (p2.y - p1.y)) * scale);
        if (x >= 1 && x < width - 1 && y >= 1 && y < height - 1 && grid[y][x] === ' ') {
          grid[y][x] = char;
        }
      }
    };

    drawLine(points[0], points[1], '.');
    drawLine(points[1], points[2], '.');
    drawLine(points[2], points[0], '.');
  }

  // Add header info
  const lines = [
    `CHIT Shape Visualization: ${doc.packet_id}`,
    `Dirichlet Alpha: [${doc.dirichlet.alpha.map((a) => a.toFixed(3)).join(', ')}]`,
    `Hyperbolic Curvature: ${doc.hyperbolic.curvature}`,
    `Attributions: ${doc.attributions.length}`,
    '',
    grid.map((row) => row.join('')).join('\n'),
    '',
    'Legend: A,B,C = simplex vertices, P = distribution point',
  ];

  return lines.join('\n');
}

// Generate SVG visualization
function generateSVG(doc: CGPDocument): string {
  const width = 400;
  const height = 400;
  const centerX = width / 2;
  const centerY = height / 2;
  const scale = 150;

  const points = dirichletToSimplex(doc.dirichlet.alpha);

  // Color palette for attributions
  const colors = ['#3498db', '#e74c3c', '#2ecc71', '#f39c12', '#9b59b6', '#1abc9c'];

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}">
  <style>
    .label { font-family: monospace; font-size: 12px; }
    .title { font-family: sans-serif; font-size: 14px; font-weight: bold; }
    .weight { font-family: monospace; font-size: 10px; fill: #666; }
  </style>
  <rect width="100%" height="100%" fill="#f8f9fa"/>
  <text x="${centerX}" y="20" class="title" text-anchor="middle">${doc.packet_id}</text>`;

  // Draw simplex edges
  if (points.length >= 3) {
    for (let i = 0; i < 3; i++) {
      const p1 = points[i];
      const p2 = points[(i + 1) % 3];
      const x1 = centerX + p1.x * scale;
      const y1 = centerY - p1.y * scale;
      const x2 = centerX + p2.x * scale;
      const y2 = centerY - p2.y * scale;
      svg += `\n  <line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#ccc" stroke-width="1"/>`;
    }
  }

  // Draw vertices
  points.forEach((p, i) => {
    const x = centerX + p.x * scale;
    const y = centerY - p.y * scale;
    const color = p.label === 'P' ? '#e74c3c' : '#3498db';
    const radius = p.label === 'P' ? 8 : 6;

    svg += `\n  <circle cx="${x}" cy="${y}" r="${radius}" fill="${color}"/>`;
    svg += `\n  <text x="${x + 12}" y="${y + 4}" class="label">${p.label}</text>`;
    svg += `\n  <text x="${x + 12}" y="${y + 16}" class="weight">${(p.weight * 100).toFixed(1)}%</text>`;
  });

  // Draw attribution pie chart
  const pieX = width - 60;
  const pieY = height - 60;
  const pieR = 40;
  let startAngle = 0;

  doc.attributions.slice(0, 6).forEach((attr, i) => {
    const angle = attr.contribution_weight * 2 * Math.PI;
    const endAngle = startAngle + angle;

    const x1 = pieX + pieR * Math.cos(startAngle);
    const y1 = pieY + pieR * Math.sin(startAngle);
    const x2 = pieX + pieR * Math.cos(endAngle);
    const y2 = pieY + pieR * Math.sin(endAngle);

    const largeArc = angle > Math.PI ? 1 : 0;
    const pathD = `M ${pieX} ${pieY} L ${x1} ${y1} A ${pieR} ${pieR} 0 ${largeArc} 1 ${x2} ${y2} Z`;

    svg += `\n  <path d="${pathD}" fill="${colors[i % colors.length]}" stroke="white" stroke-width="1"/>`;
    startAngle = endAngle;
  });

  svg += `\n  <text x="${pieX}" y="${pieY + pieR + 15}" class="weight" text-anchor="middle">Attributions</text>`;

  // Hyperbolic curvature indicator
  svg += `\n  <text x="10" y="${height - 10}" class="weight">K = ${doc.hyperbolic.curvature}</text>`;

  svg += '\n</svg>';
  return svg;
}

// Generate JSON summary
function generateJSON(doc: CGPDocument): string {
  const points = dirichletToSimplex(doc.dirichlet.alpha);
  return JSON.stringify(
    {
      packet_id: doc.packet_id,
      simplex_points: points,
      hyperbolic: doc.hyperbolic,
      attribution_summary: doc.attributions.map((a) => ({
        agent: a.agent_id,
        weight: a.contribution_weight,
      })),
    },
    null,
    2
  );
}

async function main() {
  const args = process.argv.slice(2);
  let inputPath = '';
  let outputPath = '';
  let format: OutputFormat = 'ascii';

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--input':
        inputPath = args[++i];
        break;
      case '--output':
        outputPath = args[++i];
        break;
      case '--format':
        format = args[++i] as OutputFormat;
        break;
    }
  }

  if (!inputPath) {
    console.error('[shape-viz] Usage: shape-visualize.ts --input <file> [--format ascii|svg|json] [--output <file>]');
    process.exit(1);
  }

  if (!fs.existsSync(inputPath)) {
    console.error(`[shape-viz] Input file not found: ${inputPath}`);
    process.exit(1);
  }

  const content = fs.readFileSync(inputPath, 'utf-8');
  const doc = JSON.parse(content) as CGPDocument;

  let output: string;
  switch (format) {
    case 'svg':
      output = generateSVG(doc);
      break;
    case 'json':
      output = generateJSON(doc);
      break;
    case 'ascii':
    default:
      output = generateASCII(doc);
  }

  if (outputPath) {
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(outputPath, output);
    console.log(`[shape-viz] Exported to ${outputPath}`);
  } else {
    console.log(output);
  }
}

main();

export { generateASCII, generateSVG, dirichletToSimplex };
