#!/usr/bin/env npx ts-node
/**
 * Docker Service Health Checker
 *
 * Monitors health status of PMOVES Docker services.
 * Part of the pmoves-integration skill toolset.
 *
 * Usage:
 *   npx ts-node docker-health.ts
 *   npx ts-node docker-health.ts --compose docker-compose.pmoves.yml
 *   npx ts-node docker-health.ts --service flask-backend
 */

import { execSync, spawnSync } from 'child_process';

interface ContainerHealth {
  name: string;
  status: 'running' | 'stopped' | 'unhealthy' | 'starting' | 'unknown';
  health?: 'healthy' | 'unhealthy' | 'starting' | 'none';
  ports: string[];
  uptime?: string;
  restarts: number;
}

interface HealthCheckResult {
  timestamp: string;
  dockerAvailable: boolean;
  composeFile: string;
  services: ContainerHealth[];
  summary: {
    total: number;
    running: number;
    healthy: number;
    unhealthy: number;
  };
}

const PMOVES_SERVICES = [
  'pmoves-flask',
  'pmoves-nextjs',
  'pmoves-nats',
  'pmoves-supabase',
  'pmoves-neo4j',
  'pmoves-clickhouse',
  'pmoves-tensorzero',
  'pmoves-comfyui',
];

function checkDockerAvailable(): boolean {
  try {
    execSync('docker --version', { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

function getContainerInfo(nameFilter?: string): ContainerHealth[] {
  try {
    const format = '{{.Names}}|{{.Status}}|{{.Ports}}|{{.State}}';
    const cmd = nameFilter
      ? `docker ps -a --filter "name=${nameFilter}" --format "${format}"`
      : `docker ps -a --format "${format}"`;

    const output = execSync(cmd, { encoding: 'utf-8' }).trim();
    if (!output) return [];

    return output.split('\n').map((line) => {
      const [name, status, ports, state] = line.split('|');

      // Parse health from status string
      let health: ContainerHealth['health'] = 'none';
      if (status.includes('(healthy)')) health = 'healthy';
      else if (status.includes('(unhealthy)')) health = 'unhealthy';
      else if (status.includes('(health: starting)')) health = 'starting';

      // Parse uptime
      const uptimeMatch = status.match(/Up\s+(.+?)(?:\s+\(|$)/);
      const uptime = uptimeMatch ? uptimeMatch[1] : undefined;

      // Parse restarts
      const restartMatch = status.match(/Restarting\s+\((\d+)\)/);
      const restarts = restartMatch ? parseInt(restartMatch[1], 10) : 0;

      // Determine overall status
      let containerStatus: ContainerHealth['status'] = 'unknown';
      if (state === 'running' || status.startsWith('Up')) {
        containerStatus = health === 'unhealthy' ? 'unhealthy' : 'running';
      } else if (status.includes('Exited') || state === 'exited') {
        containerStatus = 'stopped';
      } else if (status.includes('Restarting')) {
        containerStatus = 'starting';
      }

      return {
        name,
        status: containerStatus,
        health,
        ports: ports ? ports.split(',').map((p) => p.trim()) : [],
        uptime,
        restarts,
      };
    });
  } catch {
    return [];
  }
}

function checkEndpointHealth(
  url: string,
  timeout = 5000
): { ok: boolean; latencyMs: number; error?: string } {
  const start = Date.now();
  try {
    // Use curl for cross-platform HTTP check
    const result = spawnSync(
      'curl',
      ['-sf', '--max-time', String(timeout / 1000), '-o', '/dev/null', '-w', '%{http_code}', url],
      { encoding: 'utf-8', timeout }
    );

    const latencyMs = Date.now() - start;
    const statusCode = parseInt(result.stdout?.trim() || '0', 10);

    return {
      ok: statusCode >= 200 && statusCode < 400,
      latencyMs,
      error: statusCode === 0 ? 'Connection failed' : undefined,
    };
  } catch (error) {
    return {
      ok: false,
      latencyMs: Date.now() - start,
      error: String(error),
    };
  }
}

async function runHealthCheck(
  composeFile?: string,
  serviceFilter?: string
): Promise<HealthCheckResult> {
  const result: HealthCheckResult = {
    timestamp: new Date().toISOString(),
    dockerAvailable: checkDockerAvailable(),
    composeFile: composeFile || 'docker-compose.yml',
    services: [],
    summary: {
      total: 0,
      running: 0,
      healthy: 0,
      unhealthy: 0,
    },
  };

  if (!result.dockerAvailable) {
    return result;
  }

  // Get container info
  const filter = serviceFilter || 'pmoves';
  result.services = getContainerInfo(filter);

  // Calculate summary
  result.summary.total = result.services.length;
  result.summary.running = result.services.filter((s) => s.status === 'running').length;
  result.summary.healthy = result.services.filter((s) => s.health === 'healthy').length;
  result.summary.unhealthy = result.services.filter(
    (s) => s.status === 'unhealthy' || s.health === 'unhealthy'
  ).length;

  return result;
}

function printResult(result: HealthCheckResult): void {
  const statusEmoji: Record<string, string> = {
    running: '\u2705',
    stopped: '\u26d4',
    unhealthy: '\u274c',
    starting: '\u23f3',
    unknown: '\u2753',
  };

  const healthEmoji: Record<string, string> = {
    healthy: '\u2705',
    unhealthy: '\u274c',
    starting: '\u23f3',
    none: '\u2796',
  };

  console.log('\n[docker-health] PMOVES Service Health Check');
  console.log('=============================================');
  console.log(`Timestamp: ${result.timestamp}`);
  console.log(`Docker Available: ${result.dockerAvailable ? 'Yes' : 'No'}`);

  if (!result.dockerAvailable) {
    console.log('\nDocker is not available. Please ensure Docker Desktop is running.');
    return;
  }

  console.log(`\nServices (${result.summary.total} total):`);
  console.log('-'.repeat(70));

  if (result.services.length === 0) {
    console.log('  No PMOVES containers found.');
    console.log('  Run: docker-compose -f docker-compose.pmoves.yml up -d');
  } else {
    result.services.forEach((service) => {
      const status = `${statusEmoji[service.status]} ${service.status.toUpperCase()}`;
      const health = service.health !== 'none' ? ` (${healthEmoji[service.health]} ${service.health})` : '';
      const uptime = service.uptime ? ` [${service.uptime}]` : '';
      const restarts = service.restarts > 0 ? ` (restarts: ${service.restarts})` : '';
      const ports = service.ports.length > 0 ? `\n    Ports: ${service.ports.join(', ')}` : '';

      console.log(`  ${service.name}: ${status}${health}${uptime}${restarts}${ports}`);
    });
  }

  console.log('\n' + '-'.repeat(70));
  console.log('Summary:');
  console.log(`  Running: ${result.summary.running}/${result.summary.total}`);
  console.log(`  Healthy: ${result.summary.healthy}`);
  console.log(`  Unhealthy: ${result.summary.unhealthy}`);

  // Recommended endpoints to check
  console.log('\nRecommended Health Endpoints:');
  console.log('  Flask Backend:  http://localhost:5000/healthz');
  console.log('  Next.js:        http://localhost:3000/api/health');
  console.log('  NATS:           http://localhost:8222/varz');
}

async function main() {
  const args = process.argv.slice(2);
  let composeFile: string | undefined;
  let serviceFilter: string | undefined;
  let jsonOutput = false;
  let checkEndpoint: string | undefined;

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--compose':
        composeFile = args[++i];
        break;
      case '--service':
        serviceFilter = args[++i];
        break;
      case '--json':
        jsonOutput = true;
        break;
      case '--endpoint':
        checkEndpoint = args[++i];
        break;
    }
  }

  // If endpoint check requested, do that separately
  if (checkEndpoint) {
    console.log(`[docker-health] Checking endpoint: ${checkEndpoint}`);
    const endpointResult = checkEndpointHealth(checkEndpoint);
    if (jsonOutput) {
      console.log(JSON.stringify(endpointResult, null, 2));
    } else {
      console.log(`  Status: ${endpointResult.ok ? 'OK' : 'FAILED'}`);
      console.log(`  Latency: ${endpointResult.latencyMs}ms`);
      if (endpointResult.error) {
        console.log(`  Error: ${endpointResult.error}`);
      }
    }
    process.exit(endpointResult.ok ? 0 : 1);
  }

  const result = await runHealthCheck(composeFile, serviceFilter);

  if (jsonOutput) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    printResult(result);
  }

  // Exit with error if any services unhealthy
  const allHealthy =
    result.summary.unhealthy === 0 &&
    result.summary.running === result.summary.total;
  process.exit(allHealthy ? 0 : 1);
}

main();

export { runHealthCheck, ContainerHealth, HealthCheckResult };
