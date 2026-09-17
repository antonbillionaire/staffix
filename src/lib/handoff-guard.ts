/**
 * Handoff Guard (6 августа 2026, OLLEE incident):
 *
 * Общий модуль для hard-code guard'а «бот пообещал менеджера без телефона».
 * Заменяет 2 дублирующиеся реализации в channel-ai.ts и telegram/ai.ts
 * (обе с одинаковой toxic-фразой которая срабатывала до 6 раз подряд в
 * conv-10 у OLLEE).
 *
 * Что делает:
 *   1. Определяет что бот «пообещал» эскалацию через promisedForwardingRegex
 *   2. Если у клиента нет телефона и бот не вызвал notify_manager — перехват
 *   3. Вместо ОДНОЙ фразы каждый раз — три ветки в зависимости от контекста:
 *      a) Клиент прислал неполный номер (incomplete=true) — просим уточнить
 *      b) Guard уже срабатывал 2+ раз в этом диалоге — эскалируем реально
 *         через notify_manager (клиент явно упирается, LLM не помогает)
 *      c) Первое срабатывание — вариативная фраза с именем клиента если есть
 *
 * Правило `feedback_bot_never_escalate_without_phone` сохранено полностью —
 * лид не теряется, менеджер не получает пустых эскалаций. Ветка (b)
 * добавлена как safety net для случаев когда парсинг номера подводит
 * (сообщение слишком нестандартное или клиент отказывается).
 */

import type { PhoneDetection } from "./phone-parser";

export interface HandoffGuardInput {
  /** Ответ бота который может содержать «менеджер свяжется» */
  botReplyText: string;
  /** Результат detectPhone на последнем сообщении клиента */
  phoneDetection: PhoneDetection;
  /** Есть ли у клиента телефон в БД (channelClientPhoneOnRecord или Client.phone) */
  hasPhoneOnRecord: boolean;
  /** Вызывал ли бот tool `notify_manager` в этом turn'e */
  calledNotifyManager: boolean;
  /** Regex «менеджер свяжется» — считает hits в тексте */
  promisedForwardingRegex: RegExp;
  /** Имя клиента (для персонализации фразы) */
  clientName?: string | null;
  /**
   * Сколько раз guard уже перехватывал ответ в этом диалоге (из
   * ChannelConversation.extractedInfo.guardHits или Conversation.extractedInfo).
   * Если ≥ 2 — переключаемся на реальную эскалацию.
   */
  previousGuardHits: number;
  /**
   * Язык подменного ответа. Обычно не передают — guard определит сам по тексту
   * бота. Параметр нужен тестам и на случай, если вызывающий знает язык точнее.
   */
  language?: ReplyLang;
}

export interface HandoffGuardResult {
  /** true если guard сработал — вызывающий код должен использовать overrideReply */
  intercepted: boolean;
  /** Новый текст ответа клиенту, если intercepted=true */
  overrideReply?: string;
  /** true если guard решил всё же позвать notify_manager (ветка «b») */
  forceNotifyManager?: boolean;
  /** Для инкремента счётчика в БД (extractedInfo.guardHits) */
  newGuardHits: number;
  /** Строка для логов */
  logReason: string;
}

/**
 * Язык подменного ответа (17 сент 2026).
 *
 * Guard подменяет текст бота своей фразой. Пока детектор обещаний понимал
 * только русский, узбекские диалоги до этой подмены не доходили вовсе. Теперь
 * доходят — и отвечать узбекскому клиенту русским шаблоном нельзя.
 *
 * Определяем по ответу САМОГО бота, а не по Business.language: язык выбирает
 * клиент, бот подстраивается, и у OLLEE при языке бизнеса «ru» узбекский текст
 * есть в 343 ответах из 1430 (241 латиницей, 86 кириллицей, 2 смешанных).
 */
export type ReplyLang = "ru" | "uz-latn" | "uz-cyrl";

// Узбекская кириллица: буквы, которых нет в русском алфавите, либо частотные
// узбекские слова. Проверяется ПЕРВОЙ — текст с ў/қ/ғ/ҳ русским быть не может.
//
// БЕЗ \b намеренно: в JavaScript граница слова определяется через [A-Za-z0-9_],
// то есть кириллица для неё — не буквы, и `\bсизга` не совпадёт никогда.
const UZ_CYRL_HINT = /[ўқғҳЎҚҒҲ]|(сизга|сизнинг|учун|бўл|керак|рахмат|юбор)/i;

// Узбекская латиница. Кириллический текст сюда не попадёт по определению,
// поэтому достаточно набора частотных слов.
const UZ_LATN_HINT =
  /\b(sizga|sizning|uchun|bo['’`ʻ]?l|qil|mumkin|rahmat|bilan|kerak|yo['’`ʻ]?q|bog['’`ʻ]?lan|raqam)/i;

export function detectReplyLanguage(text: string): ReplyLang {
  if (UZ_CYRL_HINT.test(text)) return "uz-cyrl";
  if (UZ_LATN_HINT.test(text)) return "uz-latn";
  return "ru";
}

// 3 варианта дружелюбной формулировки — не одна и та же токсичная фраза.
// Используем %NAME% плейсхолдер: если имя есть — вставляем «, {Имя}», иначе пусто.
const PHRASES: Record<
  ReplyLang,
  { firstHit: string[]; incompletePhone: string; loop: string }
> = {
  ru: {
    firstHit: [
      "Хорошо%NAME%. Оставьте, пожалуйста, номер телефона — тогда сразу оформим всё что нужно.",
      "Понял%NAME%. Ваш номер телефона — и продолжим оформление.",
      "Хорошо%NAME%. Подскажите, пожалуйста, ваш номер — свяжусь с Вами в удобное время.",
    ],
    incompletePhone:
      "Кажется, номер не полный%NAME%. Проверьте, пожалуйста — обычно нужно 9-12 цифр (например +998 90 123 45 67). Отправьте ещё раз?",
    loop: "Понял%NAME%. Передал запрос менеджеру — он свяжется с Вами в этом чате в ближайший час. Если удобнее по телефону — оставьте номер, и позвоним.",
  },
  "uz-latn": {
    firstHit: [
      "Yaxshi%NAME%. Iltimos, telefon raqamingizni qoldiring — shunda hammasini rasmiylashtiramiz.",
      "Tushundim%NAME%. Telefon raqamingizni yozing — rasmiylashtirishni davom ettiramiz.",
      "Yaxshi%NAME%. Telefon raqamingizni ayting — sizga qulay vaqtda bog'lanamiz.",
    ],
    incompletePhone:
      "Raqam to'liq emas%NAME%. Iltimos, tekshiring — odatda 9-12 raqam bo'ladi (masalan +998 90 123 45 67). Yana bir marta yuboring.",
    loop: "Tushundim%NAME%. So'rovingizni menejerga uzatdim — u shu chatda bir soat ichida bog'lanadi. Telefon orqali qulayroq bo'lsa, raqamingizni qoldiring, qo'ng'iroq qilamiz.",
  },
  "uz-cyrl": {
    firstHit: [
      "Яхши%NAME%. Илтимос, телефон рақамингизни қолдиринг — шунда ҳаммасини расмийлаштирамиз.",
      "Тушундим%NAME%. Телефон рақамингизни ёзинг — расмийлаштиришни давом эттирамиз.",
      "Яхши%NAME%. Телефон рақамингизни айтинг — сизга қулай вақтда боғланамиз.",
    ],
    incompletePhone:
      "Рақам тўлиқ эмас%NAME%. Илтимос, текширинг — одатда 9-12 рақам бўлади (масалан +998 90 123 45 67). Яна бир марта юборинг.",
    loop: "Тушундим%NAME%. Сўровингизни менежерга узатдим — у шу чатда бир соат ичида боғланади. Телефон орқали қулайроқ бўлса, рақамингизни қолдиринг, қўнғироқ қиламиз.",
  },
};

function personalize(template: string, name?: string | null): string {
  // Имя есть и содержательное — вставляем через запятую
  const clean = (name || "").trim();
  if (clean && clean.length >= 2 && clean.length <= 40 && !/[<>@#]/.test(clean)) {
    return template.replace("%NAME%", ", " + clean);
  }
  return template.replace("%NAME%", "");
}

function pickVariant(previousHits: number, lang: ReplyLang): string {
  // Не random — детерминированный выбор по счётчику, чтобы если guard
  // сработает 2 раза подряд (что не должно, но всё же) — фразы отличались.
  const variants = PHRASES[lang].firstHit;
  return variants[previousHits % variants.length];
}

/**
 * Основная функция.
 *
 * Ветки:
 *   - неполный номер → просим проверить/дописать
 *   - 3+ srabotki → forceNotifyManager (реальная эскалация)
 *   - иначе → вариативная фраза
 */
export function evaluateHandoffGuard(input: HandoffGuardInput): HandoffGuardResult {
  const {
    botReplyText,
    phoneDetection,
    hasPhoneOnRecord,
    calledNotifyManager,
    promisedForwardingRegex,
    clientName,
    previousGuardHits,
  } = input;

  // Язык подменной фразы — по тексту самого бота, если вызывающий не задал явно
  const lang = input.language ?? detectReplyLanguage(botReplyText);
  const phrases = PHRASES[lang];

  const botPromised = promisedForwardingRegex.test(botReplyText);
  const hasPhoneNow = !!(phoneDetection.phone || hasPhoneOnRecord);

  // Не наш кейс — бот ничего не обещал ИЛИ телефон есть ИЛИ notify_manager уже вызван
  if (!botPromised || hasPhoneNow || calledNotifyManager) {
    return {
      intercepted: false,
      newGuardHits: previousGuardHits,
      logReason: "not-triggered",
    };
  }

  const nextHits = previousGuardHits + 1;

  // Ветка «a» — клиент явно попытался дать номер, но неполный
  if (phoneDetection.incomplete) {
    return {
      intercepted: true,
      overrideReply: personalize(phrases.incompletePhone, clientName),
      newGuardHits: nextHits,
      logReason: "incomplete-phone",
    };
  }

  // Ветка «b» — 3-й раз подряд guard срабатывает, LLM зациклился.
  // Реально зовём notify_manager с контекстом канала, чтобы менеджер
  // мог связаться сам (в TG по @username, в WA — по chatId).
  if (previousGuardHits >= 2) {
    return {
      intercepted: true,
      overrideReply: personalize(phrases.loop, clientName),
      forceNotifyManager: true,
      newGuardHits: nextHits,
      logReason: "loop-detected",
    };
  }

  // Ветка «c» — первое или второе срабатывание, вариативная фраза
  return {
    intercepted: true,
    overrideReply: personalize(pickVariant(previousGuardHits, lang), clientName),
    newGuardHits: nextHits,
    logReason: "first-intercept",
  };
}
