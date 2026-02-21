import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/admin";

// GET — list all campaigns
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.email || !isAdmin(session.user.email)) {
      return NextResponse.json({ error: "Доступ запрещён" }, { status: 403 });
    }

    const campaigns = await prisma.outreachCampaign.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        _count: { select: { leads: true } },
        leads: {
          select: { status: true, outreachChannel: true },
        },
      },
    });

    const result = campaigns.map((c) => {
      const total = c._count.leads;
      const sent = c.leads.filter((l) => l.status !== "pending").length;
      const replied = c.leads.filter((l) =>
        ["replied", "registered", "paying"].includes(l.status)
      ).length;
      const registered = c.leads.filter((l) =>
        ["registered", "paying"].includes(l.status)
      ).length;
      const byChannel = c.leads.reduce<Record<string, number>>((acc, l) => {
        acc[l.outreachChannel] = (acc[l.outreachChannel] || 0) + 1;
        return acc;
      }, {});

      return {
        id: c.id,
        name: c.name,
        description: c.description,
        status: c.status,
        createdAt: c.createdAt,
        stats: { total, sent, replied, registered, byChannel },
      };
    });

    return NextResponse.json({ campaigns: result });
  } catch (error) {
    console.error("Outreach campaigns GET error:", error);
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}

// POST — create campaign + import leads from CSV rows
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email || !isAdmin(session.user.email)) {
      return NextResponse.json({ error: "Доступ запрещён" }, { status: 403 });
    }

    const body = await request.json();
    const { name, description, leads } = body;

    if (!name) {
      return NextResponse.json({ error: "Название обязательно" }, { status: 400 });
    }

    // leads = array of { businessName, category, city, website, email, telegram, instagram, whatsapp }
    // Determine outreach channel priority: email > telegram > instagram
    const processedLeads = (leads || []).map(
      (row: {
        businessName: string;
        category?: string;
        city?: string;
        website?: string;
        email?: string;
        telegram?: string;
        instagram?: string;
        whatsapp?: string;
      }) => {
        let channel = "instagram";
        if (row.email) channel = "email";
        else if (row.telegram) channel = "telegram";

        return {
          businessName: row.businessName || "",
          category: row.category || null,
          city: row.city || null,
          website: row.website || null,
          email: row.email || null,
          telegram: row.telegram || null,
          instagram: row.instagram || null,
          whatsapp: row.whatsapp || null,
          outreachChannel: channel,
          status: "pending",
        };
      }
    ).filter((l: { businessName: string }) => l.businessName);

    const campaign = await prisma.outreachCampaign.create({
      data: {
        name,
        description: description || null,
        leads: {
          createMany: { data: processedLeads },
        },
      },
      include: { _count: { select: { leads: true } } },
    });

    return NextResponse.json({ campaign });
  } catch (error) {
    console.error("Outreach campaign POST error:", error);
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
