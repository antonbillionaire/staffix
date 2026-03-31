import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

// No top-level imports for parsing libraries!
// They are loaded dynamically to avoid crashes on Vercel
// if native dependencies (canvas, etc.) are missing

// Max file size: 10MB
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const PARSE_TIMEOUT_MS = 15000;

function decodeTextBuffer(buffer: Buffer): string {
  if (buffer[0] === 0xEF && buffer[1] === 0xBB && buffer[2] === 0xBF) return buffer.slice(3).toString("utf-8");
  if (buffer[0] === 0xFF && buffer[1] === 0xFE) return buffer.slice(2).toString("utf16le");
  if (buffer[0] === 0xFE && buffer[1] === 0xFF) return new TextDecoder("utf-16be").decode(buffer.slice(2));
  const utf8 = buffer.toString("utf-8");
  if (!utf8.includes("\uFFFD")) return utf8;
  try { return new TextDecoder("windows-1251").decode(buffer); } catch { return utf8; }
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`${label}: превышено время ожидания (${ms / 1000}с)`)), ms)),
  ]);
}

// Allowed file types
const ALLOWED_TYPES = [
  // Documents
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  // Images (for logo)
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "image/gif",
];

// Fallback: some OS/browsers send empty or wrong MIME type — resolve by extension
const EXT_TO_MIME: Record<string, string> = {
  ".pdf":  "application/pdf",
  ".doc":  "application/msword",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".txt":  "text/plain",
  ".xls":  "application/vnd.ms-excel",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".png":  "image/png",
  ".jpg":  "image/jpeg",
  ".jpeg": "image/jpeg",
};

function resolveFileType(file: File): string {
  if (file.type && ALLOWED_TYPES.includes(file.type)) return file.type;
  const ext = ("." + file.name.split(".").pop()?.toLowerCase()) as string;
  return EXT_TO_MIME[ext] ?? file.type;
}

export async function POST(request: NextRequest) {
  try {
    // Auth: NextAuth session
    const session = await auth();
    let userId: string | undefined;

    if (session?.user?.email) {
      const user = await prisma.user.findUnique({
        where: { email: session.user.email },
      });
      userId = user?.id;
    }

    if (!userId) {
      return NextResponse.json(
        { error: "Не авторизован" },
        { status: 401 }
      );
    }

    // Find user's business
    const business = await prisma.business.findFirst({
      where: { userId },
    });

    if (!business) {
      return NextResponse.json(
        { error: "Сначала создайте бизнес" },
        { status: 400 }
      );
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const documentType = (formData.get("type") as string) || "other";

    if (!file) {
      return NextResponse.json(
        { error: "Файл обязателен" },
        { status: 400 }
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "Файл слишком большой. Максимум 10MB" },
        { status: 400 }
      );
    }

    // Validate file type (with extension fallback for Windows/browsers sending empty MIME)
    const resolvedType = resolveFileType(file);
    if (!ALLOWED_TYPES.includes(resolvedType)) {
      return NextResponse.json(
        { error: "Неподдерживаемый тип файла. Разрешены: PDF, DOC, DOCX, TXT, XLS, XLSX, PNG, JPG" },
        { status: 400 }
      );
    }

    // Read file into memory buffer (no filesystem writes - Vercel is read-only)
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // For images (logo), convert to base64 data URL
    const isImage = resolvedType.startsWith("image/");
    let fileUrl = "";

    if (isImage) {
      // Store logo as base64 data URL
      const base64 = buffer.toString("base64");
      fileUrl = `data:${resolvedType};base64,${base64}`;
    } else {
      // For documents, we don't need to store the file - just the extracted text
      fileUrl = `document://${file.name}`;
    }

    // Extract text from file (for AI context)
    let extractedText: string | null = null;
    let parseError: string | null = null;

    try {
      console.log(`[Document Upload] Parsing file: ${file.name}, type: ${resolvedType}, size: ${file.size}`);

      if (resolvedType === "text/plain") {
        extractedText = decodeTextBuffer(buffer);
        console.log(`[Document Upload] TXT parsed, length: ${extractedText.length}`);

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
          if (!extractedText || extractedText.trim().length < 10) {
            parseError = "PDF содержит изображения, а не текст. Загрузите текстовый PDF или скопируйте содержимое в TXT файл.";
            extractedText = null;
          }
          console.log(`[Document Upload] PDF parsed, length: ${extractedText?.length || 0}`);
        } catch (pdfErr) {
          const msg = pdfErr instanceof Error ? pdfErr.message : String(pdfErr);
          if (msg.toLowerCase().includes("password") || msg.toLowerCase().includes("encrypt")) {
            parseError = "PDF защищён паролем. Снимите пароль и загрузите снова.";
          } else if (msg.includes("превышено время")) {
            parseError = msg;
          } else {
            parseError = "Ошибка парсинга PDF. Попробуйте скопировать текст в TXT файл.";
          }
          console.error(`[Document Upload] PDF error:`, msg);
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
          console.log(`[Document Upload] Word parsed, length: ${extractedText?.length || 0}`);
        } catch (docErr) {
          const msg = docErr instanceof Error ? docErr.message : String(docErr);
          if (msg.toLowerCase().includes("password") || msg.toLowerCase().includes("encrypt")) {
            parseError = "Документ защищён паролем. Снимите пароль и загрузите снова.";
          } else if (msg.includes("превышено время")) {
            parseError = msg;
          } else {
            parseError = "Ошибка парсинга Word. Попробуйте скопировать текст в TXT файл.";
          }
          console.error(`[Document Upload] Word error:`, msg);
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
          console.log(`[Document Upload] Excel parsed, length: ${extractedText?.length || 0}`);
        } catch (xlsErr) {
          const msg = xlsErr instanceof Error ? xlsErr.message : String(xlsErr);
          if (msg.toLowerCase().includes("password") || msg.toLowerCase().includes("encrypt")) {
            parseError = "Excel файл защищён паролем. Снимите пароль и загрузите снова.";
          } else if (msg.includes("превышено время")) {
            parseError = msg;
          } else {
            parseError = "Ошибка парсинга Excel. Попробуйте сохранить как CSV и загрузить.";
          }
          console.error(`[Document Upload] Excel error:`, msg);
        }

      } else {
        console.log(`[Document Upload] Unsupported file type for parsing: ${resolvedType}`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`[Document Upload] Error parsing file ${file.name}:`, errorMessage);
      parseError = errorMessage;
    }

    // Create document record
    const document = await prisma.document.create({
      data: {
        name: file.name,
        type: documentType,
        url: fileUrl,
        mimeType: resolvedType,
        size: file.size,
        businessId: business.id,
        extractedText: extractedText,
        parsed: extractedText !== null && extractedText.length > 0,
      },
    });

    console.log(`[Document Upload] Document saved: ${document.id}, parsed: ${document.parsed}, textLength: ${extractedText?.length || 0}`);

    return NextResponse.json({
      success: true,
      document,
      parsing: {
        success: extractedText !== null && extractedText.length > 0,
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
