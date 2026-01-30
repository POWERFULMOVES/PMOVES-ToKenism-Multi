#!/usr/bin/env npx ts-node
/**
 * Service Discovery Tool
 *
 * Discovers and queries PMOVES services across the 6-tier architecture.
 * Part of the pmoves-integration skill toolset.
 *
 * Usage:
 *   npx ts-node service-discovery.ts
 *   npx ts-node service-discovery.ts --tier api
 *   npx ts-node service-discovery.ts --check-all
 */

import { spawnSync } from 'child_process';

interface ServiceEndpoint {
  name: string;
  tier: string;
  url: string;
  healthPath: string;
  description: string;
}

interface ServiceStatus {
  endpoint: ServiceEndpoint;
  available: boolean;
  latencyMs: number;
  statusCode?: number;
  error?: string;
}

interface DiscoveryResult {
  timestamp: string;
  services: ServiceStatus[];
  summary: {
    total: number;
    available: number;
    unavailable: number;
    byTier: Record<string, { total: number; available: number }>;
  };
}

// PMOVES 6-Tier Service Registry
const SERVICE_REGISTRY: ServiceEndpoint[] = [
  // DATA Tier
  {
    name: 'Supabase',
    tier: 'DATA',
    url: 'http://localhost:54321',
    healthPath: '/rest/v1/',
    description: 'PostgreSQL + PostgREST API',
  },
  {
    name: 'Neo4j',
    tier: 'DATA',
    url: 'http://localhost:7474',
    healthPath: '/',
    description: 'Graph database for relationships',
  },
  {
    name: 'ClickHouse',
    tier: 'DATA',
    url: 'http://localhost:8123',
    healthPath: '/ping',
    description: 'Analytics OLAP database',
  },

  // API Tier
  {
    name: 'Flask Backend',
    tier: 'API',
    url: 'http://localhost:5000',
    healthPath: '/healthz',
    description: 'PMOVES simulation API',
  },
  {
    name: 'Next.js API',
    tier: 'API',
    url: 'http://localhost:3000',
    healthPath: '/api/health',
    description: 'Frontend API routes',
  },

  // LLM Tier
  {
    name: 'TensorZero',
    tier: 'LLM',
    url: 'http://localhost:8000',
    healthPath: '/health',
    description: 'LLM gateway and routing',
  },

  // WORKER Tier
  {
    name: 'NATS',
    tier: 'WORKER',
    url: 'http://localhost:8222',
    healthPath: '/varz',
    description: 'Message queue for GEOMETRY BUS',
  },

  // MEDIA Tier
  {
    name: 'ComfyUI',
    tier: 'MEDIA',
    url: 'http://localhost:8188',
    healthPath: '/system_stats',
    description: 'Image generation pipeline',
  },

  // AGENT Tier
  {
    name: 'Agent Zero',
    tier: 'AGENT',
    url: 'http://localhost:8001',
    healthPath: '/health',
    description: 'Autonomous agent framework',
  },
  {
    name: 'MCP Server',
    tier: 'AGENT',
    url: 'http://localhost:3001',
    healthPath: '/health',
    description: 'Model Context Protocol server',
  },
];

async function checkEndpoint(
  endpoint: ServiceEndpoint,
  timeout = 5000
): Promise<ServiceStatus> {
  const url = `${endpoint.url}${endpoint.healthPath}`;
  const start = Date.now();

  try {
    const result = spawnSync(
      'curl',
      [
        '-sf',
        '--max-time',
        String(timeout / 1000),
        '-o',
        '/dev/null',
        '-w',
        '%{http_code}',
        url,
      ],
      { encoding: 'utf-8', timeout }
    );

    const latencyMs = Date.now() - start;
    const statusCode = parseInt(result.stdout?.trim() || '0', 10);

    return {
      endpoint,
      available: statusCode >= 200 && statusCode < 400,
      latencyMs,
      statusCode: statusCode || undefined,
      error: statusCode === 0 ? 'Connection refused' : undefined,
    };
  } catch (error) {
    return {
      endpoint,
      available: false,
      latencyMs: Date.now() - start,
      error: String(error),
    };
  }
}

async function discoverServices(
  tierFilter?: string
): Promise<DiscoveryResult> {
  const endpoints = tierFilter
    ? SERVICE_REGISTRY.filter((s) => s.tier.toLowerCase() === tierFilter.toLowerCase())
    : SERVICE_REGISTRY;

  console.log(`[service-discovery] Checking ${endpoints.length} services...`);

  const statuses = await Promise.all(
    endpoints.map((endpoint) => checkEndpoint(endpoint))
  );

  // Calculate summary
  const byTier: Record<string, { total: number; available: number }> = {};
  statuses.forEach((status) => {
    const tier = status.endpoint.tier;
    if (!byTier[tier]) {
      byTier[tier] = { total: 0, available: 0 };
    }
    byTier[tier].total++;
    if (status.available) {
      byTier[tier].available++;
    }
  });

  return {
    timestamp: new Date().toISOString(),
    services: statuses,
    summary: {
      total: statuses.length,
      available: statuses.filter((s) => s.available).length,
      unavailable: statuses.filter((s) => !s.available).length,
      byTier,
    },
  };
}

function printResult(result: DiscoveryResult): void {
  const statusSymbol = (available: boolean) => (available ? '\u2705' : '\u274c');

  console.log('\n[service-discovery] PMOVES Service Discovery');
  console.log('=============================================');
  console.log(`Timestamp: ${result.timestamp}`);
  console.log(`\nSummary: ${result.summary.available}/${result.summary.total} services available`);

  // Print by tier
  const tiers = ['DATA', 'API', 'LLM', 'WORKER', 'MEDIA', 'AGENT'];
  tiers.forEach((tier) => {
    const tierServices = result.services.filter((s) => s.endpoint.tier === tier);
    if (tierServices.length === 0) return;

    const tierStats = result.summary.byTier[tier];
    console.log(`\n${tier} Tier (${tierStats?.available || 0}/${tierStats?.total || 0}):`);
    console.log('-'.repeat(60));

    tierServices.forEach((service) => {
      const status = statusSymbol(service.available);
      const latency = service.available ? `${service.latencyMs}ms` : 'N/A';
      const error = service.error ? ` - ${service.error}` : '';

      console.log(
        `  ${status} ${service.endpoint.name.padEnd(15)} ${service.endpoint.url.padEnd(25)} [${latency}]${error}`
      );
      console.log(`     ${service.endpoint.description}`);
    });
  });

  // Quick start hints for unavailable services
  const unavailable = result.services.filter((s) => !s.available);
  if (unavailable.length > 0) {
    console.log('\nTo start unavailable services:');
    console.log('  docker-compose -f docker-compose.pmoves.yml up -d');
    console.log('\nOr start specific tiers:');
    console.log('  docker-compose -f docker-compose.pmoves.yml up -d supabase neo4j  # DATA tier');
    console.log('  docker-compose -f docker-compose.pmoves.yml up -d flask nextjs    # API tier');
    console.log('  docker-compose -f docker-compose.pmoves.yml up -d nats            # WORKER tier');
  }
}

function printJSON(result: DiscoveryResult): void {
  // Simplify for JSON output
  const simplified = {
    timestamp: result.timestamp,
    summary: result.summary,
    services: result.services.map((s) => ({
      name: s.endpoint.name,
      tier: s.endpoint.tier,
      url: s.endpoint.url,
      available: s.available,
      latencyMs: s.latencyMs,
      error: s.error,
    })),
  };
  console.log(JSON.stringify(simplified, null, 2));
}

async function main() {
  const args = process.argv.slice(2);
  let tierFilter: string | undefined;
  let jsonOutput = false;
  let listOnly = false;

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--tier':
        tierFilter = args[++i];
        break;
      case '--json':
        jsonOutput = true;
        break;
      case '--list':
        listOnly = true;
        break;
      case '--check-all':
        tierFilter = undefined;
        break;
    }
  }

  // List mode - just show registry
  if (listOnly) {
    console.log('\n[service-discovery] PMOVES Service Registry');
    console.log('=============================================');
    const tiers = ['DATA', 'API', 'LLM', 'WORKER', 'MEDIA', 'AGENT'];
    tiers.forEach((tier) => {
      const services = SERVICE_REGISTRY.filter((s) => s.tier === tier);
      if (services.length === 0) return;
      console.log(`\n${tier} Tier:`);
      services.forEach((s) => {
        console.log(`  - ${s.name}: ${s.url}${s.healthPath}`);
        console.log(`    ${s.description}`);
      });
    });
    process.exit(0);
  }

  const result = await discoverServices(tierFilter);

  if (jsonOutput) {
    printJSON(result);
  } else {
    printResult(result);
  }

  // Exit with error if any critical services unavailable
  const criticalTiers = ['API', 'DATA'];
  const criticalUnavailable = result.services.filter(
    (s) => !s.available && criticalTiers.includes(s.endpoint.tier)
  );

  process.exit(criticalUnavailable.length > 0 ? 1 : 0);
}

main();

export { discoverServices, SERVICE_REGISTRY, ServiceEndpoint, DiscoveryResult };
