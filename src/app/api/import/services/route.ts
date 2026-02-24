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

    // Detect if first row is a header
    const firstRow = rows[0].map((c) => c.toLowerCase());
    const hasHeader =
      firstRow.some((c) => c.includes("наименование") || c.includes("название") || c === "name");
    const dataRows = hasHeader ? rows.slice(1) : rows;

    if (dataRows.length === 0) {
      return NextResponse.json({ error: "Нет строк с данными" }, { status: 400 });
    }

    const created: string[] = [];
    const errors: string[] = [];

    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i];
      const rowNum = hasHeader ? i + 2 : i + 1;

      const name = row[0]?.trim();
      const priceRaw = row[1]?.trim().replace(/\s/g, "").replace(",", ".");
      const durationRaw = row[2]?.trim();
      const description = row[3]?.trim() || undefined;

      if (!name) {
        errors.push(`Строка ${rowNum}: пустое название`);
        continue;
      }

      const price = Math.round(parseFloat(priceRaw));
      if (isNaN(price) || price < 0) {
        errors.push(`Строка ${rowNum} («${name}»): некорректная цена «${priceRaw}»`);
        continue;
      }

      const duration = parseInt(durationRaw, 10);
      if (isNaN(duration) || duration <= 0) {
        errors.push(`Строка ${rowNum} («${name}»): некорректная длительность «${durationRaw}» (укажите в минутах)`);
        continue;
      }

      await prisma.service.create({
        data: { name, price, duration, description, businessId },
      });
      created.push(name);
    }

    return NextResponse.json({
      success: true,
      created: created.length,
      errors: errors.length > 0 ? errors : undefined,
      message: `Создано услуг: ${created.length}${errors.length > 0 ? `, пропущено: ${errors.length}` : ""}`,
    });
  } catch (error) {
    console.error("POST /api/import/services:", error);
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
