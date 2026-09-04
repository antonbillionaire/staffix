import { describe, it, expect } from "vitest";
import { normalizeCartSnapshot, formatCartForPrompt } from "../cart-extractor";

describe("normalizeCartSnapshot", () => {
  it("Валидный ответ Haiku парсится корректно", () => {
    const r = normalizeCartSnapshot({
      items: [
        { name: "Гидрофильное масло", price: 184000, quantity: 1, currency: "сум" },
        { name: "Пенка с лавандой", price: 140000, quantity: 1, currency: "сум" },
      ],
      total: 324000,
      currency: "сум",
      status: "assembling",
    });
    expect(r).not.toBeNull();
    expect(r!.items).toHaveLength(2);
    expect(r!.items[0].name).toBe("Гидрофильное масло");
    expect(r!.total).toBe(324000);
    expect(r!.status).toBe("assembling");
  });

  it("Total считается автоматически если LLM его забыл", () => {
    const r = normalizeCartSnapshot({
      items: [{ name: "Крем", price: 100, quantity: 2 }],
      status: "assembling",
    });
    expect(r!.total).toBe(200);
  });

  it("Total пересчитывается если LLM выдал сильно неправильный (>30% отличие)", () => {
    // 145000 × 1 = 145000, а LLM говорит 999999 — берём 145000
    const r = normalizeCartSnapshot({
      items: [{ name: "BB-крем", price: 145000, quantity: 1 }],
      total: 999999,
    });
    expect(r!.total).toBe(145000);
  });

  it("Total от LLM принимается если он «близко» к расчёту (плюс налог/доставка)", () => {
    // 100 × 2 = 200, LLM говорит 220 (10% сверху = доставка) — оставляем 220
    const r = normalizeCartSnapshot({
      items: [{ name: "Крем", price: 100, quantity: 2 }],
      total: 220,
    });
    expect(r!.total).toBe(220);
  });

  it("Пустой items → status='browsing' даже если LLM сказал 'assembling'", () => {
    const r = normalizeCartSnapshot({ items: [], status: "assembling" });
    expect(r!.status).toBe("browsing");
    expect(r!.items).toHaveLength(0);
  });

  it("status='ordered' сохраняется даже с пустым items (заказ уже создан)", () => {
    const r = normalizeCartSnapshot({ items: [], status: "ordered" });
    expect(r!.status).toBe("ordered");
  });

  it("Невалидный status → 'browsing'", () => {
    const r = normalizeCartSnapshot({ items: [], status: "garbage" });
    expect(r!.status).toBe("browsing");
  });

  it("Отклоняем items с невалидными полями", () => {
    const r = normalizeCartSnapshot({
      items: [
        { name: "Хороший", price: 100, quantity: 1 },
        { name: "", price: 100, quantity: 1 }, // пустое имя → skip
        { name: "Без цены", quantity: 1 }, // нет цены → skip
        { name: "Мусор", price: "не число", quantity: 1 }, // строка вместо числа → skip
        { name: "Отрицательная", price: -50, quantity: 1 }, // отрицательная цена → skip
        { name: "Слишком дорого", price: 999999999, quantity: 1 }, // >100M → skip
      ],
    });
    expect(r!.items).toHaveLength(1);
    expect(r!.items[0].name).toBe("Хороший");
  });

  it("Лимит 30 позиций — защита от раздутых корзин", () => {
    const bigItems = Array.from({ length: 50 }, (_, i) => ({
      name: `Товар ${i}`,
      price: 100,
      quantity: 1,
    }));
    const r = normalizeCartSnapshot({ items: bigItems });
    expect(r!.items).toHaveLength(30);
  });

  it("null → null (не крашится на мусоре)", () => {
    expect(normalizeCartSnapshot(null)).toBeNull();
    expect(normalizeCartSnapshot(undefined)).toBeNull();
    expect(normalizeCartSnapshot("строка")).toBeNull();
    expect(normalizeCartSnapshot(123)).toBeNull();
  });

  it("Строковые числа конвертируются (LLM иногда возвращает '100' вместо 100)", () => {
    const r = normalizeCartSnapshot({
      items: [{ name: "Крем", price: "100", quantity: "2" }],
    });
    expect(r!.items[0].price).toBe(100);
    expect(r!.items[0].quantity).toBe(2);
  });
});

describe("normalizeCartSnapshot — discussedProducts (OLLEE-fix 4 сент 2026)", () => {
  it("Пустой input → пустой discussedProducts", () => {
    const r = normalizeCartSnapshot({ items: [] });
    expect(r!.discussedProducts).toEqual([]);
  });

  it("Товары в корзине автоматически попадают в discussedProducts", () => {
    const r = normalizeCartSnapshot({
      items: [
        { name: "BB-крем", price: 145000, quantity: 1 },
        { name: "Пенка", price: 75000, quantity: 1 },
      ],
    });
    expect(r!.discussedProducts).toContain("BB-крем");
    expect(r!.discussedProducts).toContain("Пенка");
  });

  it("Явный discussedProducts от Haiku парсится", () => {
    const r = normalizeCartSnapshot({
      items: [],
      discussedProducts: ["Гидрофильное масло", "Мицеллярная вода", "Энзимная пудра"],
    });
    expect(r!.discussedProducts).toEqual([
      "Гидрофильное масло",
      "Мицеллярная вода",
      "Энзимная пудра",
    ]);
  });

  it("Merge с previousDiscussed — предыдущие сохраняются, новые в конец", () => {
    const r = normalizeCartSnapshot(
      {
        items: [],
        discussedProducts: ["Тонер", "Крем SPF"],
      },
      ["Гидрофильное масло", "Мицеллярная вода"]
    );
    expect(r!.discussedProducts).toEqual([
      "Гидрофильное масло",
      "Мицеллярная вода",
      "Тонер",
      "Крем SPF",
    ]);
  });

  it("Dedup case-insensitive — одинаковые названия в разных регистрах не дублируются", () => {
    const r = normalizeCartSnapshot(
      {
        items: [],
        discussedProducts: ["Гидрофильное масло", "гидрофильное масло", "ГИДРОФИЛЬНОЕ МАСЛО"],
      },
      ["Гидрофильное масло"]
    );
    expect(r!.discussedProducts).toHaveLength(1);
  });

  it("Обрезка длинных названий до 100 символов", () => {
    const longName = "A".repeat(200);
    const r = normalizeCartSnapshot({
      items: [],
      discussedProducts: [longName],
    });
    expect(r!.discussedProducts[0]).toHaveLength(100);
  });

  it("Слишком короткие названия (<2 символов) отбрасываются", () => {
    const r = normalizeCartSnapshot({
      items: [],
      discussedProducts: ["A", "  ", "", "Валид"],
    });
    expect(r!.discussedProducts).toEqual(["Валид"]);
  });

  it("Лимит 30 в discussedProducts", () => {
    const many = Array.from({ length: 50 }, (_, i) => `Товар ${i}`);
    const r = normalizeCartSnapshot({
      items: [],
      discussedProducts: many,
    });
    expect(r!.discussedProducts).toHaveLength(30);
  });

  it("previousDiscussed без нового ввода — сохраняется полностью", () => {
    const r = normalizeCartSnapshot(
      { items: [] },
      ["Гидрофильное масло", "Мицеллярная вода"]
    );
    expect(r!.discussedProducts).toEqual([
      "Гидрофильное масло",
      "Мицеллярная вода",
    ]);
  });

  it("Мусорные значения в discussedProducts игнорируются (не строки)", () => {
    const r = normalizeCartSnapshot({
      items: [],
      discussedProducts: [123, null, undefined, { name: "obj" }, "Валид"],
    });
    expect(r!.discussedProducts).toEqual(["Валид"]);
  });
});

describe("formatCartForPrompt", () => {
  it("Пустая корзина + пустой discussed → пустая строка", () => {
    expect(formatCartForPrompt(null)).toBe("");
    expect(
      formatCartForPrompt({
        items: [],
        total: 0,
        currency: "сум",
        status: "browsing",
        discussedProducts: [],
        updatedAt: new Date().toISOString(),
      })
    ).toBe("");
  });

  it("Корзина старше часа → пустая строка (устарела, вероятно новый диалог)", () => {
    const oldTimestamp = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    const result = formatCartForPrompt({
      items: [{ name: "Крем", price: 100, quantity: 1 }],
      total: 100,
      currency: "сум",
      status: "assembling",
      discussedProducts: ["Крем"],
      updatedAt: oldTimestamp,
    });
    expect(result).toBe("");
  });

  it("Свежая корзина показывается с позициями и суммой", () => {
    const result = formatCartForPrompt({
      items: [
        { name: "BB-крем", price: 145000, quantity: 1 },
        { name: "Пенка", price: 75000, quantity: 2 },
      ],
      total: 295000,
      currency: "сум",
      status: "assembling",
      discussedProducts: ["BB-крем", "Пенка"],
      updatedAt: new Date().toISOString(),
    });
    expect(result).toContain("BB-крем × 1 = 145000 сум");
    expect(result).toContain("Пенка × 2 = 150000 сум");
    expect(result).toContain("ИТОГО: 295000 сум");
    expect(result).toContain("клиент выбирает");
  });

  it("status='confirmed' → инструкция «можно вызвать create_order»", () => {
    const result = formatCartForPrompt({
      items: [{ name: "Крем", price: 100, quantity: 1 }],
      total: 100,
      currency: "сум",
      status: "confirmed",
      discussedProducts: ["Крем"],
      updatedAt: new Date().toISOString(),
    });
    expect(result).toContain("подтвердил заказ");
    expect(result).toContain("create_order");
  });

  it("status='ordered' — заказ уже создан", () => {
    const result = formatCartForPrompt({
      items: [{ name: "Крем", price: 100, quantity: 1 }],
      total: 100,
      currency: "сум",
      status: "ordered",
      discussedProducts: ["Крем"],
      updatedAt: new Date().toISOString(),
    });
    expect(result).toContain("заказ уже создан");
  });

  it("Пустая корзина + непустой discussed → показывается только блок обсуждали", () => {
    const result = formatCartForPrompt({
      items: [],
      total: 0,
      currency: "сум",
      status: "browsing",
      discussedProducts: ["Гидрофильное масло", "Мицеллярная вода", "Пенка"],
      updatedAt: new Date().toISOString(),
    });
    expect(result).toContain("УЖЕ ОБСУЖДАЛИ");
    expect(result).toContain("Гидрофильное масло");
    expect(result).toContain("Мицеллярная вода");
    expect(result).toContain("Пенка");
    expect(result).not.toContain("ТЕКУЩАЯ КОРЗИНА");
  });

  it("Корзина + discussed → оба блока в одном ответе", () => {
    const result = formatCartForPrompt({
      items: [{ name: "BB-крем", price: 145000, quantity: 1 }],
      total: 145000,
      currency: "сум",
      status: "assembling",
      discussedProducts: ["BB-крем", "Гидрофильное масло", "Мицеллярная вода"],
      updatedAt: new Date().toISOString(),
    });
    expect(result).toContain("ТЕКУЩАЯ КОРЗИНА");
    expect(result).toContain("УЖЕ ОБСУЖДАЛИ");
    expect(result).toContain("Гидрофильное масло");
    // Обсуждали блок должен идти ПОСЛЕ корзины
    const cartIdx = result.indexOf("ТЕКУЩАЯ КОРЗИНА");
    const discussedIdx = result.indexOf("УЖЕ ОБСУЖДАЛИ");
    expect(discussedIdx).toBeGreaterThan(cartIdx);
  });
});
