/**
 * POST /api/documents/[id]/auto-description
 *
 * Генерирует autoDescription через Haiku 4.5 для существующего документа.
 * Нужно для файлов, загруженных до июля 2026 — у них description=null
 * и autoDescription=null, и матчер грузит их всегда как fallback.
 *
 * После вызова этого endpoint'а autoDescription заполнится, и матчер
 * начнёт lazy-loading для этого документа.
 *
 * Требования:
 *  - Документ принадлежит бизнесу вызывающего пользователя
 *  - У документа есть extractedText (parsed=true) — иначе генерить нечего
 *
 * Не трогает owner-written description — если оно уже есть, только
 * дополняет autoDescription как fallback.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentBusinessId } from "@/lib/auth-helpers";
import { generateAutoDescription } from "@/lib/document-matcher";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const businessId = await getCurrentBusinessId();
    if (!businessId) {
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
    }

    const { id } = await params;

    const doc = await prisma.document.findFirst({
      where: { id, businessId },
      select: { id: true, name: true, extractedText: true, parsed: true },
    });
    if (!doc) {
      return NextResponse.json({ error: "Документ не найден" }, { status: 404 });
    }
    if (!doc.parsed || !doc.extractedText) {
      return NextResponse.json(
        { error: "Документ ещё не распарсен — AI не может прочитать содержимое" },
        { status: 400 }
      );
    }

    const autoDescription = await generateAutoDescription(doc.name, doc.extractedText);
    if (!autoDescription) {
      return NextResponse.json(
        { error: "AI не смог сгенерировать описание. Попробуйте написать вручную." },
        { status: 502 }
      );
    }

    const updated = await prisma.document.update({
      where: { id },
      data: { autoDescription },
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
    console.error("Auto-description generate error:", error);
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
