import { describe, it, expect } from "vitest";
import { parseWorkingHours } from "../booking-tools";

describe("parseWorkingHours", () => {
  // Helper: create a date for a specific day of week (0=Sun, 1=Mon, etc.)
  const monday = new Date("2026-03-02"); // Monday
  const saturday = new Date("2026-03-07"); // Saturday
  const sunday = new Date("2026-03-08"); // Sunday
  const wednesday = new Date("2026-03-04"); // Wednesday

  it("returns default 09:00-18:00 for null input", () => {
    expect(parseWorkingHours(null, monday)).toEqual({
      startHour: 9, startMinute: 0, endHour: 18, endMinute: 0,
    });
  });

  it("returns default 09:00-18:00 for empty string", () => {
    expect(parseWorkingHours("", monday)).toEqual({
      startHour: 9, startMinute: 0, endHour: 18, endMinute: 0,
    });
  });

  it("parses simple time range 09:00-18:00", () => {
    expect(parseWorkingHours("09:00-18:00", monday)).toEqual({
      startHour: 9, startMinute: 0, endHour: 18, endMinute: 0,
    });
  });

  it("parses time range with spaces 10:00 - 20:00", () => {
    expect(parseWorkingHours("10:00 - 20:00", monday)).toEqual({
      startHour: 10, startMinute: 0, endHour: 20, endMinute: 0,
    });
  });

  it("parses time range with minutes 09:30-17:45", () => {
    expect(parseWorkingHours("09:30-17:45", monday)).toEqual({
      startHour: 9, startMinute: 30, endHour: 17, endMinute: 45,
    });
  });

  it("parses Russian format 'с 9 до 18'", () => {
    expect(parseWorkingHours("с 9 до 18", monday)).toEqual({
      startHour: 9, startMinute: 0, endHour: 18, endMinute: 0,
    });
  });

  it("parses Russian format 'С 10 до 20'", () => {
    expect(parseWorkingHours("С 10 до 20", monday)).toEqual({
      startHour: 10, startMinute: 0, endHour: 20, endMinute: 0,
    });
  });

  it("parses day-specific hours for Monday (пн-пт)", () => {
    const result = parseWorkingHours("Пн-Пт: 09:00-18:00, Сб: 10:00-16:00", monday);
    expect(result).toEqual({
      startHour: 9, startMinute: 0, endHour: 18, endMinute: 0,
    });
  });

  it("parses day-specific hours for Saturday (сб)", () => {
    const result = parseWorkingHours("Пн-Пт: 09:00-18:00, Сб: 10:00-16:00", saturday);
    expect(result).toEqual({
      startHour: 10, startMinute: 0, endHour: 16, endMinute: 0,
    });
  });

  it("parses semicolon-separated schedule", () => {
    const result = parseWorkingHours("пн-пт 10:00-20:00; сб 10:00-15:00", wednesday);
    expect(result).toEqual({
      startHour: 10, startMinute: 0, endHour: 20, endMinute: 0,
    });
  });

  it("handles unrecognized format with fallback to time range", () => {
    expect(parseWorkingHours("Рабочие часы: 08:00-22:00", monday)).toEqual({
      startHour: 8, startMinute: 0, endHour: 22, endMinute: 0,
    });
  });

  it("returns default for completely unparseable string", () => {
    expect(parseWorkingHours("круглосуточно", monday)).toEqual({
      startHour: 9, startMinute: 0, endHour: 18, endMinute: 0,
    });
  });
});
