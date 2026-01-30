# Firefly Export Troubleshooting

## Common Errors

### FIREFLY_TOKEN not configured

**Symptom:** `FIREFLY_TOKEN not configured`

**Cause:** No API token provided

**Solution:**
1. Create a Personal Access Token in Firefly-III
2. Go to Options > Profile > OAuth > Personal Access Tokens
3. Create token with full access
4. Set environment variable or create `.env.firefly`

### HTTP 401 Unauthorized

**Symptom:** `Authentication: Invalid or expired token`

**Cause:** Token is invalid or has expired

**Solution:**
1. Regenerate token in Firefly-III
2. Update `FIREFLY_TOKEN` in configuration
3. Verify token has correct permissions

### Connection refused

**Symptom:** `Connectivity: Connection failed`

**Cause:** Firefly-III server not running

**Solution:**
```bash
# If using Docker
docker-compose up firefly -d

# Check if port is accessible
curl http://localhost:8080/api/v1/about
```

### HTTP 422 Validation Error

**Symptom:** `HTTP 422: {"message":"Validation failed"}`

**Cause:** Transaction data doesn't match Firefly schema

**Solution:**
1. Check date format (YYYY-MM-DD required)
2. Verify account IDs exist
3. Ensure amount is positive number string

### Duplicate transaction errors

**Symptom:** `Duplicate transaction hash detected`

**Cause:** Same transaction already imported

**Solution:**
- Use `error_if_duplicate_hash: false` in advanced workflows
- Or clear previous test imports before re-importing

## CSV Import Issues

### Wrong column mapping

**Symptom:** Transactions import with wrong categories

**Cause:** CSV format mismatch

**Solution:** Use `--format firefly` for Firefly-native format:
```bash
npx ts-node tools/csv-generator.ts \
  --input results.json \
  --format firefly \
  --output import.csv
```

### Date parsing errors

**Symptom:** Dates show as invalid

**Cause:** Date format not ISO 8601

**Solution:** The tools output `YYYY-MM-DD` format by default. If using custom dates, ensure ISO 8601 compliance.

## Health Check Interpretation

### Status: degraded

**Meaning:** Connected but accounts not accessible

**Check:**
- Token permissions
- Account existence
- User authorization level

### Status: unhealthy

**Meaning:** Cannot connect to Firefly

**Check:**
1. Server running?
2. Correct URL?
3. Network/firewall issues?
4. TLS/SSL requirements?

## Debug Mode

Verbose output for debugging:
```bash
DEBUG=firefly:* npx ts-node tools/api-health-check.ts --json
```

## Getting Help

1. Check [recipe-basic.md](recipe-basic.md) for working setup
2. Review Firefly-III API docs: https://docs.firefly-iii.org/api/
3. Test API manually with curl before using tools
