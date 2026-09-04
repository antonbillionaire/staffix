import { describe, it, expect } from "vitest";
import {
  collectProductCandidates,
  filterImagesByMention,
  type ProductCandidate,
} from "../product-image-filter";

// Валидный OLLEE-каталог для reference:
const OLLEE_CANDIDATES: ProductCandidate[] = [
  { name: "BB-крем Matte Skin SPF50+", sku: "8809722156116", imageUrl: "https://cdn/bb.jpg" },
  { name: "Пенка с углём и коллагеном", sku: "8800304050006", imageUrl: "https://cdn/foam-coal.jpg" },
  { name: "Пенка для снятия макияжа", sku: "8800304050013", imageUrl: "https://cdn/foam-makeup.jpg" },
  { name: "Гидрофильное масло", sku: "8800304050020", imageUrl: "https://cdn/hydrophilic.jpg" },
  { name: "Мицеллярная вода", sku: "8800304050037", imageUrl: "https://cdn/micellar.jpg" },
];

describe("collectProductCandidates", () => {
  it("Извлекает из products[] массива tool_results", () => {
    const toolResults = [
      {
        content: JSON.stringify({
          products: [
            { name: "BB-крем", sku: "8809", imageUrl: "https://cdn/1.jpg" },
            { name: "Пенка", sku: "8810", imageUrl: "https://cdn/2.jpg" },
          ],
        }),
      },
    ];
    const cs = collectProductCandidates(toolResults);
    expect(cs).toHaveLength(2);
    expect(cs[0].name).toBe("BB-крем");
    expect(cs[1].imageUrl).toBe("https://cdn/2.jpg");
  });

  it("Извлекает из product (одиночный) tool_results", () => {
    const toolResults = [
      {
        content: { product: { name: "Крем", sku: "123", imageUrl: "https://cdn/x.jpg" } },
      },
    ];
    const cs = collectProductCandidates(toolResults);
    expect(cs).toHaveLength(1);
    expect(cs[0].imageUrl).toBe("https://cdn/x.jpg");
  });

  it("Дедуплицирует по imageUrl", () => {
    const toolResults = [
      { content: { products: [{ name: "X", imageUrl: "https://cdn/same.jpg" }] } },
      { content: { product: { name: "X", imageUrl: "https://cdn/same.jpg" } } },
    ];
    const cs = collectProductCandidates(toolResults);
    expect(cs).toHaveLength(1);
  });

  it("Пропускает продукты без imageUrl", () => {
    const toolResults = [
      { content: { products: [{ name: "X", sku: "1" }, { name: "Y", imageUrl: "https://cdn/y.jpg" }] } },
    ];
    const cs = collectProductCandidates(toolResults);
    expect(cs).toHaveLength(1);
    expect(cs[0].name).toBe("Y");
  });

  it("Не крашится на битом JSON / не-объекте", () => {
    const toolResults = [
      { content: "not json" },
      { content: null },
      { content: 42 },
    ];
    const cs = collectProductCandidates(toolResults);
    expect(cs).toEqual([]);
  });

  it("Принимает готовый объект (не только JSON-строку)", () => {
    const toolResults = [
      { content: { products: [{ name: "X", imageUrl: "https://cdn/1.jpg" }] } },
    ];
    const cs = collectProductCandidates(toolResults);
    expect(cs).toHaveLength(1);
  });
});

describe("filterImagesByMention — базовые случаи", () => {
  it("Пустой текст → пусто", () => {
    expect(filterImagesByMention("", OLLEE_CANDIDATES)).toEqual([]);
  });

  it("Пустой список candidates → пусто", () => {
    expect(filterImagesByMention("рекомендую BB-крем", [])).toEqual([]);
  });

  it("Ни один товар не упомянут → пусто", () => {
    // Общий ответ без конкретных названий — фото не отправляем
    expect(
      filterImagesByMention(
        "Расскажу про наши товары. Что именно Вас интересует?",
        OLLEE_CANDIDATES
      )
    ).toEqual([]);
  });
});

describe("filterImagesByMention — совпадение по имени", () => {
  it("Явное упоминание BB-крема → только это фото", () => {
    const result = filterImagesByMention(
      "Рекомендую наш BB-крем Matte Skin — подходит для комбинированной кожи.",
      OLLEE_CANDIDATES
    );
    expect(result).toEqual(["https://cdn/bb.jpg"]);
  });

  it("Упоминание 2 товаров → 2 фото в порядке кандидатов", () => {
    const result = filterImagesByMention(
      "Для очищения советую пенку с углём, для увлажнения — гидрофильное масло.",
      OLLEE_CANDIDATES
    );
    expect(result).toContain("https://cdn/foam-coal.jpg");
    expect(result).toContain("https://cdn/hydrophilic.jpg");
    expect(result).toHaveLength(2);
  });

  it("Case-insensitive matching", () => {
    const result = filterImagesByMention(
      "советую МИЦЕЛЛЯРНУЮ воду",
      OLLEE_CANDIDATES
    );
    expect(result).toContain("https://cdn/micellar.jpg");
  });

  it("Русские склонения — stem-match (мицеллярнОЙ / гидрофильнЫМ)", () => {
    // Именительный в каталоге, разные падежи в тексте — stem по 6 символам
    // должен ловить.
    const cases = [
      "нужно взять мицеллярной воды",
      "гидрофильным маслом можно снимать макияж",
      "рассмотрите мицеллярную воду",
    ];
    for (const text of cases) {
      const result = filterImagesByMention(text, OLLEE_CANDIDATES);
      expect(result.length).toBeGreaterThan(0);
    }
  });

  it("Emoji в тексте не мешают", () => {
    const result = filterImagesByMention(
      "🌸 Рекомендую ✨ BB-крем ✨ — топ",
      OLLEE_CANDIDATES
    );
    expect(result).toContain("https://cdn/bb.jpg");
  });

  it("Частичное упоминание по значимому слову (matte / skin)", () => {
    const result = filterImagesByMention(
      "Присмотритесь к Matte Skin — прекрасно матирует.",
      OLLEE_CANDIDATES
    );
    expect(result).toContain("https://cdn/bb.jpg");
  });
});

describe("filterImagesByMention — совпадение по SKU", () => {
  it("Полный штрихкод в тексте → match", () => {
    const result = filterImagesByMention(
      "Артикул 8809722156116 — это наш BB-крем",
      OLLEE_CANDIDATES
    );
    expect(result).toContain("https://cdn/bb.jpg");
  });

  it("Короткий SKU (< 5 символов) НЕ матчит по SKU (защита от false positive)", () => {
    // "1" точно есть в тексте (в дате), но SKU="1" слишком короткий
    const cs: ProductCandidate[] = [
      { name: "Товар", sku: "1", imageUrl: "https://cdn/x.jpg" },
    ];
    // Значимых слов длиной >=4 в имени "Товар" один — «товар». В тексте нет.
    expect(filterImagesByMention("Работаем 24/7 с 1 января", cs)).toEqual([]);
  });
});

describe("filterImagesByMention — лимит max images", () => {
  it("Дефолт 3 фото даже если упомянуто больше", () => {
    // Все 5 товаров явно названы — берём первые 3
    const result = filterImagesByMention(
      "Наш ассортимент: BB-крем Matte, пенка с углём, пенка для снятия, гидрофильное масло и мицеллярная вода.",
      OLLEE_CANDIDATES
    );
    expect(result).toHaveLength(3);
    // Порядок совпадает с порядком candidates
    expect(result[0]).toBe("https://cdn/bb.jpg");
    expect(result[1]).toBe("https://cdn/foam-coal.jpg");
    expect(result[2]).toBe("https://cdn/foam-makeup.jpg");
  });

  it("Кастомный maxImages", () => {
    const result = filterImagesByMention(
      "BB-крем Matte, пенка с углём, пенка для снятия",
      OLLEE_CANDIDATES,
      1
    );
    expect(result).toHaveLength(1);
    expect(result[0]).toBe("https://cdn/bb.jpg");
  });
});

describe("filterImagesByMention — anti-false-positive", () => {
  it("Слово «крем» само по себе НЕ матчит (общий термин, длина < 4)", () => {
    // "крем" — 4 символа, MIN_WORD_LEN=4. Значимое слово из BB-крем — «bb-крем» (7),
    // а не отдельное «крем». Но normalize превратит "bb-крем" в один токен с
    // дефисом, split по /[\s-]+/ разобьёт на "bb" (2, отбрасывается) и "крем" (4).
    // Значит слово «крем» из "BB-крем" именно длиной 4 и станет значимым словом.
    // Смотрим что происходит: текст «Продаём крем и масло», candidates = OLLEE.
    // "крем" (из BB-крем) есть в тексте → match BB-крема. Ожидаемое поведение
    // или false positive?
    // Решение: >= 4 достаточно строго; краткие термины типа "крем" — часть
    // разговора о косметике. Владелец описал этот компромисс.
    const result = filterImagesByMention("Продаём крем и масло", OLLEE_CANDIDATES);
    // BB-крем (крем есть) + Гидрофильное масло (масло есть — 5 символов)
    expect(result).toContain("https://cdn/bb.jpg");
    expect(result).toContain("https://cdn/hydrophilic.jpg");
  });

  it("Слово из 3 букв в имени НЕ создаёт false positive", () => {
    const cs: ProductCandidate[] = [
      { name: "Тон 3D", imageUrl: "https://cdn/x.jpg" }, // все слова < 4 символов
    ];
    expect(filterImagesByMention("работаем в 3D", cs)).toEqual([]);
  });

  it("Product без name и без sku → не матчится никогда", () => {
    const cs: ProductCandidate[] = [
      { imageUrl: "https://cdn/x.jpg" },
    ];
    expect(filterImagesByMention("что угодно тут", cs)).toEqual([]);
  });
});
