import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

// No top-level imports for parsing libraries!
// They are loaded dynamically to avoid crashes on Vercel
// if native dependencies (canvas, etc.) are missing

// Max file size: 10MB
const MAX_FILE_SIZE = 10 * 1024 * 1024;

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

export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Не авторизован" },
        { status: 401 }
      );
    }

    // Find user's business
    const business = await prisma.business.findFirst({
      where: { userId: session.user.id },
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

    // Validate file type
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: "Неподдерживаемый тип файла. Разрешены: PDF, DOC, DOCX, TXT, XLS, XLSX, PNG, JPG" },
        { status: 400 }
      );
    }

    // Read file into memory buffer (no filesystem writes - Vercel is read-only)
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // For images (logo), convert to base64 data URL
    const isImage = file.type.startsWith("image/");
    let fileUrl = "";

    if (isImage) {
      // Store logo as base64 data URL
      const base64 = buffer.toString("base64");
      fileUrl = `data:${file.type};base64,${base64}`;
    } else {
      // For documents, we don't need to store the file - just the extracted text
      fileUrl = `document://${file.name}`;
    }

    // Extract text from file (for AI context)
    let extractedText: string | null = null;
    let parseError: string | null = null;

    try {
      console.log(`[Document Upload] Parsing file: ${file.name}, type: ${file.type}, size: ${file.size}`);

      if (file.type === "text/plain") {
        extractedText = buffer.toString("utf-8");
        console.log(`[Document Upload] TXT parsed, length: ${extractedText.length}`);

      } else if (file.type === "application/pdf") {
        try {
          const { PDFParse } = await import("pdf-parse");
          const parser = new PDFParse({ data: buffer });
          const textResult = await parser.getText();
          extractedText = textResult.text;
          await parser.destroy();
          console.log(`[Document Upload] PDF parsed, length: ${extractedText?.length || 0}`);
        } catch (pdfErr) {
          console.error(`[Document Upload] PDF parser unavailable:`, pdfErr);
          parseError = "PDF парсер недоступен на сервере";
        }

      } else if (
        file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
        file.type === "application/msword"
      ) {
        try {
          const mammoth = await import("mammoth");
          const result = await mammoth.extractRawText({ buffer });
          extractedText = result.value;
          console.log(`[Document Upload] Word parsed, length: ${extractedText?.length || 0}`);
        } catch (docErr) {
          console.error(`[Document Upload] Word parser unavailable:`, docErr);
          parseError = "Word парсер недоступен на сервере";
        }

      } else if (
        file.type === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
        file.type === "application/vnd.ms-excel"
      ) {
        try {
          const XLSX = await import("xlsx");
          console.log(`[Document Upload] Starting Excel parsing...`);
          const workbook = XLSX.read(buffer, { type: "buffer" });
          console.log(`[Document Upload] Excel workbook loaded, sheets: ${workbook.SheetNames.join(", ")}`);
          const texts: string[] = [];
          for (const sheetName of workbook.SheetNames) {
            const sheet = workbook.Sheets[sheetName];
            const csv = XLSX.utils.sheet_to_csv(sheet);
            texts.push(`=== ${sheetName} ===\n${csv}`);
          }
          extractedText = texts.join("\n\n");
          console.log(`[Document Upload] Excel parsed, total length: ${extractedText.length}`);
        } catch (xlsErr) {
          console.error(`[Document Upload] Excel parser unavailable:`, xlsErr);
          parseError = "Excel парсер недоступен на сервере";
        }

      } else {
        console.log(`[Document Upload] Unsupported file type for parsing: ${file.type}`);
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
        mimeType: file.type,
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
