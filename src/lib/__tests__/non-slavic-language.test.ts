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
