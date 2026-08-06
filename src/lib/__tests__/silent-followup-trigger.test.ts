import { describe, it, expect } from "vitest";
import { lastMessageIsBotQuestion } from "../../app/api/cron/client-bot-follow-up/route";

// Триггер расширен 6 августа 2026 после OLLEE-аудита: раньше проверял
// только "?" в тексте — четверть длинных диалогов не получала nudge
// потому что бот заканчивал утверждением или CTA без вопросительного знака.

describe("lastMessageIsBotQuestion — старый триггер (?)", () => {
  it("Прямой вопрос → true", () => {
    expect(
      lastMessageIsBotQuestion([
        { role: "user", content: "Сколько стоит?" },
        { role: "assistant", content: "Что именно интересует?" },
      ])
    ).toBe(true);
  });

  it("Утверждение без ? → false в старой версии, но проверим новую", () => {
    // Утверждение без ключевых слов CTA → false
    expect(
      lastMessageIsBotQuestion([
        { role: "assistant", content: "Наши услуги работают 24/7." },
      ])
    ).toBe(false);
  });

  it("Пустая история → false", () => {
    expect(lastMessageIsBotQuestion([])).toBe(false);
  });

  it("Последнее сообщение от клиента → false (клиент уже ответил)", () => {
    expect(
      lastMessageIsBotQuestion([
        { role: "assistant", content: "Что интересует?" },
        { role: "user", content: "SPF-крем" },
      ])
    ).toBe(false);
  });
});

describe("lastMessageIsBotQuestion — расширенный триггер (CTA-слова)", () => {
  it("«Оформляем.» без ? → true", () => {
    expect(
      lastMessageIsBotQuestion([{ role: "assistant", content: "Оформляем." }])
    ).toBe(true);
  });

  it("«Записываю на завтра!» → true (запись + приглашение)", () => {
    expect(
      lastMessageIsBotQuestion([
        { role: "assistant", content: "Записываю на завтра!" },
      ])
    ).toBe(true);
  });

  it("«Могу подобрать что-то другое.» → true (подобрать)", () => {
    expect(
      lastMessageIsBotQuestion([
        { role: "assistant", content: "Могу подобрать что-то другое." },
      ])
    ).toBe(true);
  });

  it("«Хотите записаться» без ? → true", () => {
    expect(
      lastMessageIsBotQuestion([
        { role: "assistant", content: "Хотите записаться на удобное время" },
      ])
    ).toBe(true);
  });

  it("«Могу показать варианты» → true (показать)", () => {
    expect(
      lastMessageIsBotQuestion([
        { role: "assistant", content: "Могу показать варианты" },
      ])
    ).toBe(true);
  });

  it("«Спасибо за интерес! Ждём вас.» → true (жду)", () => {
    expect(
      lastMessageIsBotQuestion([
        { role: "assistant", content: "Спасибо за интерес! Ждём вас в салоне" },
      ])
    ).toBe(true);
  });

  it("«У нас скидка 20% на маникюр.» без CTA → false", () => {
    // Информационное сообщение без приглашения — не триггерим
    expect(
      lastMessageIsBotQuestion([
        { role: "assistant", content: "У нас скидка 20% на маникюр." },
      ])
    ).toBe(false);
  });

  it("Прощание («Всего доброго») → false", () => {
    expect(
      lastMessageIsBotQuestion([
        { role: "assistant", content: "Всего доброго!" },
      ])
    ).toBe(false);
  });
});
