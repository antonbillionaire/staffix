/**
 * Admin API для promo-материалов партнёрской программы.
 *
 * GET  — список всех ассетов (включая неактивные — для админа).
 * POST — создать новый ассет (баннер или шаблон текста).
 *        Принимает multipart/form-data: type, title, description?, content?, file?, ...
 *        Если type=banner и есть file — загружает в Vercel Blob с префиксом partner-assets/.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/admin";
import { put } from "@vercel/blob";

const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"];

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.email || !isAdmin(session.user.email)) {
      return NextResponse.json({ error: "Доступ запрещён" }, { status: 403 });
    }

    const assets = await prisma.partnerAsset.findMany({
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    });

    return NextResponse.json({ assets });
  } catch (error) {
    console.error("GET /api/admin/partners/assets:", error);
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email || !isAdmin(session.user.email)) {
      return NextResponse.json({ error: "Доступ запрещён" }, { status: 403 });
    }

    const form = await request.formData();
    const type = (form.get("type") as string) || "";
    const title = ((form.get("title") as string) || "").trim();
    const description = ((form.get("description") as string) || "").trim() || null;
    const content = ((form.get("content") as string) || "").trim() || null;
    const category = ((form.get("category") as string) || "").trim() || null;
    const language = ((form.get("language") as string) || "ru").trim();
    const sortOrder = parseInt((form.get("sortOrder") as string) || "0", 10) || 0;

    if (type !== "banner" && type !== "template") {
      return NextResponse.json({ error: "type должен быть banner или template" }, { status: 400 });
    }
    if (!title) {
      return NextResponse.json({ error: "title обязателен" }, { status: 400 });
    }

    let imageUrl: string | null = null;

    if (type === "banner") {
      const file = form.get("file") as File | null;
      if (!file) {
        return NextResponse.json({ error: "Для баннера нужен файл картинки" }, { status: 400 });
      }
      if (file.size > MAX_IMAGE_SIZE) {
        return NextResponse.json({ error: "Файл больше 5MB" }, { status: 400 });
      }
      if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
        return NextResponse.json({ error: "Допустимые форматы: JPG, PNG, WebP, GIF, AVIF" }, { status: 400 });
      }

      const ext = file.name.split(".").pop() || "jpg";
      const filename = `partner-assets/${Date.now()}.${ext}`;
      const blob = await put(filename, file, { access: "public", addRandomSuffix: true });
      imageUrl = blob.url;
    } else {
      // template
      if (!content) {
        return NextResponse.json({ error: "Для шаблона нужен текст" }, { status: 400 });
      }
    }

    const asset = await prisma.partnerAsset.create({
      data: {
        type,
        title,
        description,
        imageUrl,
        content,
        category,
        language,
        sortOrder,
        isActive: true,
      },
    });

    return NextResponse.json({ success: true, asset });
  } catch (error) {
    console.error("POST /api/admin/partners/assets:", error);
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
