import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/admin";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.email || !isAdmin(session.user.email)) {
      return NextResponse.json({ error: "Доступ запрещён" }, { status: 403 });
    }

    const { id } = await params;

    const campaign = await prisma.outreachCampaign.findUnique({
      where: { id },
      include: {
        leads: {
          orderBy: [{ status: "asc" }, { createdAt: "asc" }],
        },
      },
    });

    if (!campaign) {
      return NextResponse.json({ error: "Кампания не найдена" }, { status: 404 });
    }

    // Stats
    const stats = {
      total: campaign.leads.length,
      sent: campaign.leads.filter((l) => l.status !== "pending").length,
      replied: campaign.leads.filter((l) =>
        ["replied", "registered", "paying"].includes(l.status)
      ).length,
      registered: campaign.leads.filter((l) =>
        ["registered", "paying"].includes(l.status)
      ).length,
      byChannel: campaign.leads.reduce<Record<string, { total: number; sent: number }>>(
        (acc, l) => {
          if (!acc[l.outreachChannel]) acc[l.outreachChannel] = { total: 0, sent: 0 };
          acc[l.outreachChannel].total++;
          if (l.status !== "pending") acc[l.outreachChannel].sent++;
          return acc;
        },
        {}
      ),
    };

    return NextResponse.json({ campaign, stats });
  } catch (error) {
    console.error("Outreach campaign GET error:", error);
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
