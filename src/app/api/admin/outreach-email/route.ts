/**
 * Admin-only endpoint for sending outreach emails to Tashkent leads.
 * Uses RESEND_API_KEY from Vercel env — key never leaves the server.
 *
 * POST /api/admin/outreach-email
 * Body: { leads: [{email, name, category}], dry_run?: boolean }
 *
 * Or: { action: "send_all" } to send to all leads from hardcoded list
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { isAdmin } from "@/lib/admin";
import { Resend } from "resend";

const FROM_EMAIL = "Антон из Staffix <noreply@staffix.io>";
const REPLY_TO = "director.kbridge@gmail.com";

function getSubject(name: string, category: string): string {
  const cat = category.toLowerCase();
  if (cat.includes("salon") || cat.includes("barber") || cat.includes("beauty") || cat.includes("grooming") || cat.includes("nail") || cat.includes("hair"))
    return `AI-сотрудник для ${name} — отвечает клиентам 24/7`;
  if (cat.includes("dental") || cat.includes("стомат"))
    return "AI-ассистент для стоматологии — запись без администратора";
  if (cat.includes("clinic") || cat.includes("клиник") || cat.includes("cosmetol") || cat.includes("eye"))
    return "AI-сотрудник для клиники — 14 дней бесплатно";
  if (cat.includes("language") || cat.includes("курс") || cat.includes("english"))
    return `AI-ассистент для ${name} — автоматизация записи`;
  if (cat.includes("fitness"))
    return "AI-сотрудник для фитнес-клуба — 14 дней бесплатно";
  return "AI-сотрудник для вашего бизнеса — 14 дней бесплатно";
}

function getHtml(name: string, category: string): string {
  const cat = category.toLowerCase();
  let bizType = "бизнеса";
  let pain = "Клиенты пишут в мессенджеры, а ответить быстро не всегда получается. Каждый час задержки — потерянные деньги.";
  let benefit = "AI-сотрудник Staffix отвечает клиентам за 3 секунды, 24/7, на русском и узбекском языках.";

  if (cat.includes("salon") || cat.includes("barber") || cat.includes("beauty") || cat.includes("grooming") || cat.includes("nail") || cat.includes("hair")) {
    bizType = "салона";
    pain = "Клиенты пишут в WhatsApp и Instagram, а администратор не успевает отвечать. Каждый неотвеченный запрос — потерянная запись.";
    benefit = "AI-сотрудник Staffix отвечает за 3 секунды, записывает к нужному мастеру, проверяет свободное время и отправляет напоминание за 24 часа.";
  } else if (cat.includes("dental") || cat.includes("стомат")) {
    bizType = "стоматологии";
    pain = "Пациенты пишут, звонят, спрашивают о ценах и свободных слотах. Администратор тратит часы на одни и те же ответы.";
    benefit = "AI-сотрудник Staffix мгновенно отвечает на вопросы о ценах и услугах, записывает на приём к конкретному врачу и автоматически напоминает о визите.";
  } else if (cat.includes("clinic") || cat.includes("клиник") || cat.includes("cosmetol") || cat.includes("eye")) {
    bizType = "клиники";
    pain = "Клиенты хотят быстрых ответов. Если ваш администратор отвечает через час — клиент уже записался к конкуренту.";
    benefit = "AI-сотрудник Staffix отвечает мгновенно, консультирует по услугам, записывает на приём и собирает отзывы автоматически.";
  } else if (cat.includes("language") || cat.includes("курс") || cat.includes("english")) {
    bizType = "учебного центра";
    pain = "Родители и студенты пишут вопросы о расписании, ценах и наличии мест. Менеджеры отвечают одно и то же десятки раз в день.";
    benefit = "AI-сотрудник Staffix отвечает на все типовые вопросы, записывает на пробный урок и напоминает о занятиях.";
  } else if (cat.includes("fitness")) {
    bizType = "фитнес-клуба";
    pain = "Клиенты спрашивают о расписании, ценах, абонементах. Менеджеры тратят часы на однотипные ответы.";
    benefit = "AI-сотрудник Staffix мгновенно отвечает на вопросы, записывает на пробное занятие и напоминает о тренировках.";
  }

  return `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; color: #1a1a1a;">
  <p style="font-size: 16px; line-height: 1.6;">Здравствуйте!</p>
  <p style="font-size: 16px; line-height: 1.6;">Меня зовут Антон, я основатель <a href="https://staffix.io" style="color: #2563eb; text-decoration: none; font-weight: 600;">Staffix</a> — платформы AI-сотрудников для ${bizType}.</p>
  <p style="font-size: 16px; line-height: 1.6;">${pain}</p>
  <p style="font-size: 16px; line-height: 1.6;"><strong>${benefit}</strong></p>
  <p style="font-size: 16px; line-height: 1.6;">Сейчас я в Ташкенте и могу <strong>лично приехать к вам, настроить AI-сотрудника за 15 минут и показать как это работает</strong>. Бесплатно, без обязательств.</p>
  <p style="font-size: 16px; line-height: 1.6;">14 дней полного доступа — бесплатно. Если не понравится — просто не платите.</p>
  <div style="margin: 24px 0;">
    <a href="https://t.me/StaffixBot" style="display: inline-block; background: #2563eb; color: white; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px;">Написать в Telegram</a>
    &nbsp;&nbsp;
    <a href="https://staffix.io" style="display: inline-block; background: white; color: #2563eb; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px; border: 2px solid #2563eb;">Попробовать бесплатно</a>
  </div>
  <p style="font-size: 14px; color: #666; line-height: 1.5;">
    С уважением,<br>
    <strong>Антон Мельников</strong><br>
    Основатель Staffix | <a href="https://staffix.io" style="color: #2563eb;">staffix.io</a><br>
    Telegram: <a href="https://t.me/StaffixBot" style="color: #2563eb;">@StaffixBot</a>
  </p>
  <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;">
  <p style="font-size: 12px; color: #999;">Вы получили это письмо, потому что ваш бизнес указан в открытом справочнике Ташкента. Если не хотите получать подобные письма — просто проигнорируйте.</p>
</div>`;
}

// Rate limit: max 2 emails per second (Resend free tier: 100/day, paid: 5000/day)
function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function POST(request: NextRequest) {
  // Auth: admin session OR CRON_SECRET header
  const authHeader = request.headers.get("authorization");
  if (authHeader === `Bearer ${process.env.CRON_SECRET}`) {
    // OK — authenticated via secret
  } else {
    const session = await auth();
    if (!session?.user?.email || !isAdmin(session.user.email)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) {
    return NextResponse.json({ error: "RESEND_API_KEY not configured" }, { status: 500 });
  }

  const resend = new Resend(resendKey);
  const body = await request.json();
  const dryRun = body.dry_run !== false; // Default: dry run
  const leads: Array<{ email: string; name: string; category: string }> = body.leads || [];

  if (!leads.length) {
    return NextResponse.json({ error: "No leads provided. Send { leads: [{email, name, category}] }" }, { status: 400 });
  }

  const results: Array<{ email: string; status: string; error?: string }> = [];
  let sent = 0;
  let failed = 0;

  for (const lead of leads) {
    if (!lead.email || !lead.email.includes("@")) {
      results.push({ email: lead.email || "", status: "skipped", error: "invalid email" });
      continue;
    }

    const subject = getSubject(lead.name || "", lead.category || "");
    const html = getHtml(lead.name || "", lead.category || "");

    if (dryRun) {
      results.push({ email: lead.email, status: "dry_run" });
      sent++;
      continue;
    }

    try {
      const { error } = await resend.emails.send({
        from: FROM_EMAIL,
        to: [lead.email],
        replyTo: REPLY_TO,
        subject,
        html,
      });

      if (error) {
        results.push({ email: lead.email, status: "failed", error: error.message });
        failed++;
      } else {
        results.push({ email: lead.email, status: "sent" });
        sent++;
      }
    } catch (e) {
      results.push({ email: lead.email, status: "failed", error: String(e) });
      failed++;
    }

    // Rate limit: 500ms between emails
    await sleep(500);
  }

  return NextResponse.json({
    dry_run: dryRun,
    total: leads.length,
    sent,
    failed,
    results,
  });
}
