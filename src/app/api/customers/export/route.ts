import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { buildCSV, csvDate, csvDownloadHeaders } from "@/lib/csv";

// GET /api/customers/export?segment=...&search=...&dealStage=...
//
// Streams the full client list (up to 10k rows) as a CSV download.
// Mirrors the filters used in /api/customers so what the manager sees
// in the table is what they get in the file.
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: { businesses: { select: { id: true, name: true } } },
    });
    if (!user?.businesses[0]) {
      return NextResponse.json({ error: "Бизнес не найден" }, { status: 404 });
    }
    const business = user.businesses[0];

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const segment = searchParams.get("segment") || "all";
    const dealStage = searchParams.get("dealStage") || "";

    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const where: Record<string, unknown> = { businessId: business.id };
    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { phone: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
      ];
    }
    if (dealStage) where.dealStage = dealStage;

    if (segment === "vip") {
      where.totalVisits = { gte: 5 };
    } else if (segment === "active") {
      where.totalVisits = { lt: 5 };
      where.AND = [
        { OR: [{ lastVisitDate: { gt: thirtyDaysAgo } }, { lastMessageAt: { gt: thirtyDaysAgo } }] },
      ];
    } else if (segment === "inactive") {
      where.totalVisits = { lt: 5 };
      where.AND = [
        { OR: [{ lastVisitDate: null }, { lastVisitDate: { lte: thirtyDaysAgo } }] },
        { OR: [{ lastMessageAt: null }, { lastMessageAt: { lte: thirtyDaysAgo } }] },
      ];
    } else if (segment === "blocked") {
      where.isBlocked = true;
    }

    const clients = await prisma.client.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 10000,
    });

    const headers = [
      { key: "name" as const, label: "Имя" },
      { key: "phone" as const, label: "Телефон" },
      { key: "email" as const, label: "Email" },
      { key: "company" as const, label: "Компания" },
      { key: "tags" as const, label: "Теги" },
      { key: "dealStage" as const, label: "Стадия сделки" },
      { key: "dealValue" as const, label: "Сумма сделки" },
      { key: "dealClosedAt" as const, label: "Дата закрытия сделки" },
      { key: "dealNote" as const, label: "Заметка по сделке" },
      { key: "totalVisits" as const, label: "Всего визитов" },
      { key: "lastVisitDate" as const, label: "Последний визит" },
      { key: "lastMessageAt" as const, label: "Последнее сообщение" },
      { key: "loyaltyPoints" as const, label: "Бонусные баллы" },
      { key: "loyaltyTotalSpent" as const, label: "Сумма покупок" },
      { key: "loyaltyTier" as const, label: "Уровень лояльности" },
      { key: "importantNotes" as const, label: "Важные заметки" },
      { key: "isBlocked" as const, label: "Заблокирован" },
      { key: "createdAt" as const, label: "Дата регистрации" },
    ];

    const rows = clients.map((c) => ({
      name: c.name || "",
      phone: c.phone || "",
      email: c.email || "",
      company: c.company || "",
      tags: c.tags.join(", "),
      dealStage: c.dealStage,
      dealValue: c.dealValue ?? "",
      dealClosedAt: csvDate(c.dealClosedAt, true),
      dealNote: c.dealNote || "",
      totalVisits: c.totalVisits,
      lastVisitDate: csvDate(c.lastVisitDate, true),
      lastMessageAt: csvDate(c.lastMessageAt, true),
      loyaltyPoints: c.loyaltyPoints,
      loyaltyTotalSpent: c.loyaltyTotalSpent,
      loyaltyTier: c.loyaltyTier || "",
      importantNotes: c.importantNotes || "",
      isBlocked: c.isBlocked ? "да" : "нет",
      createdAt: csvDate(c.createdAt, true),
    }));

    const csv = buildCSV(headers, rows);
    const filename = `clients_${business.name || "staffix"}_${new Date().toISOString().slice(0, 10)}.csv`;

    return new NextResponse(csv, { headers: csvDownloadHeaders(filename) });
  } catch (error) {
    console.error("Customers export error:", error);
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
