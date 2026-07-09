import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentBusinessId } from "@/lib/auth-helpers";

// PATCH - Update document description (owner-written; used by lazy-loading matcher).
// Умышленно ограничено ТОЛЬКО полем description — остальные поля (extractedText,
// url, size) правит только upload-endpoint.
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const businessId = await getCurrentBusinessId();
    if (!businessId) {
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
    }

    const { id } = await params;

    const document = await prisma.document.findFirst({
      where: { id, businessId },
      select: { id: true },
    });
    if (!document) {
      return NextResponse.json({ error: "Документ не найден" }, { status: 404 });
    }

    const body = await request.json().catch(() => ({}));
    const rawDesc = typeof body?.description === "string" ? body.description.trim() : "";
    // Пустая строка → null (значит владелец очистил поле, будем использовать autoDescription)
    const description = rawDesc.length > 0 ? rawDesc.substring(0, 500) : null;

    const updated = await prisma.document.update({
      where: { id },
      data: { description },
      select: {
        id: true,
        name: true,
        type: true,
        mimeType: true,
        size: true,
        createdAt: true,
        description: true,
        autoDescription: true,
      },
    });

    return NextResponse.json({ success: true, document: updated });
  } catch (error) {
    console.error("Document PATCH error:", error);
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}

// DELETE - Delete document by ID
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const businessId = await getCurrentBusinessId();
    if (!businessId) {
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
    }

    const { id } = await params;

    // Verify document belongs to user's business
    const document = await prisma.document.findFirst({
      where: {
        id,
        businessId,
      },
    });

    if (!document) {
      return NextResponse.json({ error: "Документ не найден" }, { status: 404 });
    }

    await prisma.document.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Document delete error:", error);
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
