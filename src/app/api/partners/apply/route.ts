import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const ADMIN_TELEGRAM_CHAT_ID = process.env.ADMIN_TELEGRAM_CHAT_ID;
const STAFFIX_BOT_TOKEN = process.env.STAFFIX_BOT_TOKEN;

async function notifyAdmin(partner: {
  name: string;
  email: string;
  phone?: string | null;
  company?: string | null;
  website?: string | null;
  description?: string | null;
}) {
  if (!ADMIN_TELEGRAM_CHAT_ID || !STAFFIX_BOT_TOKEN) return;

  const text = `🤝 *Новая заявка на партнёрство!*

👤 *Имя:* ${partner.name}
📧 *Email:* ${partner.email}
📱 *Телефон:* ${partner.phone || "—"}
🏢 *Компания:* ${partner.company || "—"}
🌐 *Сайт:* ${partner.website || "—"}

💬 *Как планирует продвигать:*
${partner.description}

👉 Одобрить: https://staffix.io/admin (раздел Партнёры)`;

  try {
    await fetch(`https://api.telegram.org/bot${STAFFIX_BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: ADMIN_TELEGRAM_CHAT_ID,
        text,
        parse_mode: "Markdown",
      }),
    });
  } catch (e) {
    console.error("Failed to notify admin about partner application:", e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const { name, email, phone, company, website, description } = await req.json();

    if (!name || !email || !description) {
      return NextResponse.json(
        { error: "Заполните обязательные поля: имя, email, описание" },
        { status: 400 }
      );
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: "Некорректный email" }, { status: 400 });
    }

    // Check for duplicate
    const existing = await prisma.partner.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json(
        { error: "Заявка с этим email уже существует. Мы скоро свяжемся с вами." },
        { status: 409 }
      );
    }

    const partner = await prisma.partner.create({
      data: {
        name: name.trim(),
        email: email.toLowerCase().trim(),
        phone: phone?.trim() || null,
        company: company?.trim() || null,
        website: website?.trim() || null,
        description: description.trim(),
        status: "pending",
      },
    });

    // Notify admin in background (don't await to speed up response)
    notifyAdmin(partner).catch(console.error);

    return NextResponse.json({ success: true, id: partner.id });
  } catch (e) {
    console.error("Partner apply error:", e);
    return NextResponse.json({ error: "Внутренняя ошибка сервера" }, { status: 500 });
  }
}
