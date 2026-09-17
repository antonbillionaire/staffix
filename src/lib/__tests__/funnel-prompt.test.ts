import { describe, it, expect } from "vitest";
import {
  buildFunnelStateBlock,
  buildStuckDirective,
  STUCK_AFTER_TURNS,
} from "@/lib/funnel-prompt";
import type { FunnelKnownFacts } from "@/lib/funnel-state";

const EMPTY: FunnelKnownFacts = {};
const RICH: FunnelKnownFacts = {
  intent: "крем от акне",
  forWhom: "себе",
  budget: "до 200 000",
  phone: "+998901234567",
  objections: ["дорого"],
  offered: ["Крем X", "Крем Y"],
};

describe("buildFunnelStateBlock — где мы находимся", () => {
  it("называет текущую стадию и её цель", () => {
    const b = buildFunnelStateBlock(3, 0, EMPTY);
    expect(b).toContain("Стадия 3");
    expect(b).toContain("ПРЕДЛОЖЕНИЕ");
  });

  it("на первой стадии не пишет «стадии пройдены»", () => {
    expect(buildFunnelStateBlock(1, 0, EMPTY)).not.toContain("пройдены");
  });

  it("со второй стадии прямо запрещает здороваться заново", () => {
    // Это и есть лекарство от «бот откатился на „чем могу помочь“»
    const b = buildFunnelStateBlock(4, 0, EMPTY);
    expect(b).toContain("не здоровайся заново");
  });

  it("на последней стадии следующей нет", () => {
    expect(buildFunnelStateBlock(7, 0, RICH)).not.toContain("Следующая стадия");
  });
});

describe("buildFunnelStateBlock — что уже выяснено", () => {
  it("перечисляет выясненное и запрещает переспрашивать", () => {
    const b = buildFunnelStateBlock(5, 0, RICH);
    expect(b).toContain("НЕ ПЕРЕСПРАШИВАЙ");
    expect(b).toContain("крем от акне");
    expect(b).toContain("себе");
    expect(b).toContain("+998901234567");
  });

  it("напоминает про возражения клиента", () => {
    expect(buildFunnelStateBlock(4, 0, RICH)).toContain("дорого");
  });

  it("перечисляет уже предложенное — чтобы не ходить по кругу", () => {
    const b = buildFunnelStateBlock(4, 0, RICH);
    expect(b).toContain("Крем X");
    expect(b).toContain("по второму кругу");
  });

  it("когда ничего не выяснено — блока «уже выяснено» нет", () => {
    expect(buildFunnelStateBlock(1, 0, EMPTY)).not.toContain("УЖЕ ВЫЯСНЕНО");
  });

  it("без телефона предупреждает явно", () => {
    expect(buildFunnelStateBlock(3, 0, EMPTY)).toContain("ТЕЛЕФОНА НЕТ");
  });

  it("с телефоном предупреждения нет", () => {
    expect(buildFunnelStateBlock(6, 0, RICH)).not.toContain("ТЕЛЕФОНА НЕТ");
  });
});

describe("buildStuckDirective — топтание на месте", () => {
  it("пока стадия двигается — директивы нет", () => {
    for (let t = 0; t < STUCK_AFTER_TURNS; t++) {
      expect(buildStuckDirective(3, t, EMPTY)).toBeNull();
    }
  });

  it("на третьем обороте без движения — появляется", () => {
    expect(buildStuckDirective(3, STUCK_AFTER_TURNS, EMPTY)).not.toBeNull();
  });

  it("на выяснении потребности велит перестать уточнять", () => {
    const d = buildStuckDirective(2, 5, EMPTY)!;
    expect(d).toContain("Хватит уточнять");
  });

  it("на предложении велит задать закрывающий вопрос", () => {
    expect(buildStuckDirective(3, 5, EMPTY)!).toContain("закрывающий вопрос");
  });

  it("на закрытии без телефона — просить номер прямо", () => {
    expect(buildStuckDirective(5, 5, EMPTY)!).toContain("номер телефона");
  });

  it("на закрытии с телефоном — собирать данные, а не топтаться", () => {
    const d = buildStuckDirective(5, 5, { phone: "+998901234567" })!;
    expect(d).toContain("данные заказа");
  });

  it("клиент не даёт номер — передать менеджеру, а не долбить", () => {
    const d = buildStuckDirective(6, 5, EMPTY)!;
    expect(d).toContain("notify_manager");
  });

  it("после заказа — завершить разговор, ничего не предлагать", () => {
    const d = buildStuckDirective(7, 5, { phone: "+998901234567" })!;
    expect(d).toContain("заверши разговор");
  });

  it("директива попадает в блок промпта", () => {
    const b = buildFunnelStateBlock(3, 5, EMPTY);
    expect(b).toContain("РАЗГОВОР СТОИТ НА МЕСТЕ");
  });
});
