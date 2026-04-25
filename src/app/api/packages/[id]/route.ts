/**
 * PUT /api/packages/[id] — update package
 * DELETE /api/packages/[id] — delete package
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

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const businessId = await getBusinessId();
  if (!businessId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await request.json();
  const { name, description, discountType, discountPercent, fixedPrice, autoSuggest, isActive, serviceIds } = body;

  try {
    const pkg = await prisma.servicePackage.findFirst({ where: { id, businessId } });
    if (!pkg) return NextResponse.json({ error: "Not found" }, { status: 404 });

    // Update package fields
    const updated = await prisma.servicePackage.update({
      where: { id },
      data: {
        name: name?.trim() || undefined,
        description: description !== undefined ? (description?.trim() || null) : undefined,
        discountType: discountType !== undefined ? discountType : undefined,
        discountPercent: discountPercent !== undefined ? (discountPercent === null ? null : Number(discountPercent)) : undefined,
        fixedPrice: fixedPrice !== undefined ? (fixedPrice === null ? null : Math.round(Number(fixedPrice))) : undefined,
        autoSuggest: autoSuggest !== undefined ? autoSuggest : undefined,
        isActive: isActive !== undefined ? isActive : undefined,
      },
    });

    // If serviceIds provided — replace package items
    if (Array.isArray(serviceIds)) {
      const services = await prisma.service.findMany({
        where: { id: { in: serviceIds }, businessId },
        select: { id: true },
      });
      if (services.length !== serviceIds.length) {
        return NextResponse.json({ error: "Some services not found" }, { status: 400 });
      }

      await prisma.servicePackageItem.deleteMany({ where: { packageId: id } });
      await prisma.servicePackageItem.createMany({
        data: serviceIds.map((sid: string, idx: number) => ({
          packageId: id,
          serviceId: sid,
          sortOrder: idx,
        })),
      });
    }

    return NextResponse.json({ package: updated });
  } catch (error) {
    console.error("PUT /api/packages/[id]:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const businessId = await getBusinessId();
  if (!businessId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  try {
    const pkg = await prisma.servicePackage.findFirst({ where: { id, businessId } });
    if (!pkg) return NextResponse.json({ error: "Not found" }, { status: 404 });

    await prisma.servicePackage.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/packages/[id]:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
