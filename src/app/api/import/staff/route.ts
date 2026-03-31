import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

async function getUserBusiness(): Promise<string | null> {
  const session = await auth();
  let userId: string | null = null;

  if (session?.user?.email) {
    const user = await prisma.user.findUnique({ where: { email: session.user.email } });
    userId = user?.id || null;
  }

  if (!userId) return null;

  const business = await prisma.business.findFirst({
    where: { userId },
    select: { id: true },
  });
  return business?.id || null;
}

function parseCsv(text: string): string[][] {
  const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  const rows: string[][] = [];

  for (const line of lines) {
    if (!line.trim()) continue;
    const delim = line.includes(";") ? ";" : ",";
    const cells: string[] = [];
    let current = "";
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === delim && !inQuotes) {
        cells.push(current.trim());
        current = "";
      } else {
        current += ch;
      }
    }
    cells.push(current.trim());
    rows.push(cells);
  }

  return rows;
}

// POST /api/import/staff
// Body: { csv: string }
export async function POST(request: NextRequest) {
  try {
    const businessId = await getUserBusiness();
    if (!businessId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const csvText: string = body.csv;

    if (!csvText || typeof csvText !== "string") {
      return NextResponse.json({ error: "Нет данных CSV" }, { status: 400 });
    }

    // Size limit: 5MB
    if (csvText.length > 5 * 1024 * 1024) {
      return NextResponse.json({ error: "Файл слишком большой. Максимум 5 МБ" }, { status: 400 });
    }

    const rows = parseCsv(csvText);
    if (rows.length === 0) {
      return NextResponse.json({ error: "Файл пустой" }, { status: 400 });
    }

    const ALIASES: Record<string, string[]> = {
      name: ["имя", "name", "сотрудник", "staff", "фио", "ф.и.о", "мастер"],
      role: ["должность", "role", "позиция", "position", "специальность"],
      telegram: ["telegram", "телеграм", "username", "tg", "тг"],
    };

    const firstRow = rows[0].map((c) => c.toLowerCase().trim());
    const hasHeader = firstRow.some((c) =>
      [...ALIASES.name, ...ALIASES.role].some((a) => c.includes(a))
    );

    const colMap: Record<string, number> = {};
    if (hasHeader) {
      for (let ci = 0; ci < firstRow.length; ci++) {
        const cell = firstRow[ci];
        for (const [field, aliases] of Object.entries(ALIASES)) {
          if (!colMap[field] && aliases.some((a) => cell.includes(a))) {
            colMap[field] = ci;
            break;
          }
        }
      }
    }
    const usePositional = !hasHeader || colMap.name === undefined;
    if (usePositional) {
      colMap.name = 0; colMap.role = 1; colMap.telegram = 2;
    }

    const dataRows = hasHeader ? rows.slice(1) : rows;

    if (dataRows.length === 0) {
      return NextResponse.json({ error: "Нет строк с данными" }, { status: 400 });
    }

    // Row limit: max 10000
    if (dataRows.length > 10000) {
      return NextResponse.json({ error: `Слишком много строк: ${dataRows.length}. Максимум 10 000` }, { status: 400 });
    }

    const created: string[] = [];
    const errors: string[] = [];

    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i];
      const rowNum = hasHeader ? i + 2 : i + 1;

      const name = row[colMap.name]?.trim();
      const role = colMap.role !== undefined ? row[colMap.role]?.trim() || undefined : undefined;
      let telegram = colMap.telegram !== undefined ? row[colMap.telegram]?.trim() || undefined : undefined;

      if (!name) {
        errors.push(`Строка ${rowNum}: пустое имя`);
        continue;
      }

      // Clean telegram username
      if (telegram) {
        telegram = telegram.replace(/^@/, "").replace(/^https?:\/\/t\.me\//i, "");
      }

      await prisma.staff.create({
        data: {
          name,
          role: role || null,
          telegramUsername: telegram || null,
          businessId,
        },
      });
      created.push(name);
    }

    return NextResponse.json({
      success: true,
      created: created.length,
      errors: errors.length > 0 ? errors : undefined,
      message: `Создано сотрудников: ${created.length}${errors.length > 0 ? `, пропущено: ${errors.length}` : ""}`,
    });
  } catch (error) {
    console.error("POST /api/import/staff:", error);
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
