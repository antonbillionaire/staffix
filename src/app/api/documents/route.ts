import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";

// Helper: get user ID (NextAuth + cookie fallback)
async function getUserId(): Promise<string | undefined> {
  const session = await auth();

  if (session?.user?.email) {
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });
    if (user?.id) return user.id;
  }

  const cookieStore = await cookies();
  return cookieStore.get("userId")?.value;
}

// GET - Fetch all documents for user's business
export async function GET() {
  try {
    const userId = await getUserId();

    if (!userId) {
      return NextResponse.json(
        { error: "Не авторизован" },
        { status: 401 }
      );
    }

    const business = await prisma.business.findFirst({
      where: { userId },
    });

    if (!business) {
      return NextResponse.json({ documents: [] });
    }

    const documents = await prisma.document.findMany({
      where: { businessId: business.id },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ documents });
  } catch (error) {
    console.error("Documents fetch error:", error);
    return NextResponse.json(
      { error: "Ошибка сервера" },
      { status: 500 }
    );
  }
}

// DELETE - Delete a document
export async function DELETE(request: Request) {
  try {
    const userId = await getUserId();

    if (!userId) {
      return NextResponse.json(
        { error: "Не авторизован" },
        { status: 401 }
      );
    }

    const { documentId } = await request.json();

    if (!documentId) {
      return NextResponse.json(
        { error: "ID документа обязателен" },
        { status: 400 }
      );
    }

    const business = await prisma.business.findFirst({
      where: { userId },
    });

    if (!business) {
      return NextResponse.json(
        { error: "Бизнес не найден" },
        { status: 404 }
      );
    }

    // Verify document belongs to user's business
    const document = await prisma.document.findFirst({
      where: {
        id: documentId,
        businessId: business.id,
      },
    });

    if (!document) {
      return NextResponse.json(
        { error: "Документ не найден" },
        { status: 404 }
      );
    }

    // Delete document record
    await prisma.document.delete({
      where: { id: documentId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Document delete error:", error);
    return NextResponse.json(
      { error: "Ошибка сервера" },
      { status: 500 }
    );
  }
}
