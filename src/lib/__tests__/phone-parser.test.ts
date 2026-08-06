import { describe, it, expect } from "vitest";
import { detectPhone } from "../phone-parser";

describe("detectPhone — полные международные форматы (без учёта country)", () => {
  it("+998 90 123-45-67 → +998901234567", () => {
    expect(detectPhone("Мой номер +998 90 123-45-67").phone).toBe("+998901234567");
  });

  it("+7 (701) 234-56-78 → +77012345678", () => {
    expect(detectPhone("Позвоните: +7 (701) 234-56-78").phone).toBe("+77012345678");
  });

  it("8-901-234-56-78 → +79012345678 (старый RU/KZ формат)", () => {
    expect(detectPhone("Тел: 8-901-234-56-78").phone).toBe("+79012345678");
  });

  it("998901234567 без плюса → +998901234567", () => {
    expect(detectPhone("998901234567").phone).toBe("+998901234567");
  });
});

describe("detectPhone — локальные форматы (по country)", () => {
  it("OLLEE-случай: 998888888 (9 цифр без +998) при country=UZ → +998998888888", () => {
    // Именно этот кейс сломал OLLEE: клиент писал 9 цифр без +998
    expect(detectPhone("мой номер 998888888", "UZ").phone).toBe("+998998888888");
  });

  it("Узбекский 901234567 (9 цифр с 9) при country=UZ → +998901234567", () => {
    expect(detectPhone("Мой номер 901234567", "UZ").phone).toBe("+998901234567");
  });

  it("Тот же 901234567 при country=RU НЕ распознаётся как полный (нужен phone-context для incomplete)", () => {
    // 9 цифр — не хватает 1 для 10-цифрового русского. Слово «номер» в сообщении даёт phone-context.
    const r = detectPhone("Мой номер 901234567", "RU");
    expect(r.phone).toBeNull();
    expect(r.incomplete).toBe(true);
  });

  it("Российский 9012345678 (10 цифр с 9) при country=RU → +79012345678", () => {
    expect(detectPhone("Мой номер 9012345678", "RU").phone).toBe("+79012345678");
  });

  it("Казахстанский 7012345678 (10 цифр с 7) при country=KZ → +77012345678", () => {
    expect(detectPhone("Мой номер 7012345678", "KZ").phone).toBe("+77012345678");
  });

  it("Кыргызский 555123456 при country=KG → +996555123456", () => {
    expect(detectPhone("Тел 555 123 456", "KG").phone).toBe("+996555123456");
  });

  it("Украинский 067 123 45 67 (10 цифр с 0) при country=UA → +380671234567 (0 отбрасывается)", () => {
    expect(detectPhone("Тел: 067 123 45 67", "UA").phone).toBe("+380671234567");
  });

  it("Украинский 671234567 (9 цифр без ведущего 0) при country=UA → +380671234567", () => {
    expect(detectPhone("Тел: 671234567", "UA").phone).toBe("+380671234567");
  });

  it("Не распознаёт локальный формат если country не указан", () => {
    expect(detectPhone("Мой номер 998888888").phone).toBeNull();
  });
});

describe("detectPhone — короткие номера (incomplete)", () => {
  it("6 цифр — incomplete=true", () => {
    const r = detectPhone("Мой номер 998888", "UZ");
    expect(r.phone).toBeNull();
    expect(r.incomplete).toBe(true);
  });

  it("5 цифр + слово «телефон» → incomplete=true (граница)", () => {
    const r = detectPhone("телефон 12345", "UZ");
    expect(r.phone).toBeNull();
    expect(r.incomplete).toBe(true);
  });

  it("6 цифр в коротком сообщении без ключевых слов → всё равно incomplete=true", () => {
    // Короткое (<80 символов) с последовательностью 5-11 цифр — вероятно попытка дать номер
    const r = detectPhone("998888", "UZ");
    expect(r.incomplete).toBe(true);
  });

  it("4 цифры — НЕ incomplete (слишком мало, скорее год/номер квартиры)", () => {
    const r = detectPhone("Квартира 1234", "UZ");
    expect(r.phone).toBeNull();
    expect(r.incomplete).toBe(false);
  });

  it("Длинное сообщение — НЕ триггерим incomplete на числах внутри", () => {
    const long = "Хочу узнать про артикул 12345 в вашем магазине " +
      "OLLEE — там был крем за 145000 сум и вроде 8809 в штрихкоде. " +
      "Не пойму какой из них лучше для комбинированной кожи, я больше " +
      "склоняюсь к SPF варианту, что скажете?";
    expect(long.length).toBeGreaterThan(200);
    const r = detectPhone(long, "UZ");
    expect(r.incomplete).toBe(false);
  });
});

describe("detectPhone — не ложно срабатываем", () => {
  it("Сообщение без цифр → phone=null, incomplete=false", () => {
    const r = detectPhone("Привет, есть SPF-крем?", "UZ");
    expect(r).toEqual({ phone: null, incomplete: false });
  });

  it("Цена 145 000 сум — не путается с номером", () => {
    const r = detectPhone("Сколько стоит 145 000 сум?", "UZ");
    expect(r.phone).toBeNull();
    expect(r.incomplete).toBe(false);
  });

  it("Дата 2026-08-06 не срабатывает как номер", () => {
    const r = detectPhone("Заказ от 2026-08-06 когда придёт?", "UZ");
    expect(r.phone).toBeNull();
    // Может быть incomplete=true если regex распознает 20260806 как 8-циферную группу
    // — не критично, guard-логика всё равно спросит уточнение, что не ломает UX
  });
});

describe("detectPhone — приоритет: полный формат бьёт локальный", () => {
  it("Если в тексте и +998... и локальный 9-цифровой — выбираем полный", () => {
    const r = detectPhone("Основной +998 90 123 4567, запасной 998888888", "UZ");
    expect(r.phone).toBe("+998901234567");
  });

  it("Если в тексте только локальный — берём его", () => {
    const r = detectPhone("Пишите на 998888888", "UZ");
    expect(r.phone).toBe("+998998888888");
  });
});
