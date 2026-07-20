import { describe, it, expect } from "vitest";
import { isReasonableManualPoints } from "../loyalty-ledger";

describe("isReasonableManualPoints", () => {
  it("принимает нормальные значения", () => {
    expect(isReasonableManualPoints(500)).toBe(true);
    expect(isReasonableManualPoints(1)).toBe(true);
    expect(isReasonableManualPoints(100000)).toBe(true);
    expect(isReasonableManualPoints(-500)).toBe(true);
  });

  it("режет экстремальные значения (защита от опечатки менеджера)", () => {
    expect(isReasonableManualPoints(100001)).toBe(false);
    expect(isReasonableManualPoints(-100001)).toBe(false);
    expect(isReasonableManualPoints(999999999)).toBe(false);
  });

  it("отбрасывает не-числа", () => {
    expect(isReasonableManualPoints("500")).toBe(false);
    expect(isReasonableManualPoints(null)).toBe(false);
    expect(isReasonableManualPoints(undefined)).toBe(false);
    expect(isReasonableManualPoints(NaN)).toBe(false);
    expect(isReasonableManualPoints(Infinity)).toBe(false);
  });

  it("отбрасывает дробные", () => {
    expect(isReasonableManualPoints(500.5)).toBe(false);
    expect(isReasonableManualPoints(-1.1)).toBe(false);
  });
});
