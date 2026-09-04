import { describe, it, expect } from "vitest";
import {
  classifyIGMessage,
  getIGTemplateReply,
  IG_EVENT_TEMPLATES,
} from "../ig-event-classifier";

describe("classifyIGMessage", () => {
  it("null / undefined → empty", () => {
    expect(classifyIGMessage(null)).toBe("empty");
    expect(classifyIGMessage(undefined)).toBe("empty");
  });

  it("Пустой объект → empty", () => {
    expect(classifyIGMessage({})).toBe("empty");
  });

  it("Обычный текст → text", () => {
    expect(classifyIGMessage({ text: "Здравствуйте!" })).toBe("text");
  });

  it("Пробелы вместо текста → attachments или empty", () => {
    expect(classifyIGMessage({ text: "   " })).toBe("empty");
    expect(classifyIGMessage({ text: "\n" })).toBe("empty");
  });

  it("Текст + attachment → text (текст в приоритете)", () => {
    expect(
      classifyIGMessage({
        text: "hello",
        attachments: [{ type: "image", payload: { url: "..." } }],
      })
    ).toBe("text");
  });

  it("story_mention attachment → story_mention", () => {
    expect(
      classifyIGMessage({
        attachments: [{ type: "story_mention", payload: { url: "..." } }],
      })
    ).toBe("story_mention");
  });

  it("share attachment → share", () => {
    expect(
      classifyIGMessage({
        attachments: [{ type: "share", payload: { url: "..." } }],
      })
    ).toBe("share");
  });

  it("Несколько attachments — story_mention приоритетнее share", () => {
    expect(
      classifyIGMessage({
        attachments: [
          { type: "share" },
          { type: "story_mention" },
        ],
      })
    ).toBe("story_mention");
  });

  it("image attachment → media", () => {
    expect(
      classifyIGMessage({
        attachments: [{ type: "image", payload: { url: "..." } }],
      })
    ).toBe("media");
  });

  it("video attachment → media", () => {
    expect(classifyIGMessage({ attachments: [{ type: "video" }] })).toBe("media");
  });

  it("Регистр type не важен (STORY_MENTION → story_mention)", () => {
    expect(
      classifyIGMessage({ attachments: [{ type: "STORY_MENTION" }] })
    ).toBe("story_mention");
  });

  it("attachments не массив → empty", () => {
    expect(
      classifyIGMessage({ attachments: "not an array" as unknown })
    ).toBe("empty");
  });

  it("attachment без type → media (или empty если единственный)", () => {
    // attachments есть, но у элемента нет типа — не попадёт в story_mention/share
    // и упадёт в media (default для «есть какое-то вложение»).
    expect(
      classifyIGMessage({ attachments: [{ payload: { url: "..." } }] })
    ).toBe("media");
  });
});

describe("getIGTemplateReply", () => {
  it("story_mention → приветственный шаблон", () => {
    const r = getIGTemplateReply("story_mention");
    expect(r).toBeTruthy();
    expect(r).toContain("Спасибо");
  });

  it("share → короткий шаблон", () => {
    const r = getIGTemplateReply("share");
    expect(r).toBeTruthy();
    expect(r).toContain("Спасибо");
  });

  it("media → старый fallback", () => {
    const r = getIGTemplateReply("media");
    expect(r).toBeTruthy();
    expect(r).toContain("не распознаю");
  });

  it("text → null (идёт в AI-flow, не шаблон)", () => {
    expect(getIGTemplateReply("text")).toBeNull();
  });

  it("empty → null (не отвечаем)", () => {
    expect(getIGTemplateReply("empty")).toBeNull();
  });

  it("Все ключи покрыты в IG_EVENT_TEMPLATES", () => {
    // Регресс-тест: если добавим новый тип, тесты упадут пока не добавим шаблон
    const types = ["story_mention", "share", "media", "text", "empty"];
    for (const t of types) {
      expect(IG_EVENT_TEMPLATES).toHaveProperty(t);
    }
  });
});
