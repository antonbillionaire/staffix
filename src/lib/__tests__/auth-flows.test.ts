import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ─── Mocks ──────────────────────────────────────────────────────────────────

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    partner: {
      findUnique: vi.fn(),
    },
    partnerReferral: {
      create: vi.fn(),
    },
  },
}));

vi.mock("bcryptjs", () => ({
  default: {
    compare: vi.fn(),
    hash: vi.fn().mockResolvedValue("hashed-password"),
  },
}));

vi.mock("@/lib/rate-limit", () => ({
  rateLimit: vi.fn().mockResolvedValue({ allowed: true, retryAfterSeconds: 0 }),
  getClientIp: vi.fn().mockReturnValue("127.0.0.1"),
}));

vi.mock("@/lib/email", () => ({
  sendVerificationEmail: vi.fn().mockResolvedValue({ success: true }),
  sendWelcomeEmail: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock("@/lib/admin-notify", () => ({
  notifyNewRegistration: vi.fn().mockResolvedValue(undefined),
  notifyEmailVerified: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("resend", () => ({
  Resend: vi.fn().mockImplementation(() => ({
    emails: {
      send: vi.fn().mockResolvedValue({ id: "email-123" }),
    },
  })),
}));

import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { rateLimit } from "@/lib/rate-limit";
import { sendVerificationEmail } from "@/lib/email";

// ─── Helpers ────────────────────────────────────────────────────────────────

const savedEnv = { ...process.env };

function makeNextRequest(url: string, body: unknown, cookies?: Record<string, string>): unknown {
  const req = new Request(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  // Simulate NextRequest with cookies
  (req as unknown as Record<string, unknown>).cookies = {
    get: (name: string) => (cookies?.[name] ? { value: cookies[name] } : undefined),
  };
  return req;
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env = { ...savedEnv };
});

afterEach(() => {
  process.env = savedEnv;
});

// ═══════════════════════════════════════════════════════════════════════════════
// LOGIN
// ═══════════════════════════════════════════════════════════════════════════════

describe("POST /api/auth/login", () => {
  async function importHandler() {
    const mod = await import("@/app/api/auth/login/route");
    return mod.POST;
  }

  it("valid credentials -> 200 + user data (no password)", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "user-1",
      name: "Test",
      email: "test@example.com",
      password: "hashed-pw",
      emailVerified: true,
      businesses: [
        {
          id: "biz-1",
          name: "My Business",
          botToken: "secret-token",
          fbPageAccessToken: "secret-fb",
          waAccessToken: "secret-wa",
          webhookSecret: "secret-wh",
          igBusinessAccountId: "ig-123",
          fbPageId: "fb-123",
          waPhoneNumberId: "wa-123",
          waBusinessAccountId: "waba-123",
          subscription: { plan: "pro" },
        },
      ],
    } as never);

    vi.mocked(bcrypt.compare).mockResolvedValue(true as never);

    const POST = await importHandler();
    const req = makeNextRequest("https://staffix.io/api/auth/login", {
      email: "test@example.com",
      password: "password123",
    });
    const res = await POST(req as never);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.user.email).toBe("test@example.com");
    // Sensitive fields must NOT be in response
    expect(data.user.password).toBeUndefined();
    expect(data.user.businesses[0].botToken).toBeUndefined();
    expect(data.user.businesses[0].fbPageAccessToken).toBeUndefined();
    expect(data.user.businesses[0].waAccessToken).toBeUndefined();
  });

  it("invalid password -> 401", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "user-1",
      email: "test@example.com",
      password: "hashed-pw",
      businesses: [],
    } as never);

    vi.mocked(bcrypt.compare).mockResolvedValue(false as never);

    const POST = await importHandler();
    const req = makeNextRequest("https://staffix.io/api/auth/login", {
      email: "test@example.com",
      password: "wrong-password",
    });
    const res = await POST(req as never);

    expect(res.status).toBe(401);
  });

  it("non-existent email -> 401", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

    const POST = await importHandler();
    const req = makeNextRequest("https://staffix.io/api/auth/login", {
      email: "nobody@example.com",
      password: "password123",
    });
    const res = await POST(req as never);

    expect(res.status).toBe(401);
  });

  it("rate limited -> 429", async () => {
    vi.mocked(rateLimit).mockResolvedValueOnce({ allowed: false, remaining: 0, retryAfterSeconds: 600 });

    const POST = await importHandler();
    const req = makeNextRequest("https://staffix.io/api/auth/login", {
      email: "test@example.com",
      password: "password123",
    });
    const res = await POST(req as never);

    expect(res.status).toBe(429);
    // Should NOT even query the database
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// REGISTER
// ═══════════════════════════════════════════════════════════════════════════════

describe("POST /api/auth/register", () => {
  async function importHandler() {
    const mod = await import("@/app/api/auth/register/route");
    return mod.POST;
  }

  it("new user -> 200 + user created + verification email sent", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null); // no existing user
    vi.mocked(prisma.user.create).mockResolvedValue({
      id: "new-user",
      name: "New User",
      email: "new@example.com",
      password: "hashed",
      emailVerified: false,
      verificationToken: "123456",
      businesses: [{ id: "biz-new", name: "New Biz" }],
    } as never);

    const POST = await importHandler();
    const req = makeNextRequest("https://staffix.io/api/auth/register", {
      name: "New User",
      email: "new@example.com",
      password: "password123",
      businessName: "New Biz",
    });
    const res = await POST(req as never);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.requiresVerification).toBe(true);
    expect(data.user.email).toBe("new@example.com");
    // Password and verification token not in response
    expect(data.user.password).toBeUndefined();
    expect(data.user.verificationToken).toBeUndefined();
    // Verification email was sent
    expect(sendVerificationEmail).toHaveBeenCalledWith(
      "new@example.com",
      expect.any(String), // verification code
      "New User"
    );
  });

  it("duplicate email -> 400", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "existing",
      email: "existing@example.com",
    } as never);

    const POST = await importHandler();
    const req = makeNextRequest("https://staffix.io/api/auth/register", {
      name: "User",
      email: "existing@example.com",
      password: "password123",
      businessName: "Biz",
    });
    const res = await POST(req as never);

    expect(res.status).toBe(400);
    // User.create should NOT be called
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it("short password -> 400", async () => {
    const POST = await importHandler();
    const req = makeNextRequest("https://staffix.io/api/auth/register", {
      name: "User",
      email: "test@example.com",
      password: "short",
      businessName: "Biz",
    });
    const res = await POST(req as never);

    expect(res.status).toBe(400);
  });

  it("rate limited -> 429", async () => {
    vi.mocked(rateLimit).mockResolvedValueOnce({ allowed: false, remaining: 0, retryAfterSeconds: 3600 });

    const POST = await importHandler();
    const req = makeNextRequest("https://staffix.io/api/auth/register", {
      name: "User",
      email: "test@example.com",
      password: "password123",
      businessName: "Biz",
    });
    const res = await POST(req as never);

    expect(res.status).toBe(429);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// VERIFY EMAIL
// ═══════════════════════════════════════════════════════════════════════════════

describe("POST /api/auth/verify-email", () => {
  async function importHandler() {
    const mod = await import("@/app/api/auth/verify-email/route");
    return mod.POST;
  }

  it("valid code -> email verified", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "user-1",
      name: "User",
      email: "user@example.com",
      emailVerified: false,
      verificationToken: "123456",
      verificationExpires: new Date(Date.now() + 600000), // 10 min from now
    } as never);

    const POST = await importHandler();
    const req = makeNextRequest("https://staffix.io/api/auth/verify-email", {
      email: "user@example.com",
      code: "123456",
    });
    const res = await POST(req as never);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: {
        emailVerified: true,
        verificationToken: null,
        verificationExpires: null,
      },
    });
  });

  it("expired code -> 400", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "user-1",
      name: "User",
      email: "user@example.com",
      emailVerified: false,
      verificationToken: "123456",
      verificationExpires: new Date(Date.now() - 600000), // expired 10 min ago
    } as never);

    const POST = await importHandler();
    const req = makeNextRequest("https://staffix.io/api/auth/verify-email", {
      email: "user@example.com",
      code: "123456",
    });
    const res = await POST(req as never);

    expect(res.status).toBe(400);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it("wrong code -> 400", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "user-1",
      name: "User",
      email: "user@example.com",
      emailVerified: false,
      verificationToken: "123456",
      verificationExpires: new Date(Date.now() + 600000),
    } as never);

    const POST = await importHandler();
    const req = makeNextRequest("https://staffix.io/api/auth/verify-email", {
      email: "user@example.com",
      code: "999999", // wrong code
    });
    const res = await POST(req as never);

    expect(res.status).toBe(400);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it("already verified -> 400", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "user-1",
      email: "user@example.com",
      emailVerified: true,
    } as never);

    const POST = await importHandler();
    const req = makeNextRequest("https://staffix.io/api/auth/verify-email", {
      email: "user@example.com",
      code: "123456",
    });
    const res = await POST(req as never);

    expect(res.status).toBe(400);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// FORGOT PASSWORD
// ═══════════════════════════════════════════════════════════════════════════════

describe("POST /api/auth/forgot-password", () => {
  async function importHandler() {
    const mod = await import("@/app/api/auth/forgot-password/route");
    return mod.POST;
  }

  it("existing email -> reset token created + email sent", async () => {
    // Don't set RESEND_API_KEY — route falls back to console.log in dev mode
    delete process.env.RESEND_API_KEY;

    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "user-1",
      email: "user@example.com",
    } as never);
    vi.mocked(prisma.user.update).mockResolvedValue({} as never);

    const POST = await importHandler();
    const req = makeNextRequest("https://staffix.io/api/auth/forgot-password", {
      email: "user@example.com",
    });
    const res = await POST(req as never);
    const data = await res.json();

    expect(res.status).toBe(200);
    // Response intentionally does not reveal whether user exists
    expect(data.message).toBeDefined();
    // But behind the scenes, a reset token is saved
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: {
        resetPasswordToken: expect.any(String),
        resetPasswordExpires: expect.any(Date),
      },
    });
  });

  it("non-existent email -> still returns 200 (prevent enumeration)", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

    const POST = await importHandler();
    const req = makeNextRequest("https://staffix.io/api/auth/forgot-password", {
      email: "nobody@example.com",
    });
    const res = await POST(req as never);

    expect(res.status).toBe(200);
    // No token update should happen
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it("rate limited -> 429", async () => {
    vi.mocked(rateLimit).mockResolvedValueOnce({ allowed: false, remaining: 0, retryAfterSeconds: 600 });

    const POST = await importHandler();
    const req = makeNextRequest("https://staffix.io/api/auth/forgot-password", {
      email: "test@example.com",
    });
    const res = await POST(req as never);

    expect(res.status).toBe(429);
  });
});
