#!/usr/bin/env npx ts-node
/**
 * Firefly API Health Checker
 *
 * Verifies connectivity and authentication with Firefly-III API.
 * Part of the firefly-export skill toolset.
 *
 * Usage:
 *   npx ts-node api-health-check.ts
 *   npx ts-node api-health-check.ts --url http://localhost:8080 --token <token>
 */

import * as fs from 'fs';
import * as path from 'path';

interface HealthCheckResult {
  status: 'healthy' | 'unhealthy' | 'degraded';
  checks: {
    connectivity: boolean;
    authentication: boolean;
    apiVersion: string | null;
    accountsAccessible: boolean;
  };
  latencyMs: number;
  errors: string[];
  timestamp: string;
}

interface FireflyConfig {
  baseUrl: string;
  token: string;
}

function loadConfig(overrideUrl?: string, overrideToken?: string): FireflyConfig {
  const config: FireflyConfig = {
    baseUrl: overrideUrl || process.env.FIREFLY_BASE_URL || 'http://localhost:8080',
    token: overrideToken || process.env.FIREFLY_TOKEN || '',
  };

  // Try to load from .env file
  const envPath = path.join(process.cwd(), 'integrations', '.env.firefly');
  if (fs.existsSync(envPath) && !overrideUrl && !overrideToken) {
    const envContent = fs.readFileSync(envPath, 'utf-8');
    envContent.split('\n').forEach((line) => {
      const [key, value] = line.split('=').map((s) => s.trim());
      if (key === 'FIREFLY_BASE_URL' && !overrideUrl) config.baseUrl = value;
      if (key === 'FIREFLY_TOKEN' && !overrideToken) config.token = value;
    });
  }

  return config;
}

async function checkConnectivity(baseUrl: string): Promise<{ ok: boolean; latencyMs: number; error?: string }> {
  const start = Date.now();
  try {
    const response = await fetch(`${baseUrl}/api/v1/about`, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
    });
    const latencyMs = Date.now() - start;
    return { ok: response.status !== 0, latencyMs };
  } catch (error) {
    return { ok: false, latencyMs: Date.now() - start, error: String(error) };
  }
}

async function checkAuthentication(
  baseUrl: string,
  token: string
): Promise<{ ok: boolean; version?: string; error?: string }> {
  try {
    const response = await fetch(`${baseUrl}/api/v1/about`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json',
      },
    });

    if (response.status === 401) {
      return { ok: false, error: 'Invalid or expired token' };
    }

    if (!response.ok) {
      return { ok: false, error: `HTTP ${response.status}` };
    }

    const data = await response.json();
    return {
      ok: true,
      version: data.data?.version || data.version || 'unknown',
    };
  } catch (error) {
    return { ok: false, error: String(error) };
  }
}

async function checkAccounts(
  baseUrl: string,
  token: string
): Promise<{ ok: boolean; count?: number; error?: string }> {
  try {
    const response = await fetch(`${baseUrl}/api/v1/accounts?type=asset&limit=1`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      return { ok: false, error: `HTTP ${response.status}` };
    }

    const data = await response.json();
    return {
      ok: true,
      count: data.meta?.pagination?.total || data.data?.length || 0,
    };
  } catch (error) {
    return { ok: false, error: String(error) };
  }
}

async function runHealthCheck(config: FireflyConfig): Promise<HealthCheckResult> {
  const result: HealthCheckResult = {
    status: 'unhealthy',
    checks: {
      connectivity: false,
      authentication: false,
      apiVersion: null,
      accountsAccessible: false,
    },
    latencyMs: 0,
    errors: [],
    timestamp: new Date().toISOString(),
  };

  // Check connectivity
  console.log('[firefly-health] Checking connectivity...');
  const connectivityResult = await checkConnectivity(config.baseUrl);
  result.checks.connectivity = connectivityResult.ok;
  result.latencyMs = connectivityResult.latencyMs;
  if (!connectivityResult.ok) {
    result.errors.push(`Connectivity: ${connectivityResult.error || 'Connection failed'}`);
  }

  // Check authentication (only if connectivity passed)
  if (result.checks.connectivity && config.token) {
    console.log('[firefly-health] Checking authentication...');
    const authResult = await checkAuthentication(config.baseUrl, config.token);
    result.checks.authentication = authResult.ok;
    result.checks.apiVersion = authResult.version || null;
    if (!authResult.ok) {
      result.errors.push(`Authentication: ${authResult.error}`);
    }
  } else if (!config.token) {
    result.errors.push('Authentication: No token configured');
  }

  // Check accounts access (only if auth passed)
  if (result.checks.authentication) {
    console.log('[firefly-health] Checking accounts access...');
    const accountsResult = await checkAccounts(config.baseUrl, config.token);
    result.checks.accountsAccessible = accountsResult.ok;
    if (!accountsResult.ok) {
      result.errors.push(`Accounts: ${accountsResult.error}`);
    } else {
      console.log(`[firefly-health] Found ${accountsResult.count} asset accounts`);
    }
  }

  // Determine overall status
  if (
    result.checks.connectivity &&
    result.checks.authentication &&
    result.checks.accountsAccessible
  ) {
    result.status = 'healthy';
  } else if (result.checks.connectivity && result.checks.authentication) {
    result.status = 'degraded';
  } else {
    result.status = 'unhealthy';
  }

  return result;
}

function printResult(result: HealthCheckResult): void {
  const statusEmoji = {
    healthy: '\u2705',
    degraded: '\u26a0\ufe0f',
    unhealthy: '\u274c',
  };

  console.log('\n[firefly-health] Health Check Result');
  console.log('=====================================');
  console.log(`Status: ${statusEmoji[result.status]} ${result.status.toUpperCase()}`);
  console.log(`Latency: ${result.latencyMs}ms`);
  console.log(`Timestamp: ${result.timestamp}`);
  console.log('\nChecks:');
  console.log(`  Connectivity: ${result.checks.connectivity ? 'PASS' : 'FAIL'}`);
  console.log(`  Authentication: ${result.checks.authentication ? 'PASS' : 'FAIL'}`);
  console.log(`  API Version: ${result.checks.apiVersion || 'N/A'}`);
  console.log(`  Accounts Access: ${result.checks.accountsAccessible ? 'PASS' : 'FAIL'}`);

  if (result.errors.length > 0) {
    console.log('\nErrors:');
    result.errors.forEach((e) => console.log(`  - ${e}`));
  }
}

async function main() {
  const args = process.argv.slice(2);
  let url: string | undefined;
  let token: string | undefined;
  let jsonOutput = false;

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--url':
        url = args[++i];
        break;
      case '--token':
        token = args[++i];
        break;
      case '--json':
        jsonOutput = true;
        break;
    }
  }

  const config = loadConfig(url, token);
  console.log(`[firefly-health] Checking ${config.baseUrl}...`);

  const result = await runHealthCheck(config);

  if (jsonOutput) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    printResult(result);
  }

  process.exit(result.status === 'healthy' ? 0 : 1);
}

main();

export { runHealthCheck, HealthCheckResult };
