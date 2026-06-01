import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    business: {
      findUnique: vi.fn(),
    },
    subscription: {
      update: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/prisma";
import { checkSubscriptionLimit, incrementMessageCount } from "@/lib/subscription-check";

beforeEach(() => {
  vi.clearAllMocks();
});

// Helper — build a Business shape with optional subscription + non-blocked owner.
function mockBusiness(
  sub: {
    messagesUsed: number;
    messagesLimit: number;
    expiresAt: Date | null;
    status?: string;
  } | null,
  opts: { isBlocked?: boolean } = {}
) {
  return {
    subscription: sub,
    user: { isBlocked: opts.isBlocked ?? false },
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// checkSubscriptionLimit
// ═══════════════════════════════════════════════════════════════════════════════

describe("checkSubscriptionLimit", () => {
  it("no subscription -> allowed (free tier)", async () => {
    vi.mocked(prisma.business.findUnique).mockResolvedValue(
      mockBusiness(null) as never
    );

    const result = await checkSubscriptionLimit("biz-1");

    expect(result.allowed).toBe(true);
    expect(result.reason).toBeUndefined();
  });

  it("active subscription within limits -> allowed", async () => {
    vi.mocked(prisma.business.findUnique).mockResolvedValue(
      mockBusiness({
        messagesUsed: 50,
        messagesLimit: 1000,
        expiresAt: new Date(Date.now() + 86400000), // tomorrow
      }) as never
    );

    const result = await checkSubscriptionLimit("biz-1");

    expect(result.allowed).toBe(true);
    expect(result.subscription?.messagesUsed).toBe(50);
  });

  it("unlimited messages (-1) -> allowed", async () => {
    vi.mocked(prisma.business.findUnique).mockResolvedValue(
      mockBusiness({
        messagesUsed: 999999,
        messagesLimit: -1,
        expiresAt: new Date(Date.now() + 86400000),
      }) as never
    );

    const result = await checkSubscriptionLimit("biz-1");

    expect(result.allowed).toBe(true);
  });

  it("no expiration date (null) -> allowed", async () => {
    vi.mocked(prisma.business.findUnique).mockResolvedValue(
      mockBusiness({
        messagesUsed: 10,
        messagesLimit: 100,
        expiresAt: null,
      }) as never
    );

    const result = await checkSubscriptionLimit("biz-1");

    expect(result.allowed).toBe(true);
  });

  it("expired subscription -> not allowed, reason=expired", async () => {
    vi.mocked(prisma.business.findUnique).mockResolvedValue(
      mockBusiness({
        messagesUsed: 50,
        messagesLimit: 1000,
        expiresAt: new Date(Date.now() - 86400000), // yesterday
      }) as never
    );

    const result = await checkSubscriptionLimit("biz-1");

    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("expired");
  });

  it("message limit reached -> not allowed, reason=limit_reached", async () => {
    vi.mocked(prisma.business.findUnique).mockResolvedValue(
      mockBusiness({
        messagesUsed: 1000,
        messagesLimit: 1000,
        expiresAt: new Date(Date.now() + 86400000),
      }) as never
    );

    const result = await checkSubscriptionLimit("biz-1");

    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("limit_reached");
  });

  it("message limit exceeded -> not allowed", async () => {
    vi.mocked(prisma.business.findUnique).mockResolvedValue(
      mockBusiness({
        messagesUsed: 1500,
        messagesLimit: 1000,
        expiresAt: new Date(Date.now() + 86400000),
      }) as never
    );

    const result = await checkSubscriptionLimit("biz-1");

    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("limit_reached");
  });

  it("expired takes priority over limit_reached", async () => {
    vi.mocked(prisma.business.findUnique).mockResolvedValue(
      mockBusiness({
        messagesUsed: 1000,
        messagesLimit: 1000,
        expiresAt: new Date(Date.now() - 86400000), // expired AND limit reached
      }) as never
    );

    const result = await checkSubscriptionLimit("biz-1");

    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("expired"); // expired checked first
  });

  it("suspended status -> not allowed, reason=suspended (takes priority)", async () => {
    vi.mocked(prisma.business.findUnique).mockResolvedValue(
      mockBusiness({
        messagesUsed: 50,
        messagesLimit: 1000,
        expiresAt: new Date(Date.now() + 86400000),
        status: "suspended",
      }) as never
    );

    const result = await checkSubscriptionLimit("biz-1");

    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("suspended");
  });

  it("blocked user -> not allowed, reason=blocked (takes priority over subscription)", async () => {
    vi.mocked(prisma.business.findUnique).mockResolvedValue(
      mockBusiness(
        {
          messagesUsed: 50,
          messagesLimit: 1000,
          expiresAt: new Date(Date.now() + 86400000),
        },
        { isBlocked: true }
      ) as never
    );

    const result = await checkSubscriptionLimit("biz-1");

    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("blocked");
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// incrementMessageCount
// ═══════════════════════════════════════════════════════════════════════════════

describe("incrementMessageCount", () => {
  it("increments messagesUsed", async () => {
    vi.mocked(prisma.subscription.update).mockResolvedValue({} as never);

    await incrementMessageCount("biz-1");

    expect(prisma.subscription.update).toHaveBeenCalledWith({
      where: { businessId: "biz-1" },
      data: { messagesUsed: { increment: 1 } },
    });
  });

  it("no-op if subscription does not exist (no throw)", async () => {
    vi.mocked(prisma.subscription.update).mockRejectedValue(new Error("Record not found"));

    // Should NOT throw
    await expect(incrementMessageCount("biz-no-sub")).resolves.toBeUndefined();
  });
});
