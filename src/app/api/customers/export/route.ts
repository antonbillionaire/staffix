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

    const [clients, fieldsConfigRow] = await Promise.all([
      prisma.client.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: 10000,
      }),
      prisma.business.findUnique({
        where: { id: business.id },
        select: { clientFieldsConfig: true },
      }),
    ]);
    const customFieldDefs = (Array.isArray(fieldsConfigRow?.clientFieldsConfig)
      ? (fieldsConfigRow!.clientFieldsConfig as Array<{ key: string; label: string }>)
      : []
    );

    // Headers list combines fixed fields + dynamic custom-field columns
    // (named `cf_<key>` so they don't collide with built-ins). Typed loosely
    // because keys come from runtime config.
    const headers: { key: string; label: string }[] = [
      { key: "name", label: "Имя" },
      { key: "phone", label: "Телефон" },
      { key: "email", label: "Email" },
      { key: "company", label: "Компания" },
      { key: "tags", label: "Теги" },
      { key: "dealStage", label: "Стадия сделки" },
      { key: "dealValue", label: "Сумма сделки" },
      { key: "dealClosedAt", label: "Дата закрытия сделки" },
      { key: "dealNote", label: "Заметка по сделке" },
      { key: "totalVisits", label: "Всего визитов" },
      { key: "lastVisitDate", label: "Последний визит" },
      { key: "lastMessageAt", label: "Последнее сообщение" },
      { key: "loyaltyPoints", label: "Бонусные баллы" },
      { key: "loyaltyTotalSpent", label: "Сумма покупок" },
      { key: "loyaltyTier", label: "Уровень лояльности" },
      { key: "importantNotes", label: "Важные заметки" },
      { key: "isBlocked", label: "Заблокирован" },
      { key: "createdAt", label: "Дата регистрации" },
      ...customFieldDefs.map((f) => ({ key: `cf_${f.key}`, label: f.label })),
    ];

    const rows = clients.map((c) => {
      const cf = (c.customFields as Record<string, unknown>) || {};
      const cfRow: Record<string, string | number> = {};
      for (const def of customFieldDefs) {
        const v = cf[def.key];
        cfRow[`cf_${def.key}`] = v === null || v === undefined ? "" : String(v);
      }
      return {
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
        ...cfRow,
      };
    });

    // Cast through Record<string, unknown> so the CSV builder accepts both
    // the fixed keys and the dynamic cf_* keys without separate generics.
    const csv = buildCSV(headers, rows as unknown as Record<string, unknown>[]);
    const filename = `clients_${business.name || "staffix"}_${new Date().toISOString().slice(0, 10)}.csv`;

    return new NextResponse(csv, { headers: csvDownloadHeaders(filename) });
  } catch (error) {
    console.error("Customers export error:", error);
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
