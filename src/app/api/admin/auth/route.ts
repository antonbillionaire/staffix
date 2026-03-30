import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { isAdmin } from "@/lib/admin";

export async function GET() {
  try {
    const session = await auth();

    if (!session?.user?.email) {
      return NextResponse.json(
        { isAdmin: false, error: "Не авторизован" },
        { status: 401 }
      );
    }

    const adminStatus = isAdmin(session.user.email);

    // Debug log — remove after confirming admin access works
    console.log(`[Admin Auth] email=${session.user.email}, isAdmin=${adminStatus}, ADMIN_EMAILS=${process.env.ADMIN_EMAILS || "NOT SET"}`);

    return NextResponse.json({
      isAdmin: adminStatus,
      email: session.user.email,
    });
  } catch (error) {
    console.error("Admin auth error:", error);
    return NextResponse.json(
      { isAdmin: false, error: "Ошибка сервера" },
      { status: 500 }
    );
  }
}
