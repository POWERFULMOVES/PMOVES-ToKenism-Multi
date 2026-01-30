#!/usr/bin/env npx ts-node
/**
 * NATS Connection Monitor
 *
 * Monitors NATS server connectivity and subject activity for GEOMETRY BUS.
 * Part of the pmoves-integration skill toolset.
 *
 * Usage:
 *   npx ts-node nats-monitor.ts
 *   npx ts-node nats-monitor.ts --url nats://localhost:4222
 *   npx ts-node nats-monitor.ts --subjects tokenism.*
 */

import { execSync, spawnSync } from 'child_process';

interface NATSServerInfo {
  server_id: string;
  server_name: string;
  version: string;
  go: string;
  host: string;
  port: number;
  max_connections: number;
  ping_interval: number;
  proto: number;
  client_id?: number;
  tls_required?: boolean;
}

interface NATSVarz {
  server_id: string;
  version: string;
  proto: number;
  go: string;
  host: string;
  port: number;
  max_connections: number;
  connections: number;
  routes: number;
  remotes: number;
  subscriptions: number;
  slow_consumers: number;
  in_msgs: number;
  out_msgs: number;
  in_bytes: number;
  out_bytes: number;
  uptime: string;
  mem: number;
  cpu: number;
}

interface MonitorResult {
  timestamp: string;
  connected: boolean;
  url: string;
  serverInfo?: Partial<NATSVarz>;
  geometryBus: {
    subjects: string[];
    active: boolean;
  };
  latencyMs: number;
  error?: string;
}

const GEOMETRY_BUS_SUBJECTS = [
  'tokenism.attribution.recorded.v1',
  'tokenism.cgp.weekly.v1',
  'tokenism.cgp.ready.v1',
  'tokenism.geometry.event.v1',
  'tokenism.swarm.population.v1',
];

async function fetchWithTimeout(
  url: string,
  timeout = 5000
): Promise<{ ok: boolean; data?: unknown; error?: string; latencyMs: number }> {
  const start = Date.now();

  try {
    // Use curl for HTTP check (cross-platform)
    const result = spawnSync(
      'curl',
      ['-sf', '--max-time', String(timeout / 1000), url],
      { encoding: 'utf-8', timeout }
    );

    const latencyMs = Date.now() - start;

    if (result.status !== 0) {
      return { ok: false, latencyMs, error: result.stderr || 'Connection failed' };
    }

    try {
      const data = JSON.parse(result.stdout);
      return { ok: true, data, latencyMs };
    } catch {
      return { ok: true, data: result.stdout, latencyMs };
    }
  } catch (error) {
    return { ok: false, latencyMs: Date.now() - start, error: String(error) };
  }
}

function parseNATSUrl(url: string): { host: string; port: number; monitorPort: number } {
  // Parse nats://host:port format
  const match = url.match(/nats:\/\/([^:]+):?(\d+)?/);
  const host = match?.[1] || 'localhost';
  const port = match?.[2] ? parseInt(match[2], 10) : 4222;

  // NATS monitoring port is typically client port + 4000 (4222 -> 8222)
  const monitorPort = port + 4000;

  return { host, port, monitorPort };
}

async function checkNATSHealth(natsUrl: string): Promise<MonitorResult> {
  const { host, port, monitorPort } = parseNATSUrl(natsUrl);
  const monitorUrl = `http://${host}:${monitorPort}`;

  const result: MonitorResult = {
    timestamp: new Date().toISOString(),
    connected: false,
    url: natsUrl,
    geometryBus: {
      subjects: GEOMETRY_BUS_SUBJECTS,
      active: false,
    },
    latencyMs: 0,
  };

  // Check NATS monitoring endpoint
  console.log(`[nats-monitor] Checking ${monitorUrl}/varz...`);
  const varzResult = await fetchWithTimeout(`${monitorUrl}/varz`);

  result.latencyMs = varzResult.latencyMs;

  if (!varzResult.ok) {
    result.error = varzResult.error || 'Failed to connect to NATS monitor';
    return result;
  }

  result.connected = true;
  const varz = varzResult.data as Partial<NATSVarz>;

  result.serverInfo = {
    server_id: varz.server_id,
    version: varz.version,
    host: varz.host,
    port: varz.port,
    connections: varz.connections,
    subscriptions: varz.subscriptions,
    in_msgs: varz.in_msgs,
    out_msgs: varz.out_msgs,
    uptime: varz.uptime,
    cpu: varz.cpu,
    mem: varz.mem,
  };

  // Check for subscriptions (indicates active geometry bus)
  if (varz.subscriptions && varz.subscriptions > 0) {
    result.geometryBus.active = true;
  }

  // Try to get subscription details
  console.log(`[nats-monitor] Checking ${monitorUrl}/subsz...`);
  const subszResult = await fetchWithTimeout(`${monitorUrl}/subsz?subs=1`);
  if (subszResult.ok && subszResult.data) {
    const subsz = subszResult.data as { subscriptions_list?: Array<{ subject: string }> };
    if (subsz.subscriptions_list) {
      const activeSubjects = subsz.subscriptions_list
        .map((s) => s.subject)
        .filter((s) => GEOMETRY_BUS_SUBJECTS.some((gs) => s.startsWith(gs.replace('.v1', ''))));

      if (activeSubjects.length > 0) {
        result.geometryBus.active = true;
      }
    }
  }

  return result;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function printResult(result: MonitorResult): void {
  console.log('\n[nats-monitor] NATS GEOMETRY BUS Monitor');
  console.log('=========================================');
  console.log(`Timestamp: ${result.timestamp}`);
  console.log(`URL: ${result.url}`);
  console.log(`Connected: ${result.connected ? 'Yes' : 'No'}`);
  console.log(`Latency: ${result.latencyMs}ms`);

  if (result.error) {
    console.log(`\nError: ${result.error}`);
    console.log('\nTroubleshooting:');
    console.log('  1. Ensure NATS server is running: docker-compose up nats -d');
    console.log('  2. Check NATS port is exposed: docker port pmoves-nats');
    console.log('  3. Verify monitoring is enabled in NATS config');
    return;
  }

  if (result.serverInfo) {
    const info = result.serverInfo;
    console.log('\nServer Info:');
    console.log(`  Version: ${info.version}`);
    console.log(`  Server ID: ${info.server_id}`);
    console.log(`  Uptime: ${info.uptime}`);
    console.log(`  Connections: ${info.connections}`);
    console.log(`  Subscriptions: ${info.subscriptions}`);
    console.log(`  Messages In: ${info.in_msgs?.toLocaleString()}`);
    console.log(`  Messages Out: ${info.out_msgs?.toLocaleString()}`);
    console.log(`  CPU: ${info.cpu?.toFixed(2)}%`);
    console.log(`  Memory: ${info.mem ? formatBytes(info.mem) : 'N/A'}`);
  }

  console.log('\nGEOMETRY BUS Status:');
  console.log(`  Active: ${result.geometryBus.active ? 'Yes' : 'No'}`);
  console.log('  Monitored Subjects:');
  result.geometryBus.subjects.forEach((subject) => {
    console.log(`    - ${subject}`);
  });

  if (!result.geometryBus.active) {
    console.log('\n  Note: No active GEOMETRY BUS subscriptions detected.');
    console.log('  CHIT publishers may not be running yet.');
  }
}

async function main() {
  const args = process.argv.slice(2);
  let natsUrl = process.env.NATS_URL || 'nats://localhost:4222';
  let jsonOutput = false;
  let watchMode = false;
  let watchInterval = 5000;

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--url':
        natsUrl = args[++i];
        break;
      case '--json':
        jsonOutput = true;
        break;
      case '--watch':
        watchMode = true;
        break;
      case '--interval':
        watchInterval = parseInt(args[++i], 10) * 1000;
        break;
    }
  }

  const runCheck = async () => {
    const result = await checkNATSHealth(natsUrl);

    if (jsonOutput) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      printResult(result);
    }

    return result.connected;
  };

  if (watchMode) {
    console.log(`[nats-monitor] Watching NATS every ${watchInterval / 1000}s (Ctrl+C to stop)`);
    while (true) {
      await runCheck();
      await new Promise((resolve) => setTimeout(resolve, watchInterval));
      console.log('\n' + '='.repeat(50) + '\n');
    }
  } else {
    const connected = await runCheck();
    process.exit(connected ? 0 : 1);
  }
}

main();

export { checkNATSHealth, MonitorResult, GEOMETRY_BUS_SUBJECTS };
