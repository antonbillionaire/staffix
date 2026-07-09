/**
 * Lazy document matcher (July 2026).
 *
 * Идея: у больших бизнесов справочные документы разрастаются (Right Flight
 * держит 8-10 файлов по 5-15KB каждый — программы туров, правила отмены,
 * визовая информация, гиды и т.п.). При старом подходе ВСЕ они шли в system
 * prompt на каждый ответ клиенту — 30K токенов префикса, из которых
 * в конкретном ответе реально нужен один, максимум два файла.
 *
 * Здесь: перед вызовом основной модели зовём быстрый Haiku 4.5 c мини-индексом
 * `[имя файла → короткое описание]` и спрашиваем «какие из этих файлов нужны,
 * чтобы ответить клиенту?». Возвращаем только их. Остальные не грузим в промпт.
 *
 * Экономика (Right Flight, 50 сообщений/день, 30K prefix из которых 20K docs):
 *  - Haiku матчер: 50 × ~$0.0006 = $0.03/день
 *  - Экономия на cache_read при обрезании docs 20K → 5K: 50 × 15K × $0.20/M ≈ $0.15/день
 *  - Экономия на cache_write при истечении TTL: 5 экспирий × 15K × $4/M ≈ $0.30/день
 *  - Net: ~$0.42/день на одном крупном бизнесе
 *
 * Safety-net:
 *  - Если у документа нет ни description, ни autoDescription → он в fallback,
 *    грузим на всякий случай (нельзя ронять качество бота).
 *  - Если у Haiku ошибка или таймаут → возвращаем ВСЕ документы (никогда не
 *    урезаем контекст если не уверены).
 *  - Если docs.length ≤ 2 → сразу возвращаем все (матчер дороже экономии).
 */

import { callClaudeWithRetry } from "@/lib/claude-retry";

export interface DocDescriptor {
  id: string;
  name: string;
  description: string | null;
  autoDescription: string | null;
  extractedText: string | null;
}

const MATCHER_TIMEOUT_MS = 8000;
const MIN_DOCS_TO_MATCH = 3;

/**
 * Возвращает подмножество документов, релевантных запросу клиента.
 * Никогда не бросает — на любую ошибку возвращает весь входной массив.
 */
export async function pickRelevantDocuments(
  userMessage: string,
  docs: DocDescriptor[]
): Promise<DocDescriptor[]> {
  // Мало документов — экономия не окупает Haiku-вызов
  if (docs.length < MIN_DOCS_TO_MATCH) return docs;

  // Определяем какие документы могут участвовать в матчинге, а какие всегда включены
  const withDesc = docs.filter((d) => (d.description || d.autoDescription)?.trim());
  const withoutDesc = docs.filter((d) => !(d.description || d.autoDescription)?.trim());

  // Ни у одного нет описания — матчить нечем, грузим всё
  if (withDesc.length === 0) return docs;

  // Строим мини-индекс: только имя + краткое описание, БЕЗ текста файла
  // (это и есть основной cost saver — Haiku читает 500 токенов вместо 30000)
  const indexLines = withDesc
    .map((d, i) => {
      const desc = (d.description || d.autoDescription || "").trim();
      const shortDesc = desc.length > 200 ? desc.substring(0, 200) + "..." : desc;
      return `${i + 1}. "${d.name}" — ${shortDesc}`;
    })
    .join("\n");

  // Короткий user-message для матчера (первые 500 chars хватает для смысла)
  const shortMsg = userMessage.length > 500 ? userMessage.substring(0, 500) + "..." : userMessage;

  const matcherPrompt = `Клиент бизнеса написал сообщение. Ниже — список справочных файлов бизнеса. Твоя задача: выбрать номера файлов, которые действительно нужны, чтобы ответить именно на это сообщение.

Правила:
- Отвечай ТОЛЬКО номерами через запятую, например: "1, 3, 5"
- Если ни один файл не подходит — ответь: "нет"
- Если сомневаешься, включай файл (лучше лишний, чем недостающий)
- Если файл может содержать ответ, даже косвенно — включай

Сообщение клиента:
"${shortMsg}"

Файлы бизнеса:
${indexLines}

Твой ответ (только номера через запятую или "нет"):`;

  try {
    const response = await Promise.race([
      callClaudeWithRetry({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 30,
        system: "Ты — быстрый ассистент-роутер. Отвечаешь только номерами файлов.",
        messages: [{ role: "user" as const, content: matcherPrompt }],
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("matcher timeout")), MATCHER_TIMEOUT_MS)
      ),
    ]);

    const textBlock = response.content.find((c) => c.type === "text");
    const answer = textBlock && "text" in textBlock ? textBlock.text.trim().toLowerCase() : "";

    if (!answer || answer.startsWith("нет") || answer === "no" || answer === "none") {
      // Матчер сказал «ничего не нужно» — грузим только always-on (без описания)
      return withoutDesc;
    }

    // Парсим номера: "1, 3, 5" → [1, 3, 5] → выбираем withDesc[i-1]
    const picked = new Set<string>();
    for (const chunk of answer.split(/[,;\s]+/)) {
      const n = parseInt(chunk, 10);
      if (Number.isFinite(n) && n >= 1 && n <= withDesc.length) {
        picked.add(withDesc[n - 1].id);
      }
    }

    // Если распарсили пусто — safe fallback: все docs
    if (picked.size === 0) return docs;

    const pickedDocs = withDesc.filter((d) => picked.has(d.id));
    return [...withoutDesc, ...pickedDocs];
  } catch (e) {
    console.warn(
      `[document-matcher] failed, using all ${docs.length} docs:`,
      e instanceof Error ? e.message : String(e)
    );
    return docs;
  }
}

/**
 * Генерирует автоописание документа через Haiku по первым 3000 символам
 * извлечённого текста. Вызывается сразу после успешного парсинга файла
 * если владелец не заполнил description сам.
 *
 * Никогда не бросает — при ошибке возвращает null и endpoint продолжает
 * работать (документ сохранён, просто без autoDescription).
 */
export async function generateAutoDescription(
  documentName: string,
  extractedText: string
): Promise<string | null> {
  if (!extractedText || extractedText.trim().length < 100) return null;

  const sample = extractedText.substring(0, 3000);
  const prompt = `Ниже фрагмент документа "${documentName}". Напиши одно короткое предложение (до 150 символов) о том, ЧТО это за документ и КОГДА он может понадобиться в разговоре с клиентом.

Формат: "О чём файл — когда пригодится"
Примеры хороших описаний:
- "Программы туров на лето 2026: цены, даты вылета, что включено. Пригодится при вопросах о конкретных турах."
- "Правила отмены и возврата. Пригодится при вопросах об отказе от бронирования."
- "Список отелей в Батуми с описаниями и категориями. Пригодится при подборе размещения."

НЕ пиши "Этот документ содержит..." — сразу к сути.

Фрагмент документа:
${sample}

Одно предложение описания:`;

  try {
    const response = await callClaudeWithRetry({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 100,
      system: "Ты пишешь короткие описания документов для внутренней навигации AI.",
      messages: [{ role: "user" as const, content: prompt }],
    });

    const textBlock = response.content.find((c) => c.type === "text");
    if (!textBlock || !("text" in textBlock)) return null;

    let desc = textBlock.text.trim();
    if (desc.length > 250) desc = desc.substring(0, 250);
    return desc || null;
  } catch (e) {
    console.warn(
      `[auto-description] failed for "${documentName}":`,
      e instanceof Error ? e.message : String(e)
    );
    return null;
  }
}
