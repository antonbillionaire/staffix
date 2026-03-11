import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

// PATCH /api/products/bulk-stock — update stock for multiple products at once
export async function PATCH(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: { businesses: { select: { id: true } } },
    });

    if (!user?.businesses[0]) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }

    const businessId = user.businesses[0].id;
    const body = await request.json();
    const { updates } = body;

    if (!Array.isArray(updates) || updates.length === 0) {
      return NextResponse.json({ error: "No updates provided" }, { status: 400 });
    }

    if (updates.length > 200) {
      return NextResponse.json({ error: "Too many updates (max 200)" }, { status: 400 });
    }

    // Verify all products belong to this business and get current stock
    const productIds = updates.map((u: { id: string }) => u.id);
    const products = await prisma.product.findMany({
      where: { id: { in: productIds }, businessId },
      select: { id: true, stock: true },
    });

    const productMap = new Map(products.map((p) => [p.id, p]));

    // Apply updates with stock logging
    const results = [];
    for (const update of updates) {
      const existing = productMap.get(update.id);
      if (!existing) continue;

      const stock = update.stock === null || update.stock === undefined
        ? null
        : Math.max(0, parseInt(update.stock) || 0);

      // Skip if stock didn't change
      if (existing.stock === stock) continue;

      const updated = await prisma.product.update({
        where: { id: update.id },
        data: { stock },
        select: { id: true, name: true, stock: true },
      });

      // Log the change
      const change = (stock ?? 0) - (existing.stock ?? 0);
      await prisma.stockLog.create({
        data: {
          productId: update.id,
          previousStock: existing.stock,
          newStock: stock,
          change,
          reason: "bulk_update",
        },
      }).catch(() => {});

      results.push(updated);
    }

    return NextResponse.json({
      success: true,
      updated: results,
      count: results.length,
    });
  } catch (error) {
    console.error("PATCH /api/products/bulk-stock:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
