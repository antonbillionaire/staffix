import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock prisma before importing the module
vi.mock("@/lib/prisma", () => ({
  prisma: {
    webhookDedup: {
      create: vi.fn(),
      deleteMany: vi.fn(),
    },
  },
}));

import { markWebhookProcessed, cleanupWebhookDedup } from "../webhook-dedup";
import { prisma } from "@/lib/prisma";

describe("markWebhookProcessed", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns false for empty messageId", async () => {
    expect(await markWebhookProcessed("")).toBe(false);
  });

  it("returns true for new message (create succeeds)", async () => {
    vi.mocked(prisma.webhookDedup.create).mockResolvedValueOnce({
      id: "msg-123",
      processedAt: new Date(),
    });

    expect(await markWebhookProcessed("msg-123")).toBe(true);
    expect(prisma.webhookDedup.create).toHaveBeenCalledWith({
      data: { id: "msg-123" },
    });
  });

  it("returns false for duplicate message (create throws unique constraint)", async () => {
    vi.mocked(prisma.webhookDedup.create).mockRejectedValueOnce(
      new Error("Unique constraint failed")
    );

    expect(await markWebhookProcessed("msg-duplicate")).toBe(false);
  });
});

describe("cleanupWebhookDedup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("deletes entries older than 24 hours", async () => {
    vi.mocked(prisma.webhookDedup.deleteMany).mockResolvedValueOnce({ count: 42 });

    const result = await cleanupWebhookDedup();
    expect(result).toBe(42);
    expect(prisma.webhookDedup.deleteMany).toHaveBeenCalledWith({
      where: {
        processedAt: { lt: expect.any(Date) },
      },
    });
  });
});
