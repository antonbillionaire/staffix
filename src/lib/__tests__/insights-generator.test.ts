import { describe, it, expect } from "vitest";
import { detectLang, isDontKnow, isEscalation } from "../insights-generator";

describe("detectLang", () => {
  it("русский по кириллице без казахских букв", () => {
    expect(detectLang("Здравствуйте, сколько стоит стрижка?")).toBe("ru");
  });

  it("казахский когда есть спец-буквы", () => {
    expect(detectLang("Сәлеметсіз бе, қанша тұрады?")).toBe("kz");
    expect(detectLang("Салам, өтінемін")).toBe("kz");
  });

  it("узбекский по маркерам на латинице", () => {
    expect(detectLang("Salom, narx qancha?")).toBe("uz");
    expect(detectLang("Iltimos, manzil kerak")).toBe("uz");
  });

  it("английский на латинице без узбекских маркеров", () => {
    expect(detectLang("Hello, how much does a haircut cost?")).toBe("en");
  });

  it("other для мусора и слишком коротких", () => {
    expect(detectLang("")).toBe("other");
    expect(detectLang("!")).toBe("other");
    expect(detectLang("😀😀😀")).toBe("other");
  });
});

describe("isDontKnow", () => {
  it("детектит стандартные фразы отказа", () => {
    expect(isDontKnow("К сожалению, у меня нет такой информации")).toBe(true);
    expect(isDontKnow("Уточните у менеджера, пожалуйста")).toBe(true);
    expect(isDontKnow("Я не знаю точный ответ на этот вопрос")).toBe(true);
    expect(isDontKnow("Свяжитесь с менеджером для уточнения")).toBe(true);
  });

  it("не путает с обычным ответом", () => {
    expect(isDontKnow("Стрижка стоит 5000 рублей, записать вас?")).toBe(false);
    expect(isDontKnow("")).toBe(false);
  });
});

describe("isEscalation", () => {
  it("детектит передачу менеджеру", () => {
    expect(isEscalation("Передам ваш вопрос менеджеру")).toBe(true);
    expect(isEscalation("Наш специалист свяжется с вами в течение часа")).toBe(true);
    expect(isEscalation("Менеджер перезвонит вам")).toBe(true);
    expect(isEscalation("Соединяю вас с оператором")).toBe(true);
  });

  it("не срабатывает на обычный текст", () => {
    expect(isEscalation("Спасибо за обращение!")).toBe(false);
    expect(isEscalation("")).toBe(false);
  });
});
