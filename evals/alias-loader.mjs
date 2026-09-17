/**
 * Минимальный resolver-хук для Node: разворачивает алиас "@/..." в "src/...".
 *
 * Зачем свой, а не tsx: раннер эвалов импортирует прод-код напрямую
 * (buildSalesSystemPrompt, salesToolDefinitions) — иначе тестировался бы
 * не тот промпт, что работает в проде. Node 24 умеет читать TypeScript сам
 * (--experimental-strip-types), не хватает только резолва path-алиасов
 * из tsconfig. Это ~15 строк, ради них тянуть новую зависимость незачем
 * (правило про зависимости в CLAUDE.md).
 *
 * Подключается так:
 *   node --experimental-strip-types --import ./evals/alias-loader.mjs evals/run.mjs
 */

import { pathToFileURL } from "node:url";
import path from "node:path";
import { register } from "node:module";

const ROOT = path.resolve(import.meta.dirname, "..");

export async function resolve(specifier, context, nextResolve) {
  // 1. Алиас "@/lib/x" → "<root>/src/lib/x"
  let target = specifier;
  if (specifier.startsWith("@/")) {
    target = pathToFileURL(path.join(ROOT, "src", specifier.slice(2))).href;
  }

  try {
    return await nextResolve(target, context);
  } catch (err) {
    // 2. TypeScript разрешает импорт без расширения ("./prompts/human-tone"),
    //    Node — нет. Достраиваем .ts / .tsx / index.ts и пробуем снова.
    if (err?.code !== "ERR_MODULE_NOT_FOUND") throw err;
    const isRelative = target.startsWith("./") || target.startsWith("../") || target.startsWith("file:");
    if (!isRelative) throw err;

    for (const suffix of [".ts", ".tsx", "/index.ts"]) {
      try {
        return await nextResolve(target + suffix, context);
      } catch {
        /* пробуем следующее расширение */
      }
    }
    throw err;
  }
}

// Саморегистрация: файл одновременно и хук, и точка подключения через --import.
register(import.meta.url, import.meta.url);
