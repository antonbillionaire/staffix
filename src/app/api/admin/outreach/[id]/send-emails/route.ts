import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/admin";
import { sendOutreachEmail } from "@/lib/email";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.email || !isAdmin(session.user.email)) {
      return NextResponse.json({ error: "Доступ запрещён" }, { status: 403 });
    }

    const { id } = await params;

    // Get pending email leads
    const leads = await prisma.outreachLead.findMany({
      where: {
        campaignId: id,
        outreachChannel: "email",
        status: "pending",
        email: { not: null },
      },
    });

    if (leads.length === 0) {
      return NextResponse.json({ sent: 0, message: "Нет ожидающих email-лидов" });
    }

    let sent = 0;
    let failed = 0;

    // Send in batches of 5 with delay
    const BATCH = 5;
    for (let i = 0; i < leads.length; i += BATCH) {
      const batch = leads.slice(i, i + BATCH);

      await Promise.all(
        batch.map(async (lead) => {
          try {
            const result = await sendOutreachEmail(lead.email!, lead.businessName);
            if (result.success) {
              sent++;
              await prisma.outreachLead.update({
                where: { id: lead.id },
                data: { status: "sent", sentAt: new Date() },
              });
            } else {
              failed++;
              await prisma.outreachLead.update({
                where: { id: lead.id },
                data: { notes: `Ошибка: ${result.error}` },
              });
            }
          } catch {
            failed++;
          }
        })
      );

      // Delay between batches to respect Resend rate limits
      if (i + BATCH < leads.length) {
        await new Promise((r) => setTimeout(r, 500));
      }
    }

    return NextResponse.json({
      sent,
      failed,
      total: leads.length,
      message: `Отправлено ${sent} из ${leads.length} писем`,
    });
  } catch (error) {
    console.error("Outreach send-emails error:", error);
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
