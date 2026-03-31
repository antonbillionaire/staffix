import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

// Max file size: 10 MB
const MAX_FILE_SIZE = 10 * 1024 * 1024;

// Parse timeout: 15 seconds
const PARSE_TIMEOUT_MS = 15000;

// Allowed MIME types
const ALLOWED_TYPES = [
  "application/pdf",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/jpeg",
  "image/png",
  "text/plain",
];

// Extension fallback for browsers that send empty MIME type
const EXT_TO_MIME: Record<string, string> = {
  ".pdf": "application/pdf",
  ".doc": "application/msword",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".txt": "text/plain",
  ".xls": "application/vnd.ms-excel",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
};

function resolveFileType(file: File): string {
  if (file.type && ALLOWED_TYPES.includes(file.type)) return file.type;
  const ext = ("." + file.name.split(".").pop()?.toLowerCase()) as string;
  return EXT_TO_MIME[ext] ?? file.type;
}

/**
 * Detect text encoding from buffer (supports UTF-8, UTF-16, Windows-1251).
 */
function decodeTextBuffer(buffer: Buffer): string {
  // Check BOM (Byte Order Mark)
  if (buffer[0] === 0xEF && buffer[1] === 0xBB && buffer[2] === 0xBF) {
    return buffer.slice(3).toString("utf-8");
  }
  if (buffer[0] === 0xFF && buffer[1] === 0xFE) {
    return buffer.slice(2).toString("utf16le");
  }
  if (buffer[0] === 0xFE && buffer[1] === 0xFF) {
    // UTF-16 BE - convert via TextDecoder
    const decoder = new TextDecoder("utf-16be");
    return decoder.decode(buffer.slice(2));
  }

  // Try UTF-8 first
  const utf8 = buffer.toString("utf-8");
  // Check for replacement characters (sign of wrong encoding)
  if (!utf8.includes("\uFFFD")) {
    return utf8;
  }

  // Fallback: try Windows-1251 (common for Russian text files)
  try {
    const decoder = new TextDecoder("windows-1251");
    return decoder.decode(buffer);
  } catch {
    return utf8; // return UTF-8 as last resort
  }
}

/**
 * Parse file with timeout protection.
 */
function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`${label}: превышено время ожидания (${ms / 1000}с)`)), ms)
    ),
  ]);
}

export async function POST(request: NextRequest) {
  try {
    // Get session
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
    }

    // Get user and business
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: { businesses: true },
    });

    if (!user || user.businesses.length === 0) {
      return NextResponse.json({ error: "Бизнес не найден" }, { status: 404 });
    }

    const businessId = user.businesses[0].id;

    // Parse FormData
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "Файл не выбран" }, { status: 400 });
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "Файл слишком большой. Максимум 10 MB" },
        { status: 400 }
      );
    }

    // Validate file type
    const resolvedType = resolveFileType(file);
    if (!ALLOWED_TYPES.includes(resolvedType)) {
      return NextResponse.json(
        { error: "Неподдерживаемый тип файла. Разрешены: PDF, DOC, DOCX, TXT, XLS, XLSX, PNG, JPG" },
        { status: 400 }
      );
    }

    // Read file content
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // For images, store as base64 reference
    const isImage = resolvedType.startsWith("image/");
    const fileUrl = isImage
      ? `data:${resolvedType};base64,${buffer.toString("base64")}`
      : `document://${file.name}`;

    // Extract text based on file type (full parsing)
    let extractedText: string | null = null;
    let parseError: string | null = null;

    try {
      console.log(`[Upload] Parsing: ${file.name}, type: ${resolvedType}, size: ${file.size}`);

      if (resolvedType === "text/plain") {
        // TXT — auto-detect encoding
        extractedText = decodeTextBuffer(buffer);
        console.log(`[Upload] TXT parsed, length: ${extractedText.length}`);

      } else if (resolvedType === "application/pdf") {
        try {
          const parsePdf = async () => {
            const { PDFParse } = await import("pdf-parse");
            const parser = new PDFParse({ data: buffer });
            const textResult = await parser.getText();
            await parser.destroy();
            return textResult.text;
          };
          extractedText = await withTimeout(parsePdf(), PARSE_TIMEOUT_MS, "PDF парсинг");

          // Check for empty PDF (likely scanned)
          if (!extractedText || extractedText.trim().length < 10) {
            parseError = "PDF содержит изображения, а не текст. Пожалуйста, загрузите текстовый PDF или скопируйте содержимое в TXT файл.";
            extractedText = null;
          }
          console.log(`[Upload] PDF parsed, length: ${extractedText?.length || 0}`);
        } catch (pdfErr) {
          const msg = pdfErr instanceof Error ? pdfErr.message : String(pdfErr);
          if (msg.toLowerCase().includes("password") || msg.toLowerCase().includes("encrypt")) {
            parseError = "PDF защищён паролем. Снимите пароль и загрузите снова.";
          } else if (msg.includes("превышено время")) {
            parseError = msg;
          } else {
            parseError = "Ошибка парсинга PDF. Попробуйте скопировать текст в TXT файл.";
          }
          console.error(`[Upload] PDF error:`, msg);
        }

      } else if (
        resolvedType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
        resolvedType === "application/msword"
      ) {
        try {
          const parseDoc = async () => {
            const mammoth = await import("mammoth");
            const result = await mammoth.extractRawText({ buffer });
            return result.value;
          };
          extractedText = await withTimeout(parseDoc(), PARSE_TIMEOUT_MS, "Word парсинг");

          if (!extractedText || extractedText.trim().length === 0) {
            parseError = "Документ пуст или не содержит текста.";
            extractedText = null;
          }
          console.log(`[Upload] Word parsed, length: ${extractedText?.length || 0}`);
        } catch (docErr) {
          const msg = docErr instanceof Error ? docErr.message : String(docErr);
          if (msg.toLowerCase().includes("password") || msg.toLowerCase().includes("encrypt")) {
            parseError = "Документ защищён паролем. Снимите пароль и загрузите снова.";
          } else if (msg.includes("превышено время")) {
            parseError = msg;
          } else {
            parseError = "Ошибка парсинга Word. Попробуйте скопировать текст в TXT файл.";
          }
          console.error(`[Upload] Word error:`, msg);
        }

      } else if (
        resolvedType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
        resolvedType === "application/vnd.ms-excel"
      ) {
        try {
          const parseXls = async () => {
            const XLSX = await import("xlsx");
            const workbook = XLSX.read(buffer, { type: "buffer" });
            const texts: string[] = [];
            for (const sheetName of workbook.SheetNames) {
              const sheet = workbook.Sheets[sheetName];
              const csv = XLSX.utils.sheet_to_csv(sheet);
              texts.push(`=== ${sheetName} ===\n${csv}`);
            }
            return texts.join("\n\n");
          };
          extractedText = await withTimeout(parseXls(), PARSE_TIMEOUT_MS, "Excel парсинг");

          if (!extractedText || extractedText.trim().length === 0) {
            parseError = "Excel файл пуст.";
            extractedText = null;
          }
          console.log(`[Upload] Excel parsed, length: ${extractedText?.length || 0}`);
        } catch (xlsErr) {
          const msg = xlsErr instanceof Error ? xlsErr.message : String(xlsErr);
          if (msg.toLowerCase().includes("password") || msg.toLowerCase().includes("encrypt")) {
            parseError = "Excel файл защищён паролем. Снимите пароль и загрузите снова.";
          } else if (msg.includes("превышено время")) {
            parseError = msg;
          } else {
            parseError = "Ошибка парсинга Excel. Попробуйте сохранить как CSV и загрузить.";
          }
          console.error(`[Upload] Excel error:`, msg);
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`[Upload] Unexpected error parsing ${file.name}:`, errorMessage);
      parseError = errorMessage;
    }

    // Determine document type from filename
    let docType = "other";
    const lowerName = file.name.toLowerCase();
    if (lowerName.includes("прайс") || lowerName.includes("price") || lowerName.includes("цен")) {
      docType = "price_list";
    } else if (lowerName.includes("услуг") || lowerName.includes("service") || lowerName.includes("меню")) {
      docType = "services";
    } else if (lowerName.includes("faq") || lowerName.includes("вопрос") || lowerName.includes("ответ")) {
      docType = "faq";
    }

    // Save to database
    const document = await prisma.document.create({
      data: {
        name: file.name,
        type: docType,
        url: fileUrl,
        mimeType: resolvedType,
        size: file.size,
        extractedText,
        parsed: extractedText !== null && extractedText.length > 0,
        businessId,
      },
    });

    console.log(`[Upload] Saved: ${document.id}, parsed: ${document.parsed}, text: ${extractedText?.length || 0} chars`);

    return NextResponse.json({
      success: true,
      document: {
        id: document.id,
        name: document.name,
        type: document.type,
        size: document.size,
        mimeType: document.mimeType,
        parsed: document.parsed,
      },
      parsing: {
        success: document.parsed,
        textLength: extractedText?.length || 0,
        error: parseError,
      },
    });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json(
      { error: "Ошибка загрузки файла" },
      { status: 500 }
    );
  }
}

// Get all documents for the business
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: { businesses: true },
    });

    if (!user || user.businesses.length === 0) {
      return NextResponse.json({ error: "Бизнес не найден" }, { status: 404 });
    }

    const documents = await prisma.document.findMany({
      where: { businessId: user.businesses[0].id },
      select: {
        id: true,
        name: true,
        type: true,
        size: true,
        mimeType: true,
        parsed: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ documents });
  } catch (error) {
    console.error("Get documents error:", error);
    return NextResponse.json(
      { error: "Ошибка получения документов" },
      { status: 500 }
    );
  }
}

// Delete a document
export async function DELETE(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const documentId = searchParams.get("id");

    if (!documentId) {
      return NextResponse.json({ error: "ID документа не указан" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: { businesses: true },
    });

    if (!user || user.businesses.length === 0) {
      return NextResponse.json({ error: "Бизнес не найден" }, { status: 404 });
    }

    // Verify document belongs to user's business
    const document = await prisma.document.findFirst({
      where: {
        id: documentId,
        businessId: user.businesses[0].id,
      },
    });

    if (!document) {
      return NextResponse.json({ error: "Документ не найден" }, { status: 404 });
    }

    await prisma.document.delete({
      where: { id: documentId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete document error:", error);
    return NextResponse.json(
      { error: "Ошибка удаления документа" },
      { status: 500 }
    );
  }
}
