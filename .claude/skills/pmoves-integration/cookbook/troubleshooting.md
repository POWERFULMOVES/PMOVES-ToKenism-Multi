# PMOVES Integration Troubleshooting

## Docker Issues

### Docker not available

**Symptom:** `Docker is not available`

**Cause:** Docker Desktop not running

**Solution:**
1. Start Docker Desktop
2. Wait for it to initialize
3. Verify: `docker --version`

### No PMOVES containers found

**Symptom:** `No PMOVES containers found`

**Cause:** Services not started

**Solution:**
```bash
docker-compose -f docker-compose.pmoves.yml up -d
```

### Container unhealthy

**Symptom:** Container shows `unhealthy` status

**Debug:**
```bash
# Check container logs
docker logs pmoves-flask --tail 50

# Check health check details
docker inspect pmoves-flask | jq '.[0].State.Health'
```

### Port conflicts

**Symptom:** `port is already allocated`

**Solution:**
1. Find conflicting process: `netstat -ano | findstr :5000`
2. Stop the process or change PMOVES port

## NATS Issues

### Connection refused to NATS

**Symptom:** `Failed to connect to NATS monitor`

**Cause:** NATS not running or wrong port

**Solution:**
```bash
# Start NATS
docker-compose -f docker-compose.pmoves.yml up nats -d

# Verify monitoring port
docker port pmoves-nats
```

### No active subscriptions

**Symptom:** `No active GEOMETRY BUS subscriptions detected`

**Cause:** CHIT publishers not running

**Solution:** This is normal if no publishers are active. Start a publisher:
```bash
npx ts-node integrations/contracts/chit/chit-nats-publisher.ts
```

### High message backlog

**Symptom:** `slow_consumers > 0` in NATS stats

**Cause:** Consumer not keeping up

**Solution:**
1. Check consumer logs
2. Scale up consumers
3. Implement backpressure

## Service Discovery Issues

### Critical services unavailable

**Symptom:** Exit code 1 with API/DATA tier failures

**Check order:**
1. Docker running?
2. Containers started?
3. Health checks passing?
4. Network connectivity?

### Inconsistent status

**Symptom:** Service flapping between available/unavailable

**Cause:** Service under load or restarting

**Debug:**
```bash
# Watch continuously
npx ts-node tools/service-discovery.ts --json | jq '.services[] | select(.available == false)'

# Check restart count
docker ps --format "{{.Names}}\t{{.Status}}"
```

## Flask Backend Issues

### healthz returns 500

**Symptom:** Flask health check failing

**Debug:**
```bash
# Check logs
docker logs pmoves-flask --tail 100

# Test manually
curl -v http://localhost:5000/healthz
```

### Database connection failed

**Symptom:** Flask can't connect to Supabase

**Solution:**
1. Check Supabase is running
2. Verify connection string in environment
3. Test direct connection

## Next.js Issues

### API routes not responding

**Symptom:** `/api/health` times out

**Debug:**
```bash
# Check Next.js logs
docker logs pmoves-nextjs --tail 100

# Rebuild if needed
docker-compose -f docker-compose.pmoves.yml up --build nextjs -d
```

### Hot reload not working

**Cause:** Volume mounting issue in development

**Solution:**
```bash
# Use development mode
npm run dev
```

## Network Issues

### Services can't communicate

**Symptom:** Inter-service requests fail

**Check:**
1. Docker network exists: `docker network ls | grep pmoves`
2. Services on same network: `docker network inspect pmoves_default`
3. DNS resolution: `docker exec pmoves-flask ping pmoves-nats`

### Firewall blocking ports

**Symptom:** External access fails

**Solution:**
1. Check Windows Firewall
2. Allow Docker ports (3000, 5000, 4222, 8222)

## Performance Issues

### High latency

**Symptom:** Health checks take >1000ms

**Debug:**
```bash
# Check each tier
npx ts-node tools/service-discovery.ts --tier api --json | jq '.services[].latencyMs'
```

### Memory issues

**Symptom:** Containers OOM killed

**Solution:**
1. Check Docker Desktop memory limits
2. Increase container limits in docker-compose
3. Optimize application memory usage

## Getting Help

1. Check [recipe-basic.md](recipe-basic.md) for setup verification
2. Review Docker logs for specific errors
3. Use `--json` output for debugging scripts
4. Check IMPLEMENTATION_STATUS.md for known issues
