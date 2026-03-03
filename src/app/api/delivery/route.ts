import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

async function getUserBusinessId(): Promise<string | null> {
  const session = await auth();
  if (!session?.user?.email) return null;

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true },
  });
  if (!user) return null;

  const business = await prisma.business.findFirst({
    where: { userId: user.id },
    select: { id: true },
  });
  return business?.id || null;
}

// GET - Fetch delivery settings + zones
export async function GET() {
  try {
    const businessId = await getUserBusinessId();
    if (!businessId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const [business, zones] = await Promise.all([
      prisma.business.findUnique({
        where: { id: businessId },
        select: {
          deliveryEnabled: true,
          deliveryTimeFrom: true,
          deliveryTimeTo: true,
          deliveryFee: true,
          deliveryFreeFrom: true,
          deliveryZones: true,
        },
      }),
      prisma.deliveryZone.findMany({
        where: { businessId },
        orderBy: { sortOrder: "asc" },
      }),
    ]);

    return NextResponse.json({
      delivery: business,
      zones,
    });
  } catch (error) {
    console.error("GET /api/delivery:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// PUT - Update delivery toggle and general settings
export async function PUT(request: NextRequest) {
  try {
    const businessId = await getUserBusinessId();
    if (!businessId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { enabled, timeFrom, timeTo, fee, freeFrom } = body;

    await prisma.business.update({
      where: { id: businessId },
      data: {
        deliveryEnabled: enabled ?? undefined,
        deliveryTimeFrom: timeFrom !== undefined ? timeFrom : undefined,
        deliveryTimeTo: timeTo !== undefined ? timeTo : undefined,
        deliveryFee: fee !== undefined ? fee : undefined,
        deliveryFreeFrom: freeFrom !== undefined ? freeFrom : undefined,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("PUT /api/delivery:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// POST - Create or update a delivery zone
export async function POST(request: NextRequest) {
  try {
    const businessId = await getUserBusinessId();
    if (!businessId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { id, name, fee, currency, timeFrom, timeTo, freeFrom, isActive } = body;

    if (!name || fee === undefined) {
      return NextResponse.json({ error: "Название и стоимость обязательны" }, { status: 400 });
    }

    if (id) {
      // Update existing zone
      const zone = await prisma.deliveryZone.findFirst({
        where: { id, businessId },
      });
      if (!zone) {
        return NextResponse.json({ error: "Зона не найдена" }, { status: 404 });
      }

      const parsedFee = parseInt(fee, 10);
      if (isNaN(parsedFee) || parsedFee < 0) {
        return NextResponse.json({ error: "Некорректная стоимость доставки" }, { status: 400 });
      }

      const updated = await prisma.deliveryZone.update({
        where: { id },
        data: {
          name,
          fee: parsedFee,
          currency: currency || "UZS",
          timeFrom: timeFrom ? (parseInt(timeFrom, 10) || null) : null,
          timeTo: timeTo ? (parseInt(timeTo, 10) || null) : null,
          freeFrom: freeFrom ? (parseInt(freeFrom, 10) || null) : null,
          isActive: isActive !== undefined ? isActive : true,
        },
      });

      return NextResponse.json({ success: true, zone: updated });
    } else {
      // Create new zone
      const count = await prisma.deliveryZone.count({ where: { businessId } });

      const parsedFeeNew = parseInt(fee, 10);
      if (isNaN(parsedFeeNew) || parsedFeeNew < 0) {
        return NextResponse.json({ error: "Некорректная стоимость доставки" }, { status: 400 });
      }

      const zone = await prisma.deliveryZone.create({
        data: {
          name,
          fee: parsedFeeNew,
          currency: currency || "UZS",
          timeFrom: timeFrom ? (parseInt(timeFrom, 10) || null) : null,
          timeTo: timeTo ? (parseInt(timeTo, 10) || null) : null,
          freeFrom: freeFrom ? (parseInt(freeFrom, 10) || null) : null,
          sortOrder: count,
          businessId,
        },
      });

      return NextResponse.json({ success: true, zone });
    }
  } catch (error) {
    console.error("POST /api/delivery:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// DELETE - Remove a delivery zone
export async function DELETE(request: NextRequest) {
  try {
    const businessId = await getUserBusinessId();
    if (!businessId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const zoneId = searchParams.get("zoneId");

    if (!zoneId) {
      return NextResponse.json({ error: "zoneId required" }, { status: 400 });
    }

    const zone = await prisma.deliveryZone.findFirst({
      where: { id: zoneId, businessId },
    });

    if (!zone) {
      return NextResponse.json({ error: "Зона не найдена" }, { status: 404 });
    }

    await prisma.deliveryZone.delete({ where: { id: zoneId } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/delivery:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
