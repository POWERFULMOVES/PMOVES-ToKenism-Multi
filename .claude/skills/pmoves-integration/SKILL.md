# Skill: PMOVES Integration

**Version**: 1.0.0
**Description**: PMOVES.AI integration patterns for orchestration mesh coordination

## When to Use
- Setting up Docker services for PMOVES
- Configuring NATS messaging between services
- Managing pmoves_* Python services
- Integrating with parent PMOVES.AI repository

## Capabilities
- Docker orchestration via `docker-compose.pmoves.yml`
- Service health monitoring via `pmoves_health`
- Event broadcasting via `pmoves_announcer`
- Service discovery via `pmoves_registry`

## Context Priming
Before modifying PMOVES integration:
1. Check current service status: `docker-compose ps`
2. Review `env.shared` for configuration
3. Verify NATS connectivity

## Key Files
- `docker-compose.pmoves.yml` - Service definitions
- `pmoves_*/\__init__.py` - Service implementations
- `env.shared` - Environment configuration
- `PMOVES.AI_INTEGRATION.md` - Architecture documentation

## Constraints
- DO NOT modify `env.shared` to include secrets
- DO NOT force rebuild without checking running containers
- ALWAYS verify health endpoints after deployment

## Recipes
See `prompts/deploy.md` for deployment workflow.
