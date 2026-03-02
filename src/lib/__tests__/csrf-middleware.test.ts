import { describe, it, expect, vi, beforeEach } from "vitest";

// Test CSRF logic extracted from middleware
// Since middleware depends on Next.js, we test the core logic

describe("CSRF Origin validation", () => {
  const allowedOrigins = ["https://www.staffix.io", "https://staffix.io"];

  function isOriginAllowed(origin: string | null, isDev = false): boolean {
    if (!origin) return true; // same-origin requests don't send Origin
    const allowed = [...allowedOrigins];
    if (isDev) allowed.push("http://localhost:3000");
    return allowed.includes(origin);
  }

  it("allows requests without Origin header (same-origin)", () => {
    expect(isOriginAllowed(null)).toBe(true);
  });

  it("allows requests from staffix.io", () => {
    expect(isOriginAllowed("https://www.staffix.io")).toBe(true);
    expect(isOriginAllowed("https://staffix.io")).toBe(true);
  });

  it("rejects requests from unknown origins", () => {
    expect(isOriginAllowed("https://evil.com")).toBe(false);
    expect(isOriginAllowed("https://staffix.io.evil.com")).toBe(false);
  });

  it("allows localhost in dev mode", () => {
    expect(isOriginAllowed("http://localhost:3000", true)).toBe(true);
    expect(isOriginAllowed("http://localhost:3000", false)).toBe(false);
  });
});
