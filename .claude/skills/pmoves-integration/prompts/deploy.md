# Recipe: PMOVES Deployment

## Prerequisites
- Docker and docker-compose installed
- Environment variables configured in `env.shared`
- NATS server accessible

## Workflow

### 1. Pre-deployment Checks
```bash
# Check current state
docker-compose -f docker-compose.pmoves.yml ps

# Verify env configuration
cat env.shared | grep -v "^#" | grep -v "^$"
```

### 2. Build Services
```bash
# Build all PMOVES services
docker-compose -f docker-compose.pmoves.yml build

# Or build specific service
docker-compose -f docker-compose.pmoves.yml build pmoves_health
```

### 3. Deploy
```bash
# Start services (detached)
docker-compose -f docker-compose.pmoves.yml up -d

# Follow logs
docker-compose -f docker-compose.pmoves.yml logs -f
```

### 4. Verify Health
```bash
# Check service status
docker-compose -f docker-compose.pmoves.yml ps

# Test health endpoints
curl http://localhost:8080/health
```

### 5. Rollback (if needed)
```bash
# Stop services
docker-compose -f docker-compose.pmoves.yml down

# Revert to previous version
git checkout HEAD~1 docker-compose.pmoves.yml
docker-compose -f docker-compose.pmoves.yml up -d
```

## Constraints
- ALWAYS check running containers before rebuild
- NEVER include secrets in docker-compose files
- WAIT for health checks before marking deployment complete
