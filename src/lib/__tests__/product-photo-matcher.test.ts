import { describe, it, expect } from "vitest";
import { candidateSkus, photoPriority } from "../product-sku-matcher";

// Farrukh (OLLEE consultant) 11 августа: файлы в его архиве называются
// `8800304050006_001.png` (штрихкод + `_001` = "фото номер 1"), а SKU
// в каталоге — просто `8800304050006`. До 12 августа матчер сравнивал
// строки точно и все 5 файлов уходили в "не сматчено". Теперь при
// отсутствии точного совпадения снимаем суффикс _NNN/-NN/(N).

describe("candidateSkus", () => {
  it("простое имя → одна кандидатура", () => {
    expect(candidateSkus("8809.jpg")).toEqual(["8809"]);
  });

  it("_NNN суффикс → добавляем стрипнутую версию как fallback", () => {
    expect(candidateSkus("8800304050006_001.png")).toEqual([
      "8800304050006_001",
      "8800304050006",
    ]);
  });

  it("_1 короткий суффикс тоже стрипаем", () => {
    expect(candidateSkus("SKU-ABC_1.jpg")).toEqual(["SKU-ABC_1", "SKU-ABC"]);
  });

  it("-N суффикс через дефис", () => {
    expect(candidateSkus("8809-2.jpg")).toEqual(["8809-2", "8809"]);
  });

  it("-NNN через дефис (тоже валидная конвенция)", () => {
    expect(candidateSkus("8809-002.jpg")).toEqual(["8809-002", "8809"]);
  });

  it("(N) в скобках", () => {
    expect(candidateSkus("8809 (1).jpg")).toEqual(["8809 (1)", "8809"]);
  });

  it("пробел + число (Windows copy naming)", () => {
    expect(candidateSkus("Product 1.jpg")).toEqual(["Product 1", "Product"]);
  });

  it("путь с подкаталогами → берём только basename", () => {
    expect(candidateSkus("photos/2026/8809_001.jpg")).toEqual([
      "8809_001",
      "8809",
    ]);
  });

  it("Windows-путь с backslash", () => {
    expect(candidateSkus("subfolder\\8809.png")).toEqual(["8809"]);
  });

  it("SKU БЕЗ расширения — тоже работает", () => {
    expect(candidateSkus("8809_001")).toEqual(["8809_001", "8809"]);
  });

  it("не путать: SKU реально заканчивается на _01 — приоритет exact", () => {
    // Возвращаем оба кандидата; порядок гарантирует что exact выиграет,
    // если у бизнеса реально SKU 'ABC_01'
    expect(candidateSkus("ABC_01.jpg")).toEqual(["ABC_01", "ABC"]);
  });

  it("суффикс из 5+ цифр НЕ стрипаем (это не номер варианта, а часть SKU)", () => {
    expect(candidateSkus("88003_12345.jpg")).toEqual(["88003_12345"]);
  });

  it("нет суффикса (буквы в конце) → один кандидат", () => {
    expect(candidateSkus("8809abc.jpg")).toEqual(["8809abc"]);
  });

  it("пустое имя → пустая строка", () => {
    expect(candidateSkus("")).toEqual([""]);
  });

  it("только цифры без разделителя перед → не стрипаем", () => {
    // "8800304050006" — все цифры, нет разделителя _/-/пробел => только сам
    expect(candidateSkus("8800304050006.png")).toEqual(["8800304050006"]);
  });
});

describe("photoPriority", () => {
  it("без суффикса → 0 (главное фото)", () => {
    expect(photoPriority("8809.jpg")).toBe(0);
  });

  it("_001 → 1", () => {
    expect(photoPriority("8809_001.jpg")).toBe(1);
  });

  it("_002 → 2", () => {
    expect(photoPriority("8809_002.jpg")).toBe(2);
  });

  it("-3 → 3", () => {
    expect(photoPriority("8809-3.png")).toBe(3);
  });

  it("(5) → 5", () => {
    expect(photoPriority("8809 (5).jpg")).toBe(5);
  });

  it("суффикс не парсится → 0", () => {
    expect(photoPriority("8809abc.jpg")).toBe(0);
  });

  it("отсортированный порядок соответствует приоритету main→variants", () => {
    const files = ["8809_003.jpg", "8809.jpg", "8809_001.jpg", "8809_002.jpg"];
    const sorted = [...files].sort((a, b) => photoPriority(a) - photoPriority(b));
    expect(sorted).toEqual([
      "8809.jpg",       // priority 0 — главное фото выигрывает
      "8809_001.jpg",   // priority 1
      "8809_002.jpg",   // priority 2
      "8809_003.jpg",   // priority 3
    ]);
  });
});

describe("regression: Farrukh OLLEE case (11 августа 2026)", () => {
  it("все 5 его файлов теперь дают SKU без суффикса как fallback", () => {
    const files = [
      "8800304050006_001.png",
      "8800304050013_001.png",
      "8800304050020_001.png",
      "8800304050037_001.png",
      "8800304050044_001.png",
    ];
    const skusInCatalog = new Set([
      "8800304050006",
      "8800304050013",
      "8800304050020",
      "8800304050037",
      "8800304050044",
    ]);

    let matched = 0;
    for (const f of files) {
      const candidates = candidateSkus(f);
      if (candidates.some((c) => skusInCatalog.has(c))) matched++;
    }
    expect(matched).toBe(5);
  });
});
