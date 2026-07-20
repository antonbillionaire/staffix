import { describe, it, expect } from "vitest";
import { normalizeAdAccountId } from "../ad-insights";

describe("normalizeAdAccountId", () => {
  it("оборачивает голый ID в act_ префикс", () => {
    expect(normalizeAdAccountId("123456789")).toBe("act_123456789");
  });

  it("не дублирует act_ если он уже есть", () => {
    expect(normalizeAdAccountId("act_123456789")).toBe("act_123456789");
  });

  it("тримит пробелы", () => {
    expect(normalizeAdAccountId("  987654321  ")).toBe("act_987654321");
  });

  it("возвращает null для пустых значений", () => {
    expect(normalizeAdAccountId("")).toBeNull();
    expect(normalizeAdAccountId("  ")).toBeNull();
    expect(normalizeAdAccountId(null)).toBeNull();
    expect(normalizeAdAccountId(undefined)).toBeNull();
  });
});
