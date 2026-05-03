import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/broadcasts/unsubscribe?token=...
//
// Public endpoint linked from email broadcasts. Sets Client.marketingUnsubscribed=true.
// Renders a small confirmation page so the user knows it worked.
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");

  let businessName = "";
  let success = false;

  if (token) {
    try {
      const client = await prisma.client.findUnique({
        where: { unsubscribeToken: token },
        include: { business: { select: { name: true } } },
      });
      if (client) {
        await prisma.client.update({
          where: { id: client.id },
          data: { marketingUnsubscribed: true },
        });
        businessName = client.business.name;
        success = true;
      }
    } catch (e) {
      console.error("Unsubscribe error:", e);
    }
  }

  const html = success
    ? `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Отписка подтверждена</title></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;background:#f4f5f7;margin:0;padding:60px 20px;color:#1a1a2e;text-align:center;">
  <div style="max-width:400px;margin:0 auto;background:#fff;padding:32px;border-radius:12px;border:1px solid #e5e7eb;">
    <h1 style="font-size:20px;margin:0 0 12px;">Отписка подтверждена</h1>
    <p style="color:#4b5563;line-height:1.6;margin:0;">
      Вы больше не будете получать email-рассылки${businessName ? ` от <strong>${businessName.replace(/[<>]/g, "")}</strong>` : ""}.
    </p>
    <p style="color:#9ca3af;font-size:13px;margin:18px 0 0;">Это окно можно закрыть.</p>
  </div>
</body></html>`
    : `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Ссылка недействительна</title></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;background:#f4f5f7;margin:0;padding:60px 20px;color:#1a1a2e;text-align:center;">
  <div style="max-width:400px;margin:0 auto;background:#fff;padding:32px;border-radius:12px;border:1px solid #e5e7eb;">
    <h1 style="font-size:20px;margin:0 0 12px;">Ссылка недействительна</h1>
    <p style="color:#4b5563;">Если вы хотите отписаться — напишите нам на support@staffix.io.</p>
  </div>
</body></html>`;

  return new NextResponse(html, {
    status: success ? 200 : 404,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

// POST — также работает для one-click unsubscribe (Gmail / Apple Mail)
export async function POST(request: NextRequest) {
  return GET(request);
}
