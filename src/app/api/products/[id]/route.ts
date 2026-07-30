import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { markBusinessConversationsForRefresh } from "@/lib/knowledge-refresh";
import { Prisma } from "@prisma/client";

/**
 * Product.attributes — гибкий словарь свойств товара (30 июля 2026).
 * Валидируем: только string/number значения, max 30 пар, ключ ≤60 символов,
 * значение ≤300. Защищает промпт AI от раздувания и БД от мусора.
 * null / пустой объект → возвращаем null (Prisma сохранит как JsonNull).
 */
function sanitizeAttributes(raw: unknown): Record<string, string> | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const result: Record<string, string> = {};
  let count = 0;
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (count >= 30) break;
    if (typeof k !== "string") continue;
    const key = k.trim().slice(0, 60);
    if (!key) continue;
    if (typeof v !== "string" && typeof v !== "number") continue;
    const value = String(v).trim().slice(0, 300);
    if (!value) continue;
    result[key] = value;
    count++;
  }
  return Object.keys(result).length > 0 ? result : null;
}

async function getUserBusiness(): Promise<string | null> {
  const session = await auth();
  let userId: string | null = null;

  if (session?.user?.email) {
    const user = await prisma.user.findUnique({ where: { email: session.user.email } });
    userId = user?.id || null;
  }

  if (!userId) return null;

  const business = await prisma.business.findFirst({
    where: { userId },
    select: { id: true },
  });
  return business?.id || null;
}

// PATCH /api/products/[id]
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const businessId = await getUserBusiness();
    if (!businessId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const body = await request.json();

    const product = await prisma.product.findFirst({ where: { id, businessId } });
    if (!product) return NextResponse.json({ error: "Not found" }, { status: 404 });

    // Capture previous stock BEFORE the update so we can log the delta.
    // bulk-stock and create_order already log; this PATCH is the third path
    // that mutates stock (edit-product modal in dashboard) and it was silent —
    // владельцу нечего сверять с фактическим отчётом склада.
    const previousStock = product.stock;
    const newStockRaw = body.stock;
    const stockChanging =
      newStockRaw !== undefined &&
      newStockRaw !== null &&
      Number.isFinite(Number(newStockRaw)) &&
      Number(newStockRaw) !== previousStock;

    // Attributes handling: если body.attributes === undefined — не трогаем.
    // Если {} или null — обнуляем (владелец очистил все свойства).
    // Иначе — санитизируем и сохраняем.
    let attributesUpdate: Prisma.JsonNullValueInput | Record<string, string> | undefined;
    if (body.attributes !== undefined) {
      const clean = sanitizeAttributes(body.attributes);
      attributesUpdate = clean ?? Prisma.JsonNull;
    }

    const updated = await prisma.product.update({
      where: { id },
      data: {
        name: body.name ?? undefined,
        description: body.description !== undefined ? body.description : undefined,
        price: body.price !== undefined ? Math.round(body.price) : undefined,
        oldPrice: body.oldPrice !== undefined ? (body.oldPrice ? Math.round(body.oldPrice) : null) : undefined,
        stock: body.stock !== undefined ? body.stock : undefined,
        sku: body.sku !== undefined ? body.sku : undefined,
        category: body.category !== undefined ? body.category : undefined,
        tags: body.tags !== undefined ? body.tags : undefined,
        imageUrl: body.imageUrl !== undefined ? body.imageUrl : undefined,
        productUrl: body.productUrl !== undefined ? body.productUrl : undefined,
        isActive: body.isActive !== undefined ? body.isActive : undefined,
        ...(attributesUpdate !== undefined ? { attributes: attributesUpdate } : {}),
      },
    });

    // Log stock change (reason: "manual" — правка через UI).
    // Fire-and-forget с console.error — StockLog не блокирует ответ клиенту,
    // но и не заглушаем silent .catch.
    if (stockChanging && updated.stock !== null && previousStock !== null) {
      prisma.stockLog.create({
        data: {
          productId: id,
          previousStock,
          newStock: updated.stock,
          change: updated.stock - previousStock,
          reason: "manual",
        },
      }).catch((e) => console.error("[Product PATCH] stockLog create failed:", e));
    }

    await markBusinessConversationsForRefresh(businessId);

    return NextResponse.json({ product: updated });
  } catch (error) {
    console.error("PATCH /api/products/[id]:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// DELETE /api/products/[id]
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const businessId = await getUserBusiness();
    if (!businessId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;

    const product = await prisma.product.findFirst({ where: { id, businessId } });
    if (!product) return NextResponse.json({ error: "Not found" }, { status: 404 });

    // Мягкое удаление — скрываем, не удаляем (история заказов)
    await prisma.product.update({ where: { id }, data: { isActive: false } });

    await markBusinessConversationsForRefresh(businessId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/products/[id]:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
