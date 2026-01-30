# Recipe: Advanced PMOVES Operations

Deployment workflows, monitoring, and debugging.

## Prerequisites

- Basic health check recipe completed
- Understanding of 6-tier architecture
- Access to production environment (if applicable)

## Continuous Monitoring

### Watch mode for NATS
```bash
npx ts-node tools/nats-monitor.ts --watch --interval 10
```

### Health check loop
```bash
#!/bin/bash
# monitor-loop.sh

while true; do
  clear
  echo "=== PMOVES Health Check $(date) ==="

  npx ts-node tools/service-discovery.ts --json 2>/dev/null | \
    jq -r '.services[] | "\(.endpoint.tier)\t\(.endpoint.name)\t\(if .available then "UP" else "DOWN" end)\t\(.latencyMs)ms"' | \
    column -t

  echo ""
  echo "Press Ctrl+C to stop"
  sleep 30
done
```

### Prometheus-compatible metrics
```bash
# Export metrics for Prometheus scraping
npx ts-node tools/service-discovery.ts --json | jq -r '
  .services[] |
  "pmoves_service_available{name=\"\(.endpoint.name)\",tier=\"\(.endpoint.tier)\"} \(if .available then 1 else 0 end)"
' > /tmp/pmoves_metrics.prom
```

## Deployment Workflows

### Pre-deployment check
```bash
#!/bin/bash
# pre-deploy-check.sh

set -e

echo "Running pre-deployment checks..."

# Check all services are healthy
npx ts-node tools/service-discovery.ts --json > /tmp/services.json
UNAVAILABLE=$(jq '[.services[] | select(.available == false)] | length' /tmp/services.json)

if [ "$UNAVAILABLE" -gt 0 ]; then
  echo "ERROR: $UNAVAILABLE services unavailable"
  jq '.services[] | select(.available == false) | .endpoint.name' /tmp/services.json
  exit 1
fi

# Check GEOMETRY BUS
npx ts-node tools/nats-monitor.ts --json > /tmp/nats.json
CONNECTED=$(jq '.connected' /tmp/nats.json)

if [ "$CONNECTED" != "true" ]; then
  echo "ERROR: NATS not connected"
  exit 1
fi

echo "All pre-deployment checks passed!"
```

### Rolling restart
```bash
#!/bin/bash
# rolling-restart.sh

SERVICES="flask nextjs"

for service in $SERVICES; do
  echo "Restarting $service..."
  docker-compose -f docker-compose.pmoves.yml up -d --no-deps --force-recreate $service

  # Wait for health
  echo "Waiting for $service to be healthy..."
  timeout 60 bash -c "until docker inspect pmoves-$service | jq -e '.[0].State.Health.Status == \"healthy\"' > /dev/null 2>&1; do sleep 2; done"

  if [ $? -ne 0 ]; then
    echo "ERROR: $service failed health check"
    exit 1
  fi

  echo "$service is healthy"
  sleep 5  # Allow traffic to settle
done

echo "Rolling restart complete"
```

## Debug Mode

### Verbose service discovery
```bash
DEBUG=pmoves:* npx ts-node tools/service-discovery.ts
```

### Check individual endpoint
```bash
npx ts-node tools/docker-health.ts --endpoint http://localhost:5000/healthz
```

### Trace NATS messages
```bash
# Subscribe to all tokenism subjects
nats sub 'tokenism.>' --trace

# Or use monitor tool
npx ts-node tools/nats-monitor.ts --json | jq '.serverInfo'
```

## Multi-Environment Support

### Environment-specific discovery
```typescript
// env-discovery.ts
import { discoverServices } from './tools/service-discovery';

const ENVIRONMENTS = {
  development: {
    FLASK_URL: 'http://localhost:5000',
    NATS_URL: 'nats://localhost:4222',
  },
  staging: {
    FLASK_URL: 'http://staging.pmoves.internal:5000',
    NATS_URL: 'nats://staging-nats.pmoves.internal:4222',
  },
  production: {
    FLASK_URL: 'http://api.pmoves.co:5000',
    NATS_URL: 'nats://nats.pmoves.co:4222',
  },
};

const env = process.env.PMOVES_ENV || 'development';
const config = ENVIRONMENTS[env];

console.log(`Checking ${env} environment...`);
// Update service registry with environment URLs...
```

## Alerting Integration

### Slack webhook on failure
```bash
#!/bin/bash
# alert-check.sh

SLACK_WEBHOOK="${SLACK_WEBHOOK_URL}"

result=$(npx ts-node tools/service-discovery.ts --json 2>/dev/null)
unavailable=$(echo "$result" | jq '[.services[] | select(.available == false)] | length')

if [ "$unavailable" -gt 0 ]; then
  services=$(echo "$result" | jq -r '[.services[] | select(.available == false) | .endpoint.name] | join(", ")')

  curl -X POST "$SLACK_WEBHOOK" \
    -H 'Content-type: application/json' \
    --data "{
      \"text\": \":warning: PMOVES Alert: $unavailable services down\",
      \"attachments\": [{
        \"color\": \"danger\",
        \"fields\": [{
          \"title\": \"Affected Services\",
          \"value\": \"$services\"
        }]
      }]
    }"
fi
```

### PagerDuty integration
```typescript
// pagerduty-check.ts
import { discoverServices } from './tools/service-discovery';

async function checkAndAlert() {
  const result = await discoverServices();

  const criticalDown = result.services.filter(
    s => !s.available && ['API', 'DATA'].includes(s.endpoint.tier)
  );

  if (criticalDown.length > 0) {
    const incident = {
      routing_key: process.env.PAGERDUTY_KEY,
      event_action: 'trigger',
      payload: {
        summary: `PMOVES: ${criticalDown.length} critical services down`,
        severity: 'critical',
        source: 'pmoves-monitor',
        custom_details: {
          services: criticalDown.map(s => s.endpoint.name),
        },
      },
    };

    await fetch('https://events.pagerduty.com/v2/enqueue', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(incident),
    });
  }
}

checkAndAlert();
```

## Scaling Operations

### Scale Flask workers
```bash
# In docker-compose.pmoves.yml, update:
# deploy:
#   replicas: 3

docker-compose -f docker-compose.pmoves.yml up -d --scale flask=3
```

### Load balancer health check
```bash
# Check all replicas
for i in $(docker ps -q --filter "name=pmoves-flask"); do
  IP=$(docker inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' $i)
  echo -n "Replica $i: "
  curl -sf "http://$IP:5000/healthz" && echo "OK" || echo "FAIL"
done
```

## Disaster Recovery

### Backup verification
```bash
#!/bin/bash
# verify-backups.sh

echo "Checking database backups..."

# Supabase backup
BACKUP_DATE=$(ls -t /backups/supabase/*.dump 2>/dev/null | head -1)
if [ -z "$BACKUP_DATE" ]; then
  echo "WARNING: No Supabase backup found"
else
  echo "Latest Supabase backup: $BACKUP_DATE"
fi

# Check service can restore
echo "Verifying restore capability..."
npx ts-node tools/service-discovery.ts --tier data
```

### Failover test
```bash
#!/bin/bash
# failover-test.sh

echo "Simulating primary failure..."

# Stop primary Flask
docker stop pmoves-flask-1

# Check if traffic routes to replica
sleep 5
npx ts-node tools/docker-health.ts --service flask

# Restore
docker start pmoves-flask-1
```

## Tips

1. **Automate checks**: Run discovery on CI/CD before deploys
2. **Set baselines**: Know normal latencies for comparison
3. **Use JSON output**: Enables scripting and automation
4. **Monitor trends**: Track metrics over time, not just current state
5. **Test failures**: Regularly verify failover procedures
6. **Document runbooks**: Create step-by-step guides for common issues
