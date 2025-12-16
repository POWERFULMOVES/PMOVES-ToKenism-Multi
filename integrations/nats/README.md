# NATS Integration for PMOVES.AI

This module provides event bus connectivity to the PMOVES.AI ecosystem via NATS JetStream messaging.

## Status

**Current**: Stub implementation (ready for production integration)

## Configuration

Set environment variables:

```bash
NATS_URL=nats://localhost:4222  # NATS server URL
```

## Usage

```typescript
import { natsClient, NATSClient } from './nats-client';

// Connect to NATS
await natsClient.connect();

// Publish simulation results
await natsClient.publishSimulationResult({
  simulationId: 'sim-123',
  scenario: 'baseline',
  weeklyHistory: [...],
  finalMetrics: {
    totalWealth: 500000,
    wealthGap: 0.35,
    economicVelocity: 0.45
  },
  parameters: { NUM_MEMBERS: 100, SIMULATION_WEEKS: 260 }
});

// Subscribe to research requests
natsClient.subscribe('research.deepresearch.request.v1', (event) => {
  console.log('Research request:', event.data);
});
```

## NATS Subjects

| Subject | Direction | Purpose |
|---------|-----------|---------|
| `tokenism.simulation.result.v1` | Publish | Simulation results |
| `tokenism.calibration.result.v1` | Publish | Calibration results |
| `research.deepresearch.request.v1` | Subscribe | Research requests |
| `supaserch.request.v1` | Subscribe | SupaSerch requests |

## Production Implementation

To enable full NATS connectivity, install the nats package:

```bash
npm install nats
```

Then update `nats-client.ts` to use actual NATS connection instead of stub.

## Integration with PMOVES.AI

This client integrates with:
- **Agent Zero** - Task coordination via MCP
- **DeepResearch** - Complex research tasks
- **SupaSerch** - Multi-source search aggregation
- **TensorZero** - LLM observability (via separate integration)

See `.claude/CLAUDE.md` in the main PMOVES.AI repo for full architecture details.
