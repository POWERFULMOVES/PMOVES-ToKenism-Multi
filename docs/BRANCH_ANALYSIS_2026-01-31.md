# Branch Analysis - 2026-01-31

**Analyzed by:** Claude Opus 4.5
**Base Branch:** PMOVES.AI-Edition-Hardened

## Summary

All PMOVES-specific feature work has been incorporated into `PMOVES.AI-Edition-Hardened`. The following branches are now stale and can be archived or deleted.

## Branches Ready for Cleanup

### Merged/Superseded Branches

| Branch | Last Activity | Status | Recommendation |
|--------|---------------|--------|----------------|
| `feat/pmoves-ai-integration` | Merged via squash | Behind by ~50 commits | Archive |
| `feat/production-review-2026-01-29` | Fully merged | No unmerged commits | Delete |
| `feature/firefly-sim-export` | Content merged | Behind main | Archive |
| `feature/frontend-fixes` | Content merged | Behind main | Archive |
| `fix/pr-27-review-issues` | Content merged | Behind main | Delete |
| `update/wealth-submodule-hardened-merge` | Superseded | Missing recent work | Delete |
| `codex/*` (all branches) | Fully merged | No unmerged commits | Delete |
| `claude/*` (all branches) | Fully merged | No unmerged commits | Delete |

### Upstream Firefly III Branches (Different Purpose)

These branches track upstream Firefly III changes and serve a different purpose:

| Branch | Purpose | Keep? |
|--------|---------|-------|
| `fix/hardened-healthcheck-port` | Firefly III Dockerfile (PHP/Apache) | Keep for reference |
| `fix/release-gpg-optional` | CI release workflow fixes | Keep for upstream sync |
| `chore/pmoves-net+ghcr` | GHCR Docker publishing | Keep for upstream sync |

## Architecture Note

The repository contains two distinct Dockerfiles for different purposes:

1. **Current `Dockerfile`** (Python 3.9 + Flask)
   - Purpose: PMOVES economic simulation backend
   - Runs: Flask API on port 5000
   - Location: Repository root

2. **`fix/hardened-healthcheck-port` Dockerfile** (Firefly III)
   - Purpose: Personal finance management (upstream Firefly III)
   - Runs: Apache/PHP on port 8080
   - Based on: `fireflyiii/core:latest`

These serve complementary roles in the PMOVES-Wealth ecosystem.

## Cleanup Commands

To delete merged branches (run when ready):

```bash
# Delete local branches
git branch -d feat/production-review-2026-01-29
git branch -d fix/pr-27-review-issues

# Delete remote branches (requires push access)
git push origin --delete feat/production-review-2026-01-29
git push origin --delete fix/pr-27-review-issues
git push origin --delete update/wealth-submodule-hardened-merge
```

## Next Steps

- Phase 4: Production configuration (env files)
- Phase 5d: EvoSwarm/MACA/Venice research
