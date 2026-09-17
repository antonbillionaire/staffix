import { describe, it, expect } from "vitest";
import { botPromisedHandoff } from "../handoff-detector";

describe("botPromisedHandoff", () => {
  // ─── Должны срабатывать (true) — бот обещает передачу человеку ─────────

  it("matches 'Передал менеджеру'", () => {
    expect(botPromisedHandoff("Передал менеджеру ваш запрос на звонок.")).toBe(true);
  });

  it("matches 'Передам менеджеру вашу просьбу'", () => {
    expect(botPromisedHandoff("Конечно! Передам менеджеру вашу просьбу о цене.")).toBe(true);
  });

  it("matches 'Сообщу администратору'", () => {
    expect(botPromisedHandoff("Сообщу администратору, он свяжется с вами.")).toBe(true);
  });

  it("matches 'Менеджер свяжется с вами'", () => {
    expect(botPromisedHandoff("Готово ✅ Менеджер свяжется с вами в течение часа.")).toBe(true);
  });

  it("matches 'Оператор перезвонит'", () => {
    expect(botPromisedHandoff("Наш оператор перезвонит вам сегодня.")).toBe(true);
  });

  it("matches 'Сотрудник получит'", () => {
    expect(botPromisedHandoff("Сотрудник получит ваше обращение и ответит.")).toBe(true);
  });

  it("matches 'Оставил заявку'", () => {
    expect(botPromisedHandoff("Оставил заявку на звонок, ожидайте.")).toBe(true);
  });

  it("matches 'Оформил обращение'", () => {
    expect(botPromisedHandoff("Оформил обращение от вашего имени.")).toBe(true);
  });

  it("matches 'Заявка принята'", () => {
    expect(botPromisedHandoff("Ваша заявка принята, скоро свяжемся.")).toBe(true);
  });

  it("matches 'Заявка зарегистрирована'", () => {
    expect(botPromisedHandoff("Ваше обращение зарегистрировано, ожидайте звонка.")).toBe(true);
  });

  it("matches 'Перезвоним вам'", () => {
    expect(botPromisedHandoff("Спасибо, перезвоним вам в ближайшее время.")).toBe(true);
  });

  it("matches 'Свяжемся с вами'", () => {
    expect(botPromisedHandoff("Принято. Свяжемся с вами после обеда.")).toBe(true);
  });

  it("matches 'позову менеджера'", () => {
    expect(botPromisedHandoff("Позову менеджера, он подскажет точнее.")).toBe(true);
  });

  it("matches 'наш представитель свяжется'", () => {
    expect(botPromisedHandoff("Наш представитель свяжется с вами в рабочее время.")).toBe(true);
  });

  it("matches English 'forwarded to manager'", () => {
    expect(botPromisedHandoff("Done — I've forwarded your request to the manager.")).toBe(true);
  });

  it("matches English 'we will get back to you'", () => {
    expect(botPromisedHandoff("Got it. We will get back to you shortly.")).toBe(true);
  });

  it("matches the actual Right Flight bot reply that broke things", () => {
    const actual =
      "Готово, Farrukh! ✅\n\nПередал менеджеру ваш запрос на звонок. " +
      "Он увидит уведомление и свяжется с вами в ближайшее время.";
    expect(botPromisedHandoff(actual)).toBe(true);
  });

  // ─── НЕ должны срабатывать (false) — обычные ответы бота ───────────────

  it("does not match a price answer", () => {
    expect(botPromisedHandoff("Цена тура — 1391 USD за двухместный номер.")).toBe(false);
  });

  it("does not match service description", () => {
    expect(botPromisedHandoff("Стрижка занимает 30 минут. Записать вас?")).toBe(false);
  });

  it("does not match catalog reply", () => {
    expect(botPromisedHandoff("В наличии Glue Remover Lovely 50ml — 250 000 сум.")).toBe(false);
  });

  it("does not match factual menu listing", () => {
    expect(botPromisedHandoff("У нас есть три тура: Аватар, Гуанчжоу, Шанхай.")).toBe(false);
  });

  it("does not match question to client", () => {
    expect(botPromisedHandoff("На какую дату вы хотели бы записаться?")).toBe(false);
  });

  it("does not match short greetings", () => {
    expect(botPromisedHandoff("Здравствуйте!")).toBe(false);
    expect(botPromisedHandoff("Чем могу помочь?")).toBe(false);
  });

  it("does not match empty/null", () => {
    expect(botPromisedHandoff("")).toBe(false);
  });
});

// ─── Узбекский (17 сент 2026) ─────────────────────────────────────────────
// Все «положительные» строки — РЕАЛЬНЫЕ ответы бота из диалогов OLLEE,
// не выдуманные. До этой правки детектор не ловил ни одну из них: список
// формулировок был только русский и английский, а узбекский текст есть в
// 343 ответах бота из 1430.
describe("botPromisedHandoff — узбекский, латиница", () => {
  it("«менеджер с вами свяжется»", () => {
    expect(botPromisedHandoff("Menejer sizga bog'lanadi. Sabr qiling!")).toBe(true);
  });

  it("«передал ответственному специалисту»", () => {
    expect(
      botPromisedHandoff("Mas'ul mutaxassisimizga yetkazdim. U sizga tez orada bog'lanadi.")
    ).toBe(true);
  });

  it("«отправил сообщение менеджеру»", () => {
    expect(botPromisedHandoff("Mas'ul menejerga darhol xabar yubordim!")).toBe(true);
  });

  it("«передам ваш заказ менеджеру»", () => {
    expect(
      botPromisedHandoff("men sizning buyurtmangizni menedzherga uzatib beraman")
    ).toBe(true);
  });

  it("обратный порядок слов — глагол впереди", () => {
    expect(botPromisedHandoff("Boglanadi menejerimiz")).toBe(true);
  });

  it("апостроф могут не поставить вовсе", () => {
    expect(botPromisedHandoff("Menejer sizga boglanadi")).toBe(true);
  });
});

describe("botPromisedHandoff — узбекский, кириллица", () => {
  it("«менеджер вам позвонит»", () => {
    expect(
      botPromisedHandoff("Менеджер сизга қўнг қилади ва барча деталларни тушуниб олади")
    ).toBe(true);
  });

  it("«наш менеджер вам сообщит»", () => {
    expect(
      botPromisedHandoff("Менеджеримиз сизга қис вақтда хабар беради")
    ).toBe(true);
  });

  it("«менеджер скоро свяжется»", () => {
    expect(botPromisedHandoff("менеджер яқин вақтда алоқа қилади!")).toBe(true);
  });
});

describe("botPromisedHandoff — узбекский, обычные ответы не ловятся", () => {
  it("приветствие", () => {
    expect(botPromisedHandoff("Assalomu alaykum! Qanday yordam bera olaman?")).toBe(false);
    expect(botPromisedHandoff("Сизга қандай ёрдам бера оламан?")).toBe(false);
  });

  it("цена товара", () => {
    expect(botPromisedHandoff("BB-krem 152 000 so'm. Buyurtma qilasizmi?")).toBe(false);
  });

  it("условия доставки — глагол yetkaz есть, исполнителя нет", () => {
    expect(botPromisedHandoff("Yetkazib berish 1-3 ish kunida, 30 000 so'm.")).toBe(false);
  });

  it("запрос данных для заказа", () => {
    expect(
      botPromisedHandoff(
        "Buyurtmangizni rasmiylashtirish uchun ismingizni va telefon raqamingizni ayting."
      )
    ).toBe(false);
  });

  it("наличие на складе", () => {
    expect(botPromisedHandoff("Bu mahsulot hozir omborda bor.")).toBe(false);
  });
});
