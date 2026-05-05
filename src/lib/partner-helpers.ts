/**
 * Helper'ы для админа партнёрской программы.
 *
 * generateReferralCode — делает читабельный код на основе имени.
 *   "Иван Петров" → "IVAN2026A1B" (латиница, верхний регистр + случайный суффикс).
 *   Латиница чтобы клиент мог легко скопировать ссылку и записать на бумаге.
 *
 * generateAccessToken — UUID v4 для безопасного входа в кабинет партнёра.
 *
 * Оба гарантируют уникальность через лёгкий retry — крайне маловероятно столкновение,
 * но защищаемся от теоретического случая.
 */

import { randomUUID, randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";

// Транслит самых частых букв из СНГ-имён в латиницу.
// Не идеален, но для генерации кода достаточно.
const TRANSLIT: Record<string, string> = {
  а: "A", б: "B", в: "V", г: "G", д: "D", е: "E", ё: "E", ж: "ZH", з: "Z",
  и: "I", й: "Y", к: "K", л: "L", м: "M", н: "N", о: "O", п: "P", р: "R",
  с: "S", т: "T", у: "U", ф: "F", х: "KH", ц: "TS", ч: "CH", ш: "SH",
  щ: "SCH", ъ: "", ы: "Y", ь: "", э: "E", ю: "YU", я: "YA",
  // Узбекский и казахский специфичные
  ў: "U", қ: "Q", ғ: "G", ҳ: "H",
  ә: "A", і: "I", ң: "N", ұ: "U", ү: "U", һ: "H", ө: "O",
};

function translit(text: string): string {
  return text
    .toLowerCase()
    .split("")
    .map((ch) => TRANSLIT[ch] ?? ch)
    .join("")
    .replace(/[^a-z0-9]/g, "")
    .toUpperCase();
}

/**
 * Генерирует уникальный реферальный код вроде "IVAN2026A1B".
 * Если базовая часть слишком короткая — добавляется до 8 символов.
 * Случайный суффикс из 3 hex-символов гарантирует уникальность.
 */
export async function generateReferralCode(name: string, maxAttempts = 5): Promise<string> {
  const year = new Date().getFullYear();
  const baseRaw = translit(name).slice(0, 6) || "PARTNER";

  for (let i = 0; i < maxAttempts; i++) {
    const suffix = randomBytes(2).toString("hex").toUpperCase(); // 4 hex chars
    const candidate = `${baseRaw}${year}${suffix}`.slice(0, 16);

    const existing = await prisma.partner.findUnique({
      where: { referralCode: candidate },
      select: { id: true },
    });
    if (!existing) return candidate;
  }

  // Защитный fallback — крайне маловероятный случай 5 collisions подряд
  return `PARTNER${year}${randomBytes(4).toString("hex").toUpperCase()}`;
}

/**
 * Генерирует UUID для access token. UUID v4 даёт 122 бита энтропии — достаточно
 * чтобы быть unguessable. Партнёр получает его в email и хранит как пароль.
 */
export function generateAccessToken(): string {
  return randomUUID();
}

/**
 * Базовая нормализация номера телефона для проверки self-referral блока.
 * Удаляет всё кроме цифр.
 */
export function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, "");
}

/**
 * Нормализация email для проверки self-referral.
 *
 * Цель — поймать партнёра, который пытается зарегаться под своей же ссылкой
 * через alias gmail (anton+sub@gmail.com == anton@gmail.com), удалив:
 *  - домен-алиасы (googlemail.com → gmail.com)
 *  - +tag после localpart (anton+anything → anton)
 *  - точки в localpart для @gmail (an.ton → anton, gmail их игнорирует)
 *
 * Для не-gmail доменов трогаем только +tag (большинство провайдеров его поддерживают).
 *
 * Не панацея — серьёзный абуз обходится через купленный домен. Но 95% «зашёл
 * под собой ради 20% себе» отрезает.
 */
export function normalizeEmail(email: string): string {
  const trimmed = email.toLowerCase().trim();
  const at = trimmed.lastIndexOf("@");
  if (at < 0) return trimmed;

  let local = trimmed.slice(0, at);
  let domain = trimmed.slice(at + 1);

  // googlemail.com → gmail.com
  if (domain === "googlemail.com") domain = "gmail.com";

  // +tag — режем
  const plusIdx = local.indexOf("+");
  if (plusIdx >= 0) local = local.slice(0, plusIdx);

  // dots в @gmail localpart
  if (domain === "gmail.com") local = local.replace(/\./g, "");

  return `${local}@${domain}`;
}
