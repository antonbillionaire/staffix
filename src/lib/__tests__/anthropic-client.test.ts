import { describe, it, expect, afterEach } from "vitest";
import { isAiEnabled, createAnthropic, AiDisabledError } from "@/lib/anthropic-client";

const ORIG = process.env.STAFFIX_AI_ENABLED;
afterEach(() => {
  if (ORIG === undefined) delete process.env.STAFFIX_AI_ENABLED;
  else process.env.STAFFIX_AI_ENABLED = ORIG;
});

describe("createAnthropic — выключен по умолчанию", () => {
  it("переменной нет — AI выключен, клиент не создаётся", () => {
    delete process.env.STAFFIX_AI_ENABLED;
    expect(isAiEnabled()).toBe(false);
    expect(() => createAnthropic("sk-test")).toThrow(AiDisabledError);
  });

  it("забытая или кривая переменная НЕ включает AI — расходы не возвращаются сами", () => {
    for (const v of ["0", "", "true", "yes", "on", " 1"]) {
      process.env.STAFFIX_AI_ENABLED = v;
      expect(isAiEnabled()).toBe(false);
      expect(() => createAnthropic("sk-test")).toThrow(AiDisabledError);
    }
  });

  it("STAFFIX_AI_ENABLED=1 — клиент создаётся", () => {
    process.env.STAFFIX_AI_ENABLED = "1";
    expect(isAiEnabled()).toBe(true);
    expect(createAnthropic("sk-test")).toBeDefined();
  });

  it("включено, но ключа нет — понятная ошибка, а не падение в SDK", () => {
    process.env.STAFFIX_AI_ENABLED = "1";
    const orig = process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    expect(() => createAnthropic()).toThrow(/ANTHROPIC_API_KEY/);
    if (orig !== undefined) process.env.ANTHROPIC_API_KEY = orig;
  });
});
