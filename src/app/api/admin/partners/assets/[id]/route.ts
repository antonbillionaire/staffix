/**
 * PATCH — изменить (title, description, content, category, language, sortOrder, isActive).
 *         Картинку через PATCH не меняем — проще удалить и загрузить новый ассет.
 * DELETE — удалить запись (картинка в Vercel Blob остаётся, не критично).
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/admin";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.email || !isAdmin(session.user.email)) {
      return NextResponse.json({ error: "Доступ запрещён" }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();

    const data: Record<string, unknown> = {};
    if (typeof body.title === "string") data.title = body.title.trim();
    if ("description" in body) data.description = body.description?.trim() || null;
    if ("content" in body) data.content = body.content?.trim() || null;
    if ("category" in body) data.category = body.category?.trim() || null;
    if (typeof body.language === "string") data.language = body.language.trim();
    if (typeof body.sortOrder === "number") data.sortOrder = body.sortOrder;
    if (typeof body.isActive === "boolean") data.isActive = body.isActive;

    const asset = await prisma.partnerAsset.update({
      where: { id },
      data,
    });

    return NextResponse.json({ success: true, asset });
  } catch (error) {
    console.error("PATCH /api/admin/partners/assets/[id]:", error);
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.email || !isAdmin(session.user.email)) {
      return NextResponse.json({ error: "Доступ запрещён" }, { status: 403 });
    }

    const { id } = await params;
    await prisma.partnerAsset.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/admin/partners/assets/[id]:", error);
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
