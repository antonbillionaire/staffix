/**
 * POST /api/admin/businesses/[id]/test-notify
 *
 * Отправляет тестовое уведомление владельцу бизнеса в Telegram.
 * Используется админом Staffix чтобы проверить что owner-уведомления реально
 * долетают (например после онбординга нового клиента).
 *
 * Авто-фикс: если у бизнеса ещё не сохранён ownerTelegramChatId, но у одного
 * из Staff с ролью владельца/админа/директора уже есть telegramChatId — берём
 * его и проставляем как ownerTelegramChatId. Это разрешает сценарий когда
 * владелец зашёл в бот ДО фикса owner-detection и его chat_id "застрял" в
 * Staff.telegramChatId без зеркалирования в Business.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/admin";

const OWNER_ROLE_REGEX = /владел|админ|директор|owner|admin|director/i;

export async function POST(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.email || !isAdmin(session.user.email)) {
      return NextResponse.json({ error: "Доступ запрещён" }, { status: 403 });
    }

    const { id: businessId } = await context.params;

    const business = await prisma.business.findUnique({
      where: { id: businessId },
      select: {
        id: true,
        name: true,
        botToken: true,
        ownerTelegramChatId: true,
        ownerTelegramUsername: true,
      },
    });

    if (!business) {
      return NextResponse.json({ error: "Бизнес не найден" }, { status: 404 });
    }
    if (!business.botToken) {
      return NextResponse.json(
        { error: "У бизнеса не подключён Telegram-бот" },
        { status: 400 }
      );
    }

    let chatIdToUse = business.ownerTelegramChatId;
    let autoFixed = false;
    let autoFixSource = "";

    // Авто-фикс если ownerTelegramChatId не установлен
    if (!chatIdToUse) {
      const staffWithChat = await prisma.staff.findMany({
        where: {
          businessId: business.id,
          telegramChatId: { not: null },
        },
        select: { id: true, name: true, role: true, telegramChatId: true },
      });

      // 1) Сначала ищем по роли владельца/админа
      const adminStaff = staffWithChat.find(
        (s) => s.role && OWNER_ROLE_REGEX.test(s.role)
      );
      // 2) Иначе fallback на единственного staff
      const fallbackStaff =
        staffWithChat.length === 1 ? staffWithChat[0] : null;
      const candidate = adminStaff || fallbackStaff;

      if (candidate?.telegramChatId) {
        chatIdToUse = candidate.telegramChatId;
        await prisma.business.update({
          where: { id: business.id },
          data: { ownerTelegramChatId: candidate.telegramChatId },
        });
        autoFixed = true;
        autoFixSource = adminStaff
          ? `Staff.role="${candidate.role}"`
          : "единственный Staff с telegramChatId";
        console.log(
          `[test-notify] auto-fixed ownerTelegramChatId for ${business.id} from ${autoFixSource}`
        );
      }
    }

    if (!chatIdToUse) {
      return NextResponse.json(
        {
          error:
            "Не нашли куда отправлять. Владелец не подключён к боту, и среди Staff нет ни одного с telegramChatId. Попросите владельца сделать /start вашему боту.",
        },
        { status: 400 }
      );
    }

    const text =
      `🧪 Тестовое уведомление от Staffix\n\n` +
      `Это проверка что вы реально получаете уведомления от вашего AI-бота "${business.name}".\n\n` +
      `Если вы видите это — настройка корректна. Эскалации клиентов и срочные запросы будут приходить сюда же.\n\n` +
      `(отправлено админом Staffix через тест-кнопку)`;

    // decrypt() — envelope encryption; passthrough для plaintext
    const { decrypt } = await import("@/lib/crypto");
    const token = decrypt(business.botToken) || business.botToken;
    const tgRes = await fetch(
      `https://api.telegram.org/bot${token}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatIdToUse.toString(),
          text,
        }),
      }
    );

    if (!tgRes.ok) {
      const body = await tgRes.text().catch(() => "");
      console.error(`[test-notify] TG ${tgRes.status}: ${body.slice(0, 300)}`);
      return NextResponse.json(
        {
          delivered: false,
          autoFixed,
          autoFixSource,
          telegramError: `${tgRes.status}: ${body.slice(0, 300)}`,
          chatId: chatIdToUse.toString(),
        },
        { status: 502 }
      );
    }

    return NextResponse.json({
      delivered: true,
      autoFixed,
      autoFixSource,
      chatId: chatIdToUse.toString(),
      message: autoFixed
        ? `Тестовое сообщение отправлено. Дополнительно: автоматически восстановлен ownerTelegramChatId из ${autoFixSource}.`
        : `Тестовое сообщение отправлено владельцу.`,
    });
  } catch (error) {
    console.error("POST /api/admin/businesses/[id]/test-notify:", error);
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
