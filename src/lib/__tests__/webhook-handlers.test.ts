import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ─── Mocks (must be before imports) ─────────────────────────────────────────

vi.mock("@/lib/prisma", () => ({
  prisma: {
    business: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    subscription: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    webhookDedup: {
      create: vi.fn(),
    },
    conversation: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    message: {
      create: vi.fn(),
    },
    client: {
      upsert: vi.fn(),
    },
  },
}));

vi.mock("@/lib/channel-ai", () => ({
  generateChannelAIResponse: vi.fn().mockResolvedValue("AI reply text"),
}));

vi.mock("@/lib/subscription-check", () => ({
  checkSubscriptionLimit: vi.fn().mockResolvedValue({ allowed: true }),
  incrementMessageCount: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/staffix-sales-ai", () => ({
  generateStaffixSalesResponse: vi.fn().mockResolvedValue("Sales bot reply"),
}));

vi.mock("@/lib/meta-webhook-verify", () => ({
  verifyMetaWebhookSignature: vi.fn().mockReturnValue(true),
}));

vi.mock("@/lib/facebook-utils", () => ({
  getPageAccessToken: vi.fn().mockResolvedValue("page-token"),
  parseFBWebhookAll: vi.fn().mockReturnValue([]),
  sendFBMessage: vi.fn().mockResolvedValue(true),
  sendFBTyping: vi.fn().mockResolvedValue(true),
  parseLeadgenEvents: vi.fn().mockReturnValue([]),
  fetchLeadAdData: vi.fn().mockResolvedValue(null),
}));

vi.mock("@/lib/whatsapp-utils", () => ({
  parseWAWebhook: vi.fn().mockReturnValue(null),
  sendWAMessage: vi.fn().mockResolvedValue(true),
  markWAMessageRead: vi.fn().mockResolvedValue(true),
}));

vi.mock("@/lib/rate-limit", () => ({
  rateLimit: vi.fn().mockResolvedValue({ allowed: true, retryAfterSeconds: 0 }),
  getClientIp: vi.fn().mockReturnValue("127.0.0.1"),
}));

vi.mock("@/lib/webhook-dedup", () => ({
  markWebhookProcessed: vi.fn().mockResolvedValue(true),
}));

vi.mock("@anthropic-ai/sdk", () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: {
      create: vi.fn().mockResolvedValue({
        content: [{ type: "text", text: "AI Telegram reply" }],
        stop_reason: "end_turn",
        usage: { input_tokens: 100, output_tokens: 50 },
      }),
    },
  })),
}));

vi.mock("@/lib/ai-memory", () => ({
  buildClientContext: vi.fn().mockResolvedValue(null),
  buildBusinessContext: vi.fn().mockResolvedValue({
    name: "Test Biz",
    businessType: "salon",
    dashboardMode: null,
    language: "ru",
    phone: "+7999",
    address: "Test",
    city: "Test",
    country: "KZ",
    workingHours: "09-18",
    welcomeMessage: "Hi",
    aiTone: "friendly",
    aiRules: "",
    botDisplayName: null,
    services: [],
    products: [],
    faqs: [],
    staff: [],
    documents: [],
    loyaltyProgram: null,
  }),
  buildSystemPrompt: vi.fn().mockReturnValue("system prompt"),
  updateClientAfterMessage: vi.fn().mockResolvedValue(undefined),
  updateConversationMessageCount: vi.fn().mockResolvedValue(undefined),
  extractClientName: vi.fn().mockReturnValue(null),
  extractPhone: vi.fn().mockReturnValue(null),
}));

vi.mock("@/lib/booking-tools", () => ({
  bookingToolDefinitions: [],
  checkAvailability: vi.fn(),
  createBooking: vi.fn(),
  getServicesList: vi.fn(),
  getStaffList: vi.fn(),
  getClientBookings: vi.fn(),
  cancelBooking: vi.fn(),
  updateLeadStatus: vi.fn(),
}));

vi.mock("@/lib/notifications", () => ({
  sendBookingNotification: vi.fn(),
}));

vi.mock("@/lib/automation", () => ({
  formatDateRu: vi.fn().mockReturnValue("1 января"),
}));

vi.mock("@/lib/crm-integrations", () => ({
  dispatchCrmEvent: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/sales-tools", () => ({
  salesToolDefinitions: [],
  executeSalesTool: vi.fn(),
  notifyManagerByTelegram: vi.fn(),
}));

vi.mock("@/lib/sales-prompt", () => ({
  buildSalesSystemPrompt: vi.fn().mockReturnValue("sales prompt"),
  isSalesMode: vi.fn().mockReturnValue(false),
}));

import { prisma } from "@/lib/prisma";
import { verifyMetaWebhookSignature } from "@/lib/meta-webhook-verify";
import { markWebhookProcessed } from "@/lib/webhook-dedup";
import { generateChannelAIResponse } from "@/lib/channel-ai";
import { parseWAWebhook, sendWAMessage } from "@/lib/whatsapp-utils";
import { parseFBWebhookAll, sendFBMessage } from "@/lib/facebook-utils";
import { checkSubscriptionLimit } from "@/lib/subscription-check";

// ─── Helpers ────────────────────────────────────────────────────────────────

const savedEnv = { ...process.env };

// Global fetch mock for external API calls (Meta Graph API, Telegram API)
const mockFetch = vi.fn().mockResolvedValue({
  ok: true,
  json: () => Promise.resolve({ message_id: "123" }),
});

beforeEach(() => {
  vi.clearAllMocks();
  process.env = { ...savedEnv };
  process.env.META_APP_SECRET = "test-secret";
  process.env.ANTHROPIC_API_KEY = "test-key";
  global.fetch = mockFetch as unknown as typeof fetch;
});

afterEach(() => {
  process.env = savedEnv;
});

// ═══════════════════════════════════════════════════════════════════════════════
// INSTAGRAM WEBHOOK
// ═══════════════════════════════════════════════════════════════════════════════

describe("Instagram Webhook POST", () => {
  async function importHandler() {
    const mod = await import("@/app/api/instagram/webhook/route");
    return mod.POST;
  }

  const igBody = {
    object: "instagram",
    entry: [
      {
        id: "ig-account-123",
        messaging: [
          {
            sender: { id: "user-456" },
            message: { mid: "msg-789", text: "Hello" },
          },
        ],
      },
    ],
  };

  it("valid message -> business found -> AI response -> reply sent", async () => {
    vi.mocked(prisma.business.findFirst).mockResolvedValue({
      id: "biz-1",
      fbPageId: "page-1",
      fbPageAccessToken: "token-123",
      subscription: { messagesUsed: 5, messagesLimit: 100, expiresAt: new Date(Date.now() + 86400000) },
    } as never);

    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ name: "Test User" }),
    });

    const POST = await importHandler();
    const req = new Request("https://staffix.io/api/instagram/webhook", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(igBody),
    });
    const res = await POST(req);

    expect(res.status).toBe(200);
    expect(generateChannelAIResponse).toHaveBeenCalledWith(
      "biz-1",
      "instagram",
      "user-456",
      "Hello",
      expect.anything()
    );
    // sendIGMessage calls fetch to Meta Graph API
    expect(mockFetch).toHaveBeenCalled();
  });

  it("invalid signature -> 401", async () => {
    vi.mocked(verifyMetaWebhookSignature).mockReturnValueOnce(false);

    const POST = await importHandler();
    const req = new Request("https://staffix.io/api/instagram/webhook", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(igBody),
    });
    const res = await POST(req);

    expect(res.status).toBe(401);
  });

  it("duplicate message -> skipped via dedup", async () => {
    vi.mocked(markWebhookProcessed).mockResolvedValueOnce(false);

    const POST = await importHandler();
    const req = new Request("https://staffix.io/api/instagram/webhook", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(igBody),
    });
    const res = await POST(req);

    expect(res.status).toBe(200);
    expect(generateChannelAIResponse).not.toHaveBeenCalled();
  });

  it("expired subscription -> fallback message sent instead of AI", async () => {
    vi.mocked(checkSubscriptionLimit).mockResolvedValueOnce({ allowed: false, reason: "expired" });
    vi.mocked(prisma.business.findFirst).mockResolvedValue({
      id: "biz-1",
      fbPageId: "page-1",
      fbPageAccessToken: "token-123",
    } as never);

    const POST = await importHandler();
    const req = new Request("https://staffix.io/api/instagram/webhook", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(igBody),
    });
    const res = await POST(req);

    expect(res.status).toBe(200);
    expect(generateChannelAIResponse).not.toHaveBeenCalled();
    // Fallback message sent via fetch to Meta API
    const messageCalls = mockFetch.mock.calls.filter(
      (c: unknown[]) => typeof c[0] === "string" && (c[0] as string).includes("/messages")
    );
    expect(messageCalls.length).toBeGreaterThan(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// WHATSAPP WEBHOOK
// ═══════════════════════════════════════════════════════════════════════════════

describe("WhatsApp Webhook POST", () => {
  async function importHandler() {
    const mod = await import("@/app/api/whatsapp/webhook/route");
    return mod.POST;
  }

  it("valid message -> AI response -> reply sent", async () => {
    vi.mocked(parseWAWebhook).mockReturnValueOnce({
      waId: "79991234567",
      name: "Test User",
      text: "Hello WA",
      messageId: "wa-msg-1",
      phoneNumberId: "phone-123",
      type: "text",
    });

    vi.mocked(prisma.business.findFirst).mockResolvedValue({ id: "biz-wa" } as never);
    vi.mocked(prisma.business.findUnique).mockResolvedValue({
      waPhoneNumberId: "phone-123",
      waAccessToken: "wa-token",
      waActive: true,
      subscription: { messagesUsed: 0, messagesLimit: 100, expiresAt: new Date(Date.now() + 86400000) },
    } as never);

    const POST = await importHandler();
    const req = new Request("https://staffix.io/api/whatsapp/webhook", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ entry: [] }),
    });
    const res = await POST(req);

    expect(res.status).toBe(200);
    expect(generateChannelAIResponse).toHaveBeenCalledWith(
      "biz-wa", "whatsapp", "79991234567", "Hello WA", "Test User"
    );
    expect(sendWAMessage).toHaveBeenCalled();
  });

  it("invalid signature -> 401", async () => {
    vi.mocked(verifyMetaWebhookSignature).mockReturnValueOnce(false);

    const POST = await importHandler();
    const req = new Request("https://staffix.io/api/whatsapp/webhook", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    });
    const res = await POST(req);

    expect(res.status).toBe(401);
  });

  it("expired subscription -> fallback message sent", async () => {
    vi.mocked(checkSubscriptionLimit).mockResolvedValueOnce({ allowed: false, reason: "expired" });
    vi.mocked(parseWAWebhook).mockReturnValueOnce({
      waId: "79991234567",
      name: "Test User",
      text: "Hello",
      messageId: "wa-msg-2",
      phoneNumberId: "phone-123",
      type: "text",
    });

    vi.mocked(prisma.business.findFirst).mockResolvedValue({ id: "biz-wa" } as never);
    vi.mocked(prisma.business.findUnique).mockResolvedValue({
      waPhoneNumberId: "phone-123",
      waAccessToken: "wa-token",
      waActive: true,
    } as never);

    const POST = await importHandler();
    const req = new Request("https://staffix.io/api/whatsapp/webhook", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ entry: [] }),
    });
    const res = await POST(req);

    expect(res.status).toBe(200);
    expect(generateChannelAIResponse).not.toHaveBeenCalled();
    expect(sendWAMessage).toHaveBeenCalledWith(
      "phone-123", "wa-token", "79991234567",
      expect.stringContaining("временно не можем")
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// FACEBOOK WEBHOOK
// ═══════════════════════════════════════════════════════════════════════════════

describe("Facebook Webhook POST", () => {
  async function importHandler() {
    const mod = await import("@/app/api/facebook/webhook/route");
    return mod.POST;
  }

  it("valid message -> AI response -> reply sent", async () => {
    vi.mocked(parseFBWebhookAll).mockReturnValueOnce([
      { senderId: "fb-user-1", pageId: "fb-page-1", text: "Hello FB", messageId: "fb-msg-1" },
    ]);

    vi.mocked(prisma.business.findFirst).mockResolvedValue({ id: "biz-fb" } as never);
    vi.mocked(prisma.business.findUnique).mockResolvedValue({
      fbPageAccessToken: "fb-token",
      fbActive: true,
      subscription: { messagesUsed: 0, messagesLimit: 1000, expiresAt: new Date(Date.now() + 86400000) },
    } as never);

    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ first_name: "Test", last_name: "User" }),
    });

    const POST = await importHandler();
    const req = new Request("https://staffix.io/api/facebook/webhook", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ object: "page", entry: [] }),
    });
    const res = await POST(req);

    expect(res.status).toBe(200);
    expect(generateChannelAIResponse).toHaveBeenCalledWith(
      "biz-fb", "facebook", "fb-user-1", "Hello FB", expect.anything()
    );
    expect(sendFBMessage).toHaveBeenCalled();
  });

  it("invalid signature -> 401", async () => {
    vi.mocked(verifyMetaWebhookSignature).mockReturnValueOnce(false);

    const POST = await importHandler();
    const req = new Request("https://staffix.io/api/facebook/webhook", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    });
    const res = await POST(req);

    expect(res.status).toBe(401);
  });

  it("expired subscription -> fallback message sent", async () => {
    vi.mocked(checkSubscriptionLimit).mockResolvedValueOnce({ allowed: false, reason: "expired" });
    vi.mocked(parseFBWebhookAll).mockReturnValueOnce([
      { senderId: "fb-user-1", pageId: "fb-page-1", text: "Hello", messageId: "fb-msg-2" },
    ]);

    vi.mocked(prisma.business.findFirst).mockResolvedValue({ id: "biz-fb" } as never);
    vi.mocked(prisma.business.findUnique).mockResolvedValue({
      fbPageAccessToken: "fb-token",
      fbActive: true,
    } as never);

    const POST = await importHandler();
    const req = new Request("https://staffix.io/api/facebook/webhook", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ object: "page", entry: [] }),
    });
    const res = await POST(req);

    expect(res.status).toBe(200);
    expect(generateChannelAIResponse).not.toHaveBeenCalled();
    expect(sendFBMessage).toHaveBeenCalledWith(
      expect.any(String), "fb-user-1",
      expect.stringContaining("временно не можем"),
      "fb-page-1"
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// TELEGRAM WEBHOOK
// ═══════════════════════════════════════════════════════════════════════════════

describe("Telegram Webhook POST", () => {
  async function importHandler() {
    const mod = await import("@/app/api/telegram/webhook/route");
    return mod.POST;
  }

  const tgBody = {
    update_id: 12345,
    message: {
      message_id: 1,
      from: { id: 100, first_name: "Test", last_name: "User", username: "testuser" },
      chat: { id: 100, type: "private" },
      date: Math.floor(Date.now() / 1000),
      text: "Hello Telegram",
    },
  };

  it("valid message -> processes and returns 200", async () => {
    vi.mocked(prisma.business.findUnique).mockResolvedValue({
      id: "biz-tg",
      name: "Test Biz",
      botToken: "123:ABC",
      webhookSecret: null,
    } as never);

    // checkMessageLimit
    vi.mocked(prisma.subscription.findUnique).mockResolvedValue({
      businessId: "biz-tg",
      plan: "pro",
      messagesUsed: 5,
      messagesLimit: 1000,
      expiresAt: new Date(Date.now() + 86400000),
    } as never);

    // getOrCreateConversation
    vi.mocked((prisma as unknown as Record<string, unknown>).conversation as { findUnique: ReturnType<typeof vi.fn> }).findUnique
      .mockResolvedValue({ id: "conv-1", messages: [] });

    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ ok: true }),
    });

    const POST = await importHandler();
    const req = new Request("https://staffix.io/api/telegram/webhook?businessId=biz-tg", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(tgBody),
    });
    const res = await POST(req as never);

    expect(res.status).toBe(200);
  });

  it("invalid secret token -> 403", async () => {
    vi.mocked(prisma.business.findUnique).mockResolvedValue({
      id: "biz-tg",
      name: "Test Biz",
      botToken: "123:ABC",
      webhookSecret: "correct-secret",
    } as never);

    const POST = await importHandler();
    const req = new Request("https://staffix.io/api/telegram/webhook?businessId=biz-tg", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-telegram-bot-api-secret-token": "wrong-secret",
      },
      body: JSON.stringify(tgBody),
    });
    const res = await POST(req as never);

    expect(res.status).toBe(403);
  });

  it("no business found -> 401", async () => {
    vi.mocked(prisma.business.findUnique).mockResolvedValue(null);

    const POST = await importHandler();
    const req = new Request("https://staffix.io/api/telegram/webhook?businessId=nonexistent", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(tgBody),
    });
    const res = await POST(req as never);

    expect(res.status).toBe(401);
  });

  it("expired subscription -> sends limit reached message", async () => {
    vi.mocked(prisma.business.findUnique).mockResolvedValue({
      id: "biz-tg",
      name: "Test Biz",
      botToken: "123:ABC",
      webhookSecret: null,
    } as never);

    vi.mocked(prisma.subscription.findUnique).mockResolvedValue({
      businessId: "biz-tg",
      plan: "pro",
      messagesUsed: 5,
      messagesLimit: 1000,
      expiresAt: new Date(Date.now() - 86400000), // expired
    } as never);

    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ ok: true }),
    });

    const POST = await importHandler();
    const req = new Request("https://staffix.io/api/telegram/webhook?businessId=biz-tg", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(tgBody),
    });
    const res = await POST(req as never);

    expect(res.status).toBe(200);
    // Telegram handler sends fallback via fetch to Telegram API
    const tgCalls = mockFetch.mock.calls.filter(
      (c: unknown[]) => typeof c[0] === "string" && (c[0] as string).includes("api.telegram.org")
    );
    expect(tgCalls.length).toBeGreaterThan(0);
  });
});
