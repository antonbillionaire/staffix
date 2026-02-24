import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// ONE-TIME endpoint — DELETE AFTER USE
export async function DELETE(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get("secret");
  const email = req.nextUrl.searchParams.get("email");

  if (secret !== "staffix_admin_del_2025" || !email) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const user = await prisma.user.delete({ where: { email } });
    return NextResponse.json({ deleted: user.email, id: user.id });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 404 });
  }
}
