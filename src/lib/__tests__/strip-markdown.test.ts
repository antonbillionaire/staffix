import { describe, it, expect } from "vitest";
import { stripMarkdown } from "../strip-markdown";

describe("stripMarkdown", () => {
  it("removes bold markers (**)", () => {
    expect(stripMarkdown("Цена: **1391 USD**")).toBe("Цена: 1391 USD");
  });

  it("removes bold markers (__)", () => {
    expect(stripMarkdown("__Внимание__")).toBe("Внимание");
  });

  it("removes italic with single asterisks", () => {
    expect(stripMarkdown("Это *очень* важно")).toBe("Это очень важно");
  });

  it("does not break math/separators with asterisks", () => {
    expect(stripMarkdown("5 * 2 = 10")).toBe("5 * 2 = 10");
  });

  it("does not break snake_case identifiers", () => {
    expect(stripMarkdown("Поле user_id обновлено")).toBe("Поле user_id обновлено");
  });

  it("removes headings", () => {
    expect(stripMarkdown("# Заголовок\n## Подзаголовок\nтекст")).toBe(
      "Заголовок\nПодзаголовок\nтекст"
    );
  });

  it("converts markdown links to 'text (url)'", () => {
    expect(stripMarkdown("Подробнее [тут](https://staffix.io)")).toBe(
      "Подробнее тут (https://staffix.io)"
    );
  });

  it("returns just text if link text equals url", () => {
    expect(stripMarkdown("[https://staffix.io](https://staffix.io)")).toBe(
      "https://staffix.io"
    );
  });

  it("strips inline code backticks", () => {
    expect(stripMarkdown("Используй `npm install`")).toBe("Используй npm install");
  });

  it("strips code blocks but keeps content", () => {
    expect(stripMarkdown("```\nconst x = 1;\n```")).toBe("const x = 1;");
  });

  it("converts -/* bullet lists to • bullets", () => {
    const md = "Что есть:\n- ресницы\n- клей\n- ремувер";
    expect(stripMarkdown(md)).toBe("Что есть:\n• ресницы\n• клей\n• ремувер");
  });

  it("preserves numbered lists as-is", () => {
    const md = "Шаги:\n1. Записаться\n2. Прийти\n3. Получить услугу";
    expect(stripMarkdown(md)).toBe("Шаги:\n1. Записаться\n2. Прийти\n3. Получить услугу");
  });

  it("strips simple HTML tags but keeps text", () => {
    expect(stripMarkdown("<b>Цена</b>: 1391<br>USD")).toBe("Цена: 1391\nUSD");
  });

  it("decodes basic HTML entities", () => {
    expect(stripMarkdown("Tom &amp; Jerry &nbsp;вместе")).toBe("Tom & Jerry  вместе");
  });

  it("removes blockquote markers", () => {
    expect(stripMarkdown("> важное замечание\nдальше текст")).toBe(
      "важное замечание\nдальше текст"
    );
  });

  it("strips horizontal rules", () => {
    expect(stripMarkdown("Сверху\n---\nСнизу")).toBe("Сверху\n\nСнизу");
  });

  it("collapses 3+ blank lines to 2", () => {
    expect(stripMarkdown("a\n\n\n\nb")).toBe("a\n\nb");
  });

  it("handles empty / null gracefully", () => {
    expect(stripMarkdown("")).toBe("");
    expect(stripMarkdown(null)).toBe("");
    expect(stripMarkdown(undefined)).toBe("");
  });

  it("real-world: bot reply with mixed formatting", () => {
    const claudeReply = `**Glue Remover Lovely 50ml** — это гель для снятия клея.

## Характеристики:
- Объём: 50 мл
- Бренд: *Lovely*
- Применение: \`нанести на ресницы\`

Подробности: [сайт](https://lovely-professional.ru)`;

    const expected = `Glue Remover Lovely 50ml — это гель для снятия клея.

Характеристики:
• Объём: 50 мл
• Бренд: Lovely
• Применение: нанести на ресницы

Подробности: сайт (https://lovely-professional.ru)`;

    expect(stripMarkdown(claudeReply)).toBe(expected);
  });

  it("trims surrounding whitespace", () => {
    expect(stripMarkdown("\n\n  привет  \n\n")).toBe("привет");
  });
});
