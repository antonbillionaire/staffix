# Test Report — 2026-07-20

## Summary

10 tests failing across 2 test files. TypeScript (`npx tsc --noEmit`) passes with no errors.
All failures are caused by **production code changes that are not yet reflected in test mocks** — no production logic bugs.

---

## Failing Tests

### 1. `src/lib/__tests__/paypro-webhook.test.ts` — 2 failures

| Test | Error |
|------|-------|
| `ORDER_REFUNDED -> subscription downgraded to trial` | `prisma.subscription.update` was never called (0 calls) |
| `ORDER_CHARGED_BACK -> subscription deactivated like refund` | `prisma.subscription.update` was never called (0 calls) |

**Root cause**: Production code in `src/app/api/webhooks/paypro/route.ts` (lines 388–398 and 431–439) now guards refund/chargeback processing with an order-ID match check:
```ts
if (business.subscription.payproOrderId && business.subscription.payproOrderId !== ipn.orderId) {
  // "does not match active subscription order" — subscription untouched
  break;
}
```
The test mock (`baseBusiness`) has `subscription.payproOrderId: "order-old"`, while `baseIPNFields.ORDER_ID` is `"order-123"`. The guard fires, skips the `prisma.subscription.update` call, and the test assertion fails.

**Affected files**: test file only — `src/lib/__tests__/paypro-webhook.test.ts`

---

### 2. `src/lib/__tests__/webhook-handlers.test.ts` — 8 failures

| Test | Error |
|------|-------|
| Instagram: `valid message -> business found -> AI response -> reply sent` | `generateChannelAIResponse` not called (0 calls) |
| Instagram: `expired subscription -> fallback message sent instead of AI` | `sendIGMessage` fetch calls count = 0 |
| WhatsApp: `valid message -> AI response -> reply sent` | `generateChannelAIResponse` not called (0 calls) |
| WhatsApp: `expired subscription -> fallback message sent` | `sendWAMessage` not called (0 calls) |
| Facebook: `valid message -> AI response -> reply sent` | `generateChannelAIResponse` not called (0 calls) |
| Facebook: `expired subscription -> fallback message sent` | `sendFBMessage` not called (0 calls) |
| Telegram: `invalid secret token -> 403` | Got `200`, expected `403` |
| Telegram: `expired subscription -> sends limit reached message` | `api.telegram.org` fetch calls count = 0 |

**Root cause**: All three social webhook routes plus Telegram now check `botActive` on the fetched business and return early (200 OK) if it is falsy:

- `src/app/api/instagram/webhook/route.ts` line 287, 294–296
- `src/app/api/whatsapp/webhook/route.ts` line 187, 196–198
- `src/app/api/facebook/webhook/route.ts` line 227, 232–234
- `src/app/api/telegram/webhook/route.ts` line 135–136

The test mocks for `prisma.business.findFirst` / `prisma.business.findUnique` in these 8 tests do **not** include `botActive: true`, so `business.botActive` is `undefined` (falsy), triggering the early-exit path before the subscription check or secret-token validation is reached.

**Affected files**: test file only — `src/lib/__tests__/webhook-handlers.test.ts`

---

## Suggested Fix Approach

### paypro-webhook.test.ts — 2 tests

In the `ORDER_REFUNDED` and `ORDER_CHARGED_BACK` tests, override the mock so `subscription.payproOrderId` matches `baseIPNFields.ORDER_ID` (`"order-123"`), allowing the guard to pass:

```ts
vi.mocked(prisma.business.findFirst).mockResolvedValue({
  ...baseBusiness,
  subscription: { ...baseBusiness.subscription, payproOrderId: "order-123" },
} as never);
```

Apply this to both failing test cases.

### webhook-handlers.test.ts — 8 tests

Add `botActive: true` to the `prisma.business.findFirst` / `prisma.business.findUnique` mock in each of the 8 failing tests:

```ts
// Instagram valid message mock:
vi.mocked(prisma.business.findFirst).mockResolvedValue({
  id: "biz-1",
  fbPageId: "page-1",
  fbPageAccessToken: "token-123",
  botActive: true,          // ← add this
  subscription: { ... },
} as never);

// WhatsApp and Facebook findUnique mocks — same pattern: add botActive: true
// Telegram findUnique mock for "invalid secret token" test — add botActive: true
```

---

## Fix Classification

- **Files affected**: `src/lib/__tests__/paypro-webhook.test.ts`, `src/lib/__tests__/webhook-handlers.test.ts`
- **Production code**: unchanged — TSC passes, no production bug
- **Total lines to change**: ~15 lines across 2 test files (exceeds the 5-line auto-fix threshold)
- **Risk**: Low — all changes are additive mock fields in test files only

---

## Checks Run

| Check | Result |
|-------|--------|
| `npm test` | 10 failed / 278 passed |
| `npx tsc --noEmit` | ✅ 0 errors |
