/**
 * Ограничитель частоты АВТО-эскалаций (17 сентября 2026).
 *
 * ЗАЧЕМ. Safety-net вызывает notify_manager сам, когда бот пообещал передать
 * запрос менеджеру, но инструмент не вызвал. Проверка обещания — regex по
 * тексту бота, и она срабатывает на КАЖДОМ обороте, где обещание прозвучало.
 * Если модель зациклилась и повторяет «менеджер свяжется» десять оборотов
 * подряд, владелец получает десять уведомлений об одном клиенте. В диалоге с
 * блогером у OLLEE бот извинялся и обещал звонок больше десяти раз подряд —
 * ровно такой веер.
 *
 * Риск вырос 17 сентября, когда детектор обещаний научился узбекскому: он стал
 * видеть ещё 105 ответов бота, которых раньше не замечал.
 *
 * ЧЕГО ЭТОТ МОДУЛЬ НЕ ДЕЛАЕТ. Он не трогает notify_manager, вызванный самой
 * моделью — это осознанное решение бота, а не автоматика, и глушить его нельзя.
 * Только авто-вызовы из safety-net.
 *
 * ПОЧЕМУ НЕ ПРОСТО «ОДИН РАЗ НА ДИАЛОГ». Диалог живёт неделями. Клиент, который
 * написал в понедельник и вернулся в пятницу, — это новый повод позвонить.
 * Отсюда окно, а не флаг.
 */

/** Окно тишины для повторного обещания в одном диалоге. */
export const AUTO_ESCALATION_COOLDOWN_MS = 30 * 60 * 1000;

export type EscalationTrigger = "handoff-promise" | "new-contact";

/**
 * Хранится в `extractedInfo` диалога — рядом с guardHits, тем же способом.
 * Отдельной таблицы не заводим: состояние маленькое и живёт ровно столько,
 * сколько диалог.
 */
export interface EscalationThrottleState {
  /** ISO-время последней АВТО-эскалации в этом диалоге */
  lastAutoNotifyAt?: string | null;
  /** Телефон, с которым уже уведомляли — чтобы не слать один и тот же дважды */
  lastAutoNotifyPhone?: string | null;
}

export interface EscalationThrottleInput {
  trigger: EscalationTrigger;
  /** Телефон клиента на момент эскалации, если известен */
  phone?: string | null;
  state: EscalationThrottleState;
  /**
   * Guard поймал зацикливание (3-е срабатывание подряд) и требует эскалации.
   * Такое решение принято отдельной логикой и окном не глушится.
   */
  forced?: boolean;
  now?: Date;
}

export interface EscalationThrottleResult {
  send: boolean;
  /** Для логов: почему отправили или почему промолчали */
  reason: string;
  /** Что записать в extractedInfo. При send=false состояние не меняется. */
  nextState: EscalationThrottleState;
}

/** Только цифры — «+998 90 123-45-67» и «998901234567» это один номер. */
function normalizePhone(phone?: string | null): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  return digits.length >= 7 ? digits : null;
}

export function shouldSendAutoEscalation(
  input: EscalationThrottleInput
): EscalationThrottleResult {
  const { trigger, phone, state, forced } = input;
  const now = input.now ?? new Date();
  const phoneKey = normalizePhone(phone);

  const passed = (reason: string): EscalationThrottleResult => ({
    send: true,
    reason,
    nextState: {
      lastAutoNotifyAt: now.toISOString(),
      lastAutoNotifyPhone: phoneKey ?? state.lastAutoNotifyPhone ?? null,
    },
  });
  const blocked = (reason: string): EscalationThrottleResult => ({
    send: false,
    reason,
    nextState: state,
  });

  // Зацикливание поймал guard — это уже не «бот снова что-то пообещал»,
  // а вывод кода о том, что разговор встал. Пропускаем без условий.
  if (forced) return passed("forced-by-guard");

  // Новый контакт: ценность в самом номере, а не в частоте. Шлём всегда,
  // кроме случая, когда этот же номер уже уходил менеджеру.
  if (trigger === "new-contact") {
    if (phoneKey && normalizePhone(state.lastAutoNotifyPhone) === phoneKey) {
      return blocked("same-phone-already-sent");
    }
    return passed("new-contact");
  }

  // Повторное обещание передать менеджеру — то самое, что даёт веер.
  const lastAt = state.lastAutoNotifyAt ? Date.parse(state.lastAutoNotifyAt) : NaN;
  if (Number.isFinite(lastAt)) {
    const elapsed = now.getTime() - lastAt;
    // Отрицательное время (часы съехали, запись из будущего) — не повод
    // глушить эскалацию: трактуем как «давно» и пропускаем.
    if (elapsed >= 0 && elapsed < AUTO_ESCALATION_COOLDOWN_MS) {
      const minutesLeft = Math.ceil((AUTO_ESCALATION_COOLDOWN_MS - elapsed) / 60000);
      return blocked(`cooldown-${minutesLeft}m-left`);
    }
  }
  return passed("handoff-promise");
}
