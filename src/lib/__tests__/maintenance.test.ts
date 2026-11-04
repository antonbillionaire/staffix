import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  MAINTENANCE_MODE,
  MAINTENANCE_HTML,
  LOGIN_PATHS,
  WEBHOOK_PREFIXES,
} from "@/lib/maintenance";

describe("режим заглушки", () => {
  it("сейчас включён — проект закрыт", () => {
    // Когда сайт вернут, этот тест нужно поменять вместе с константой:
    // он существует, чтобы включение/выключение было осознанным, а не забытым.
    expect(MAINTENANCE_MODE).toBe(true);
  });

  it("страница самодостаточная — без внешних ресурсов и скриптов", () => {
    expect(MAINTENANCE_HTML).not.toMatch(/<script/i);
    expect(MAINTENANCE_HTML).not.toMatch(/https?:\/\/(?!schema)/i);
    expect(MAINTENANCE_HTML).toContain("Проект в стадии разработки");
  });

  it("страница закрыта от индексации", () => {
    expect(MAINTENANCE_HTML).toMatch(/noindex/);
  });

  it("вход остаётся доступен, регистрации в исключениях нет", () => {
    expect(LOGIN_PATHS).toContain("/login");
    expect(LOGIN_PATHS.some((p) => p.includes("register"))).toBe(false);
  });

  it("в модуле нет захардкоженного секрета", () => {
    // Первая версия этой правки зашивала ключ обхода в исходник и была
    // отклонена: секретам не место в коде.
    const src = fs.readFileSync("src/lib/maintenance.ts", "utf8");
    expect(src).not.toMatch(/BYPASS\s*=\s*"[^"]{6,}"/);
  });
});

describe("вебхуки не должны получать заглушку", () => {
  // Meta и Telegram отключают подписку за повторяющиеся ошибки. Если появится
  // новый вебхук, а в списке его не будет, после возврата проекта канал
  // придётся переподключать вручную у каждого клиента.
  it("список покрывает все вебхук-роуты в репозитории", () => {
    const apiDir = path.join(process.cwd(), "src", "app", "api");
    const found: string[] = [];
    const walk = (dir: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (entry.name === "route.ts") {
          const rel = "/" + path.relative(path.join(process.cwd(), "src", "app"), path.dirname(full)).split(path.sep).join("/");
          if (rel.includes("webhook") || rel.startsWith("/api/sales-bot/")) found.push(rel);
        }
      }
    };
    walk(apiDir);
    expect(found.length).toBeGreaterThan(0);
    const uncovered = found.filter((r) => !WEBHOOK_PREFIXES.some((p) => r.startsWith(p)));
    expect(uncovered).toEqual([]);
  });
});
