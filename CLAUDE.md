# PMOVES-ToKenism-Multi

## Role Definition
You are an expert AI agent working within the PMOVES.AI orchestration mesh - a distributed, local-first architecture that integrates high-performance computing with edge devices into a unified cognitive fabric.

## Architecture Overview

### Core Systems
- **Agent Zero**: Master orchestrator & planner (MCP bridge)
- **Archon**: Knowledge manager (NATS + Supabase Realtime)
- **NATS**: High-performance pub/sub messaging bus
- **Supabase**: PostgreSQL + pgvector for storage

### Key Services
| Service | Function |
|---------|----------|
| `pmoves_announcer` | Event broadcasting & notifications |
| `pmoves_health` | System health monitoring |
| `pmoves_registry` | Service discovery & registration |
| `pmoves_common` | Shared utilities |

### Integration Points
- **Parent Repo**: PMOVES.AI (C:\Users\russe\OneDrive\Documents\GitHub\PMOVES-DoX)
- **Firefly-iii**: Financial simulation export
- **CHIT Geometry Bus**: Shape-attribution agents

## Codebase Structure

```
PMOVES-ToKenism-Multi/
├── pmoves-nextjs/          # React/Next.js frontend
├── pmoves_*/               # Python backend services
├── integrations/           # External service integrations
│   ├── firefly/            # Firefly-iii export
│   └── PMOVES-DoX/         # Parent repo submodule
├── chit/                   # CHIT geometry system
├── agents/                 # Agentic architecture docs
└── .claude/                # Claude Code configuration
    ├── skills/             # Agent skills (SKILL.md pattern)
    └── patterns.yaml       # Safety constraints
```

## Context Priming Rules (R&D Framework)

### Reduce
- DO NOT load entire files into context unnecessarily
- Query specific functions/classes using grep patterns
- Use `skills/` for domain-specific knowledge

### Delegate
- Offload heavy analysis to sub-agents
- Use Task tool with Explore agents for codebase discovery
- Return distilled artifacts, not raw data

## Model Selection Strategy

| Task Type | Recommended Model | Rationale |
|-----------|-------------------|-----------|
| Architecture planning | Opus | Complex reasoning, long-horizon planning |
| Code generation | Sonnet | Balanced speed/quality for implementation |
| Security auditing | Haiku | Fast probabilistic safety checks |
| Quick fixes | Haiku | Low-latency for simple tasks |

## Thread Types Supported

- **P-Threads**: Parallel execution via mprocs
- **C-Threads**: Chained workflows (Plan → Build → Test → Deploy)
- **F-Threads**: Fusion consensus (multi-model validation)
- **B-Threads**: Big/Meta orchestration (Agent Zero as supervisor)

## Safety Constraints

See `.claude/patterns.yaml` for full list. Key rules:
- Never force-push to main/hardened branches
- Never delete production data without explicit confirmation
- Protect `.env*` and `secrets_manifest*.yaml` files
- Require human approval for `docker-compose down`

## Common Tasks

### Running Tests
```bash
# Frontend
cd pmoves-nextjs && npm test

# Backend
pytest

# E2E
cd pmoves-nextjs && npx playwright test
```

### Docker Operations
```bash
# Build all services
docker-compose build

# Start services
docker-compose -f docker-compose.pmoves.yml up -d

# Check health
docker-compose ps
```

### Firefly Export
```bash
cd integrations/firefly
npx ts-node export_sim_to_firefly.ts
```

## Important Files

| File | Purpose |
|------|---------|
| `docker-compose.pmoves.yml` | PMOVES service orchestration |
| `env.shared` | Shared environment config (DO NOT commit secrets) |
| `chit/secrets_manifest_v2.yaml` | CHIT secrets configuration |
| `PMOVES.AI_INTEGRATION.md` | Integration patterns documentation |

## Plugins Available

This project has these Claude Code plugins enabled:
- `feature-dev` - Guided feature development
- `code-review` - PR code review
- `pr-review-toolkit` - Comprehensive PR analysis
- `agent-sdk-dev` - Agent SDK development
- `ralph-loop` - Iterative development loops
- `frontend-design` - UI/UX implementation
- `huggingface-skills` - HuggingFace integration
