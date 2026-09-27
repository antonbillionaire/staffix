import { describe, it, expect } from "vitest";
import { isNonSlavicLanguage } from "@/lib/complexity-classifier";

// Замерено на эвалах 17 сент 2026: узбекские кейсы Sonnet проходит, Haiku
// валит оба — выдумывает несуществующие варианты товара и пишет ломаным
// узбекским. Поэтому такие сообщения не должны уходить на дешёвую модель.
describe("isNonSlavicLanguage — узбекский", () => {
  it("латиница", () => {
    expect(isNonSlavicLanguage("Salom! BB-krem bormi? Narxi qancha?")).toBe(true);
    expect(isNonSlavicLanguage("rahmat, yaxshi")).toBe(true);
    expect(isNonSlavicLanguage("Menga krem kerak")).toBe(true);
  });

  it("кириллица — по буквам, которых нет в русском", () => {
    expect(isNonSlavicLanguage("Салом! Юз учун крем борми? Нархи қанча?")).toBe(true);
    expect(isNonSlavicLanguage("Рахмат, бўлади")).toBe(true);
  });

  it("кириллица без особых букв — по частотным словам", () => {
    expect(isNonSlavicLanguage("сизга керак")).toBe(true);
  });
});

describe("isNonSlavicLanguage — казахский", () => {
  it("буквы ә, ң, ө, ү, һ", () => {
    expect(isNonSlavicLanguage("Сәлем! Крем бар ма?")).toBe(true);
  });
});

describe("isNonSlavicLanguage — русский и английский не трогаем", () => {
  it("обычные русские сообщения", () => {
    expect(isNonSlavicLanguage("здравствуйте, есть бб-крем? сколько стоит")).toBe(false);
    expect(isNonSlavicLanguage("спасибо, беру два")).toBe(false);
    expect(isNonSlavicLanguage("а доставка сколько по Ташкенту?")).toBe(false);
    expect(isNonSlavicLanguage("хорошо, жду")).toBe(false);
  });

  it("английские сообщения", () => {
    expect(isNonSlavicLanguage("Hello, do you have BB cream?")).toBe(false);
    expect(isNonSlavicLanguage("what is the price")).toBe(false);
  });

  it("английские слова, внутри которых прячутся узбекские — не ловим", () => {
    // без границы слова «nima» нашлось бы внутри «minimal» и «animal»
    expect(isNonSlavicLanguage("minimal packaging please")).toBe(false);
    expect(isNonSlavicLanguage("no animal testing?")).toBe(false);
  });

  it("названия товаров латиницей не делают сообщение узбекским", () => {
    expect(isNonSlavicLanguage("есть Glue Remover Lovely 50ml?")).toBe(false);
  });

  it("пустая строка", () => {
    expect(isNonSlavicLanguage("")).toBe(false);
  });
});

describe("isNonSlavicLanguage — узбекская кириллица БЕЗ особых букв", () => {
  it("«Она тилида гапирсанг булмайдими» — реальное сообщение клиента RIGHT FLIGHT", () => {
    // 26 сент 2026: это ушло на Haiku, и бот сочинил, что работает только
    // по-русски, хотя в базе знаний бизнеса написано обратное.
    expect(isNonSlavicLanguage("Она тилида гапирсанг булмайдими ёки менсимайсанми")).toBe(true);
  });

  it("«Нархи канча экан» — самый частый вопрос в комментариях", () => {
    expect(isNonSlavicLanguage("Нархи канча экан")).toBe(true);
    expect(isNonSlavicLanguage("[Комментарий к посту] Нархи канча")).toBe(true);
  });

  it("приветствия и благодарности", () => {
    expect(isNonSlavicLanguage("Ассалому алайкум, нархи канча экан?")).toBe(true);
    expect(isNonSlavicLanguage("Асаломалекум бартер есть?")).toBe(true);
    expect(isNonSlavicLanguage("Рахмат")).toBe(true);
    expect(isNonSlavicLanguage("Яхши")).toBe(true);
  });
});

describe("isNonSlavicLanguage — «нима» внутри русских слов НЕ считается", () => {
  // Старый детектор искал подстроку без границ слова и гнал на Sonnet
  // обычные русские сообщения. Граница задана классом кириллицы, а не :
  // в JavaScript перед кириллической буквой границы слова не бывает.
  it.each([
    "Я не понимаю",
    "Спасибо за внимание",
    "Сколько времени занимает поездка между городами?",
    "Менеджер не поднимает трубку",
    "минимальный заказ какой?",
  ])("«%s» — русское", (msg) => {
    expect(isNonSlavicLanguage(msg)).toBe(false);
  });

  it("«бор» внутри «выбор» тоже не считается", () => {
    expect(isNonSlavicLanguage("а выбор большой?")).toBe(false);
  });
});
