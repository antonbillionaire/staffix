import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

async function getUserBusiness(): Promise<string | null> {
  const session = await auth();
  let userId: string | null = null;

  if (session?.user?.email) {
    const user = await prisma.user.findUnique({ where: { email: session.user.email } });
    userId = user?.id || null;
  }

  if (!userId) {
    const cookieStore = await cookies();
    userId = cookieStore.get("userId")?.value || null;
  }

  if (!userId) return null;

  const business = await prisma.business.findFirst({
    where: { userId },
    select: { id: true },
  });
  return business?.id || null;
}

/**
 * Parse CSV text into rows of cells.
 * Handles quoted fields with commas and semicolons as delimiters.
 */
function parseCsv(text: string): string[][] {
  const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  const rows: string[][] = [];

  for (const line of lines) {
    if (!line.trim()) continue;

    // Detect delimiter: semicolon takes priority if present
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

// POST /api/import/services
// Body: { csv: string } — CSV text
// CSV columns: name, price, duration (minutes), description (optional)
export async function POST(request: NextRequest) {
  try {
    const businessId = await getUserBusiness();
    if (!businessId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const csvText: string = body.csv;

    if (!csvText || typeof csvText !== "string") {
      return NextResponse.json({ error: "Нет данных CSV" }, { status: 400 });
    }

    const rows = parseCsv(csvText);
    if (rows.length === 0) {
      return NextResponse.json({ error: "Файл пустой" }, { status: 400 });
    }

    // Column-name aliases for smart mapping
    const ALIASES: Record<string, string[]> = {
      name: ["название", "наименование", "name", "услуга", "service"],
      price: ["цена", "price", "стоимость", "cost"],
      duration: ["длительность", "duration", "время", "time", "минут", "minutes", "мин"],
      description: ["описание", "description", "desc"],
    };

    const firstRow = rows[0].map((c) => c.toLowerCase().trim());
    const hasHeader = firstRow.some((c) =>
      [...ALIASES.name, ...ALIASES.price].some((a) => c.includes(a))
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
      colMap.name = 0; colMap.price = 1; colMap.duration = 2; colMap.description = 3;
    }

    const dataRows = hasHeader ? rows.slice(1) : rows;

    if (dataRows.length === 0) {
      return NextResponse.json({ error: "Нет строк с данными" }, { status: 400 });
    }

    const servicesToCreate: { name: string; price: number; duration: number; description: string | null; businessId: string }[] = [];
    const errors: string[] = [];

    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i];
      const rowNum = hasHeader ? i + 2 : i + 1;

      const name = row[colMap.name]?.trim();
      const priceRaw = (row[colMap.price] || "").trim().replace(/[^\d.,-]/g, "").replace(/\s/g, "").replace(",", ".");
      const durationRaw = colMap.duration !== undefined ? row[colMap.duration]?.trim() : undefined;
      const description = colMap.description !== undefined ? row[colMap.description]?.trim() || undefined : undefined;

      if (!name) {
        errors.push(`Строка ${rowNum}: пустое название`);
        continue;
      }

      const price = Math.round(parseFloat(priceRaw));
      if (isNaN(price) || price < 0) {
        errors.push(`Строка ${rowNum} («${name}»): некорректная цена «${priceRaw}»`);
        continue;
      }

      const duration = parseInt(durationRaw || "", 10);
      if (isNaN(duration) || duration <= 0) {
        errors.push(`Строка ${rowNum} («${name}»): некорректная длительность «${durationRaw}» (укажите в минутах)`);
        continue;
      }

      servicesToCreate.push({ name, price, duration, description: description || null, businessId });
    }

    let createdCount = 0;
    if (servicesToCreate.length > 0) {
      const result = await prisma.service.createMany({ data: servicesToCreate });
      createdCount = result.count;
    }

    return NextResponse.json({
      success: true,
      created: createdCount,
      errors: errors.length > 0 ? errors : undefined,
      message: `Создано услуг: ${createdCount}${errors.length > 0 ? `, пропущено: ${errors.length}` : ""}`,
    });
  } catch (error) {
    console.error("POST /api/import/services:", error);
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
