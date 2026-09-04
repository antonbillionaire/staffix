import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  getHumanTakeoverMinutes,
  computeTakeoverExpiry,
  isBotSilenced,
} from "../human-takeover";

const ORIG_ENV = process.env.HUMAN_TAKEOVER_MINUTES;

describe("getHumanTakeoverMinutes — env parsing", () => {
  beforeEach(() => {
    delete process.env.HUMAN_TAKEOVER_MINUTES;
  });
  afterEach(() => {
    if (ORIG_ENV === undefined) delete process.env.HUMAN_TAKEOVER_MINUTES;
    else process.env.HUMAN_TAKEOVER_MINUTES = ORIG_ENV;
  });

  it("env не задан → дефолт 30 мин", () => {
    expect(getHumanTakeoverMinutes()).toBe(30);
  });

  it("валидное число → возвращается как есть", () => {
    process.env.HUMAN_TAKEOVER_MINUTES = "45";
    expect(getHumanTakeoverMinutes()).toBe(45);
  });

  it("округление до целого", () => {
    process.env.HUMAN_TAKEOVER_MINUTES = "42.7";
    expect(getHumanTakeoverMinutes()).toBe(42);
  });

  it("мусор → дефолт 30", () => {
    process.env.HUMAN_TAKEOVER_MINUTES = "not a number";
    expect(getHumanTakeoverMinutes()).toBe(30);
  });

  it("пустая строка → дефолт 30", () => {
    process.env.HUMAN_TAKEOVER_MINUTES = "";
    expect(getHumanTakeoverMinutes()).toBe(30);
  });

  it("нулевое или отрицательное → дефолт 30", () => {
    process.env.HUMAN_TAKEOVER_MINUTES = "0";
    expect(getHumanTakeoverMinutes()).toBe(30);
    process.env.HUMAN_TAKEOVER_MINUTES = "-10";
    expect(getHumanTakeoverMinutes()).toBe(30);
  });

  it("меньше 1 (например 0.5) → кламп до 1", () => {
    process.env.HUMAN_TAKEOVER_MINUTES = "0.5";
    // 0.5 > 0 → пройдёт первую проверку, потом кламп до MIN_MINUTES=1
    expect(getHumanTakeoverMinutes()).toBe(1);
  });

  it("больше 24 часов → кламп до 1440 мин", () => {
    process.env.HUMAN_TAKEOVER_MINUTES = "99999";
    expect(getHumanTakeoverMinutes()).toBe(1440);
  });
});

describe("computeTakeoverExpiry", () => {
  afterEach(() => {
    if (ORIG_ENV === undefined) delete process.env.HUMAN_TAKEOVER_MINUTES;
    else process.env.HUMAN_TAKEOVER_MINUTES = ORIG_ENV;
  });

  it("дефолт → сейчас + 30 мин", () => {
    delete process.env.HUMAN_TAKEOVER_MINUTES;
    const now = new Date("2026-09-04T12:00:00Z");
    const expiry = computeTakeoverExpiry(now);
    expect(expiry.toISOString()).toBe("2026-09-04T12:30:00.000Z");
  });

  it("кастомный env → сейчас + N мин", () => {
    process.env.HUMAN_TAKEOVER_MINUTES = "15";
    const now = new Date("2026-09-04T12:00:00Z");
    const expiry = computeTakeoverExpiry(now);
    expect(expiry.toISOString()).toBe("2026-09-04T12:15:00.000Z");
  });
});

describe("isBotSilenced", () => {
  it("null → бот работает (false)", () => {
    expect(isBotSilenced(null)).toBe(false);
    expect(isBotSilenced(undefined)).toBe(false);
  });

  it("будущее время → бот молчит (true)", () => {
    const now = new Date("2026-09-04T12:00:00Z");
    const future = new Date("2026-09-04T12:15:00Z");
    expect(isBotSilenced(future, now)).toBe(true);
  });

  it("прошедшее время → бот работает (false)", () => {
    const now = new Date("2026-09-04T12:00:00Z");
    const past = new Date("2026-09-04T11:45:00Z");
    expect(isBotSilenced(past, now)).toBe(false);
  });

  it("ровно сейчас → бот работает (граница exclusive)", () => {
    const t = new Date("2026-09-04T12:00:00Z");
    // now === expiry → окно уже истекло, бот отвечает
    expect(isBotSilenced(t, t)).toBe(false);
  });

  it("на 1 мс раньше окончания → бот всё ещё молчит", () => {
    const now = new Date("2026-09-04T12:00:00Z");
    const expiry = new Date(now.getTime() + 1);
    expect(isBotSilenced(expiry, now)).toBe(true);
  });
});
