import { describe, it, expect } from "vitest";
import {
  parseKnownFacts,
  mergeKnownFacts,
  validateStageTransition,
  isFunnelStage,
  bootstrapStage,
  FUNNEL_STAGES,
  type FunnelKnownFacts,
} from "@/lib/funnel-state";

const WITH_PHONE: FunnelKnownFacts = { phone: "+998901234567" };
const NO_PHONE: FunnelKnownFacts = {};

describe("FUNNEL_STAGES", () => {
  it("ровно семь стадий, как в funnel-rules.ts — новых не заводим", () => {
    expect(Object.keys(FUNNEL_STAGES)).toHaveLength(7);
  });

  it("isFunnelStage отсекает всё, что не 1..7", () => {
    expect(isFunnelStage(1)).toBe(true);
    expect(isFunnelStage(7)).toBe(true);
    expect(isFunnelStage(0)).toBe(false);
    expect(isFunnelStage(8)).toBe(false);
    expect(isFunnelStage(2.5)).toBe(false);
    expect(isFunnelStage("3")).toBe(false);
    expect(isFunnelStage(null)).toBe(false);
  });
});

describe("validateStageTransition — движение вперёд", () => {
  it("на следующую стадию — свободно", () => {
    const r = validateStageTransition(2, 3, NO_PHONE);
    expect(r).toMatchObject({ stage: 3, accepted: true });
  });

  it("прыжок через несколько стадий разрешён", () => {
    // «Беру, вот телефон» первым сообщением — законный переход 1 → 6
    const r = validateStageTransition(1, 6, WITH_PHONE);
    expect(r).toMatchObject({ stage: 6, accepted: true });
  });

  it("остаться на месте — разрешено (уточняющий вопрос внутри стадии)", () => {
    const r = validateStageTransition(3, 3, NO_PHONE);
    expect(r).toMatchObject({ stage: 3, accepted: true, reason: "same" });
  });
});

describe("validateStageTransition — движение назад", () => {
  it("откат на стадию возражений разрешён — клиент засомневался", () => {
    const r = validateStageTransition(5, 4, NO_PHONE);
    expect(r).toMatchObject({ stage: 4, accepted: true, reason: "objection" });
  });

  it("откат на приветствие отклоняем — это и есть «бот поплыл»", () => {
    const r = validateStageTransition(5, 1, NO_PHONE);
    expect(r).toMatchObject({ stage: 5, accepted: false, reason: "backward-rejected" });
  });

  it("откат на выяснение потребности отклоняем", () => {
    const r = validateStageTransition(4, 2, NO_PHONE);
    expect(r.stage).toBe(4);
    expect(r.accepted).toBe(false);
  });
});

describe("validateStageTransition — телефон как часть модели данных", () => {
  it("на стадию контакта без телефона не пускаем", () => {
    const r = validateStageTransition(3, 6, NO_PHONE);
    expect(r.accepted).toBe(false);
    expect(r.reason).toBe("needs-phone");
    expect(r.stage).toBeLessThan(6);
  });

  it("на стадию «после заказа» без телефона тоже не пускаем", () => {
    const r = validateStageTransition(5, 7, NO_PHONE);
    expect(r.accepted).toBe(false);
    expect(r.stage).toBeLessThan(6);
  });

  it("с телефоном — пускаем", () => {
    const r = validateStageTransition(5, 6, WITH_PHONE);
    expect(r).toMatchObject({ stage: 6, accepted: true });
  });

  it("отказ не откатывает диалог в начало — держит на закрытии", () => {
    const r = validateStageTransition(5, 6, NO_PHONE);
    expect(r.stage).toBe(5);
  });

  it("пустая строка телефоном не считается", () => {
    const r = validateStageTransition(5, 6, { phone: "   " });
    expect(r.accepted).toBe(false);
  });
});

describe("validateStageTransition — мусор от модели", () => {
  it("стадия 0, 99, дробная, строка → остаёмся где были", () => {
    for (const bad of [0, 99, 2.5, -1]) {
      const r = validateStageTransition(3, bad, WITH_PHONE);
      expect(r).toMatchObject({ stage: 3, accepted: false, reason: "invalid-stage" });
    }
  });
});

describe("parseKnownFacts — не доверяем форме Json", () => {
  it("null и мусор дают пустой объект", () => {
    expect(parseKnownFacts(null).intent).toBeFalsy();
    expect(parseKnownFacts("строка").intent).toBeFalsy();
    expect(parseKnownFacts([1, 2, 3]).intent).toBeFalsy();
  });

  it("читает нормальный объект", () => {
    const f = parseKnownFacts({
      intent: "крем от акне",
      forWhom: "себе",
      objections: ["дорого"],
      offered: ["Крем X"],
    });
    expect(f.intent).toBe("крем от акне");
    expect(f.objections).toEqual(["дорого"]);
  });

  it("числа и объекты в списках отбрасываются", () => {
    const f = parseKnownFacts({ objections: [1, { a: 1 }, "дорого", null] });
    expect(f.objections).toEqual(["дорого"]);
  });

  it("длинные значения обрезаются", () => {
    const f = parseKnownFacts({ intent: "я".repeat(500) });
    expect(f.intent!.length).toBeLessThanOrEqual(200);
  });
});

describe("mergeKnownFacts — выясненное не теряется", () => {
  it("новое значение перекрывает старое", () => {
    const m = mergeKnownFacts({ intent: "крем" }, { intent: "крем от акне" });
    expect(m.intent).toBe("крем от акне");
  });

  it("молчание НЕ затирает выясненное", () => {
    // Это и есть лекарство от «бот забыл, что клиент уже сказал»
    const m = mergeKnownFacts({ intent: "крем от акне", forWhom: "себе" }, {});
    expect(m.intent).toBe("крем от акне");
    expect(m.forWhom).toBe("себе");
  });

  it("пустая строка тоже не затирает", () => {
    const m = mergeKnownFacts({ budget: "до 200 000" }, { budget: "  " });
    expect(m.budget).toBe("до 200 000");
  });

  it("списки растут, а не переписываются", () => {
    const m = mergeKnownFacts(
      { objections: ["дорого"], offered: ["Крем X"] },
      { objections: ["подумаю"], offered: ["Крем Y"] }
    );
    expect(m.objections).toEqual(["дорого", "подумаю"]);
    expect(m.offered).toEqual(["Крем X", "Крем Y"]);
  });

  it("повтор в списке не дублируется, регистр не важен", () => {
    const m = mergeKnownFacts({ objections: ["Дорого"] }, { objections: ["дорого"] });
    expect(m.objections).toEqual(["Дорого"]);
  });

  it("список не растёт бесконечно", () => {
    let facts: FunnelKnownFacts = {};
    for (let i = 0; i < 30; i++) {
      facts = mergeKnownFacts(facts, { offered: [`Товар ${i}`] });
    }
    expect(facts.offered!.length).toBeLessThanOrEqual(10);
  });
});

describe("bootstrapStage — диалоги, начавшиеся до Этапа 4", () => {
  it("пустой диалог — стадия приветствия", () => {
    expect(bootstrapStage(0, {})).toBe(1);
  });

  it("разговор уже идёт — НЕ приветствие", () => {
    // Иначе после миграции бот поздоровался бы заново в каждом живом диалоге.
    // Ровно это поймал эвал silence-after-offer.
    expect(bootstrapStage(6, {})).toBeGreaterThan(1);
  });

  it("телефон уже есть — разговор дошёл до закрытия", () => {
    expect(bootstrapStage(10, { phone: "+998901234567" })).toBe(5);
  });

  it("известно, чего хочет клиент — предложение", () => {
    expect(bootstrapStage(4, { intent: "крем от акне" })).toBe(3);
  });

  it("товары уже показывали — тоже предложение", () => {
    expect(bootstrapStage(4, { offered: ["Крем X"] })).toBe(3);
  });

  it("сообщения есть, но ничего не выяснено — выяснение потребности", () => {
    expect(bootstrapStage(2, {})).toBe(2);
  });

  it("оценка осторожная: без телефона выше закрытия не поднимаемся", () => {
    expect(bootstrapStage(50, { intent: "крем", offered: ["A", "B"] })).toBeLessThan(6);
  });
});
