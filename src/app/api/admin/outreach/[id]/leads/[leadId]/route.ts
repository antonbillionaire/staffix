import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/admin";

// PATCH — update lead status (mark as sent, replied, etc.)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; leadId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.email || !isAdmin(session.user.email)) {
      return NextResponse.json({ error: "Доступ запрещён" }, { status: 403 });
    }

    const { leadId } = await params;
    const body = await request.json();
    const { status, notes } = body;

    const validStatuses = ["pending", "sent", "replied", "registered", "paying"];
    if (status && !validStatuses.includes(status)) {
      return NextResponse.json({ error: "Неверный статус" }, { status: 400 });
    }

    const updateData: Record<string, unknown> = {};
    if (status) {
      updateData.status = status;
      if (status === "sent" || status === "replied") {
        updateData.sentAt = updateData.sentAt ?? new Date();
      }
      if (status === "replied") {
        updateData.repliedAt = new Date();
      }
    }
    if (notes !== undefined) updateData.notes = notes;

    const lead = await prisma.outreachLead.update({
      where: { id: leadId },
      data: updateData,
    });

    return NextResponse.json({ lead });
  } catch (error) {
    console.error("Update outreach lead error:", error);
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
