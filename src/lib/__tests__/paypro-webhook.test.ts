import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createHash } from "crypto";

// ─── Mocks ──────────────────────────────────────────────────────────────────

vi.mock("@/lib/prisma", () => ({
  prisma: {
    business: {
      findFirst: vi.fn(),
    },
    subscription: {
      upsert: vi.fn(),
      update: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock("@/lib/admin-notify", () => ({
  notifyNewPayment: vi.fn().mockResolvedValue(undefined),
}));

// We need to mock the paypro module's verifyIP, verifyHash, verifySignature
// but the route imports them, so we mock the whole module
vi.mock("@/lib/paypro", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/paypro")>();
  return {
    ...original,
    // Override verification functions for controlled testing
    verifyIP: vi.fn().mockReturnValue(true),
    verifyHash: vi.fn().mockReturnValue(true),
    verifySignature: vi.fn().mockReturnValue(true),
    parseIPN: vi.fn().mockImplementation((formData: URLSearchParams) => {
      // Use real parser logic for accurate tests
      const customFields = formData.get("ORDER_CUSTOM_FIELDS") || "";
      const customMap = new Map<string, string>();
      customFields.split(/[,;]/).forEach((pair) => {
        const [key, value] = pair.split("=");
        if (key && value) customMap.set(key.replace("x-", ""), value);
      });

      return {
        ipnTypeId: formData.get("IPN_TYPE_ID") || "",
        ipnTypeName: formData.get("IPN_TYPE_NAME") || "",
        testMode: formData.get("TEST_MODE") === "1",
        orderId: formData.get("ORDER_ID") || "",
        orderStatus: formData.get("ORDER_STATUS") || "",
        orderTotalAmount: formData.get("ORDER_TOTAL_AMOUNT") || "",
        orderCurrency: formData.get("ORDER_CURRENCY_CODE") || "",
        customerId: formData.get("CUSTOMER_ID") || "",
        customerEmail: formData.get("CUSTOMER_EMAIL") || "",
        customerFirstName: formData.get("CUSTOMER_FIRST_NAME") || "",
        customerLastName: formData.get("CUSTOMER_LAST_NAME") || "",
        productId: formData.get("PRODUCT_ID") || "",
        subscriptionId: formData.get("SUBSCRIPTION_ID") || "",
        subscriptionStatus: formData.get("SUBSCRIPTION_STATUS_NAME") || "",
        subscriptionNextChargeDate: formData.get("SUBSCRIPTION_NEXT_CHARGE_DATE") || "",
        subscriptionNextChargeAmount: formData.get("SUBSCRIPTION_NEXT_CHARGE_AMOUNT") || "",
        hash: formData.get("HASH") || "",
        signature: formData.get("SIGNATURE") || "",
        userId: customMap.get("userId") || "",
        planId: customMap.get("planId") || "",
        billingPeriod: customMap.get("billingPeriod") || "",
        packId: customMap.get("packId") || "",
      };
    }),
  };
});

import { prisma } from "@/lib/prisma";
import { verifyIP, verifyHash, verifySignature } from "@/lib/paypro";
import { notifyNewPayment } from "@/lib/admin-notify";

// ─── Helpers ────────────────────────────────────────────────────────────────

const savedEnv = { ...process.env };

/**
 * Build form-encoded body simulating PayPro IPN webhook
 */
function buildIPNBody(params: Record<string, string>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    sp.set(k, v);
  }
  return sp.toString();
}

function makePayProRequest(body: string): unknown {
  return new Request("https://staffix.io/api/webhooks/paypro", {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      "x-forwarded-for": "198.199.123.239",
    },
    body,
  });
}

const baseBusiness = {
  id: "biz-1",
  userId: "user-1",
  subscription: {
    id: "sub-1",
    businessId: "biz-1",
    plan: "pro",
    messagesUsed: 50,
    messagesLimit: 1000,
    expiresAt: new Date(Date.now() + 86400000),
    status: "active",
    billingPeriod: "monthly",
    payproOrderId: "order-old",
    payproSubscriptionId: "sub-old",
    payproCustomerId: "cust-old",
  },
};

const baseIPNFields = {
  IPN_TYPE_ID: "1", // ORDER_CHARGED
  IPN_TYPE_NAME: "OrderCharged",
  TEST_MODE: "1",
  ORDER_ID: "order-123",
  ORDER_STATUS: "Completed",
  ORDER_TOTAL_AMOUNT: "45.00",
  ORDER_CURRENCY_CODE: "USD",
  CUSTOMER_ID: "cust-1",
  CUSTOMER_EMAIL: "buyer@example.com",
  CUSTOMER_FIRST_NAME: "Test",
  CUSTOMER_LAST_NAME: "Buyer",
  PRODUCT_ID: "prod-1",
  SUBSCRIPTION_ID: "sub-new",
  HASH: "test-hash",
  SIGNATURE: "test-sig",
  ORDER_CUSTOM_FIELDS: "x-userId=user-1,x-planId=pro,x-billingPeriod=monthly",
};

beforeEach(() => {
  vi.clearAllMocks();
  process.env = { ...savedEnv };
  vi.mocked(verifyIP).mockReturnValue(true);
  vi.mocked(verifyHash).mockReturnValue(true);
  vi.mocked(verifySignature).mockReturnValue(true);
});

afterEach(() => {
  process.env = savedEnv;
});

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("PayPro Webhook POST", () => {
  async function importHandler() {
    const mod = await import("@/app/api/webhooks/paypro/route");
    return mod.POST;
  }

  // ── ORDER_CHARGED: Subscription purchase ──────────────────────────────────

  it("ORDER_CHARGED -> subscription created/updated", async () => {
    vi.mocked(prisma.business.findFirst).mockResolvedValue(baseBusiness as never);
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "user-1",
      name: "Test",
      email: "buyer@example.com",
    } as never);

    const POST = await importHandler();
    const body = buildIPNBody(baseIPNFields);
    const req = makePayProRequest(body);
    const res = await POST(req as never);

    expect(res.status).toBe(200);
    expect(prisma.subscription.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { businessId: "biz-1" },
        update: expect.objectContaining({
          plan: "pro",
          messagesUsed: 0,
          status: "active",
          billingPeriod: "monthly",
          payproOrderId: "order-123",
        }),
        create: expect.objectContaining({
          businessId: "biz-1",
          plan: "pro",
          status: "active",
        }),
      })
    );
    expect(notifyNewPayment).toHaveBeenCalled();
  });

  // ── SUBSCRIPTION_CHARGE_SUCCEED: Renewal ──────────────────────────────────

  it("SUBSCRIPTION_CHARGE_SUCCEED -> expiry extended + messages reset", async () => {
    vi.mocked(prisma.business.findFirst).mockResolvedValue(baseBusiness as never);

    const POST = await importHandler();
    const body = buildIPNBody({
      ...baseIPNFields,
      IPN_TYPE_ID: "6", // SUBSCRIPTION_CHARGE_SUCCEED
      IPN_TYPE_NAME: "SubscriptionChargeSucceed",
    });
    const req = makePayProRequest(body);
    const res = await POST(req as never);

    expect(res.status).toBe(200);
    expect(prisma.subscription.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "sub-1" },
        data: expect.objectContaining({
          messagesUsed: 0,
          status: "active",
          expiresAt: expect.any(Date),
        }),
      })
    );
  });

  // ── SUBSCRIPTION_TERMINATED: Cancellation ─────────────────────────────────

  it("SUBSCRIPTION_TERMINATED -> subscription cancelled (status expired)", async () => {
    vi.mocked(prisma.business.findFirst).mockResolvedValue(baseBusiness as never);

    const POST = await importHandler();
    const body = buildIPNBody({
      ...baseIPNFields,
      IPN_TYPE_ID: "10", // SUBSCRIPTION_TERMINATED
      IPN_TYPE_NAME: "SubscriptionTerminated",
    });
    const req = makePayProRequest(body);
    const res = await POST(req as never);

    expect(res.status).toBe(200);
    expect(prisma.subscription.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "sub-1" },
        data: expect.objectContaining({
          status: "expired",
          payproSubscriptionId: null,
        }),
      })
    );
  });

  // ── Invalid hash ──────────────────────────────────────────────────────────

  it("invalid hash -> 400", async () => {
    vi.mocked(verifyHash).mockReturnValueOnce(false);

    const POST = await importHandler();
    const body = buildIPNBody(baseIPNFields);
    const req = makePayProRequest(body);
    const res = await POST(req as never);

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("hash");
  });

  // ── Invalid signature ─────────────────────────────────────────────────────

  it("invalid signature -> 400", async () => {
    vi.mocked(verifySignature).mockReturnValueOnce(false);

    const POST = await importHandler();
    const body = buildIPNBody(baseIPNFields);
    const req = makePayProRequest(body);
    const res = await POST(req as never);

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("signature");
  });

  // ── Invalid IP ────────────────────────────────────────────────────────────

  it("invalid IP -> 403", async () => {
    vi.mocked(verifyIP).mockReturnValueOnce(false);

    const POST = await importHandler();
    const body = buildIPNBody(baseIPNFields);
    const req = makePayProRequest(body);
    const res = await POST(req as never);

    expect(res.status).toBe(403);
  });

  // ── Message pack purchase ─────────────────────────────────────────────────

  it("ORDER_CHARGED with packId -> messagesLimit increased", async () => {
    vi.mocked(prisma.business.findFirst).mockResolvedValue(baseBusiness as never);
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "user-1",
      name: "Test",
      email: "buyer@example.com",
    } as never);

    const POST = await importHandler();
    const body = buildIPNBody({
      ...baseIPNFields,
      ORDER_CUSTOM_FIELDS: "x-userId=user-1,x-packId=pack_500",
    });
    const req = makePayProRequest(body);
    const res = await POST(req as never);

    expect(res.status).toBe(200);
    // pack_500 = 500 messages
    expect(prisma.subscription.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "sub-1" },
        data: expect.objectContaining({
          messagesLimit: { increment: 500 },
        }),
      })
    );
    expect(notifyNewPayment).toHaveBeenCalled();
  });

  // ── Missing userId ────────────────────────────────────────────────────────

  it("missing userId in custom fields -> 400", async () => {
    const POST = await importHandler();
    const body = buildIPNBody({
      ...baseIPNFields,
      ORDER_CUSTOM_FIELDS: "x-planId=pro", // no userId
    });
    const req = makePayProRequest(body);
    const res = await POST(req as never);

    expect(res.status).toBe(400);
  });

  // ── ORDER_REFUNDED: Downgrade to trial ────────────────────────────────────

  it("ORDER_REFUNDED -> subscription downgraded to trial", async () => {
    vi.mocked(prisma.business.findFirst).mockResolvedValue(baseBusiness as never);

    const POST = await importHandler();
    const body = buildIPNBody({
      ...baseIPNFields,
      IPN_TYPE_ID: "2", // ORDER_REFUNDED
      IPN_TYPE_NAME: "OrderRefunded",
    });
    const req = makePayProRequest(body);
    const res = await POST(req as never);

    expect(res.status).toBe(200);
    expect(prisma.subscription.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "sub-1" },
        data: expect.objectContaining({
          status: "expired",
          plan: "trial",
          messagesLimit: 200,
          payproSubscriptionId: null,
        }),
      })
    );
  });

  // ── SUBSCRIPTION_SUSPENDED ────────────────────────────────────────────────

  it("SUBSCRIPTION_SUSPENDED -> status set to suspended", async () => {
    vi.mocked(prisma.business.findFirst).mockResolvedValue(baseBusiness as never);

    const POST = await importHandler();
    const body = buildIPNBody({
      ...baseIPNFields,
      IPN_TYPE_ID: "8", // SUBSCRIPTION_SUSPENDED
      IPN_TYPE_NAME: "SubscriptionSuspended",
    });
    const req = makePayProRequest(body);
    const res = await POST(req as never);

    expect(res.status).toBe(200);
    expect(prisma.subscription.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "sub-1" },
        data: { status: "suspended" },
      })
    );
  });

  // ── ORDER_CHARGED_BACK (chargeback) ───────────────────────────────────────

  it("ORDER_CHARGED_BACK -> subscription deactivated like refund", async () => {
    vi.mocked(prisma.business.findFirst).mockResolvedValue(baseBusiness as never);

    const POST = await importHandler();
    const body = buildIPNBody({
      ...baseIPNFields,
      IPN_TYPE_ID: "3", // ORDER_CHARGED_BACK
      IPN_TYPE_NAME: "OrderChargedBack",
    });
    const req = makePayProRequest(body);
    const res = await POST(req as never);

    expect(res.status).toBe(200);
    expect(prisma.subscription.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "expired",
          plan: "trial",
          messagesLimit: 200,
        }),
      })
    );
  });

  // ── Yearly billing period ─────────────────────────────────────────────────

  it("ORDER_CHARGED with yearly billing -> expiry set to +1 year", async () => {
    vi.mocked(prisma.business.findFirst).mockResolvedValue(baseBusiness as never);
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "user-1",
      name: "Test",
      email: "buyer@example.com",
    } as never);

    const POST = await importHandler();
    const body = buildIPNBody({
      ...baseIPNFields,
      ORDER_CUSTOM_FIELDS: "x-userId=user-1,x-planId=pro,x-billingPeriod=yearly",
    });
    const req = makePayProRequest(body);
    const res = await POST(req as never);

    expect(res.status).toBe(200);
    expect(prisma.subscription.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({
          billingPeriod: "yearly",
          expiresAt: expect.any(Date),
        }),
      })
    );

    // Verify the expiry date is roughly 1 year from now
    const call = vi.mocked(prisma.subscription.upsert).mock.calls[0][0] as { update: { expiresAt: Date } };
    const expiresAt = call.update.expiresAt;
    const oneYearMs = 365 * 24 * 60 * 60 * 1000;
    const diff = expiresAt.getTime() - Date.now();
    // Should be within 1 day of exactly 1 year
    expect(diff).toBeGreaterThan(oneYearMs - 86400000);
    expect(diff).toBeLessThan(oneYearMs + 86400000);
  });
});
