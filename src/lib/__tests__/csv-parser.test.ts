import { describe, it, expect } from "vitest";
import { parseCsv } from "../csv-parser";

describe("parseCsv — state-machine (RFC 4180)", () => {
  it("парсит простой CSV с запятой", () => {
    const csv = "name,price\nCream,100";
    expect(parseCsv(csv)).toEqual([
      ["name", "price"],
      ["Cream", "100"],
    ]);
  });

  it("парсит CSV с точкой с запятой (европейский Excel)", () => {
    const csv = "name;price\nCream;100";
    expect(parseCsv(csv)).toEqual([
      ["name", "price"],
      ["Cream", "100"],
    ]);
  });

  it("КРИТИЧНО: сохраняет перенос строки внутри quoted-ячейки как один товар", () => {
    // Ровно то что валит импорт OLLEE: SheetJS оборачивает
    // многострочное описание в кавычки, старый split("\n") ломал это на 3 строки.
    const csv = `name;price;description
Cream;100;"Technology of smart pigmentation
lies with an even coating
without a mask effect"`;
    const rows = parseCsv(csv);
    expect(rows).toHaveLength(2);
    expect(rows[1]).toHaveLength(3);
    expect(rows[1][0]).toBe("Cream");
    expect(rows[1][2]).toBe(
      "Technology of smart pigmentation\nlies with an even coating\nwithout a mask effect"
    );
  });

  it("парсит русские описания OLLEE с реальными переносами", () => {
    const csv = `Номенклатура;Цена;Описание
BB-крем;145000;" Технология умного пигментирования позволяет крему,
ложиться ровным покрытием без эффекта \\"маски\\"."`;
    // (В реальности escaping "" — тестируем отдельно)
    const rows = parseCsv(csv);
    expect(rows).toHaveLength(2);
    expect(rows[1][0]).toBe("BB-крем");
    expect(rows[1][2]).toContain("Технология умного пигментирования");
    expect(rows[1][2]).toContain("ложиться ровным покрытием");
  });

  it("экранирование кавычек (RFC 4180: '\"\"' → одна кавычка)", () => {
    const csv = `name;desc
Cream;"say ""hello"" world"`;
    const rows = parseCsv(csv);
    expect(rows[1][1]).toBe('say "hello" world');
  });

  it("Windows-переносы \\r\\n нормализуются", () => {
    const csv = "name;price\r\nCream;100\r\nSoap;50";
    expect(parseCsv(csv)).toEqual([
      ["name", "price"],
      ["Cream", "100"],
      ["Soap", "50"],
    ]);
  });

  it("Mac classic-переносы \\r нормализуются", () => {
    const csv = "name;price\rCream;100";
    expect(parseCsv(csv)).toEqual([
      ["name", "price"],
      ["Cream", "100"],
    ]);
  });

  it("пропускает пустые строки в конце файла", () => {
    const csv = "name;price\nCream;100\n\n\n";
    expect(parseCsv(csv)).toEqual([
      ["name", "price"],
      ["Cream", "100"],
    ]);
  });

  it("обрабатывает пустые ячейки", () => {
    const csv = "name;price;stock\nCream;100;\nSoap;;5";
    expect(parseCsv(csv)).toEqual([
      ["name", "price", "stock"],
      ["Cream", "100", ""],
      ["Soap", "", "5"],
    ]);
  });

  it("парсит запятую внутри quoted-ячейки без разбиения", () => {
    const csv = `name,description
Cream,"Contains hyaluronic, vitamin C, and niacinamide"`;
    const rows = parseCsv(csv);
    expect(rows).toHaveLength(2);
    expect(rows[1][1]).toBe("Contains hyaluronic, vitamin C, and niacinamide");
  });

  it("точка с запятой внутри quoted-ячейки не ломает разбор", () => {
    const csv = `name;description
Cream;"Состав: вода; глицерин; ниацинамид"`;
    const rows = parseCsv(csv);
    expect(rows).toHaveLength(2);
    expect(rows[1][1]).toBe("Состав: вода; глицерин; ниацинамид");
  });

  it("определяет разделитель — приоритет ';' если он в первой строке", () => {
    const csv = "name;price;description\nCream;100;low, low";
    const rows = parseCsv(csv);
    expect(rows[0]).toEqual(["name", "price", "description"]);
    expect(rows[1]).toEqual(["Cream", "100", "low, low"]);
  });

  it("обрезает пробелы вокруг ячеек", () => {
    const csv = "name;price\n  Cream  ;  100  ";
    expect(parseCsv(csv)).toEqual([
      ["name", "price"],
      ["Cream", "100"],
    ]);
  });

  it("многострочное описание с несколькими товарами не смешивает данные", () => {
    // Регрессионный тест на баг OLLEE: 3 товара с многострочными описаниями
    const csv = `name;price;description
Product A;100;"Line 1
Line 2
Line 3"
Product B;200;"Single line desc"
Product C;300;"First para

Second para"`;
    const rows = parseCsv(csv);
    expect(rows).toHaveLength(4); // header + 3 товара
    expect(rows[1][0]).toBe("Product A");
    expect(rows[1][2]).toBe("Line 1\nLine 2\nLine 3");
    expect(rows[2][0]).toBe("Product B");
    expect(rows[3][0]).toBe("Product C");
    expect(rows[3][2]).toBe("First para\n\nSecond para");
  });

  it("файл не заканчивается на \\n — последняя ячейка не теряется", () => {
    const csv = "name;price\nCream;100";
    expect(parseCsv(csv)).toEqual([
      ["name", "price"],
      ["Cream", "100"],
    ]);
  });
});
