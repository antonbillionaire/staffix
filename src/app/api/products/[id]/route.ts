import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

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
      },
    });

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

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/products/[id]:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
