import { describe, it, expect, afterEach } from "vitest";
import { areBotsPaused } from "@/lib/bots-paused";

const ORIG = process.env.STAFFIX_BOTS_PAUSED;
afterEach(() => {
  if (ORIG === undefined) delete process.env.STAFFIX_BOTS_PAUSED;
  else process.env.STAFFIX_BOTS_PAUSED = ORIG;
});

describe("areBotsPaused — глобальный рубильник", () => {
  it("переменной нет — боты работают", () => {
    delete process.env.STAFFIX_BOTS_PAUSED;
    expect(areBotsPaused()).toBe(false);
  });

  it("STAFFIX_BOTS_PAUSED=1 — пауза", () => {
    process.env.STAFFIX_BOTS_PAUSED = "1";
    expect(areBotsPaused()).toBe(true);
  });

  it("любое другое значение паузу НЕ включает — чтобы опечатка не остановила продукт", () => {
    for (const v of ["0", "", "true", "yes", "on", " 1"]) {
      process.env.STAFFIX_BOTS_PAUSED = v;
      expect(areBotsPaused()).toBe(false);
    }
  });
});
