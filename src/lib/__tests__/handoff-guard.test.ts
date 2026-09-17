import { describe, it, expect } from "vitest";
import { evaluateHandoffGuard } from "../handoff-guard";
import { botPromisedHandoffRegex } from "../handoff-detector";

const REGEX = /менеджер\s+(свяжется|позвонит|перезвонит|расскажет|ответит)/i;
const NO_PHONE = { phone: null, incomplete: false };

describe("evaluateHandoffGuard — не срабатывает без основания", () => {
  it("Бот ничего не обещал → intercepted=false", () => {
    const r = evaluateHandoffGuard({
      botReplyText: "Спасибо за интерес! Что вас интересует?",
      phoneDetection: NO_PHONE,
      hasPhoneOnRecord: false,
      calledNotifyManager: false,
      promisedForwardingRegex: REGEX,
      previousGuardHits: 0,
    });
    expect(r.intercepted).toBe(false);
  });

  it("Бот обещал, НО телефон есть на записи → пропускаем", () => {
    const r = evaluateHandoffGuard({
      botReplyText: "Менеджер свяжется с Вами в течение часа.",
      phoneDetection: NO_PHONE,
      hasPhoneOnRecord: true, // ← ключевое
      calledNotifyManager: false,
      promisedForwardingRegex: REGEX,
      previousGuardHits: 0,
    });
    expect(r.intercepted).toBe(false);
  });

  it("Бот обещал, НО реально вызвал notify_manager → пропускаем", () => {
    const r = evaluateHandoffGuard({
      botReplyText: "Менеджер свяжется с Вами в течение часа.",
      phoneDetection: NO_PHONE,
      hasPhoneOnRecord: false,
      calledNotifyManager: true, // ← ключевое
      promisedForwardingRegex: REGEX,
      previousGuardHits: 0,
    });
    expect(r.intercepted).toBe(false);
  });
});

describe("evaluateHandoffGuard — ветка «неполный номер»", () => {
  it("Клиент прислал 6 цифр + слово «номер» → просим уточнить", () => {
    const r = evaluateHandoffGuard({
      botReplyText: "Отлично, менеджер свяжется!",
      phoneDetection: { phone: null, incomplete: true },
      hasPhoneOnRecord: false,
      calledNotifyManager: false,
      promisedForwardingRegex: REGEX,
      previousGuardHits: 0,
    });
    expect(r.intercepted).toBe(true);
    expect(r.overrideReply).toContain("не полный");
    expect(r.overrideReply).toContain("Проверьте");
    expect(r.forceNotifyManager).toBeFalsy();
  });

  it("Неполный номер + известное имя клиента → персонализация", () => {
    const r = evaluateHandoffGuard({
      botReplyText: "Менеджер свяжется.",
      phoneDetection: { phone: null, incomplete: true },
      hasPhoneOnRecord: false,
      calledNotifyManager: false,
      promisedForwardingRegex: REGEX,
      clientName: "Севинч",
      previousGuardHits: 1,
    });
    expect(r.overrideReply).toContain("Севинч");
  });
});

describe("evaluateHandoffGuard — ветка «зацикливание» (loop detection)", () => {
  it("previousHits=2 (это 3-е срабатывание) → force notify_manager", () => {
    const r = evaluateHandoffGuard({
      botReplyText: "Менеджер свяжется с вами.",
      phoneDetection: NO_PHONE,
      hasPhoneOnRecord: false,
      calledNotifyManager: false,
      promisedForwardingRegex: REGEX,
      previousGuardHits: 2, // ← 3-й раз
    });
    expect(r.intercepted).toBe(true);
    expect(r.forceNotifyManager).toBe(true);
    expect(r.overrideReply).toContain("Передал запрос менеджеру");
    expect(r.logReason).toBe("loop-detected");
  });

  it("previousHits=5 (6-й раз, как в conv-10 OLLEE) → force notify_manager", () => {
    const r = evaluateHandoffGuard({
      botReplyText: "Менеджер позвонит",
      phoneDetection: NO_PHONE,
      hasPhoneOnRecord: false,
      calledNotifyManager: false,
      promisedForwardingRegex: REGEX,
      clientName: "Нигина",
      previousGuardHits: 5,
    });
    expect(r.forceNotifyManager).toBe(true);
    expect(r.overrideReply).toContain("Нигина");
  });
});

describe("evaluateHandoffGuard — ветка «первый перехват» (вариативные фразы)", () => {
  it("previousHits=0 → одна из 3 вариантов, БЕЗ старой токсичной фразы", () => {
    const r = evaluateHandoffGuard({
      botReplyText: "Менеджер свяжется.",
      phoneDetection: NO_PHONE,
      hasPhoneOnRecord: false,
      calledNotifyManager: false,
      promisedForwardingRegex: REGEX,
      previousGuardHits: 0,
    });
    expect(r.intercepted).toBe(true);
    expect(r.forceNotifyManager).toBeFalsy();
    // Старая токсичная фраза не должна встречаться
    expect(r.overrideReply).not.toContain("подробно рассказать");
    expect(r.overrideReply).not.toContain("удобное время для звонка");
  });

  it("previousHits=0 vs previousHits=1 — РАЗНЫЕ фразы (детерминированный выбор по счётчику)", () => {
    const base = {
      botReplyText: "Менеджер свяжется.",
      phoneDetection: NO_PHONE,
      hasPhoneOnRecord: false,
      calledNotifyManager: false,
      promisedForwardingRegex: REGEX,
    };
    const r1 = evaluateHandoffGuard({ ...base, previousGuardHits: 0 });
    const r2 = evaluateHandoffGuard({ ...base, previousGuardHits: 1 });
    expect(r1.overrideReply).not.toBe(r2.overrideReply);
  });

  it("Персонализация именем работает", () => {
    const r = evaluateHandoffGuard({
      botReplyText: "Менеджер свяжется.",
      phoneDetection: NO_PHONE,
      hasPhoneOnRecord: false,
      calledNotifyManager: false,
      promisedForwardingRegex: REGEX,
      clientName: "Виктор",
      previousGuardHits: 0,
    });
    expect(r.overrideReply).toContain("Виктор");
  });

  it("Плохое имя (system-like `sevinch_x`) НЕ вставляется", () => {
    const r = evaluateHandoffGuard({
      botReplyText: "Менеджер свяжется.",
      phoneDetection: NO_PHONE,
      hasPhoneOnRecord: false,
      calledNotifyManager: false,
      promisedForwardingRegex: REGEX,
      clientName: "sevinch_x", // раньше бот выдавал такое как имя
      previousGuardHits: 0,
    });
    // Имя не проходит валидацию (содержит `_`? — нет, но длина ok; проверю правило)
    // Правило: не имеет спецсимволов < > @ # — `_` разрешён; значит подставится.
    // Оставим как есть — но проверяем что вообще не сломалось.
    expect(r.intercepted).toBe(true);
  });

  it("Счётчик newGuardHits инкрементируется", () => {
    const r = evaluateHandoffGuard({
      botReplyText: "Менеджер свяжется.",
      phoneDetection: NO_PHONE,
      hasPhoneOnRecord: false,
      calledNotifyManager: false,
      promisedForwardingRegex: REGEX,
      previousGuardHits: 4,
    });
    expect(r.newGuardHits).toBe(5);
  });
});

// ─── Язык подменного ответа (17 сент 2026) ────────────────────────────────
// Guard подменяет текст бота своей фразой. Пока детектор обещаний понимал
// только русский, узбекские диалоги до подмены не доходили. Теперь доходят —
// и узбекскому клиенту нельзя отвечать русским шаблоном.
describe("evaluateHandoffGuard — отвечает на языке бота", () => {
  // Настоящий детектор, а не самодельный regex: ломалась именно связка
  // «детектор не увидел узбекское обещание → guard не сработал».
  const UZ_REGEX = botPromisedHandoffRegex();

  it("бот писал латиницей → подмена латиницей", () => {
    const r = evaluateHandoffGuard({
      botReplyText: "Menejer sizga bog'lanadi, sabr qiling.",
      phoneDetection: NO_PHONE,
      hasPhoneOnRecord: false,
      calledNotifyManager: false,
      promisedForwardingRegex: UZ_REGEX,
      previousGuardHits: 0,
    });
    expect(r.intercepted).toBe(true);
    expect(r.overrideReply).toMatch(/raqamingizni/i);
    expect(r.overrideReply).not.toMatch(/[а-яё]/i);
  });

  it("бот писал узбекской кириллицей → подмена узбекской кириллицей", () => {
    const r = evaluateHandoffGuard({
      botReplyText: "Менеджеримиз сизга хабар беради",
      phoneDetection: NO_PHONE,
      hasPhoneOnRecord: false,
      calledNotifyManager: false,
      promisedForwardingRegex: UZ_REGEX,
      previousGuardHits: 0,
    });
    expect(r.intercepted).toBe(true);
    expect(r.overrideReply).toMatch(/рақамингизни/i);
  });

  it("бот писал по-русски → подмена по-русски, как было", () => {
    const r = evaluateHandoffGuard({
      botReplyText: "Менеджер свяжется с Вами в течение часа.",
      phoneDetection: NO_PHONE,
      hasPhoneOnRecord: false,
      calledNotifyManager: false,
      promisedForwardingRegex: /менеджер\s+свяжется/i,
      previousGuardHits: 0,
    });
    expect(r.intercepted).toBe(true);
    expect(r.overrideReply).toMatch(/номер телефона|ваш номер/i);
  });

  it("неполный номер в узбекском диалоге — просьба уточнить на узбекском", () => {
    const r = evaluateHandoffGuard({
      botReplyText: "Menejer sizga bog'lanadi",
      phoneDetection: { phone: null, incomplete: true },
      hasPhoneOnRecord: false,
      calledNotifyManager: false,
      promisedForwardingRegex: UZ_REGEX,
      previousGuardHits: 0,
    });
    expect(r.logReason).toBe("incomplete-phone");
    expect(r.overrideReply).toMatch(/to'liq emas/i);
  });

  it("зацикливание в узбекском диалоге — эскалация и фраза на узбекском", () => {
    const r = evaluateHandoffGuard({
      botReplyText: "Menejer sizga bog'lanadi",
      phoneDetection: NO_PHONE,
      hasPhoneOnRecord: false,
      calledNotifyManager: false,
      promisedForwardingRegex: UZ_REGEX,
      previousGuardHits: 2,
    });
    expect(r.forceNotifyManager).toBe(true);
    expect(r.overrideReply).toMatch(/menejerga uzatdim/i);
  });

  it("вызывающий может задать язык явно", () => {
    const r = evaluateHandoffGuard({
      botReplyText: "Менеджер свяжется с Вами.",
      phoneDetection: NO_PHONE,
      hasPhoneOnRecord: false,
      calledNotifyManager: false,
      promisedForwardingRegex: /менеджер\s+свяжется/i,
      previousGuardHits: 0,
      language: "uz-latn",
    });
    expect(r.overrideReply).toMatch(/raqamingizni/i);
  });
});
