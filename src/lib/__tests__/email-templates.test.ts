import { describe, it, expect, vi, beforeEach } from "vitest";

// Hoist the mock send function so it's available in vi.mock factory
const { mockSend } = vi.hoisted(() => ({
  mockSend: vi.fn(),
}));

// Mock resend with a proper class constructor
vi.mock("resend", () => ({
  Resend: class MockResend {
    emails = { send: mockSend };
  },
}));

// Set RESEND_API_KEY so getResend() returns a client
vi.stubEnv("RESEND_API_KEY", "re_test_123");

import {
  sendDripServicesReminder,
  sendDripChannelReminder,
  sendDripReengageReminder,
} from "../email";

describe("Drip email templates", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSend.mockResolvedValue({ data: { id: "email-1" }, error: null });
  });

  // === sendDripServicesReminder (Day 2) ===

  describe("sendDripServicesReminder", () => {
    it("sends successfully", async () => {
      const result = await sendDripServicesReminder("user@test.com", "Антон");
      expect(result.success).toBe(true);
    });

    it("includes user name in email", async () => {
      await sendDripServicesReminder("user@test.com", "Антон");
      const call = mockSend.mock.calls[0][0];
      expect(call.html).toContain("Антон");
    });

    it("has correct subject", async () => {
      await sendDripServicesReminder("user@test.com", "Антон");
      const call = mockSend.mock.calls[0][0];
      expect(call.subject).toContain("услуги");
    });

    it("links to services page", async () => {
      await sendDripServicesReminder("user@test.com", "Антон");
      const call = mockSend.mock.calls[0][0];
      expect(call.html).toContain("/dashboard/services");
    });

    it("handles Resend error", async () => {
      mockSend.mockResolvedValueOnce({ data: null, error: { message: "Rate limit" } });
      const result = await sendDripServicesReminder("user@test.com", "Антон");
      expect(result.success).toBe(false);
      expect(result.error).toBe("Rate limit");
    });

    it("handles thrown exception", async () => {
      mockSend.mockRejectedValueOnce(new Error("Network error"));
      const result = await sendDripServicesReminder("user@test.com", "Антон");
      expect(result.success).toBe(false);
      expect(result.error).toContain("Network error");
    });
  });

  // === sendDripChannelReminder (Day 5) ===

  describe("sendDripChannelReminder", () => {
    it("sends successfully", async () => {
      const result = await sendDripChannelReminder("user@test.com", "Марат");
      expect(result.success).toBe(true);
    });

    it("includes user name in email", async () => {
      await sendDripChannelReminder("user@test.com", "Марат");
      const call = mockSend.mock.calls[0][0];
      expect(call.html).toContain("Марат");
    });

    it("has correct subject about channels", async () => {
      await sendDripChannelReminder("user@test.com", "Марат");
      const call = mockSend.mock.calls[0][0];
      expect(call.subject).toContain("канал");
    });

    it("links to all three channel pages", async () => {
      await sendDripChannelReminder("user@test.com", "Марат");
      const call = mockSend.mock.calls[0][0];
      expect(call.html).toContain("/dashboard/channels/telegram");
      expect(call.html).toContain("/dashboard/channels/whatsapp");
      expect(call.html).toContain("/dashboard/channels/meta");
    });

    it("handles Resend error", async () => {
      mockSend.mockResolvedValueOnce({ data: null, error: { message: "Invalid email" } });
      const result = await sendDripChannelReminder("bad@", "Марат");
      expect(result.success).toBe(false);
    });
  });

  // === sendDripReengageReminder (Day 14) ===

  describe("sendDripReengageReminder", () => {
    it("sends successfully", async () => {
      const result = await sendDripReengageReminder("user@test.com", "Дана");
      expect(result.success).toBe(true);
    });

    it("includes user name in subject", async () => {
      await sendDripReengageReminder("user@test.com", "Дана");
      const call = mockSend.mock.calls[0][0];
      expect(call.subject).toContain("Дана");
    });

    it("has help-themed subject", async () => {
      await sendDripReengageReminder("user@test.com", "Дана");
      const call = mockSend.mock.calls[0][0];
      expect(call.subject).toContain("помощь");
    });

    it("links to dashboard", async () => {
      await sendDripReengageReminder("user@test.com", "Дана");
      const call = mockSend.mock.calls[0][0];
      expect(call.html).toContain("staffix.io/dashboard");
    });

    it("includes Staffix branding", async () => {
      await sendDripReengageReminder("user@test.com", "Дана");
      const call = mockSend.mock.calls[0][0];
      expect(call.html).toContain("Staffix");
      expect(call.html).toContain("staffix.io");
    });

    it("handles thrown exception", async () => {
      mockSend.mockRejectedValueOnce(new Error("Timeout"));
      const result = await sendDripReengageReminder("user@test.com", "Дана");
      expect(result.success).toBe(false);
    });
  });
});
