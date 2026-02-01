# Phase 5d Research Summary: EvoSwarm, MACA, Venice.ai

**Date:** 2026-01-31
**Status:** Research Phase
**Branch:** PMOVES.AI-Edition-Hardened

---

## Overview

Phase 5d encompasses advanced agent capabilities that enable self-improvement and multi-agent consensus. All LLM access (local and cloud providers including Venice.ai) routes through TensorZero Gateway. This document summarizes the architectural documentation and implementation requirements.

---

## 1. EvoSwarm + AgentGym-RL Integration

### Purpose
Create a self-improving reinforcement learning loop where agents learn from their interactions.

### Architecture Components

| Component | Function | Location |
|-----------|----------|----------|
| **EvoSwarm Controller** | Monitors CGP fitness, triggers training | `services/evo-controller/` |
| **AgentGym-RL Coordinator** | Orchestrates training jobs | Port 8114 |
| **PMOVES-HiRAG Environment** | RL environment for constellation tasks | Port 36000 |
| **RL Trainer Subordinate** | Agent Zero subordinate for RL lifecycle | `agents/rl-trainer/` |

### NATS Subjects (5 New)

```
agent.rl.trajectory.v1       # Multi-turn interaction sequences
agent.rl.reward.v1           # Computed reward signals
agent.rl.training.request.v1 # Training job requests
agent.rl.training.status.v1  # Training progress updates
agent.rl.model.deployed.v1   # Model deployment notifications
```

### Reward Function Components

| Component | Weight | Source |
|-----------|--------|--------|
| Task Completion | 40% | Automated |
| Efficiency | 20% | Turn count vs baseline |
| Code Quality | 15% | Linter/tests |
| User Feedback | 25% | Explicit + implicit |

### Training Triggers

1. **Threshold-Based:** 5000 new trajectories
2. **Scheduled:** Daily at 02:00 UTC
3. **Manual:** Via Agent Zero command
4. **Performance Degradation:** Reward drops > 10%

### ScalingInter-RL Horizon Progression

| Epoch Range | Horizon |
|-------------|---------|
| 0-10 | 5 |
| 11-20 | 10 |
| 21+ | 15 |

### Implementation Phases

| Phase | Duration | Deliverables |
|-------|----------|--------------|
| 1. Foundation | Weeks 1-2 | Trajectory hooks, NATS streams, ClickHouse storage |
| 2. RL Trainer | Weeks 3-4 | Subordinate agent, reward pipeline |
| 3. AgentGym-RL | Weeks 5-6 | Training service, PPO/DPO algorithms |
| 4. Deployment | Weeks 7-8 | TensorZero integration, canary rollout |
| 5. Monitoring | Weeks 9-10 | Grafana dashboards, integration tests |
| 6. Production | Weeks 11-12 | Staging, baseline metrics, rollout |

---

## 2. MACA (Multi-Agent Consensus Alignment)

### Purpose
Enable multiple model outputs to be fused through consensus mechanisms, improving reliability and reducing hallucinations.

### Key Concepts (From Architecture Doc)

| Component | Function |
|-----------|----------|
| **Shape Merger** | Combines CGP outputs from multiple agents |
| **Entropy Calculator** | Measures uncertainty across responses |
| **Multi-Model Routing** | Routes queries to appropriate models |
| **F-Thread (Fusion)** | Thread type for consensus operations |

### Integration Points

- TensorZero Gateway for multi-model routing
- NATS for consensus event propagation
- CGP fitness scoring for merger decisions

### Status: Research Required

The MACA implementation requires:
1. Define consensus algorithms (voting, weighted average, attention)
2. Design F-Thread orchestration patterns
3. Implement shape merger for CGP documents
4. Create entropy-based confidence scoring

---

## 3. TensorZero Gateway (Unified LLM Access)

### Purpose
All LLM access routes through TensorZero Gateway - including local models (Ollama, vLLM) and cloud providers (OpenAI, Anthropic, Venice.ai, Groq, etc.).

### Architecture Principle

```
┌─────────────────────────────────────────────────────────┐
│                    TensorZero Gateway                    │
│                  http://tensorzero:3030                  │
├─────────────────────────────────────────────────────────┤
│  Local Providers          │  Cloud Providers            │
│  ─────────────────        │  ──────────────────         │
│  • Ollama (llama, qwen)   │  • OpenAI (gpt-4o)          │
│  • vLLM (local inference) │  • Anthropic (claude)       │
│                           │  • Venice.ai (qwen-235b)    │
│                           │  • Groq (llama-70b)         │
│                           │  • DeepSeek                 │
└─────────────────────────────────────────────────────────┘
```

### Big Thread Routing

TensorZero handles model selection based on task complexity:

| Thread Type | Routing Strategy |
|-------------|-----------------|
| **Base Thread (B)** | Local Sonnet/Haiku via Ollama |
| **Big Thread (B)** | Route to frontier models (Opus, GPT-4, Qwen-235B) |
| **Parallel Thread (P)** | Fan-out to multiple local models |
| **Fusion Thread (F)** | Multi-model consensus via TensorZero |

### Configuration (in env.tier-llm)

All provider API keys are configured in `env.tier-llm` and consumed by TensorZero:

```bash
# TensorZero consumes these - services call TensorZero, not providers directly
OPENAI_API_KEY=${OPENAI_API_KEY}
ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
VENICE_API_KEY=${VENICE_API_KEY}
GROQ_API_KEY=${GROQ_API_KEY}
# ... all other providers
```

### Key Point

**No service should call LLM providers directly.** All LLM requests go through:
```
http://tensorzero-gateway:3030/v1/chat/completions
```

This ensures:
- Unified observability (ClickHouse logging)
- A/B testing capabilities
- Automatic fallback routing
- Cost tracking and rate limiting

---

## 4. Environment Variables (Phase 5d)

Add to `env.tier-worker` or `env.tier-agent` (NOT env.tier-llm - that's for TensorZero only):

```bash
# EvoSwarm + AgentGym-RL
AGENTGYM_ENABLE=true
AGENTGYM_DEFAULT_ALGORITHM=ppo
AGENTGYM_DEFAULT_EPOCHS=50
AGENTGYM_DEFAULT_BATCH_SIZE=64
AGENTGYM_DEFAULT_HORIZON=15
AGENTGYM_ENV_MAX_TURNS=20

# Reward Weights
AGENTGYM_TASK_SUCCESS_WEIGHT=0.4
AGENTGYM_RETRIEVAL_QUALITY_WEIGHT=0.3
AGENTGYM_CGP_FITNESS_WEIGHT=0.2
AGENTGYM_EFFICIENCY_WEIGHT=0.1

# Training Triggers
AGENTGYM_TRIGGER_ON_PLATEAU=true
AGENTGYM_PLATEAU_WINDOW=5
AGENTGYM_TRIGGER_ON_NEW_CONSTELLATION=true
AGENTGYM_PERIODIC_TRAINING_INTERVAL=100

# ScalingInter-RL
AGENTGYM_HORIZON_SCHEDULE=5,10,15
AGENTGYM_HORIZON_EPOCH_THRESHOLDS=0,10,20

# TensorZero (all LLM access goes here)
TENSORZERO_BASE_URL=http://tensorzero-gateway:3030
TENSORZERO_URL=http://tensorzero-gateway:3030
```

**Note:** LLM provider API keys (OpenAI, Anthropic, Venice, etc.) belong in `env.tier-llm` and are consumed by TensorZero Gateway only.

---

## 5. Docker Compose Additions

```yaml
# docker-compose.agentgym.yml
services:
  agentgym-rl-coordinator:
    image: pmoves/agentgym-rl-coordinator:latest
    ports:
      - "8114:8114"
    environment:
      - NATS_URL=nats://nats:4222
      - SUPABASE_URL=${SUPABASE_URL}
    volumes:
      - agentgym-models:/models
      - agentgym-logs:/logs

  agentgym-env-pmoves:
    image: pmoves/agentgym-env-pmoves:latest
    ports:
      - "36000:36000"
    environment:
      - HIRAG_URL=http://hirag-v2:8086
      - QDRANT_URL=http://qdrant:6333

volumes:
  agentgym-models:
  agentgym-logs:
  agentgym-task-cache:
```

---

## 6. NATS Stream Configuration

```bash
# Trajectories (30-day retention, 1M msgs)
nats stream add RL_TRAJECTORIES \
  --subjects "agent.rl.trajectory.v1" \
  --retention limits \
  --max-age 30d \
  --max-msgs 1000000 \
  --storage file

# Rewards (30-day retention, 500K msgs)
nats stream add RL_REWARDS \
  --subjects "agent.rl.reward.v1" \
  --retention limits \
  --max-age 30d \
  --max-msgs 500000 \
  --storage file

# Training (7-day retention, 10K msgs)
nats stream add RL_TRAINING \
  --subjects "agent.rl.training.>" \
  --retention limits \
  --max-age 7d \
  --max-msgs 10000 \
  --storage file
```

---

## 7. Success Metrics

### Technical Metrics

| Metric | Target |
|--------|--------|
| Model performance improvement | +5-10% per training cycle |
| Training success rate | > 90% |
| Deployment success rate | > 95% |
| Mean time to rollback | < 60 seconds |
| False rollback rate | < 5% |

### Business Metrics

| Metric | Target |
|--------|--------|
| Task completion rate | +10-15% |
| User satisfaction | +20% |
| Agent efficiency (turns) | -15% |
| Code quality (linter scores) | +10% |

---

## 8. Documentation References

| Document | Path | Purpose |
|----------|------|---------|
| EvoSwarm QuickStart | `docs/architecture/evoswarm-agentgym-rl-quickstart.md` | Implementation guide |
| RL Feedback Loop Design | `docs/architecture/rl-feedback-loop-design.md` | Full architecture spec |
| RL Quick Reference | `docs/architecture/rl-feedback-loop-quickref.md` | Command reference |
| RL Summary | `docs/architecture/rl-feedback-loop-summary.md` | Implementation roadmap |
| Hardware Requirements | `agents/HARDWARE_TTS_REQUIREMENTS.md` | Venice.ai integration |
| Architecture Deep Dive | `agents/PMOVES.AI Agentic Architecture Deep Dive.md` | Comprehensive overview |

---

## 9. Implementation Priority

### High Priority (Immediate)

1. Create NATS stream configurations
2. Implement trajectory collection hooks in Agent Zero
3. Deploy RL JSON schemas

### Medium Priority (Next Sprint)

4. Build RL Trainer subordinate agent
5. Implement reward computation pipeline
6. Configure TensorZero Big Thread routing

### Low Priority (Future)

7. MACA consensus algorithms
8. Advanced PBT (Population-Based Training)
9. Meta-learning for fast adaptation

---

## 10. Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Training instability | Medium | High | Checkpointing, validation gates |
| Model degradation | Medium | High | Canary deployment, auto-rollback |
| NATS message loss | Low | Medium | JetStream persistence |
| GPU resource contention | Medium | Medium | Scheduling, resource limits |
| Venice.ai API limits | Low | Low | Fallback to local inference |

---

## Next Steps

1. **Review and approve** this research summary
2. **Add Phase 5d env vars** to `env.tier-worker` or `env.tier-agent`
3. **Create NATS streams** for RL operations
4. **Begin Phase 1** of EvoSwarm implementation (trajectory hooks)
5. **Configure TensorZero** routing for Big Thread tasks

---

## Appendix: Key Commands

```bash
# Start AgentGym services
docker compose -f docker-compose.yml -f docker-compose.agentgym.yml --profile agentgym up -d

# Check service health
curl http://localhost:8114/healthz
curl http://localhost:36000/healthz

# Monitor NATS events
nats sub "agent.rl.trajectory.v1"
nats sub "agent.rl.training.status.v1"

# Trigger training manually
curl -X POST http://localhost:8114/agentgym/train/start \
  -H "Content-Type: application/json" \
  -d @examples/agentgym-training-request.json
```
