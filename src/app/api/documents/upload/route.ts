import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";

// Max file size: 10MB
const MAX_FILE_SIZE = 10 * 1024 * 1024;

// Allowed file types
const ALLOWED_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
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
        { error: "Неподдерживаемый тип файла. Разрешены: PDF, DOC, DOCX, TXT, XLS, XLSX" },
        { status: 400 }
      );
    }

    // Create uploads directory if it doesn't exist
    const uploadsDir = path.join(process.cwd(), "public", "uploads", business.id);
    await mkdir(uploadsDir, { recursive: true });

    // Generate unique filename
    const ext = path.extname(file.name);
    const uniqueFilename = `${randomUUID()}${ext}`;
    const filePath = path.join(uploadsDir, uniqueFilename);

    // Save file
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    await writeFile(filePath, buffer);

    // URL for accessing the file
    const fileUrl = `/uploads/${business.id}/${uniqueFilename}`;

    // Extract text from file (for AI context)
    let extractedText: string | null = null;

    if (file.type === "text/plain") {
      // For TXT files - read directly
      extractedText = buffer.toString("utf-8");
    }
    // TODO: Add PDF/DOC extraction with external libraries (pdf-parse, mammoth)

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
        parsed: extractedText !== null,
      },
    });

    return NextResponse.json({
      success: true,
      document,
    });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json(
      { error: "Ошибка загрузки файла" },
      { status: 500 }
    );
  }
}
