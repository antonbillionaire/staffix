import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { buildCSV, csvDate, csvDownloadHeaders } from "@/lib/csv";
import { getCurrentBusiness } from "@/lib/auth-helpers";

// GET /api/orders/export?status=...&from=...&to=...
//
// Streams orders as CSV. Includes order items concatenated into one cell
// so the file stays one row per order — Excel-friendly.
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  try {
    const business = await getCurrentBusiness();
    if (!business) {
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") || "";
    const fromStr = searchParams.get("from");
    const toStr = searchParams.get("to");

    const where: Record<string, unknown> = { businessId: business.id };
    if (status && status !== "all") where.status = status;
    const createdAt: Record<string, Date> = {};
    if (fromStr) {
      const d = new Date(fromStr);
      if (!Number.isNaN(d.getTime())) createdAt.gte = d;
    }
    if (toStr) {
      const d = new Date(toStr);
      if (!Number.isNaN(d.getTime())) createdAt.lte = d;
    }
    if (Object.keys(createdAt).length > 0) where.createdAt = createdAt;

    const orders = await prisma.order.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        items: { select: { name: true, quantity: true, price: true } },
        staff: { select: { name: true } },
      },
      take: 10000,
    });

    const headers = [
      { key: "orderNumber" as const, label: "№ заказа" },
      { key: "createdAt" as const, label: "Дата" },
      { key: "status" as const, label: "Статус" },
      { key: "clientName" as const, label: "Клиент" },
      { key: "clientPhone" as const, label: "Телефон" },
      { key: "clientChannel" as const, label: "Канал" },
      { key: "clientAddress" as const, label: "Адрес доставки" },
      { key: "items" as const, label: "Позиции" },
      { key: "totalPrice" as const, label: "Сумма" },
      { key: "paymentMethod" as const, label: "Способ оплаты" },
      { key: "isPaid" as const, label: "Оплачено" },
      { key: "staffName" as const, label: "Продавец" },
      { key: "clientNotes" as const, label: "Заметки клиента" },
    ];

    const rows = orders.map((o) => ({
      orderNumber: `#${o.orderNumber}`,
      createdAt: csvDate(o.createdAt, true),
      status: o.status,
      clientName: o.clientName,
      clientPhone: o.clientPhone || "",
      clientChannel: o.clientChannel || "",
      clientAddress: o.clientAddress || "",
      // Concatenate items into a single cell: "Товар A x2 (50000); Товар B x1 (30000)"
      items: o.items
        .map((it) => `${it.name} x${it.quantity} (${it.price})`)
        .join("; "),
      totalPrice: o.totalPrice,
      paymentMethod: o.paymentMethod || "",
      isPaid: o.isPaid ? "да" : "нет",
      staffName: o.staff?.name || "",
      clientNotes: o.clientNotes || "",
    }));

    const csv = buildCSV(headers, rows);
    const filename = `orders_${business.name || "staffix"}_${new Date().toISOString().slice(0, 10)}.csv`;

    return new NextResponse(csv, { headers: csvDownloadHeaders(filename) });
  } catch (error) {
    console.error("Orders export error:", error);
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
