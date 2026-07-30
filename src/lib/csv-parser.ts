/**
 * CSV parser — правильный state-machine (30 июля 2026).
 *
 * До этого модуля в 4 endpoint'ах импорта (products, customers, staff,
 * services) была скопирована упрощённая реализация:
 *   text.split("\n") → for each line → parse cells.
 *
 * Она НЕ работает если ячейка содержит `\n` внутри кавычек — а Excel и
 * SheetJS кладут переносы в описания товаров/услуг ровно так. Проявление:
 * клиент импортирует 44 товара, получает 100+ мусорных строк потому что
 * каждый абзац описания превратился в отдельный «товар».
 *
 * Этот парсер идёт посимвольно, отслеживает состояние `inQuotes` через
 * переносы строк — разбивает на строки ТОЛЬКО когда встречает `\n` вне
 * кавычек. Ровно как это делает Excel/Google Sheets/RFC 4180.
 *
 * Разделитель определяется по первому непустому не-quoted line:
 *   - Если встречается `;` вне кавычек — используем `;` (европейский стиль,
 *     Excel в русской локали, SheetJS default в products page.tsx).
 *   - Иначе — `,` (стандартный CSV).
 *
 * Экранирование кавычек — RFC 4180: `""` внутри quoted-cell → одна `"`.
 */

export function parseCsv(text: string): string[][] {
  // Нормализуем окончания строк, чтобы Windows/Mac/Unix обрабатывались одинаково
  const normalized = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  // Определяем разделитель — смотрим на первую строку до входа в кавычки
  const delimiter = detectDelimiter(normalized);

  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = "";
  let inQuotes = false;
  let i = 0;

  while (i < normalized.length) {
    const ch = normalized[i];

    if (inQuotes) {
      if (ch === '"') {
        // Escape: две кавычки подряд внутри quoted-cell = одна кавычка
        if (normalized[i + 1] === '"') {
          currentCell += '"';
          i += 2;
          continue;
        }
        // Закрывающая кавычка
        inQuotes = false;
        i++;
        continue;
      }
      // Любой другой символ (включая \n и разделитель) — часть содержимого ячейки
      currentCell += ch;
      i++;
      continue;
    }

    // === Вне кавычек ===
    if (ch === '"') {
      // Открывающая кавычка (только если ячейка ещё пустая — иначе " считается частью значения)
      if (currentCell.length === 0) {
        inQuotes = true;
        i++;
        continue;
      }
      // Кавычка в середине unquoted-ячейки — оставляем как есть
      currentCell += ch;
      i++;
      continue;
    }

    if (ch === delimiter) {
      currentRow.push(currentCell.trim());
      currentCell = "";
      i++;
      continue;
    }

    if (ch === "\n") {
      currentRow.push(currentCell.trim());
      // Не добавляем пустые строки (например хвостовой \n или подряд идущие \n\n)
      if (currentRow.length > 1 || currentRow[0] !== "") {
        rows.push(currentRow);
      }
      currentRow = [];
      currentCell = "";
      i++;
      continue;
    }

    currentCell += ch;
    i++;
  }

  // Финальная ячейка + строка (если файл не заканчивался \n)
  if (currentCell.length > 0 || currentRow.length > 0) {
    currentRow.push(currentCell.trim());
    if (currentRow.length > 1 || currentRow[0] !== "") {
      rows.push(currentRow);
    }
  }

  return rows;
}

/**
 * Определяет разделитель CSV (`;` или `,`).
 * Приоритет `;` — стандарт русского Excel и SheetJS default в products page.
 * Смотрим только вне кавычек в первой значимой строке.
 */
function detectDelimiter(text: string): "," | ";" {
  let inQuotes = false;
  let hasSemicolon = false;
  let hasComma = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') {
      // Учитываем escape ""
      if (inQuotes && text[i + 1] === '"') {
        i++;
        continue;
      }
      inQuotes = !inQuotes;
      continue;
    }
    if (inQuotes) continue;
    if (ch === "\n") {
      // Конец первой строки — если что-то нашли, решаем
      if (hasSemicolon) return ";";
      if (hasComma) return ",";
      // Пустая первая строка (странно, но не падаем) — идём дальше
      continue;
    }
    if (ch === ";") hasSemicolon = true;
    else if (ch === ",") hasComma = true;
  }
  return hasSemicolon ? ";" : ",";
}
