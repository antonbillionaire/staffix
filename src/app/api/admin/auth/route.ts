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
