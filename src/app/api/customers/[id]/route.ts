import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: { businesses: true },
    });

    if (!user?.businesses[0]) {
      return NextResponse.json({ error: "Бизнес не найден" }, { status: 404 });
    }

    const businessId = user.businesses[0].id;
    const { id } = await params;

    const client = await prisma.client.findFirst({
      where: { id, businessId },
    });

    if (!client) {
      return NextResponse.json({ error: "Клиент не найден" }, { status: 404 });
    }

    // Get conversation
    const conversation = await prisma.conversation.findFirst({
      where: {
        businessId,
        clientTelegramId: client.telegramId,
      },
      include: {
        messages: {
          orderBy: { createdAt: "desc" },
          take: 50,
        },
        _count: { select: { messages: true } },
      },
    });

    // Get bookings
    const bookings = await prisma.booking.findMany({
      where: {
        businessId,
        clientTelegramId: client.telegramId,
      },
      include: {
        service: true,
        staff: true,
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    // Get reviews
    const reviews = await prisma.review.findMany({
      where: {
        businessId,
        clientTelegramId: client.telegramId,
      },
      orderBy: { createdAt: "desc" },
    });

    // Calculate stats
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const isActive = client.lastVisitDate
      ? new Date(client.lastVisitDate) > thirtyDaysAgo
      : false;
    const isVip = client.totalVisits >= 5;

    const avgRating =
      reviews.length > 0
        ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
        : null;

    // Calculate total spent
    const completedBookings = bookings.filter((b) => b.status === "completed");
    const totalSpent = completedBookings.reduce(
      (sum, b) => sum + (b.service?.price || 0),
      0
    );

    return NextResponse.json({
      customer: {
        id: client.id,
        telegramId: client.telegramId.toString(),
        name: client.name || conversation?.clientName || "Клиент",
        phone: client.phone,
        totalVisits: client.totalVisits,
        lastVisitDate: client.lastVisitDate,
        isBlocked: client.isBlocked,
        createdAt: client.createdAt,
        // Computed
        isActive,
        isVip,
        segment: isVip ? "vip" : isActive ? "active" : "inactive",
        avgRating,
        totalSpent,
      },
      conversation: conversation
        ? {
            id: conversation.id,
            messagesCount: conversation._count.messages,
            messages: conversation.messages.map((m) => ({
              id: m.id,
              role: m.role,
              content: m.content,
              createdAt: m.createdAt,
            })),
          }
        : null,
      bookings: bookings.map((b) => ({
        id: b.id,
        date: b.date,
        status: b.status,
        serviceName: b.service?.name,
        servicePrice: b.service?.price,
        staffName: b.staff?.name,
        createdAt: b.createdAt,
      })),
      reviews: reviews.map((r) => ({
        id: r.id,
        rating: r.rating,
        comment: r.comment,
        createdAt: r.createdAt,
      })),
    });
  } catch (error) {
    console.error("Customer detail error:", error);
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}

// Block/unblock customer
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: { businesses: true },
    });

    if (!user?.businesses[0]) {
      return NextResponse.json({ error: "Бизнес не найден" }, { status: 404 });
    }

    const businessId = user.businesses[0].id;
    const { id } = await params;
    const body = await request.json();

    const client = await prisma.client.findFirst({
      where: { id, businessId },
    });

    if (!client) {
      return NextResponse.json({ error: "Клиент не найден" }, { status: 404 });
    }

    const updatedClient = await prisma.client.update({
      where: { id },
      data: {
        isBlocked: body.isBlocked ?? client.isBlocked,
        name: body.name ?? client.name,
        phone: body.phone ?? client.phone,
      },
    });

    return NextResponse.json({ customer: updatedClient });
  } catch (error) {
    console.error("Customer update error:", error);
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
