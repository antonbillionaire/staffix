/**
 * GET /api/incompatibilities — list service incompatibilities
 * POST /api/incompatibilities — create new incompatibility rule
 *   Body: { serviceAId, serviceBId, cooldownDays?, bidirectional?, reason? }
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
    const incompatibilities = await prisma.serviceIncompatibility.findMany({
      where: { businessId },
      include: {
        serviceA: { select: { id: true, name: true } },
        serviceB: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ incompatibilities });
  } catch (error) {
    console.error("GET /api/incompatibilities:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const businessId = await getBusinessId();
  if (!businessId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await request.json();
    const { serviceAId, serviceBId, cooldownDays, bidirectional, reason } = body;

    if (!serviceAId || !serviceBId) {
      return NextResponse.json({ error: "serviceAId and serviceBId required" }, { status: 400 });
    }

    if (serviceAId === serviceBId) {
      return NextResponse.json({ error: "Services must be different" }, { status: 400 });
    }

    // Verify both services belong to this business
    const services = await prisma.service.findMany({
      where: { id: { in: [serviceAId, serviceBId] }, businessId },
      select: { id: true },
    });
    if (services.length !== 2) {
      return NextResponse.json({ error: "Some services not found" }, { status: 400 });
    }

    const inc = await prisma.serviceIncompatibility.create({
      data: {
        serviceAId,
        serviceBId,
        cooldownDays: cooldownDays !== undefined ? Math.max(1, Math.round(Number(cooldownDays))) : 7,
        bidirectional: bidirectional !== false,
        reason: reason?.trim() || null,
        businessId,
      },
      include: {
        serviceA: { select: { id: true, name: true } },
        serviceB: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json({ incompatibility: inc }, { status: 201 });
  } catch (error) {
    console.error("POST /api/incompatibilities:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
