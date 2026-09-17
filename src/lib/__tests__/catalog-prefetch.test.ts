import { describe, it, expect } from "vitest";
import {
  queryTokens,
  isStrongMatch,
  renderPrefetchBlock,
} from "@/lib/catalog-prefetch";

describe("queryTokens — что вообще уходит в поиск", () => {
  it("вытаскивает значимые слова из вопроса о товаре", () => {
    expect(queryTokens("есть маска для лица?")).toEqual(["маска", "лица"]);
  });

  it("отбрасывает вежливость и согласие целиком", () => {
    // Это главный гейт: «да» ушло бы в LIKE '%да%' и вытащило «Помаду»
    for (const noise of ["да", "нет", "ок", "спасибо", "хорошо", "привет"]) {
      expect(queryTokens(noise)).toEqual([]);
    }
  });

  it("отбрасывает короткие слова и голые числа", () => {
    expect(queryTokens("да, 5 шт")).toEqual([]);
    expect(queryTokens("мой номер 998901234567")).toEqual(["номер"]);
  });

  it("не ломается на пустом вводе и пунктуации", () => {
    expect(queryTokens("")).toEqual([]);
    expect(queryTokens("???")).toEqual([]);
    expect(queryTokens("   ")).toEqual([]);
  });

  it("режет длинное сообщение до 12 слов", () => {
    const long = Array.from({ length: 30 }, (_, i) => `слово${i}`).join(" ");
    expect(queryTokens(long)).toHaveLength(12);
  });

  it("работает с латиницей", () => {
    expect(queryTokens("do you have collagen serum?")).toEqual([
      "collagen",
      "serum",
    ]);
  });
});

describe("isStrongMatch — совпадение по описанию не в счёт", () => {
  const tokens = ["коллаген"];

  it("засчитывает попадание в название", () => {
    expect(
      isStrongMatch(tokens, { name: "Коллагеновый комплекс", tags: [] })
    ).toBe(true);
  });

  it("засчитывает попадание в тег", () => {
    expect(
      isStrongMatch(tokens, { name: "Пенка для умывания", tags: ["коллаген", "уход"] })
    ).toBe(true);
  });

  it("засчитывает попадание в категорию", () => {
    expect(
      isStrongMatch(tokens, { name: "Саше №30", category: "Коллаген и БАДы" })
    ).toBe(true);
  });

  it("НЕ засчитывает товар, который совпал только описанием", () => {
    // searchProducts ищет и по description — такие попадания в префетч не идут:
    // подмешивать их без спроса клиента значит навязывать не то
    expect(
      isStrongMatch(tokens, {
        name: "Антивозрастной крем",
        category: "Уход за лицом",
        tags: ["крем", "лифтинг"],
      })
    ).toBe(false);
  });

  it("не падает, когда тегов и категории нет", () => {
    expect(isStrongMatch(tokens, { name: "Крем" })).toBe(false);
  });
});

describe("renderPrefetchBlock", () => {
  const items = [
    { name: "Коллагеновый комплекс", price: 320000, category: "Красота изнутри", stockMessage: "В наличии (10+ шт.)" },
    { name: "Бустер с коллагеном", price: 180000, category: null, stockMessage: "Осталось 2 шт." },
  ];

  it("пустой список — пустая строка, в промпт ничего не уходит", () => {
    expect(renderPrefetchBlock("коллаген", [])).toBe("");
  });

  it("перечисляет товары с ценой, наличием и категорией", () => {
    const block = renderPrefetchBlock("коллаген", items);
    expect(block).toContain("Коллагеновый комплекс");
    expect(block).toContain("320000");
    expect(block).toContain("В наличии (10+ шт.)");
    expect(block).toContain("[Красота изнутри]");
  });

  it("товар без категории не даёт пустых скобок", () => {
    const block = renderPrefetchBlock("коллаген", items);
    expect(block).not.toContain("[]");
  });

  it("говорит модели не дублировать поиск и когда блок игнорировать", () => {
    const block = renderPrefetchBlock("коллаген", items);
    expect(block).toContain("НЕ вызывай search_products");
    expect(block).toContain("игнорируй");
  });
});
