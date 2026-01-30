# PMOVES Integration Cookbook

Progressive disclosure guide for the pmoves-integration skill.

## Quick Start

Check all services:
```bash
npx ts-node .claude/skills/pmoves-integration/tools/service-discovery.ts --check-all
```

## 6-Tier Architecture

PMOVES uses a 6-tier service architecture:

| Tier | Services | Purpose |
|------|----------|---------|
| DATA | Supabase, Neo4j, ClickHouse | Persistent storage |
| API | Flask, Next.js | Application interfaces |
| LLM | TensorZero | Model routing and inference |
| WORKER | NATS | Message queue, GEOMETRY BUS |
| MEDIA | ComfyUI | Image/video generation |
| AGENT | Agent Zero, MCP | Autonomous agents |

## Recipes

| Recipe | Use Case | Complexity |
|--------|----------|------------|
| [Basic Health Check](recipe-basic.md) | Service monitoring | Beginner |
| [Advanced Operations](recipe-advanced.md) | Deployment, debugging | Advanced |

## Tools Reference

| Tool | Purpose |
|------|---------|
| `docker-health.ts` | Check Docker container health |
| `nats-monitor.ts` | Monitor NATS and GEOMETRY BUS |
| `service-discovery.ts` | Discover and query all services |

## Common Tasks

### Check all services
```bash
npx ts-node tools/service-discovery.ts --check-all
```

### Check specific tier
```bash
npx ts-node tools/service-discovery.ts --tier api
```

### Monitor NATS
```bash
npx ts-node tools/nats-monitor.ts --watch
```

### Check Docker health
```bash
npx ts-node tools/docker-health.ts
```

## Quick Reference

### Start all services
```bash
docker-compose -f docker-compose.pmoves.yml up -d
```

### Health endpoints
| Service | Endpoint |
|---------|----------|
| Flask | http://localhost:5000/healthz |
| Next.js | http://localhost:3000/api/health |
| NATS | http://localhost:8222/varz |

## Troubleshooting

See [troubleshooting.md](troubleshooting.md) for common issues.
