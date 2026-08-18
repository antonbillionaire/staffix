import { describe, it, expect } from "vitest";
import {
  parseTelegramInput,
  formatTelegramInput,
} from "../telegram-input-parser";

describe("parseTelegramInput — username variant", () => {
  it("@username → username без @", () => {
    expect(parseTelegramInput("@farrukh_ollee")).toEqual({
      username: "farrukh_ollee",
      chatId: null,
      error: null,
    });
  });

  it("без @ (лояльно) → username", () => {
    expect(parseTelegramInput("farrukh_ollee")).toEqual({
      username: "farrukh_ollee",
      chatId: null,
      error: null,
    });
  });

  it("username с пробелами по краям → тримим", () => {
    expect(parseTelegramInput("  @staffix_bot  ")).toEqual({
      username: "staffix_bot",
      chatId: null,
      error: null,
    });
  });

  it("слишком короткий username → ошибка", () => {
    expect(parseTelegramInput("@abc").error).toMatch(/5-32 символа/);
  });

  it("username с недопустимыми символами → ошибка", () => {
    expect(parseTelegramInput("@user-name").error).toMatch(/5-32 символа/);
    expect(parseTelegramInput("@user name").error).toMatch(/5-32 символа/);
    expect(parseTelegramInput("@юзер").error).toMatch(/5-32 символа/);
  });

  it("username начинается с цифры → ошибка (правило Telegram)", () => {
    expect(parseTelegramInput("@1username").error).toMatch(/начинаться с буквы/);
  });

  it("только @ → ошибка", () => {
    expect(parseTelegramInput("@").error).toMatch(/username/);
  });
});

describe("parseTelegramInput — chat id variant (группа)", () => {
  it("legacy группа `-NNN...` → chatId", () => {
    expect(parseTelegramInput("-5530519186")).toEqual({
      username: null,
      chatId: "-5530519186",
      error: null,
    });
  });

  it("supergroup `-100NNN...` → chatId", () => {
    expect(parseTelegramInput("-1001234567890")).toEqual({
      username: null,
      chatId: "-1001234567890",
      error: null,
    });
  });

  it("тримим пробелы у chat_id", () => {
    expect(parseTelegramInput("  -5530519186  ")).toEqual({
      username: null,
      chatId: "-5530519186",
      error: null,
    });
  });

  it("`-` без цифр → ошибка", () => {
    expect(parseTelegramInput("-").error).toMatch(/минуса и цифр/);
  });

  it("`-` + буквы → ошибка", () => {
    expect(parseTelegramInput("-abc").error).toMatch(/минуса и цифр/);
  });

  it("слишком короткий chat_id → ошибка", () => {
    expect(parseTelegramInput("-123").error).toMatch(/минуса и цифр/);
  });

  it("плюс перед цифрами (личный chat_id) НЕ поддерживаем — это username-flow", () => {
    // Ставим личные chat_id только через /start бота, не через ручной ввод.
    // Число без минуса лоя́льно попадает в username-ветку, там валидатор
    // отбьёт (не буквы, короткий и т.п.).
    const r = parseTelegramInput("123456789");
    expect(r.username).toBeNull();
    expect(r.error).not.toBeNull();
  });
});

describe("parseTelegramInput — пустое поле", () => {
  it("пустая строка → чистый EMPTY", () => {
    expect(parseTelegramInput("")).toEqual({
      username: null,
      chatId: null,
      error: null,
    });
  });

  it("только пробелы → чистый EMPTY", () => {
    expect(parseTelegramInput("   ")).toEqual({
      username: null,
      chatId: null,
      error: null,
    });
  });

  it("не строка → EMPTY", () => {
    expect(parseTelegramInput(null)).toEqual({
      username: null,
      chatId: null,
      error: null,
    });
    expect(parseTelegramInput(undefined)).toEqual({
      username: null,
      chatId: null,
      error: null,
    });
    expect(parseTelegramInput(42)).toEqual({
      username: null,
      chatId: null,
      error: null,
    });
  });
});

describe("formatTelegramInput — обратное преобразование", () => {
  it("username → @username", () => {
    expect(formatTelegramInput("farrukh_ollee", null)).toBe("@farrukh_ollee");
  });

  it("chatId (BigInt) → строка с минусом", () => {
    expect(formatTelegramInput(null, BigInt("-5530519186"))).toBe("-5530519186");
  });

  it("chatId уже как строка → возвращаем как есть", () => {
    expect(formatTelegramInput(null, "-5530519186")).toBe("-5530519186");
  });

  it("оба null → пустая строка", () => {
    expect(formatTelegramInput(null, null)).toBe("");
    expect(formatTelegramInput(undefined, undefined)).toBe("");
  });

  it("username приоритетнее chatId (не должно быть, но защита)", () => {
    expect(formatTelegramInput("user", "-123456")).toBe("@user");
  });
});
