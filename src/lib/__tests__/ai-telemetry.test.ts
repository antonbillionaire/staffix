import { describe, it, expect, vi, beforeEach } from "vitest";

// Мокаем prisma до импорта тестируемого модуля — createTurnTracker
// пишет через prisma.aiTurn.create fire-and-forget.
// vi.hoisted нужен потому что vi.mock поднимается выше объявлений const.
const { createMock } = vi.hoisted(() => ({
  createMock: vi.fn().mockResolvedValue({ id: "turn-1" }),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: { aiTurn: { create: createMock } },
}));

import { createTurnTracker, createNoopTurnTracker } from "../ai-telemetry";
import { estimateCostUsd, MODEL_PRICING, PRICING_CHECKED_AT } from "../ai-pricing";

beforeEach(() => {
  createMock.mockClear();
});

describe("estimateCostUsd", () => {
  it("считает стоимость Sonnet 5 по официальным ставкам", () => {
    // 1M input + 1M output = $2 + $10
    const cost = estimateCostUsd("claude-sonnet-5", {
      tokensInput: 1_000_000,
      tokensOutput: 1_000_000,
      tokensCacheRead: 0,
      tokensCacheCreate: 0,
    });
    expect(cost).toBe(12);
  });

  it("считает кэш дешевле обычного входа", () => {
    // 1M cache read у Sonnet = 0.1 × $2 = $0.20
    const cost = estimateCostUsd("claude-sonnet-5", {
      tokensInput: 0,
      tokensOutput: 0,
      tokensCacheRead: 1_000_000,
      tokensCacheCreate: 0,
    });
    expect(cost).toBe(0.2);
  });

  it("считает запись в кэш дороже обычного входа", () => {
    // 1M cache write 1h у Haiku = 2 × $1 = $2
    const cost = estimateCostUsd("claude-haiku-4-5-20251001", {
      tokensInput: 0,
      tokensOutput: 0,
      tokensCacheRead: 0,
      tokensCacheCreate: 1_000_000,
    });
    expect(cost).toBe(2);
  });

  it("возвращает null для неизвестной модели вместо чужого прайса", () => {
    const cost = estimateCostUsd("claude-some-future-model", {
      tokensInput: 1_000_000,
      tokensOutput: 0,
      tokensCacheRead: 0,
      tokensCacheCreate: 0,
    });
    expect(cost).toBeNull();
  });

  it("прайс помечен датой проверки — защита от правок по памяти", () => {
    expect(PRICING_CHECKED_AT).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(Object.keys(MODEL_PRICING).length).toBeGreaterThan(0);
  });
});

describe("createTurnTracker", () => {
  const init = {
    businessId: "biz-1",
    channel: "instagram",
  };

  it("пишет строку когда модель и диалог известны", () => {
    const t = createTurnTracker(init);
    t.setConversation("conv-1", "ig-user-1", true);
    t.setModel("claude-sonnet-5", "complex");
    t.addUsage({ input_tokens: 100, output_tokens: 50 });
    t.finish();

    expect(createMock).toHaveBeenCalledTimes(1);
    const data = createMock.mock.calls[0][0].data;
    expect(data.businessId).toBe("biz-1");
    expect(data.conversationKey).toBe("conv-1");
    expect(data.model).toBe("claude-sonnet-5");
    expect(data.complexity).toBe("complex");
    expect(data.salesMode).toBe(true);
    expect(data.tokensInput).toBe(100);
    expect(data.tokensOutput).toBe(50);
    expect(typeof data.latencyMs).toBe("number");
  });

  it("НЕ пишет строку если до вызова модели дело не дошло", () => {
    // Бот на паузе / human takeover / подписка кончилась — это не оборот,
    // такие строки испортили бы среднюю латентность и долю recovery.
    const t = createTurnTracker(init);
    t.setConversation("conv-1");
    t.finish();
    expect(createMock).not.toHaveBeenCalled();
  });

  it("НЕ пишет строку без conversationKey", () => {
    const t = createTurnTracker(init);
    t.setModel("claude-sonnet-5");
    t.finish();
    expect(createMock).not.toHaveBeenCalled();
  });

  it("идемпотентен — повторный finish() не дублирует строку", () => {
    const t = createTurnTracker(init);
    t.setConversation("conv-1");
    t.setModel("claude-sonnet-5");
    t.finish();
    t.finish();
    t.finish();
    expect(createMock).toHaveBeenCalledTimes(1);
  });

  it("суммирует токены со всех вызовов оборота", () => {
    const t = createTurnTracker(init);
    t.setConversation("conv-1");
    t.setModel("claude-sonnet-5");
    t.addUsage({ input_tokens: 100, output_tokens: 10, cache_read_input_tokens: 5000 });
    t.addUsage({ input_tokens: 50, output_tokens: 20, cache_creation_input_tokens: 200 });
    t.addUsage(null); // пропущенный usage не должен ломать счёт
    t.finish();

    const data = createMock.mock.calls[0][0].data;
    expect(data.tokensInput).toBe(150);
    expect(data.tokensOutput).toBe(30);
    expect(data.tokensCacheRead).toBe(5000);
    expect(data.tokensCacheCreate).toBe(200);
  });

  it("копит инструменты и итерации tool-loop", () => {
    const t = createTurnTracker(init);
    t.setConversation("conv-1");
    t.setModel("claude-haiku-4-5-20251001");
    t.addIteration();
    t.addTool("search_products");
    t.addIteration();
    t.addTool("create_order");
    t.finish();

    const data = createMock.mock.calls[0][0].data;
    expect(data.iterations).toBe(2);
    expect(data.toolsCalled).toEqual(["search_products", "create_order"]);
  });

  it("запоминает первое срабатывание safety-net, а не последнее", () => {
    // Первое объясняет, что пошло не так; последующие — следствие.
    const t = createTurnTracker(init);
    t.setConversation("conv-1");
    t.setModel("claude-sonnet-5");
    t.markSafetyNet("handoff_guard");
    t.markSafetyNet("notify_manager");
    t.finish();

    expect(createMock.mock.calls[0][0].data.safetyNetFired).toBe("handoff_guard");
  });

  it("помечает recovery и пустой ответ", () => {
    const t = createTurnTracker(init);
    t.setConversation("conv-1");
    t.setModel("claude-sonnet-5");
    t.markRecovery();
    t.markEmptyResponse();
    t.finish();

    const data = createMock.mock.calls[0][0].data;
    expect(data.recoveryUsed).toBe(true);
    expect(data.emptyResponse).toBe(true);
  });

  it("считает costUsd по модели оборота", () => {
    const t = createTurnTracker(init);
    t.setConversation("conv-1");
    t.setModel("claude-sonnet-5");
    t.addUsage({ input_tokens: 1_000_000, output_tokens: 0 });
    t.finish();

    expect(createMock.mock.calls[0][0].data.costUsd).toBe(2);
  });

  it("падение записи в БД не пробрасывает исключение наружу", async () => {
    // Телеметрия не имеет права уронить ответ клиенту.
    createMock.mockRejectedValueOnce(new Error("db down"));
    const t = createTurnTracker(init);
    t.setConversation("conv-1");
    t.setModel("claude-sonnet-5");
    expect(() => t.finish()).not.toThrow();
    // даём микротаску отработать, чтобы .catch() успел сработать
    await Promise.resolve();
  });

  it("noop-трекер безопасен и ничего не пишет", () => {
    const t = createNoopTurnTracker();
    t.setConversation("conv-1");
    t.setModel("claude-sonnet-5");
    t.addUsage({ input_tokens: 100 });
    t.addTool("x");
    t.addIteration();
    t.markRecovery();
    t.markSafetyNet("phone_guard");
    t.markEmptyResponse();
    t.finish();
    expect(createMock).not.toHaveBeenCalled();
  });
});
