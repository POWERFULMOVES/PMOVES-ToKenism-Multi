# Recipe: Basic Health Check

Verify PMOVES services are running and healthy.

## Prerequisites

- Docker Desktop installed and running
- docker-compose.pmoves.yml available

## Step 1: Check Docker Availability

```bash
npx ts-node .claude/skills/pmoves-integration/tools/docker-health.ts
```

Expected output (when services running):
```
[docker-health] PMOVES Service Health Check
=============================================
Timestamp: 2026-01-29T12:00:00Z
Docker Available: Yes

Services (4 total):
----------------------------------------------------------------------
  pmoves-flask: RUNNING (healthy) [Up 2 hours]
    Ports: 0.0.0.0:5000->5000/tcp
  pmoves-nextjs: RUNNING (healthy) [Up 2 hours]
    Ports: 0.0.0.0:3000->3000/tcp
  pmoves-nats: RUNNING [Up 2 hours]
    Ports: 0.0.0.0:4222->4222/tcp, 0.0.0.0:8222->8222/tcp
  pmoves-supabase: RUNNING (healthy) [Up 2 hours]
    Ports: 0.0.0.0:54321->54321/tcp

----------------------------------------------------------------------
Summary:
  Running: 4/4
  Healthy: 3
  Unhealthy: 0
```

## Step 2: Run Service Discovery

```bash
npx ts-node .claude/skills/pmoves-integration/tools/service-discovery.ts
```

This checks all 6 tiers:
```
[service-discovery] PMOVES Service Discovery
=============================================
Timestamp: 2026-01-29T12:00:00Z

Summary: 6/10 services available

DATA Tier (2/3):
------------------------------------------------------------
  Supabase        http://localhost:54321        [45ms]
     PostgreSQL + PostgREST API
  Neo4j           http://localhost:7474         [N/A] - Connection refused
     Graph database for relationships
  ClickHouse      http://localhost:8123         [23ms]
     Analytics OLAP database

API Tier (2/2):
------------------------------------------------------------
  Flask Backend   http://localhost:5000         [12ms]
     PMOVES simulation API
  Next.js API     http://localhost:3000         [8ms]
     Frontend API routes
...
```

## Step 3: Check NATS GEOMETRY BUS

```bash
npx ts-node .claude/skills/pmoves-integration/tools/nats-monitor.ts
```

Output:
```
[nats-monitor] NATS GEOMETRY BUS Monitor
=========================================
Timestamp: 2026-01-29T12:00:00Z
URL: nats://localhost:4222
Connected: Yes
Latency: 5ms

Server Info:
  Version: 2.10.0
  Uptime: 2h15m
  Connections: 3
  Subscriptions: 12
  Messages In: 1,234
  Messages Out: 2,345

GEOMETRY BUS Status:
  Active: Yes
  Monitored Subjects:
    - tokenism.attribution.recorded.v1
    - tokenism.cgp.weekly.v1
    - tokenism.cgp.ready.v1
    - tokenism.geometry.event.v1
    - tokenism.swarm.population.v1
```

## Step 4: Test Individual Endpoints

```bash
# Flask health
curl http://localhost:5000/healthz

# Next.js health
curl http://localhost:3000/api/health

# NATS stats
curl http://localhost:8222/varz
```

## Step 5: JSON Output for Scripting

```bash
# Service discovery as JSON
npx ts-node tools/service-discovery.ts --json > services.json

# Check if critical services available
jq '.services[] | select(.endpoint.tier == "API") | select(.available == false)' services.json
```

## Verification Checklist

| Check | Command | Expected |
|-------|---------|----------|
| Docker running | `docker --version` | Version info |
| Containers up | `docker ps` | PMOVES containers listed |
| Flask healthy | `curl localhost:5000/healthz` | `{"status":"ok"}` |
| Next.js healthy | `curl localhost:3000/api/health` | `{"status":"ok"}` |
| NATS connected | `curl localhost:8222/varz` | JSON with version |

## Starting Services (if not running)

```bash
# Start all PMOVES services
docker-compose -f docker-compose.pmoves.yml up -d

# Start specific tier
docker-compose -f docker-compose.pmoves.yml up flask nextjs -d

# View logs
docker-compose -f docker-compose.pmoves.yml logs -f flask
```

## Next Steps

- See [recipe-advanced.md](recipe-advanced.md) for deployment and scaling
- Check NATS monitor in watch mode: `--watch --interval 5`
- Integrate with CI/CD pipelines
