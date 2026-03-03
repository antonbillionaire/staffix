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

// POST /api/import/customers
// Body: { csv: string }
export async function POST(request: NextRequest) {
  try {
    const businessId = await getUserBusiness();
    if (!businessId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const csvText: string = body.csv;

    if (!csvText || typeof csvText !== "string") {
      return NextResponse.json({ error: "Нет данных" }, { status: 400 });
    }

    const rows = parseCsv(csvText);
    if (rows.length === 0) {
      return NextResponse.json({ error: "Файл пустой" }, { status: 400 });
    }

    // Column-name aliases for smart mapping
    const ALIASES: Record<string, string[]> = {
      name: ["имя", "фио", "name", "клиент", "client", "first_name", "firstname", "first name"],
      surname: ["фамилия", "surname", "last_name", "lastname", "last name"],
      phone: ["телефон", "phone", "номер", "mobile", "тел", "сотовый"],
      email: ["email", "почта", "e-mail", "mail", "эл.почта"],
      company: ["компания", "бизнес", "business", "company", "организация", "org"],
      notes: ["заметки", "notes", "комментарий", "comment", "примечание"],
      loyalty: ["лояльность", "loyalty", "статус", "status", "уровень", "level", "программа"],
    };

    const firstRow = rows[0].map((c) => c.toLowerCase().trim());
    const hasHeader = firstRow.some((c) =>
      [...ALIASES.name, ...ALIASES.phone, ...ALIASES.surname].some((a) => c.includes(a))
    );

    // Build column index map
    const colMap: Record<string, number> = {};
    if (hasHeader) {
      for (let ci = 0; ci < firstRow.length; ci++) {
        const cell = firstRow[ci];
        for (const [field, aliases] of Object.entries(ALIASES)) {
          if (colMap[field] === undefined && aliases.some((a) => cell.includes(a))) {
            colMap[field] = ci;
            break;
          }
        }
      }
    }

    // Fallback to positional
    const usePositional = !hasHeader || colMap.name === undefined;
    if (usePositional) {
      colMap.name = 0;
      colMap.surname = 1;
      colMap.phone = 2;
      colMap.email = 3;
      colMap.company = 4;
      colMap.notes = 5;
    }

    const dataRows = hasHeader ? rows.slice(1) : rows;
    if (dataRows.length === 0) {
      return NextResponse.json({ error: "Нет строк с данными" }, { status: 400 });
    }

    let created = 0;
    let updated = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i];
      const rowNum = hasHeader ? i + 2 : i + 1;

      const name = row[colMap.name]?.trim() || "";
      const surname = colMap.surname !== undefined ? row[colMap.surname]?.trim() || "" : "";
      const phone = colMap.phone !== undefined ? row[colMap.phone]?.trim().replace(/[^\d+]/g, "") || "" : "";
      const email = colMap.email !== undefined ? row[colMap.email]?.trim() || "" : "";
      const company = colMap.company !== undefined ? row[colMap.company]?.trim() || "" : "";
      const notes = colMap.notes !== undefined ? row[colMap.notes]?.trim() || "" : "";

      const fullName = [name, surname].filter(Boolean).join(" ").trim();

      if (!fullName && !phone && !email) {
        skipped++;
        continue;
      }

      try {
        // Try to find existing client by phone (if provided)
        if (phone) {
          const existing = await prisma.client.findFirst({
            where: { businessId, phone },
          });

          if (existing) {
            // Update existing client
            await prisma.client.update({
              where: { id: existing.id },
              data: {
                ...(fullName ? { name: fullName } : {}),
                ...(surname ? { surname } : {}),
                ...(email ? { email } : {}),
                ...(company ? { company } : {}),
                ...(notes ? { importantNotes: notes } : {}),
              },
            });
            updated++;
            continue;
          }
        }

        // Create new client (use a placeholder telegramId since it's required)
        // Imported clients get telegramId = 0 (will be linked when they message the bot)
        await prisma.client.create({
          data: {
            businessId,
            telegramId: BigInt(0),
            name: fullName || null,
            surname: surname || null,
            phone: phone || null,
            email: email || null,
            company: company || null,
            importantNotes: notes || null,
          },
        });
        created++;
      } catch (err) {
        errors.push(`Строка ${rowNum}: ${err instanceof Error ? err.message : "ошибка"}`);
      }
    }

    return NextResponse.json({
      success: true,
      created,
      updated,
      skipped,
      total: dataRows.length,
      errors: errors.slice(0, 10),
    });
  } catch (error) {
    console.error("Import customers error:", error);
    return NextResponse.json({ error: "Ошибка импорта" }, { status: 500 });
  }
}
