/**
 * GET /api/packages — list all service packages with items
 * POST /api/packages — create new package
 *   Body: { name, description, discountType, discountPercent?, fixedPrice?, autoSuggest?, serviceIds: [...] }
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

async function getBusinessId(): Promise<string | null> {
  const session = await auth();
  if (!session?.user?.id) return null;
  const business = await prisma.business.findFirst({
    where: { userId: session.user.id },
    select: { id: true },
  });
  return business?.id || null;
}

export async function GET() {
  const businessId = await getBusinessId();
  if (!businessId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const packages = await prisma.servicePackage.findMany({
      where: { businessId },
      include: {
        items: {
          include: { service: true },
          orderBy: { sortOrder: "asc" },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // Calculate totals for each package
    const enriched = packages.map((p) => {
      const totalRegularPrice = p.items.reduce((sum, i) => sum + i.service.price, 0);
      const totalDuration = p.items.reduce((sum, i) => sum + i.service.duration, 0);

      let finalPrice = totalRegularPrice;
      if (p.discountType === "percent" && p.discountPercent) {
        finalPrice = Math.round(totalRegularPrice * (1 - p.discountPercent / 100));
      } else if (p.discountType === "fixed" && p.fixedPrice !== null) {
        finalPrice = p.fixedPrice;
      }

      return {
        ...p,
        totalRegularPrice,
        finalPrice,
        savedAmount: totalRegularPrice - finalPrice,
        totalDuration,
      };
    });

    return NextResponse.json({ packages: enriched });
  } catch (error) {
    console.error("GET /api/packages:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const businessId = await getBusinessId();
  if (!businessId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await request.json();
    const { name, description, discountType, discountPercent, fixedPrice, autoSuggest, serviceIds } = body;

    if (!name || !Array.isArray(serviceIds) || serviceIds.length === 0) {
      return NextResponse.json({ error: "name and serviceIds required" }, { status: 400 });
    }

    // Валидация скидки/цены — без этого можно было отправить -50 (скидка
    // на 150%) или 999 → пакет становился дороже отдельных услуг или уходил
    // в отрицательную цену.
    const discountNum = discountPercent != null ? Number(discountPercent) : null;
    if (discountNum !== null && (!Number.isFinite(discountNum) || discountNum < 0 || discountNum > 100)) {
      return NextResponse.json({ error: "discountPercent должен быть 0-100" }, { status: 400 });
    }
    const fixedPriceNum = fixedPrice != null ? Number(fixedPrice) : null;
    if (fixedPriceNum !== null && (!Number.isFinite(fixedPriceNum) || fixedPriceNum < 0)) {
      return NextResponse.json({ error: "fixedPrice не может быть отрицательным" }, { status: 400 });
    }

    // Verify all services belong to this business
    const services = await prisma.service.findMany({
      where: { id: { in: serviceIds }, businessId },
      select: { id: true },
    });
    if (services.length !== serviceIds.length) {
      return NextResponse.json({ error: "Some services not found" }, { status: 400 });
    }

    const pkg = await prisma.servicePackage.create({
      data: {
        name: name.trim(),
        description: description?.trim() || null,
        discountType: discountType || "percent",
        discountPercent: discountNum,
        fixedPrice: fixedPriceNum !== null ? Math.round(fixedPriceNum) : null,
        autoSuggest: autoSuggest !== false,
        isActive: true,
        businessId,
        items: {
          create: serviceIds.map((sid: string, idx: number) => ({
            serviceId: sid,
            sortOrder: idx,
          })),
        },
      },
      include: {
        items: { include: { service: true } },
      },
    });

    return NextResponse.json({ package: pkg }, { status: 201 });
  } catch (error) {
    console.error("POST /api/packages:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
