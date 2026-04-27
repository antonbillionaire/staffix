import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/admin";

/**
 * POST /api/admin/sales-leads/[id]/reset-history
 *
 * Clears the conversation history of a Victor (sales bot) lead so that
 * the model starts a fresh, polite tone next message instead of being
 * dragged into the previous casual style by the in-context examples.
 */
export async function POST(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.email || !isAdmin(session.user.email)) {
      return NextResponse.json({ error: "Доступ запрещён" }, { status: 403 });
    }

    const { id } = await context.params;
    if (!id) {
      return NextResponse.json({ error: "ID required" }, { status: 400 });
    }

    const lead = await prisma.salesLead.findUnique({ where: { id } });
    if (!lead) {
      return NextResponse.json({ error: "Лид не найден" }, { status: 404 });
    }

    await prisma.salesLead.update({
      where: { id },
      data: { history: [] },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Reset Victor history error:", error);
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
