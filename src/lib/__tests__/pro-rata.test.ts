import { describe, it, expect } from "vitest";
import { calculateProRataCredit, planDailyPrice } from "@/lib/plans";

describe("planDailyPrice", () => {
  it("monthly Pro = $45 / 30 = $1.50", () => {
    expect(planDailyPrice("pro", "monthly")).toBeCloseTo(1.5, 5);
  });

  it("yearly Pro = $432 / 365 ≈ $1.18", () => {
    expect(planDailyPrice("pro", "yearly")).toBeCloseTo(1.183, 2);
  });

  it("trial = $0/day", () => {
    expect(planDailyPrice("trial", "monthly")).toBe(0);
  });
});

describe("calculateProRataCredit", () => {
  const NOW = new Date("2026-05-03T12:00:00Z");

  it("downgrade Business → Pro: 15 days left → ~31 extra Pro days", () => {
    const expiresAt = new Date(NOW.getTime() + 15 * 24 * 60 * 60 * 1000);
    const r = calculateProRataCredit({
      currentPlanId: "business",
      currentBillingPeriod: "monthly",
      expiresAt,
      targetPlanId: "pro",
      targetBillingPeriod: "monthly",
      now: NOW,
    });
    // Business $95/30 = $3.1667/day; 15 days = $47.50 credit
    expect(r.daysRemaining).toBeCloseTo(15, 1);
    expect(r.creditDollars).toBeCloseTo(47.5, 1);
    // $47.50 / ($45/30) = 31.67 days
    expect(r.creditDaysAtTarget).toBeCloseTo(31.67, 1);
  });

  it("upgrade Pro → Business: 10 days left → ~4.7 bonus Business days", () => {
    const expiresAt = new Date(NOW.getTime() + 10 * 24 * 60 * 60 * 1000);
    const r = calculateProRataCredit({
      currentPlanId: "pro",
      currentBillingPeriod: "monthly",
      expiresAt,
      targetPlanId: "business",
      targetBillingPeriod: "monthly",
      now: NOW,
    });
    // Pro $1.50/day * 10 = $15 credit
    // $15 / ($95/30) = $15 / $3.1667 = 4.74 days
    expect(r.creditDollars).toBeCloseTo(15, 1);
    expect(r.creditDaysAtTarget).toBeCloseTo(4.74, 1);
  });

  it("expired subscription: zero credit", () => {
    const expiresAt = new Date(NOW.getTime() - 5 * 24 * 60 * 60 * 1000);
    const r = calculateProRataCredit({
      currentPlanId: "pro",
      currentBillingPeriod: "monthly",
      expiresAt,
      targetPlanId: "business",
      targetBillingPeriod: "monthly",
      now: NOW,
    });
    expect(r.daysRemaining).toBe(0);
    expect(r.creditDollars).toBe(0);
    expect(r.creditDaysAtTarget).toBe(0);
  });

  it("yearly current → monthly target preserves dollar value", () => {
    // 100 days left of yearly Pro ($432/365 ≈ $1.183/day) = $118.36 credit
    const expiresAt = new Date(NOW.getTime() + 100 * 24 * 60 * 60 * 1000);
    const r = calculateProRataCredit({
      currentPlanId: "pro",
      currentBillingPeriod: "yearly",
      expiresAt,
      targetPlanId: "pro",
      targetBillingPeriod: "monthly",
      now: NOW,
    });
    // Should round-trip: same plan, monthly rate is more expensive per day,
    // so creditDays at monthly should be < daysRemaining.
    expect(r.creditDollars).toBeCloseTo(118.36, 0);
    // $118.36 / $1.50 = 78.9 days at monthly Pro
    expect(r.creditDaysAtTarget).toBeCloseTo(78.9, 0);
  });
});
