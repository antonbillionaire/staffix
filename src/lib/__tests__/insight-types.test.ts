import { describe, it, expect } from "vitest";
import { isTeachableInsight, TEACHABLE_INSIGHT_TYPES } from "@/lib/insight-types";

describe("isTeachableInsight", () => {
  it("частый вопрос без ответа — можно научить", () => {
    expect(isTeachableInsight("faq_suggestion")).toBe(true);
  });

  it("бот эскалирует однотипный вопрос — можно научить", () => {
    // Все шесть инсайтов OLLEE такие. Раньше владелец мог только отклонить их.
    expect(isTeachableInsight("escalation_pattern")).toBe(true);
  });

  it("бот часто говорит «не знаю» — можно научить", () => {
    expect(isTeachableInsight("dont_know_pattern")).toBe(true);
  });

  it("языковой пробел — не про FAQ, кнопки быть не должно", () => {
    expect(isTeachableInsight("language_gap")).toBe(false);
  });

  it("неизвестный тип, пустое значение, null", () => {
    expect(isTeachableInsight("suggestion")).toBe(false);
    expect(isTeachableInsight("")).toBe(false);
    expect(isTeachableInsight(null)).toBe(false);
    expect(isTeachableInsight(undefined)).toBe(false);
  });

  it("список не пустой — иначе кнопка исчезнет у всех разом", () => {
    expect(TEACHABLE_INSIGHT_TYPES.length).toBeGreaterThan(0);
  });
});
