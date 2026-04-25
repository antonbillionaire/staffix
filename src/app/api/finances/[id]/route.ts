/**
 * DELETE /api/finances/[id] — delete finance transaction
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const business = await prisma.business.findFirst({
    where: { userId: session.user.id },
    select: { id: true },
  });
  if (!business) {
    return NextResponse.json({ error: "Business not found" }, { status: 404 });
  }

  const { id } = await params;

  try {
    const tx = await prisma.financeTransaction.findFirst({
      where: { id, businessId: business.id },
    });
    if (!tx) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    await prisma.financeTransaction.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/finances/[id]:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
