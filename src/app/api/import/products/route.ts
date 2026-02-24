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
 */
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

// POST /api/import/products
// Body: { csv: string }
// CSV columns: name, price, category (opt), description (opt), stock (opt), sku (opt), old_price (opt)
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

    const firstRow = rows[0].map((c) => c.toLowerCase());
    const hasHeader =
      firstRow.some((c) => c.includes("наименование") || c.includes("название") || c === "name" || c === "товар");
    const dataRows = hasHeader ? rows.slice(1) : rows;

    if (dataRows.length === 0) {
      return NextResponse.json({ error: "Нет строк с данными" }, { status: 400 });
    }

    const created: string[] = [];
    const errors: string[] = [];

    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i];
      const rowNum = hasHeader ? i + 2 : i + 1;

      // columns: name, price, category, description, stock, sku, old_price
      const name = row[0]?.trim();
      const priceRaw = row[1]?.trim().replace(/\s/g, "").replace(",", ".");
      const category = row[2]?.trim() || undefined;
      const description = row[3]?.trim() || undefined;
      const stockRaw = row[4]?.trim();
      const sku = row[5]?.trim() || undefined;
      const oldPriceRaw = row[6]?.trim().replace(/\s/g, "").replace(",", ".");

      if (!name) {
        errors.push(`Строка ${rowNum}: пустое название`);
        continue;
      }

      const price = Math.round(parseFloat(priceRaw));
      if (isNaN(price) || price < 0) {
        errors.push(`Строка ${rowNum} («${name}»): некорректная цена «${priceRaw}»`);
        continue;
      }

      let stock: number | null = null;
      if (stockRaw && stockRaw !== "" && stockRaw !== "-") {
        const s = parseInt(stockRaw, 10);
        if (!isNaN(s) && s >= 0) stock = s;
      }

      let oldPrice: number | null = null;
      if (oldPriceRaw && oldPriceRaw !== "" && oldPriceRaw !== "-") {
        const op = Math.round(parseFloat(oldPriceRaw));
        if (!isNaN(op) && op > price) oldPrice = op;
      }

      await prisma.product.create({
        data: {
          name,
          price,
          category: category || null,
          description: description || null,
          stock,
          sku: sku || null,
          oldPrice,
          isActive: true,
          businessId,
        },
      });
      created.push(name);
    }

    return NextResponse.json({
      success: true,
      created: created.length,
      errors: errors.length > 0 ? errors : undefined,
      message: `Создано товаров: ${created.length}${errors.length > 0 ? `, пропущено: ${errors.length}` : ""}`,
    });
  } catch (error) {
    console.error("POST /api/import/products:", error);
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
