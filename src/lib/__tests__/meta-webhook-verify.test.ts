import { describe, it, expect, afterEach } from "vitest";
import { verifyMetaWebhookSignature } from "../meta-webhook-verify";
import { createHmac } from "crypto";

describe("verifyMetaWebhookSignature", () => {
  const originalEnv = process.env;

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("returns false when META_APP_SECRET is not set (fail-secure)", () => {
    delete process.env.META_APP_SECRET;
    delete process.env.INSTAGRAM_APP_SECRET;
    expect(verifyMetaWebhookSignature("any body", null)).toBe(false);
  });

  it("returns false when signature header is missing", () => {
    process.env.META_APP_SECRET = "test-secret";
    expect(verifyMetaWebhookSignature("body", null)).toBe(false);
  });

  it("returns true for valid signature", () => {
    const secret = "my-app-secret";
    const body = '{"entry":[]}';
    process.env.META_APP_SECRET = secret;

    const expected = "sha256=" + createHmac("sha256", secret).update(body).digest("hex");
    expect(verifyMetaWebhookSignature(body, expected)).toBe(true);
  });

  it("returns false for invalid signature", () => {
    process.env.META_APP_SECRET = "my-app-secret";
    expect(verifyMetaWebhookSignature("body", "sha256=invalid")).toBe(false);
  });

  it("returns false for wrong format signature", () => {
    process.env.META_APP_SECRET = "my-app-secret";
    expect(verifyMetaWebhookSignature("body", "md5=something")).toBe(false);
  });
});
