import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import Anthropic from "@anthropic-ai/sdk";

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
    let csvText: string = body.csv || "";
    const isPreview: boolean = body.preview === true;
    const pdfBase64: string | undefined = body.pdfBase64;
    const importUrl: string | undefined = body.importUrl;

    // URL import: fetch website page, extract products with AI
    if (importUrl && !csvText) {
      try {
        const url = new URL(importUrl);
        if (!["http:", "https:"].includes(url.protocol)) {
          return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
        }

        const pageRes = await fetch(importUrl, {
          headers: { "User-Agent": "Mozilla/5.0 (compatible; Staffix/1.0)" },
          signal: AbortSignal.timeout(15000),
        });
        if (!pageRes.ok) {
          return NextResponse.json({ error: `Failed to fetch page: ${pageRes.status}` }, { status: 400 });
        }

        const html = await pageRes.text();
        if (!html || html.length < 100) {
          return NextResponse.json({ error: "Page is empty or too short" }, { status: 400 });
        }

        // Strip scripts/styles, keep text content (limit to 50KB for AI)
        const cleanHtml = html
          .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
          .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
          .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, "")
          .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, "")
          .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, "")
          .slice(0, 50000);

        const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
        const aiResponse = await anthropic.messages.create({
          model: "claude-sonnet-4-5-20250929",
          max_tokens: 4096,
          system: "You extract product catalogs from HTML pages and output CSV. Always output ONLY CSV data with a header row, nothing else. Use semicolon (;) as delimiter. Columns: название;цена;категория;описание;ссылка. Extract product name, price (number only), category if visible, short description, and product page URL if available. If price is not found, put 0. Output in the same language as the source page.",
          messages: [{ role: "user", content: `Extract all products with prices from this website HTML and output as CSV (semicolon-separated). Source URL: ${importUrl}\n\n${cleanHtml}` }],
        });

        const aiText = aiResponse.content.find(b => b.type === "text")?.text || "";
        if (!aiText || aiText.trim().length < 10) {
          return NextResponse.json({
            error: "Could not extract products from this page. Try a different page or use CSV/Excel.",
          }, { status: 400 });
        }

        csvText = aiText.trim();
        console.log(`[URL Import] Extracted ${csvText.split("\n").length - 1} products from ${importUrl}`);
      } catch (urlErr) {
        console.error("[URL Import] Error:", urlErr);
        const msg = urlErr instanceof Error ? urlErr.message : "Unknown error";
        return NextResponse.json({
          error: msg.includes("timeout") ? "Website took too long to respond. Try a different URL." : "Failed to import from URL. Try CSV/Excel.",
        }, { status: 500 });
      }
    }

    // PDF import: extract text from PDF, then use AI to convert to CSV
    if (pdfBase64 && !csvText) {
      try {
        const buffer = Buffer.from(pdfBase64, "base64");

        // Parse PDF to text
        const { PDFParse } = await import("pdf-parse");
        const parser = new PDFParse({ data: buffer });
        const textResult = await parser.getText();
        await parser.destroy();
        const pdfText = textResult.text;

        if (!pdfText || pdfText.trim().length < 20) {
          return NextResponse.json({
            error: "PDF содержит изображения, а не текст. Загрузите текстовый PDF или используйте Excel/CSV.",
          }, { status: 400 });
        }

        // Use Claude to extract products from PDF text
        const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
        const aiResponse = await anthropic.messages.create({
          model: "claude-sonnet-4-5-20250929",
          max_tokens: 4096,
          system: "You extract product/service catalogs from text and output CSV. Always output ONLY CSV data with a header row, nothing else. Use semicolon (;) as delimiter. Columns: название;цена;категория;описание. If price is not found, put 0. If category is not clear, leave empty. Output in the same language as the source text.",
          messages: [{ role: "user", content: `Extract all products/services with prices from this catalog text and output as CSV (semicolon-separated):\n\n${pdfText.slice(0, 30000)}` }],
        });

        const aiText = aiResponse.content.find(b => b.type === "text")?.text || "";
        if (!aiText || aiText.trim().length < 10) {
          return NextResponse.json({
            error: "Не удалось извлечь товары из PDF. Попробуйте Excel/CSV формат.",
          }, { status: 400 });
        }

        csvText = aiText.trim();
        console.log(`[PDF Import] Extracted ${csvText.split("\n").length - 1} products from PDF`);
      } catch (pdfErr) {
        console.error("[PDF Import] Error:", pdfErr);
        return NextResponse.json({
          error: "Ошибка обработки PDF. Попробуйте Excel/CSV формат.",
        }, { status: 500 });
      }
    }

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

    // Column-name aliases for smart mapping
    const ALIASES: Record<string, string[]> = {
      name: ["название", "наименование", "name", "товар", "product", "item", "продукт"],
      price: ["цена", "price", "стоимость", "cost"],
      category: ["категория", "category", "группа", "group"],
      description: ["описание", "description", "desc"],
      stock: ["остаток", "stock", "количество", "qty", "quantity", "кол-во"],
      sku: ["артикул", "sku", "код", "code"],
      oldPrice: ["старая цена", "old price", "старая_цена", "скидка от", "old_price", "oldprice"],
      productUrl: ["ссылка", "url", "link", "страница", "page_url", "product_url"],
    };

    const FIELD_LABELS: Record<string, string> = {
      name: "Название",
      price: "Цена",
      category: "Категория",
      description: "Описание",
      stock: "Остаток",
      sku: "Артикул",
      oldPrice: "Старая цена",
      productUrl: "Ссылка",
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

    // Row limit: max 10000
    if (dataRows.length > 10000) {
      return NextResponse.json({ error: `Слишком много строк: ${dataRows.length}. Максимум 10 000` }, { status: 400 });
    }

    // Preview mode: return column mapping + sample rows without importing
    if (isPreview) {
      const mapping = Object.entries(colMap).map(([field, colIndex]) => ({
        field,
        label: FIELD_LABELS[field] || field,
        columnIndex: colIndex,
        headerName: hasHeader ? rows[0][colIndex] || `Колонка ${colIndex + 1}` : `Колонка ${colIndex + 1}`,
      }));

      const sampleRows = dataRows.slice(0, 5).map((row) => {
        const mapped: Record<string, string> = {};
        for (const [field, colIndex] of Object.entries(colMap)) {
          mapped[field] = row[colIndex] || "";
        }
        return mapped;
      });

      return NextResponse.json({
        preview: true,
        hasHeader,
        usePositional,
        totalRows: dataRows.length,
        mapping,
        sampleRows,
      });
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
