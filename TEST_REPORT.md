# Test Report — 2026-06-29

## Summary

| Check | Result |
|-------|--------|
| `npm test` (vitest) | ✅ 216 tests passed, 17 test files |
| `npx tsc --noEmit` | ❌ 314 errors in 62 files |

---

## Tests (vitest) — ALL PASSED

```
Test Files  17 passed (17)
Tests       216 passed (216)
Duration    ~1.9s
```

All 17 test files passed with no failures.

---

## TypeScript (`tsc --noEmit`) — FAILED

### Root Cause: `prisma generate` could not run

`prisma generate` needs to download Prisma binary engines from the internet.
In this monitoring environment the outbound connection to Prisma's CDN is
blocked (ECONNRESET), so no `@prisma/client` generated types were produced.

This single missing step causes a **cascade of 314 TypeScript errors** across
62 source files.

### Error breakdown

| Error code | Count (approx) | Description |
|------------|---------------|-------------|
| TS7006 | ~280 | Parameter implicitly has `any` type (spread across all files that use Prisma models) |
| TS2305 | 8 | `Module '"@prisma/client"' has no exported member` — core types missing |
| TS2339 | ~17 | Property does not exist on type `{}` (Prisma query results typed as `{}`) |
| TS18046 | 3 | `error` is of type `unknown` |
| TS7031 / TS2347 | ~6 | Other implicit-any / untyped generics |

### Key files with TS2305 (missing Prisma exports — most critical)

```
src/lib/prisma.ts(1,10)         — PrismaClient not found
src/lib/partner-commission.ts   — Prisma namespace not found
src/lib/auth-helpers.ts         — Business type not found
src/lib/sales-tools.ts          — Prisma namespace not found
src/app/api/admin/partners/...  — Prisma namespace not found
src/app/api/cron/...            — Prisma namespace not found
```

### Semantic errors (TS2339) — may indicate real bugs OR cascade from missing types

```
src/app/api/admin/conversations/route.ts:260  — Property '_max' does not exist on type '{}'
src/app/api/admin/conversations/route.ts:272  — Property '_sum' does not exist on type '{}'
src/app/api/customers/route.ts:144            — Property 'clientName' does not exist on type '{}'
src/app/api/customers/route.ts:152            — Property '_count' does not exist on type '{}'
src/app/api/products/bulk-stock/route.ts:44   — Property 'stock' does not exist on type '{}'
src/app/api/products/bulk-stock/route.ts:53   — Property 'stock' does not exist on type '{}'
```

These TS2339 errors are **likely cascading** from missing Prisma types (Prisma
query return types fall back to `{}` without generated client). They should
resolve once `prisma generate` runs successfully.

---

## Affected Files (partial list — 62 total)

Production code affected (not test files):
- `src/lib/prisma.ts`
- `src/lib/ai-memory.ts`
- `src/lib/booking-tools.ts`
- `src/lib/channel-ai.ts`
- `src/lib/automation.ts`
- `src/lib/sales-tools.ts`
- `src/lib/partner-commission.ts`
- `src/lib/auth-helpers.ts`
- `src/app/api/admin/analytics/route.ts`
- `src/app/api/admin/conversations/route.ts`
- `src/app/api/customers/route.ts`
- `src/app/api/products/bulk-stock/route.ts`
- ... (and 50 more)

---

## Probable Cause

`prisma generate` cannot download the Prisma query engine binary in this
monitoring environment (network policy blocks `binaries.prisma.sh`).

**This does NOT mean production is broken.** Vercel deployments run
`prisma generate` as part of the build command and have unrestricted network
access. The TypeScript errors seen here are an artifact of the monitoring
environment, not a regression in production code.

---

## Suggested Fix Approach

**For the monitoring environment:**
- Pre-cache Prisma binaries, or use `PRISMA_QUERY_ENGINE_TYPE=library` with a
  pre-installed binary, so `prisma generate` can succeed without outbound access.
- Alternatively, commit the generated `@prisma/client` output to the repo
  (not recommended for large repos but resolves the CI environment issue).

**For the TS2339 errors** (verify after `prisma generate` works):
- If `_max`/`_sum` errors persist after Prisma types are generated, they
  indicate real aggregation query type mismatches in
  `src/app/api/admin/conversations/route.ts`.
- If `stock`/`clientName` errors persist, check Prisma schema vs query shape in
  `src/app/api/products/bulk-stock/route.ts` and `src/app/api/customers/route.ts`.

---

## Next Steps

1. Fix monitoring environment: enable Prisma binary download or pre-install it.
2. Re-run `tsc --noEmit` after `prisma generate` succeeds to isolate genuine
   TypeScript errors from environment artifacts.
3. Investigate the 6 TS2339 semantic errors listed above — they may be real bugs.
