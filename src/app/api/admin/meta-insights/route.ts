import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/admin";

/**
 * GET /api/admin/meta-insights        — список (по умолчанию status=new)
 * GET /api/admin/meta-insights?run=1  — синхронный прогон детекторов на лету
 *                                       (полезно для тестирования без ожидания cron)
 *
 * PATCH — { id, action: "resolve" | "dismiss", notes? }
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email || !isAdmin(session.user.email)) {
      return NextResponse.json({ error: "Доступ запрещён" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);

    if (searchParams.get("run") === "1") {
      const { generateMetaInsights } = await import("@/lib/meta-insights-generator");
      const result = await generateMetaInsights();
      return NextResponse.json({ run: true, ...result });
    }

    const status = searchParams.get("status") || "new";
    const where: { status?: string } = {};
    if (status !== "all") where.status = status;

    const [insights, counts] = await Promise.all([
      prisma.metaInsight.findMany({
        where,
        include: {
          business: { select: { id: true, name: true, country: true, dashboardMode: true } },
        },
        orderBy: [{ severity: "desc" }, { createdAt: "desc" }],
        take: 200,
      }),
      prisma.metaInsight.groupBy({
        by: ["status"],
        _count: true,
      }),
    ]);

    const countsMap = counts.reduce(
      (acc, c) => ({ ...acc, [c.status]: c._count }),
      {} as Record<string, number>
    );

    return NextResponse.json({
      insights,
      counts: {
        new: countsMap.new || 0,
        resolved: countsMap.resolved || 0,
        dismissed: countsMap.dismissed || 0,
      },
    });
  } catch (error) {
    console.error("GET /api/admin/meta-insights:", error);
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email || !isAdmin(session.user.email)) {
      return NextResponse.json({ error: "Доступ запрещён" }, { status: 403 });
    }

    const { id, action, notes } = (await request.json()) as {
      id?: string;
      action?: "resolve" | "dismiss";
      notes?: string;
    };

    if (!id || !action) {
      return NextResponse.json({ error: "id и action обязательны" }, { status: 400 });
    }

    const status = action === "resolve" ? "resolved" : "dismissed";
    const insight = await prisma.metaInsight.update({
      where: { id },
      data: {
        status,
        resolvedAt: action === "resolve" ? new Date() : null,
        resolvedBy: session.user.email,
        notes: notes ?? null,
      },
    });

    return NextResponse.json({ insight });
  } catch (error) {
    console.error("PATCH /api/admin/meta-insights:", error);
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
