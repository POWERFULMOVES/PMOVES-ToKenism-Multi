# CHIT Geometry Troubleshooting

## Validation Errors

### Missing required field

**Symptom:** `Missing required field: dirichlet`

**Cause:** CGP document missing required fields

**Required fields:**
- `version`
- `packet_id`
- `created_at`
- `dirichlet`
- `hyperbolic`
- `attributions`

**Solution:** Ensure all required fields are present in the CGP document.

### Invalid version format

**Symptom:** `Invalid version format: v1.0`

**Cause:** Version doesn't match pattern `chit.cgp.vX.Y`

**Solution:**
```json
{
  "version": "chit.cgp.v0.1"
}
```

### Dirichlet alpha below minimum

**Symptom:** `dirichlet.alpha[0] (0.0001) is below minimum (0.001)`

**Cause:** Alpha values too small

**Solution:** Use alpha values >= 0.001. Very small values cause numerical instability.

### Hyperbolic norm constraint

**Symptom:** `hyperbolic.position norm (1.2345) must be < 1 for Poincare ball`

**Cause:** Position coordinates outside valid hyperbolic space

**Solution:** Ensure `||position|| < 1`:
```json
{
  "hyperbolic": {
    "curvature": -1,
    "position": [0.3, 0.4, 0.5]
  }
}
```

The norm should be: `sqrt(0.3² + 0.4² + 0.5²) = 0.707 < 1`

### Positive curvature error

**Symptom:** `hyperbolic.curvature (1) must be <= 0 for hyperbolic space`

**Cause:** Curvature must be non-positive for hyperbolic geometry

**Solution:** Use negative curvature:
```json
{
  "hyperbolic": {
    "curvature": -1
  }
}
```

## Attribution Warnings

### Weights don't sum to 1

**Symptom:** `Total attribution weight (0.8500) should sum to 1.0`

**Cause:** Contribution weights don't normalize

**Solution:** Ensure all `contribution_weight` values sum to 1.0:
```json
{
  "attributions": [
    { "contribution_weight": 0.5 },
    { "contribution_weight": 0.3 },
    { "contribution_weight": 0.2 }
  ]
}
```

### Duplicate agent_id

**Symptom:** `Duplicate agent_id: agent-001`

**Cause:** Same agent appears multiple times

**Solution:** Merge contributions for the same agent or use unique IDs.

## Merkle Verification Errors

### Invalid hash format

**Symptom:** `merkle_root does not appear to be a valid SHA-256 hash`

**Cause:** Hash isn't 64 hex characters

**Solution:** Use proper SHA-256 hash:
```bash
echo -n "data" | sha256sum
# Output: 64 hex characters
```

### Proof verification failed

**Symptom:** `Computed root doesn't match expected`

**Cause:** Proof doesn't correspond to the stated root

**Debug:**
```bash
# Generate fresh proof
npx ts-node tools/merkle-verify.ts --cgp packet.json --generate --index 0

# Compare with stored proof
```

## Visualization Issues

### ASCII garbled

**Symptom:** Misaligned characters in ASCII output

**Cause:** Non-monospace terminal font

**Solution:** Use monospace terminal or export to SVG:
```bash
npx ts-node tools/shape-visualize.ts --format svg --output shape.svg
```

### SVG not rendering

**Symptom:** SVG file appears blank

**Cause:** Extreme coordinate values

**Solution:** Validate document first to check coordinate ranges.

## Schema Compatibility

### Upgrading from older versions

**v0.1 to v1.0 changes:**
1. `merkle_root` becomes required
2. `attributions[].timestamp` becomes required
3. New optional `metadata` field

**Migration:**
```bash
# Add missing fields
jq '. + {merkle_root: "", metadata: {}}' old.json > new.json
```

## Getting Help

1. Check [recipe-basic.md](recipe-basic.md) for working examples
2. Review CGP schema: `contracts/schemas/geometry/cgp.v1.schema.json`
3. Use `--json` flag for machine-readable output
