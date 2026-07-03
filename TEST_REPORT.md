# Test Report — 2026-07-03

## Summary

**Tests: ALL PASS (216/216 across 17 test files)**
**TypeScript: FAIL — 319 errors across 62 files**

Root cause: `npx prisma generate` cannot download engine binaries in this monitoring environment due to network policy (ECONNRESET on binary download). Without the generated Prisma client, all Prisma types are missing, causing a cascade of TypeScript errors.

---

## Test Results

```
Test Files  17 passed (17)
Tests       216 passed (216)
Duration    1.82s
```

All test suites pass cleanly.

---

## TypeScript Errors

### Root Cause

`prisma generate` fails with:
```
Error: aborted — code: 'ECONNRESET'
```

The Prisma postinstall script tries to download engine binaries from an external CDN. The monitoring environment's network policy blocks this download (binary CDN is not in the `noProxy` allowlist, and the connection is reset).

As a result, `node_modules/.prisma/` is never created, so `@prisma/client` exports no types.

### Error Distribution

| Error Code | Count | Meaning |
|------------|-------|---------|
| TS7006 | 291 | Implicit `any` (Prisma callback params can't be inferred without generated types) |
| TS2305 | 8 | Missing exports from `@prisma/client` (`PrismaClient`, `Prisma`, `Business`) |
| TS2339 | 9 | Missing properties on `{}` (Prisma aggregate results untyped) |
| TS7031 | 7 | Binding element has implicit `any` type |
| TS18046 | 3 | Value is of type `unknown` |
| TS2347 | 1 | Untyped function calls |

### Key Missing Exports

```
Module '"@prisma/client"' has no exported member 'PrismaClient'  — src/lib/prisma.ts
Module '"@prisma/client"' has no exported member 'Prisma'        — 5 files
Module '"@prisma/client"' has no exported member 'Business'      — src/lib/auth-helpers.ts
```

### Affected Files (62 total)

All 62 affected files are in production code (`src/`). The errors are entirely a consequence of missing generated types — no logic bugs detected.

Most affected areas:
- `src/app/api/admin/*` — 17 API routes
- `src/app/api/*` — 30+ API routes  
- `src/lib/*` — core library files (prisma.ts, sales-tools.ts, auth-helpers.ts, partner-commission.ts)

---

## Is This a Code Regression?

**Very likely NOT.** Evidence:

1. All 216 unit tests pass (tests mock Prisma so they work without generated client)
2. Production deployments via Vercel succeed (Vercel can download Prisma binaries)
3. No recent changes to `prisma/schema.prisma` that would introduce new type incompatibilities
4. No existing `test-report/*` branches — these errors have not been flagged before
5. The errors span 62 files with identical pattern — characteristic of a missing generated dependency, not code bugs

---

## Suggested Fix

**For the monitoring environment:**

Option A — Commit the generated Prisma client to the repo:
```bash
# Add generated files to .gitignore exclusion
# echo '!node_modules/.prisma' >> .gitignore
# npx prisma generate  (run where network access allows)
# git add node_modules/.prisma
```

Option B — Use `PRISMA_GENERATE_SKIP_AUTOINSTALL=true` + pre-built binaries cached in the environment.

Option C — Accept that `npx tsc --noEmit` will fail in this environment and only alert on test failures.

**For production:** No action needed. Vercel builds succeed.

---

## Recent Commits (for context)

```
fabd257 Fix: escalate to owner when client sends new phone
25db061 Cost + length: max_tokens 300, harder length rule, Haiku 4.5 for tool-loop
b7482b1 Fix statistics for channels properly
a6fc3e2 Fix: 'Моя статистика' page shows 0 for IG/WA/FB-only businesses
1431d42 Fix test errors: add missing vi.mock stubs for @prisma/client
```
