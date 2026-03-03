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

    // Column-name aliases for smart mapping
    const ALIASES: Record<string, string[]> = {
      name: ["название", "наименование", "name", "товар", "product", "item", "продукт"],
      price: ["цена", "price", "стоимость", "cost"],
      category: ["категория", "category", "группа", "group"],
      description: ["описание", "description", "desc"],
      stock: ["остаток", "stock", "количество", "qty", "quantity", "кол-во"],
      sku: ["артикул", "sku", "код", "code"],
      oldPrice: ["старая цена", "old price", "старая_цена", "скидка от", "old_price", "oldprice"],
    };

    const firstRow = rows[0].map((c) => c.toLowerCase().trim());
    const hasHeader = firstRow.some((c) =>
      [...ALIASES.name, ...ALIASES.price].some((a) => c.includes(a))
    );

    // Build column index map
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
    // Fallback to positional if no name column found
    const usePositional = !hasHeader || colMap.name === undefined;
    if (usePositional) {
      colMap.name = 0; colMap.price = 1; colMap.category = 2;
      colMap.description = 3; colMap.stock = 4; colMap.sku = 5; colMap.oldPrice = 6;
    }

    const dataRows = hasHeader ? rows.slice(1) : rows;

    if (dataRows.length === 0) {
      return NextResponse.json({ error: "Нет строк с данными" }, { status: 400 });
    }

    const productsToCreate: {
      name: string;
      price: number;
      category: string | null;
      description: string | null;
      stock: number | null;
      sku: string | null;
      oldPrice: number | null;
      isActive: boolean;
      businessId: string;
    }[] = [];
    const errors: string[] = [];

    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i];
      const rowNum = hasHeader ? i + 2 : i + 1;

      const name = row[colMap.name]?.trim();
      const priceRaw = (row[colMap.price] || "").trim().replace(/[^\d.,-]/g, "").replace(/\s/g, "").replace(",", ".");
      const category = colMap.category !== undefined ? row[colMap.category]?.trim() || undefined : undefined;
      const description = colMap.description !== undefined ? row[colMap.description]?.trim() || undefined : undefined;
      const stockRaw = colMap.stock !== undefined ? row[colMap.stock]?.trim() : undefined;
      const sku = colMap.sku !== undefined ? row[colMap.sku]?.trim() || undefined : undefined;
      const oldPriceRaw = colMap.oldPrice !== undefined ? (row[colMap.oldPrice] || "").trim().replace(/[^\d.,-]/g, "").replace(/\s/g, "").replace(",", ".") : "";

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

      productsToCreate.push({
        name,
        price,
        category: category || null,
        description: description || null,
        stock,
        sku: sku || null,
        oldPrice,
        isActive: true,
        businessId,
      });
    }

    // Batch insert all valid products in one query
    let createdCount = 0;
    if (productsToCreate.length > 0) {
      const result = await prisma.product.createMany({ data: productsToCreate });
      createdCount = result.count;
    }

    return NextResponse.json({
      success: true,
      created: createdCount,
      errors: errors.length > 0 ? errors : undefined,
      message: `Создано товаров: ${createdCount}${errors.length > 0 ? `, пропущено: ${errors.length}` : ""}`,
    });
  } catch (error) {
    console.error("POST /api/import/products:", error);
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
