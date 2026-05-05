import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { promoteDealStageByTelegram } from "@/lib/deal-pipeline";
import { getCurrentBusinessId } from "@/lib/auth-helpers";

/**
 * PATCH /api/bookings/[id]
 * Body: { staffId?: string | null, status?: string }
 *
 * Used by the calendar UI to fix orphan bookings (created without a master)
 * by manually picking a staff member after the fact.
 */
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const businessId = await getCurrentBusinessId();
    if (!businessId) {
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
    }

    const { id } = await context.params;
    const body = await request.json();

    const booking = await prisma.booking.findFirst({
      where: { id, businessId },
      select: { id: true, status: true, clientTelegramId: true },
    });
    if (!booking) {
      return NextResponse.json({ error: "Запись не найдена" }, { status: 404 });
    }

    const data: { staffId?: string | null; status?: string } = {};

    if (body.staffId !== undefined) {
      if (body.staffId === null || body.staffId === "") {
        data.staffId = null;
      } else {
        // Verify the staff member belongs to this business
        const staff = await prisma.staff.findFirst({
          where: { id: body.staffId, businessId },
          select: { id: true },
        });
        if (!staff) {
          return NextResponse.json({ error: "Мастер не найден" }, { status: 400 });
        }
        data.staffId = body.staffId;
      }
    }

    if (typeof body.status === "string") {
      const allowed = ["pending", "confirmed", "completed", "cancelled", "no_show"];
      if (!allowed.includes(body.status)) {
        return NextResponse.json({ error: "Недопустимый статус" }, { status: 400 });
      }
      data.status = body.status;
    }

    const updated = await prisma.booking.update({
      where: { id },
      data,
      include: {
        service: { select: { name: true, price: true, duration: true } },
        staff: { select: { id: true, name: true } },
      },
    });

    // Auto-promote deal pipeline when a booking transitions to "completed"
    // (= встреча состоялась). Only when the status actually changed to avoid
    // re-promotion on incidental PATCHes, and only if we have a client identity.
    if (
      data.status === "completed" &&
      booking.status !== "completed" &&
      booking.clientTelegramId
    ) {
      promoteDealStageByTelegram(
        businessId,
        booking.clientTelegramId,
        "consultation_done"
      ).catch(() => {});
    }

    return NextResponse.json({
      booking: {
        id: updated.id,
        status: updated.status,
        staffId: updated.staff?.id || null,
        staffName: updated.staff?.name || null,
      },
    });
  } catch (error) {
    console.error("PATCH /api/bookings/[id]:", error);
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
