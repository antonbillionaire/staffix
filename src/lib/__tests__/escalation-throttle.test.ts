import { describe, it, expect } from "vitest";
import {
  shouldSendAutoEscalation,
  AUTO_ESCALATION_COOLDOWN_MS,
} from "@/lib/escalation-throttle";

const NOW = new Date("2026-09-17T12:00:00.000Z");
const minutesAgo = (m: number) =>
  new Date(NOW.getTime() - m * 60 * 1000).toISOString();

describe("shouldSendAutoEscalation — первая эскалация", () => {
  it("состояние пустое → отправляем", () => {
    const r = shouldSendAutoEscalation({
      trigger: "handoff-promise",
      state: {},
      now: NOW,
    });
    expect(r.send).toBe(true);
    expect(r.nextState.lastAutoNotifyAt).toBe(NOW.toISOString());
  });
});

describe("shouldSendAutoEscalation — повторное обещание", () => {
  it("бот повторил обещание через минуту → молчим", () => {
    const r = shouldSendAutoEscalation({
      trigger: "handoff-promise",
      state: { lastAutoNotifyAt: minutesAgo(1) },
      now: NOW,
    });
    expect(r.send).toBe(false);
    expect(r.reason).toMatch(/cooldown/);
  });

  it("десять оборотов подряд дают ОДНО уведомление, а не десять", () => {
    // Диалог с блогером у OLLEE: бот обещал звонок больше десяти раз подряд
    let state = {};
    let sent = 0;
    for (let i = 0; i < 10; i++) {
      const r = shouldSendAutoEscalation({
        trigger: "handoff-promise",
        state,
        now: new Date(NOW.getTime() + i * 60 * 1000), // по обороту в минуту
      });
      if (r.send) sent++;
      state = r.nextState;
    }
    expect(sent).toBe(1);
  });

  it("клиент вернулся через час → отправляем снова", () => {
    const r = shouldSendAutoEscalation({
      trigger: "handoff-promise",
      state: { lastAutoNotifyAt: minutesAgo(60) },
      now: NOW,
    });
    expect(r.send).toBe(true);
  });

  it("ровно на границе окна → отправляем", () => {
    const r = shouldSendAutoEscalation({
      trigger: "handoff-promise",
      state: {
        lastAutoNotifyAt: new Date(
          NOW.getTime() - AUTO_ESCALATION_COOLDOWN_MS
        ).toISOString(),
      },
      now: NOW,
    });
    expect(r.send).toBe(true);
  });
});

describe("shouldSendAutoEscalation — новый контакт", () => {
  it("клиент прислал номер → отправляем, даже если только что уведомляли", () => {
    const r = shouldSendAutoEscalation({
      trigger: "new-contact",
      phone: "+998 90 123 45 67",
      state: { lastAutoNotifyAt: minutesAgo(1) },
      now: NOW,
    });
    expect(r.send).toBe(true);
  });

  it("тот же номер второй раз → молчим", () => {
    const r = shouldSendAutoEscalation({
      trigger: "new-contact",
      phone: "+998 90 123 45 67",
      state: { lastAutoNotifyPhone: "998901234567" },
      now: NOW,
    });
    expect(r.send).toBe(false);
    expect(r.reason).toBe("same-phone-already-sent");
  });

  it("номер в другом написании — тот же номер", () => {
    const r = shouldSendAutoEscalation({
      trigger: "new-contact",
      phone: "998-90-123-45-67",
      state: { lastAutoNotifyPhone: "+998 90 123 45 67" },
      now: NOW,
    });
    expect(r.send).toBe(false);
  });

  it("клиент исправил номер → отправляем", () => {
    const r = shouldSendAutoEscalation({
      trigger: "new-contact",
      phone: "+998901234567",
      state: { lastAutoNotifyPhone: "998907777777" },
      now: NOW,
    });
    expect(r.send).toBe(true);
  });
});

describe("shouldSendAutoEscalation — что окно НЕ глушит", () => {
  it("guard поймал зацикливание → пропускаем без условий", () => {
    const r = shouldSendAutoEscalation({
      trigger: "handoff-promise",
      forced: true,
      state: { lastAutoNotifyAt: minutesAgo(1) },
      now: NOW,
    });
    expect(r.send).toBe(true);
    expect(r.reason).toBe("forced-by-guard");
  });
});

describe("shouldSendAutoEscalation — испорченное состояние не блокирует", () => {
  it("мусор вместо даты → отправляем", () => {
    const r = shouldSendAutoEscalation({
      trigger: "handoff-promise",
      state: { lastAutoNotifyAt: "не дата" },
      now: NOW,
    });
    expect(r.send).toBe(true);
  });

  it("дата из будущего (часы съехали) → отправляем, а не глушим навсегда", () => {
    const r = shouldSendAutoEscalation({
      trigger: "handoff-promise",
      state: { lastAutoNotifyAt: new Date(NOW.getTime() + 86400000).toISOString() },
      now: NOW,
    });
    expect(r.send).toBe(true);
  });

  it("слишком короткий номер не считается номером", () => {
    const r = shouldSendAutoEscalation({
      trigger: "new-contact",
      phone: "123",
      state: { lastAutoNotifyPhone: "123" },
      now: NOW,
    });
    expect(r.send).toBe(true);
  });
});
