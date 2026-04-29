import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/admin";

/**
 * POST /api/admin/businesses/[id]/migrate-mode
 * Body: { to: "sales" | "service" }
 *
 * Switch a business between dashboard modes. When migrating service → sales,
 * convert each Service into a Product (name/price/description) so the owner
 * does not have to re-enter their catalog. Existing Service rows are kept
 * untouched in case the migration needs to be reversed manually.
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.email || !isAdmin(session.user.email)) {
      return NextResponse.json({ error: "Доступ запрещён" }, { status: 403 });
    }

    const { id: businessId } = await context.params;
    const body = await request.json();
    const targetMode: "sales" | "service" | undefined = body?.to;

    if (targetMode !== "sales" && targetMode !== "service") {
      return NextResponse.json(
        { error: "to must be 'sales' or 'service'" },
        { status: 400 }
      );
    }

    const business = await prisma.business.findUnique({
      where: { id: businessId },
      select: { id: true, name: true, dashboardMode: true },
    });

    if (!business) {
      return NextResponse.json({ error: "Бизнес не найден" }, { status: 404 });
    }

    if (business.dashboardMode === targetMode) {
      return NextResponse.json({
        ok: true,
        message: `Бизнес уже в режиме ${targetMode}`,
        productsCreated: 0,
      });
    }

    let productsCreated = 0;

    // service → sales: convert services into products
    if (targetMode === "sales" && business.dashboardMode !== "sales") {
      const services = await prisma.service.findMany({
        where: { businessId },
        select: { name: true, description: true, price: true },
      });

      if (services.length > 0) {
        // Avoid creating duplicates if product with same name already exists
        const existingProducts = await prisma.product.findMany({
          where: { businessId },
          select: { name: true },
        });
        const existingNames = new Set(existingProducts.map((p) => p.name.toLowerCase().trim()));

        const productsData = services
          .filter((s) => !existingNames.has(s.name.toLowerCase().trim()))
          .map((s) => ({
            businessId,
            name: s.name,
            description: s.description,
            price: s.price,
          }));

        if (productsData.length > 0) {
          const result = await prisma.product.createMany({ data: productsData });
          productsCreated = result.count;
        }
      }
    }

    await prisma.business.update({
      where: { id: businessId },
      data: { dashboardMode: targetMode },
    });

    return NextResponse.json({
      ok: true,
      from: business.dashboardMode,
      to: targetMode,
      productsCreated,
      message: productsCreated > 0
        ? `Бизнес переключён в ${targetMode}. Создано ${productsCreated} товаров из услуг.`
        : `Бизнес переключён в ${targetMode}.`,
    });
  } catch (error) {
    console.error("Migrate mode error:", error);
    return NextResponse.json({ error: "Ошибка миграции" }, { status: 500 });
  }
}
