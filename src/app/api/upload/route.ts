import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

// Max file size: 10 MB
const MAX_FILE_SIZE = 10 * 1024 * 1024;

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
    if (!ALLOWED_TYPES.includes(file.type) &&
        !file.name.endsWith('.xlsx') &&
        !file.name.endsWith('.xls') &&
        !file.name.endsWith('.docx') &&
        !file.name.endsWith('.doc')) {
      return NextResponse.json(
        { error: "Неподдерживаемый тип файла" },
        { status: 400 }
      );
    }

    // Read file content
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const base64Content = buffer.toString("base64");

    // Extract text based on file type
    let extractedText = "";

    if (file.type === "text/plain") {
      // Plain text - decode directly
      extractedText = buffer.toString("utf-8");
    } else if (file.type === "application/pdf" || file.name.endsWith('.pdf')) {
      // For PDF - store base64, will be parsed later
      // In production, use pdf-parse or similar library
      extractedText = `[PDF документ: ${file.name}]`;
    } else if (file.type.includes("spreadsheet") || file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
      // Excel file
      extractedText = `[Excel документ: ${file.name}]`;
    } else if (file.type.includes("document") || file.name.endsWith('.docx') || file.name.endsWith('.doc')) {
      // Word document
      extractedText = `[Word документ: ${file.name}]`;
    } else if (file.type.startsWith("image/")) {
      // Image - for OCR in the future
      extractedText = `[Изображение: ${file.name}]`;
    }

    // Determine document type
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
        url: `data:${file.type};base64,${base64Content.substring(0, 100)}...`, // Store reference, not full content for URL field
        mimeType: file.type || "application/octet-stream",
        size: file.size,
        extractedText: extractedText,
        parsed: file.type === "text/plain", // Only text files are "parsed" immediately
        businessId,
      },
    });

    return NextResponse.json({
      success: true,
      document: {
        id: document.id,
        name: document.name,
        type: document.type,
        size: document.size,
        mimeType: document.mimeType,
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
