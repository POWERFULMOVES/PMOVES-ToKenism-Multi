# Tokenism Distributed Deployment Context

> Context file for Claude Code when working with Tokenism in distributed mode.

## Architecture Position

Tokenism is the **Simulation Framework** module in the PMOVES ecosystem. It hosts:

- **Economic Simulation** (:5000): Agent-based economic modeling
- **Integration Coordinator**: Event bus orchestration
- **PMOVES-Wealth**: Firefly-iii financial validation

```
┌──────────────────────────────────────────────┐
│              Tokenism                         │
│  ┌──────────────────┐  ┌──────────────────┐  │
│  │Integration Coord │  │  PMOVES-Wealth   │  │
│  │   (NATS Events)  │◄─►│ (Firefly-iii)   │  │
│  └──────────────────┘  └──────────────────┘  │
│                                               │
│  ┌──────────────────┐  ┌──────────────────┐  │
│  │   Simulation     │  │  CHIT Geometry   │  │
│  │    Engine        │  │     Bus          │  │
│  └──────────────────┘  └──────────────────┘  │
│                                               │
│  Agent Simulation  │  Financial Validation   │
└───────────────────────────────────────────────┘
```

## Service Discovery

### Environment Variables (Distributed Mode)

```bash
# This service
TOKENISM_HOST=192.168.1.40
TOKENISM_PORT=5000
TOKENISM_URL=http://${TOKENISM_HOST}:${TOKENISM_PORT}

# Parent services
NATS_URL=nats://192.168.1.10:4222
TENSORZERO_URL=http://192.168.1.10:3030
SUPABASE_URL=http://192.168.1.10:54321

# Sibling submodules
DOX_BACKEND_URL=http://192.168.1.20:8484
BOTZ_GATEWAY_URL=http://192.168.1.30:2091
AGENT_ZERO_URL=http://192.168.1.20:50051

# PMOVES-Wealth
WEALTH_URL=http://${TOKENISM_HOST}:8080
FIREFLY_API_URL=http://${TOKENISM_HOST}:8080/api/v1
```

### Configuration Files

| File | Purpose |
|------|---------|
| `env.distributed.example` | Template for cross-host configuration |
| `docker-compose.distributed.yml` | Overlay for distributed networks |
| `env.tier-*` | Tier-specific configurations |
| `integrations/` | External service integrations |

## Tier-Based Environment

Tokenism uses a 6-tier environment system:

| Tier | File | Purpose |
|------|------|---------|
| API | `env.tier-api` | Gateway services |
| Data | `env.tier-data` | Storage backends |
| LLM | `env.tier-llm` | Provider API keys |
| Worker | `env.tier-worker` | Background processing |
| Media | `env.tier-media` | Media services |
| Agent | `env.tier-agent.sh` | Agent-specific |

### Loading Order

```bash
source env.shared
source env.tier-${TIER}
source env.distributed  # Override for distributed mode
```

## NATS Subjects (Published)

Tokenism publishes to these NATS subjects:

| Subject | Description |
|---------|-------------|
| `tokenism.simulation.started.v1` | Simulation started |
| `tokenism.simulation.complete.v1` | Simulation finished |
| `tokenism.cgp.ready.v1` | CHIT Geometry Packet ready |
| `tokenism.agent.state.v1` | Agent state update |
| `tokenism.finance.transaction.v1` | Financial transaction |
| `tokenism.wealth.sync.v1` | Firefly sync event |

## NATS Subjects (Subscribed)

Tokenism subscribes to:

| Subject | Source | Description |
|---------|--------|-------------|
| `dox.document.ingested.v1` | DoX | Documents for analysis |
| `botz.archon.knowledge.updated.v1` | BoTZ | Knowledge updates |
| `geometry.event.manifold_update` | DoX | Manifold changes |

## Integration Coordinator

Central orchestration for cross-service communication:

```typescript
// integrations/integration-coordinator.ts
class IntegrationCoordinator {
  // Event Bus with JSON Schema validation
  private eventBus: EventBus;

  // Service clients
  private doxClient: DoXClient;
  private fireflyClient: FireflyClient;
  private contractListeners: ContractEventListener[];
}
```

### Event Topics

| Topic | Schema | Description |
|-------|--------|-------------|
| `finance.transaction` | `TransactionEvent` | Financial movements |
| `agent.task.lifecycle` | `TaskEvent` | Agent task states |
| `content.published` | `ContentEvent` | Publishing events |
| `health.metrics` | `MetricsEvent` | System health |

## PMOVES-Wealth Integration

### Firefly-iii API

```bash
FIREFLY_API_URL=http://${WEALTH_HOST}:8080/api/v1
FIREFLY_TOKEN=your-personal-access-token
```

### Simulation Export

```typescript
// Export simulation to Firefly
cd integrations/firefly
npx ts-node export_sim_to_firefly.ts
```

### Financial Validation

Tokenism validates simulations against Firefly data:

1. Run economic simulation
2. Export transactions to Firefly
3. Compare projected vs actual
4. Generate variance reports

## DoX Integration

Tokenism uses DoX for document analysis:

```python
# Query DoX for document insights
POST http://${DOX_BACKEND_URL}/search
{
  "query": "financial projections Q4",
  "artifact_id": "optional-scope"
}
```

### Agent Zero Tasks

```python
# Dispatch task to Agent Zero
POST http://${AGENT_ZERO_URL}/mcp/t-{token}/sse
{
  "tool": "analyze_document",
  "arguments": {"path": "/docs/report.pdf"}
}
```

## BoTZ Integration

Tokenism accesses BoTZ tools via gateway:

```python
# Use Archon for knowledge queries
POST http://${BOTZ_GATEWAY_URL}/mcp/call
{
  "tool": "archon_query",
  "arguments": {"query": "economic model constraints"}
}
```

## CHIT Geometry Bus

Shape-attribution for economic agents:

```python
# Publish CGP to geometry bus
{
  "type": "cgp",
  "manifold": "hyperbolic",
  "curvature": -0.5,
  "agents": [...]
}
```

### Subjects

| Subject | Direction | Description |
|---------|-----------|-------------|
| `tokenism.cgp.>` | Publish | Agent geometry |
| `geometry.event.>` | Subscribe | Manifold updates |

## Health Endpoint

```bash
GET http://${TOKENISM_HOST}:5000/health

{
  "status": "healthy",
  "services": {
    "simulation_engine": "running",
    "firefly_connection": "connected",
    "nats_connection": "connected"
  }
}
```

## Troubleshooting

### Firefly Sync Failed

1. Verify FIREFLY_TOKEN is valid
2. Check Firefly API is accessible
3. Review transaction format compatibility

### NATS Events Not Received

1. Verify NATS_URL resolves
2. Check JetStream is enabled
3. Confirm subject subscriptions

### Simulation Performance

1. Tokenism is CPU-bound by design
2. Scale horizontally for parallel simulations
3. Use worker tier configuration

## Related Documentation

- [PMOVES.AI DISTRIBUTED_SUBMODULES.md](../../pmoves/docs/DISTRIBUTED_SUBMODULES.md)
- [Tokenism CLAUDE.md](../CLAUDE.md)
- [Integration Architecture](../INTEGRATION_ARCHITECTURE.md)
- [PMOVES-Wealth Integration](../integrations/PMOVES-Wealth/README.md)
