import { describe, it, expect } from "vitest";
import {
  outcomeFromTools,
  outcomeFromSilence,
  normalizeOutcome,
  shouldUpgradeOutcome,
  isSuccessOutcome,
  isLossOutcome,
} from "../conversation-outcome";
import { classifyConversationKind, countsTowardFunnelMetric } from "../conversation-kind";

describe("outcomeFromTools — исход по факту, а не по мнению модели", () => {
  it("create_booking → booked", () => {
    expect(outcomeFromTools(["check_availability", "create_booking"], true)).toBe("booked");
  });

  it("book_package тоже считается записью", () => {
    expect(outcomeFromTools(["book_package"], true)).toBe("booked");
  });

  it("create_order → ordered", () => {
    expect(outcomeFromTools(["search_products", "create_order"], true)).toBe("ordered");
  });

  it("notify_manager С телефоном → lead_captured", () => {
    expect(outcomeFromTools(["notify_manager"], true)).toBe("lead_captured");
  });

  it("notify_manager БЕЗ телефона → escalated", () => {
    // Ровно то, что происходило на проде: 206 эскалаций, менеджеру не с чем
    // работать. Различие между этими двумя исходами — суть метрики.
    expect(outcomeFromTools(["notify_manager"], false)).toBe("escalated");
  });

  it("route_to_specialist ведёт себя как notify_manager", () => {
    expect(outcomeFromTools(["route_to_specialist"], true)).toBe("lead_captured");
    expect(outcomeFromTools(["route_to_specialist"], false)).toBe("escalated");
  });

  it("заказ сильнее эскалации в одном обороте", () => {
    expect(outcomeFromTools(["notify_manager", "create_order"], false)).toBe("ordered");
  });

  it("справочные инструменты фактом не являются", () => {
    expect(outcomeFromTools(["search_products", "get_categories"], true)).toBeNull();
  });

  it("пустой список инструментов → серая зона", () => {
    expect(outcomeFromTools([], true)).toBeNull();
  });
});

describe("outcomeFromSilence — разбор серой зоны", () => {
  it("бот сказал последнее слово и тишина сутки → клиент ушёл", () => {
    expect(
      outcomeFromSilence({ lastRole: "assistant", minutesSinceLastMessage: 24 * 60 })
    ).toBe("abandoned");
  });

  it("последним говорил клиент → вопрос закрыт", () => {
    expect(outcomeFromSilence({ lastRole: "user", minutesSinceLastMessage: 48 * 60 })).toBe(
      "answered"
    );
  });

  it("свежий диалог ещё не исход — клиент может вернуться вечером", () => {
    expect(
      outcomeFromSilence({ lastRole: "assistant", minutesSinceLastMessage: 60 })
    ).toBeNull();
  });

  it("порог тишины настраивается", () => {
    expect(
      outcomeFromSilence({
        lastRole: "assistant",
        minutesSinceLastMessage: 120,
        abandonAfterMinutes: 60,
      })
    ).toBe("abandoned");
  });
});

describe("shouldUpgradeOutcome — не затирать сильный исход слабым", () => {
  it("пустой текущий исход перезаписывается любым", () => {
    expect(shouldUpgradeOutcome(null, "answered")).toBe(true);
  });

  it("созданный заказ не становится answered на следующем обороте", () => {
    // Клиент оформил заказ, потом спросил про доставку — диалог остаётся ordered.
    expect(shouldUpgradeOutcome("ordered", "answered")).toBe(false);
  });

  it("эскалация повышается до заказа", () => {
    expect(shouldUpgradeOutcome("escalated", "ordered")).toBe(true);
  });

  it("escalated повышается до lead_captured когда телефон получен", () => {
    expect(shouldUpgradeOutcome("escalated", "lead_captured")).toBe(true);
  });

  it("мусор в текущем значении не блокирует запись", () => {
    expect(shouldUpgradeOutcome("что-то-непонятное", "booked")).toBe(true);
  });
});

describe("normalizeOutcome", () => {
  it("приводит регистр и пробелы", () => {
    expect(normalizeOutcome("  BOOKED ")).toBe("booked");
  });

  it("мусор от модели отбрасывается", () => {
    expect(normalizeOutcome("клиент доволен")).toBeNull();
    expect(normalizeOutcome("")).toBeNull();
    expect(normalizeOutcome(null)).toBeNull();
  });
});

describe("классификация успеха и потери", () => {
  it("цель достигнута", () => {
    expect(isSuccessOutcome("booked")).toBe(true);
    expect(isSuccessOutcome("ordered")).toBe(true);
    expect(isSuccessOutcome("lead_captured")).toBe(true);
  });

  it("эскалация без контакта — не успех", () => {
    expect(isSuccessOutcome("escalated")).toBe(false);
  });

  it("потери", () => {
    expect(isLossOutcome("abandoned")).toBe(true);
    expect(isLossOutcome("unresolved")).toBe(true);
    expect(isLossOutcome("answered")).toBe(false);
  });
});

describe("classifyConversationKind — кто вообще пишет", () => {
  it("блогер с предложением бартера — не клиент", () => {
    // Дословно из прод-задач OLLEE
    expect(
      classifyConversationKind([
        "Здравствуйте! Предлагаю сотрудничество по бартеру, создаю Reels с хорошей вовлеченностью",
      ])
    ).toBe("partnership");
  });

  it("UGC-креатор — не клиент", () => {
    expect(
      classifyConversationKind(["Я UGC creator, готов продвигать вашу продукцию, 36 400 подписчиков"])
    ).toBe("partnership");
  });

  it("покупатель с вопросом о цене — клиент", () => {
    expect(classifyConversationKind(["Сколько стоит BB-крем? Есть в наличии?"])).toBe("client");
  });

  it("узбекский покупатель распознаётся", () => {
    expect(classifyConversationKind(["Narxi qancha? Buyurtma bermoqchiman"])).toBe("client");
  });

  it("блогер, который в итоге хочет купить, считается клиентом", () => {
    expect(
      classifyConversationKind([
        "Я блогер, предлагаю сотрудничество",
        "А вообще сколько стоит этот крем? Хочу заказать себе",
      ])
    ).toBe("client");
  });

  it("без маркеров — unknown, не гадаем", () => {
    expect(classifyConversationKind(["Здравствуйте"])).toBe("unknown");
    expect(classifyConversationKind([])).toBe("unknown");
  });

  it("в метрику не идёт только партнёрка", () => {
    // unknown считаем клиентом: осторожнее занизить успех, чем скрыть потерю.
    expect(countsTowardFunnelMetric("client")).toBe(true);
    expect(countsTowardFunnelMetric("unknown")).toBe(true);
    expect(countsTowardFunnelMetric("partnership")).toBe(false);
  });
});
