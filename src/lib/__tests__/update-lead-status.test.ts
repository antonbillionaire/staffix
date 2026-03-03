import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock prisma before importing
vi.mock("@/lib/prisma", () => ({
  prisma: {
    lead: {
      findFirst: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
    },
  },
}));

import { updateLeadStatus } from "../booking-tools";
import { prisma } from "@/lib/prisma";

const BIZ_ID = "biz-123";
const CLIENT_ID = "client-456";
const CHANNEL = "telegram";

function makeExistingLead(overrides: Record<string, unknown> = {}) {
  return {
    id: "lead-1",
    businessId: BIZ_ID,
    channel: CHANNEL,
    clientId: CLIENT_ID,
    clientName: null,
    source: "channel_message",
    status: "cold",
    statusReason: null,
    qualifiedAt: null,
    convertedAt: null,
    lastInteractionAt: new Date("2026-03-01"),
    ...overrides,
  };
}

describe("updateLeadStatus", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.lead.update).mockResolvedValue({} as never);
    vi.mocked(prisma.lead.create).mockResolvedValue({} as never);
  });

  // === Upgrade paths ===

  it("upgrades cold → warm", async () => {
    vi.mocked(prisma.lead.findFirst).mockResolvedValueOnce(makeExistingLead({ status: "cold" }) as never);

    const result = await updateLeadStatus(BIZ_ID, CLIENT_ID, CHANNEL, "warm", "Asked about services");
    expect(result.success).toBe(true);
    expect(result.previousStatus).toBe("cold");
    expect(result.newStatus).toBe("warm");
  });

  it("upgrades warm → hot", async () => {
    vi.mocked(prisma.lead.findFirst).mockResolvedValueOnce(makeExistingLead({ status: "warm" }) as never);

    const result = await updateLeadStatus(BIZ_ID, CLIENT_ID, CHANNEL, "hot");
    expect(result.success).toBe(true);
    expect(result.previousStatus).toBe("warm");
    expect(result.newStatus).toBe("hot");
  });

  it("upgrades hot → client", async () => {
    vi.mocked(prisma.lead.findFirst).mockResolvedValueOnce(
      makeExistingLead({ status: "hot", qualifiedAt: new Date("2026-03-01") }) as never
    );

    const result = await updateLeadStatus(BIZ_ID, CLIENT_ID, CHANNEL, "client");
    expect(result.success).toBe(true);
    expect(result.newStatus).toBe("client");
  });

  it("upgrades cold → client directly", async () => {
    vi.mocked(prisma.lead.findFirst).mockResolvedValueOnce(makeExistingLead({ status: "cold" }) as never);

    const result = await updateLeadStatus(BIZ_ID, CLIENT_ID, CHANNEL, "client");
    expect(result.success).toBe(true);
    expect(result.newStatus).toBe("client");
  });

  // === Downgrade prevention ===

  it("prevents downgrade hot → cold (keeps hot)", async () => {
    vi.mocked(prisma.lead.findFirst).mockResolvedValueOnce(makeExistingLead({ status: "hot" }) as never);

    const result = await updateLeadStatus(BIZ_ID, CLIENT_ID, CHANNEL, "cold");
    expect(result.success).toBe(true);
    expect(result.newStatus).toBe("hot");
  });

  it("prevents downgrade client → warm (keeps client)", async () => {
    vi.mocked(prisma.lead.findFirst).mockResolvedValueOnce(makeExistingLead({ status: "client" }) as never);

    const result = await updateLeadStatus(BIZ_ID, CLIENT_ID, CHANNEL, "warm");
    expect(result.success).toBe(true);
    expect(result.newStatus).toBe("client");
  });

  it("same status is allowed (not a downgrade)", async () => {
    vi.mocked(prisma.lead.findFirst).mockResolvedValueOnce(makeExistingLead({ status: "warm" }) as never);

    const result = await updateLeadStatus(BIZ_ID, CLIENT_ID, CHANNEL, "warm");
    expect(result.success).toBe(true);
    expect(result.newStatus).toBe("warm");
  });

  // === Timestamps ===

  it("sets qualifiedAt when upgrading to hot", async () => {
    vi.mocked(prisma.lead.findFirst).mockResolvedValueOnce(makeExistingLead({ status: "warm" }) as never);

    await updateLeadStatus(BIZ_ID, CLIENT_ID, CHANNEL, "hot");

    expect(prisma.lead.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          qualifiedAt: expect.any(Date),
        }),
      })
    );
  });

  it("does NOT overwrite existing qualifiedAt", async () => {
    const existingDate = new Date("2026-03-01T10:00:00Z");
    vi.mocked(prisma.lead.findFirst).mockResolvedValueOnce(
      makeExistingLead({ status: "hot", qualifiedAt: existingDate }) as never
    );

    await updateLeadStatus(BIZ_ID, CLIENT_ID, CHANNEL, "client");

    const updateCall = vi.mocked(prisma.lead.update).mock.calls[0][0];
    expect(updateCall.data).not.toHaveProperty("qualifiedAt");
  });

  it("sets convertedAt when upgrading to client", async () => {
    vi.mocked(prisma.lead.findFirst).mockResolvedValueOnce(makeExistingLead({ status: "hot" }) as never);

    await updateLeadStatus(BIZ_ID, CLIENT_ID, CHANNEL, "client");

    expect(prisma.lead.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          convertedAt: expect.any(Date),
        }),
      })
    );
  });

  it("does NOT overwrite existing convertedAt", async () => {
    const existingDate = new Date("2026-03-02T10:00:00Z");
    vi.mocked(prisma.lead.findFirst).mockResolvedValueOnce(
      makeExistingLead({ status: "client", convertedAt: existingDate }) as never
    );

    // Same status re-sent
    await updateLeadStatus(BIZ_ID, CLIENT_ID, CHANNEL, "client");

    const updateCall = vi.mocked(prisma.lead.update).mock.calls[0][0];
    expect(updateCall.data).not.toHaveProperty("convertedAt");
  });

  // === New lead creation ===

  it("creates new lead when none exists", async () => {
    vi.mocked(prisma.lead.findFirst).mockResolvedValueOnce(null);

    const result = await updateLeadStatus(BIZ_ID, CLIENT_ID, CHANNEL, "warm", "First contact");
    expect(result.success).toBe(true);
    expect(result.previousStatus).toBe("cold");
    expect(result.newStatus).toBe("warm");

    expect(prisma.lead.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          businessId: BIZ_ID,
          clientId: CLIENT_ID,
          channel: CHANNEL,
          status: "warm",
          source: "channel_message",
        }),
      })
    );
  });

  it("creates new lead with qualifiedAt when hot", async () => {
    vi.mocked(prisma.lead.findFirst).mockResolvedValueOnce(null);

    await updateLeadStatus(BIZ_ID, CLIENT_ID, CHANNEL, "hot");

    expect(prisma.lead.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          qualifiedAt: expect.any(Date),
        }),
      })
    );
  });

  it("creates new lead with convertedAt when client", async () => {
    vi.mocked(prisma.lead.findFirst).mockResolvedValueOnce(null);

    await updateLeadStatus(BIZ_ID, CLIENT_ID, CHANNEL, "client");

    expect(prisma.lead.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          convertedAt: expect.any(Date),
          qualifiedAt: expect.any(Date),
        }),
      })
    );
  });

  // === Client name ===

  it("updates clientName on existing lead", async () => {
    vi.mocked(prisma.lead.findFirst).mockResolvedValueOnce(makeExistingLead({ status: "cold" }) as never);

    await updateLeadStatus(BIZ_ID, CLIENT_ID, CHANNEL, "warm", "Asked price", "Алия");

    expect(prisma.lead.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          clientName: "Алия",
        }),
      })
    );
  });

  // === Error handling ===

  it("returns success: false on database error", async () => {
    vi.mocked(prisma.lead.findFirst).mockRejectedValueOnce(new Error("DB connection lost"));

    const result = await updateLeadStatus(BIZ_ID, CLIENT_ID, CHANNEL, "warm");
    expect(result.success).toBe(false);
  });
});
