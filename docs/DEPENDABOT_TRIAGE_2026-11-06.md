# Dependabot Triage — 2026-11-06

Snapshot of open Dependabot alerts on `PMOVES.AI-Edition-Hardened` at time of writing: **292 alerts** — 13 critical, 136 high, 119 medium, 24 low (98% npm, 2% pip).

## Alert Distribution by Manifest

| Manifest | Alerts | Notes |
|---|---:|---|
| `contracts/solidity/package-lock.json` | 97 | hardhat toolchain transitive deps |
| `pmoves-nextjs/package-lock.json` | 93 | Next.js app deps |
| `integrations/package-lock.json` | 79 | TS contracts/integrations deps |
| `requirements-updated.txt` | 21 | **stale duplicate file — see P2 below** |
| `requirements.txt` | 1 | Flask advisory |
| `pmoves-nextjs/package.json` | 1 | zod (direct dep) |

## P0 — Critical (13 alerts)

| Package | Alerts | Manifests | First patched | Fix path |
|---|---:|---|---|---|
| `next` | 3 critical (of 30 total) | pmoves-nextjs | 15.5.28+ (also 16.x lines) | **Direct dep** — bump `next` from `^15.5.12` to latest 15.5.x (`npm audit fix` may suffice; advisories GHSA-2464-fhr4-w9xw, GHSA-2xp9-vwfh-vxw4, GHSA-p293-qw3h-jr36) |
| `handlebars` | 3 critical × 3 manifests = 9 (of 10 each) | contracts, integrations, pmoves-nextjs | 4.7.9 / 4.7.10 | **Transitive** (via hardhat toolchain) — add npm `overrides`: `"handlebars": "^4.7.9"` |
| `basic-ftp` | 1 critical + 1 high | pmoves-nextjs | 5.2.0 / 5.2.2 | npm `overrides` → `5.2.2` |

## P1 — High (136 alerts)

Highest-impact packages (alert count includes all severities):

| Package | Alerts | Manifests | First patched | Fix path |
|---|---:|---|---|---|
| `axios` | 60 | contracts, integrations | 1.20.0+ | **Direct dep in integrations** — bump `^1.6.0` → `^1.20.0`; add `overrides` in contracts/solidity for transitive copies |
| `fast-uri` | 23 | contracts, integrations | 3.1.9+ / 4.x | `overrides` |
| `js-yaml` | 20 | contracts, integrations, pmoves-nextjs | 4.3.2 (or 3.15.2 for v3) | `overrides` (mind v3→v4 breaking change) |
| `undici` | 12 | contracts | 7.30.1 / 6.29.1 | `overrides` |
| `brace-expansion` | 12 | all three npm manifests | 2.1.7 / 1.1.21 | `overrides` |
| `picomatch` | 8 | all three | 2.3.2 / 4.0.4 | `overrides` |
| `minimatch` | 7 | all three | 9.0.7 (v3 line: 3.1.3) | `overrides` |
| `ws` | 6 | all three | 8.20.1+ | `overrides` |
| `sharp` | 3 | pmoves-nextjs | 0.35.5 | direct/bump |
| `nanoid` | 3 | pmoves-nextjs | 3.3.18 / 5.x | bump or `overrides` |
| `postcss` | 4 | pmoves-nextjs | 8.5.23 | bump |
| `ip-address` | 4 | pmoves-nextjs | 10.7.1 | bump |
| `Werkzeug` (pip) | 7 | requirements-updated.txt | 3.1.9 | **file removed in P2** |

After the P0/P1 waves, run `npm audit fix` per manifest and re-check; remaining stragglers get targeted `overrides`.

## P2 — Process / Hygiene

1. **Delete `requirements-updated.txt`** — a stale duplicate of `requirements.txt` carrying **21 pip alerts** (Werkzeug, werkzeug, flask, jinja2, Jinja2, gunicorn, pyinstaller). Removing the file eliminates that exposure entirely. Then bump the two remaining real advisories in `requirements.txt` (flask → 3.1.3 line, already pinned `==2.3.3` — evaluate upgrade path carefully as it is a breaking-major jump).
2. **No patch published:** `extract-zip` (2 high, pmoves-nextjs) and `elliptic` (1 low, contracts) currently have **no fixed version available**. Document risk acceptance or remove the dependency path; re-check periodically.
3. **Enable grouped security updates** in `.github/dependabot.yml` (`groups: security-updates: applies-to: security-updates`) so future fixes batch into one PR per manifest.
4. Re-run `npm ci` + full test suites (integrations 21/21, pmoves-nextjs 34/34 as of PR #67) after each dependency wave — overrides can shift transitive resolution.

## Verification Loop

After each remediation wave:

```bash
# pmoves-nextjs (Jest + build)
cd pmoves-nextjs && npm ci --no-audit --no-fund && npx jest --silent && npm run build
# integrations (Jest)
cd integrations && npm ci --no-audit --no-fund && npx jest --silent
# contracts/solidity (Hardhat, not Jest)
cd contracts/solidity && npm ci --no-audit --no-fund && npx hardhat compile && npx hardhat test
# then confirm alert counts dropped
```

Expected outcome: the top 8 packages (axios 60 + next 30 + handlebars 30 + fast-uri 23 + js-yaml 20 + undici 12 + brace-expansion 12 + picomatch 8 = **195 of 292, ~67%**) clear in the first two waves; P2 removes the pip block entirely (21 more, ~74% cumulative).
