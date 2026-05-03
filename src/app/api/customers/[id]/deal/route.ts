import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

// Allowed dealStage values — keep in sync with the migration comment.
const VALID_STAGES = [
  "lead",
  "consultation_booked",
  "consultation_done",
  "client",
  "lost",
] as const;

type DealStage = (typeof VALID_STAGES)[number];

// PATCH /api/customers/[id]/deal — move client through the deal pipeline
//
// Body: { stage: DealStage, value?: number | null, note?: string | null }
//
// dealClosedAt is set automatically when stage moves to "client" or "lost",
// cleared when stage moves back to an earlier step.
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: { businesses: { select: { id: true } } },
    });
    if (!user?.businesses[0]) {
      return NextResponse.json({ error: "Бизнес не найден" }, { status: 404 });
    }
    const businessId = user.businesses[0].id;

    const { id: clientId } = await params;
    const client = await prisma.client.findFirst({
      where: { id: clientId, businessId },
    });
    if (!client) {
      return NextResponse.json({ error: "Клиент не найден" }, { status: 404 });
    }

    const body = await request.json().catch(() => ({}));
    const stage = body.stage as DealStage | undefined;
    const value = body.value as number | null | undefined;
    const note = body.note as string | null | undefined;

    if (!stage || !VALID_STAGES.includes(stage)) {
      return NextResponse.json(
        { error: `Недопустимая стадия. Возможные: ${VALID_STAGES.join(", ")}` },
        { status: 400 }
      );
    }

    // value: undefined = не трогать; null = очистить; number = задать.
    const updateData: {
      dealStage: DealStage;
      dealClosedAt: Date | null;
      dealValue?: number | null;
      dealNote?: string | null;
    } = {
      dealStage: stage,
      // Closed when reaching a terminal stage; cleared when re-opening.
      dealClosedAt: stage === "client" || stage === "lost" ? new Date() : null,
    };
    if (value !== undefined) {
      if (value !== null && (typeof value !== "number" || !Number.isFinite(value) || value < 0)) {
        return NextResponse.json({ error: "Сумма сделки должна быть неотрицательным числом" }, { status: 400 });
      }
      updateData.dealValue = value;
    }
    if (note !== undefined) {
      if (note !== null && typeof note !== "string") {
        return NextResponse.json({ error: "Заметка должна быть строкой" }, { status: 400 });
      }
      const trimmed = typeof note === "string" ? note.trim() : null;
      if (trimmed && trimmed.length > 1000) {
        return NextResponse.json({ error: "Заметка слишком длинная (макс 1000)" }, { status: 400 });
      }
      updateData.dealNote = trimmed || null;
    }

    const updated = await prisma.client.update({
      where: { id: clientId },
      data: updateData,
    });

    return NextResponse.json({
      customer: {
        id: updated.id,
        dealStage: updated.dealStage,
        dealValue: updated.dealValue,
        dealClosedAt: updated.dealClosedAt,
        dealNote: updated.dealNote,
      },
    });
  } catch (error) {
    console.error("Deal update error:", error);
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
