/**
 * GET /api/admin/businesses/[id]/diagnostic
 *
 * Полный дамп текущего состояния бизнеса для отладки уведомлений.
 * Возвращает в одном JSON всё что нужно понять, почему/работает/нет
 * notify_manager и связанные потоки.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/admin";
import { botPromisedHandoff } from "@/lib/handoff-detector";

const HOURS_24 = 24 * 60 * 60 * 1000;
const HOURS_72 = 72 * 60 * 60 * 1000;

function maskToken(token: string | null): string {
  if (!token) return "(не настроен)";
  if (token.length < 12) return "***";
  return `${token.slice(0, 6)}…${token.slice(-4)}`;
}

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.email || !isAdmin(session.user.email)) {
      return NextResponse.json({ error: "Доступ запрещён" }, { status: 403 });
    }

    const { id: businessId } = await context.params;

    // ─── 1) Бизнес и его настройки ─────────────────────────────────────────
    const business = await prisma.business.findUnique({
      where: { id: businessId },
      select: {
        id: true,
        name: true,
        businessType: true,
        dashboardMode: true,
        country: true,
        language: true,
        botToken: true,
        botUsername: true,
        botActive: true,
        ownerTelegramUsername: true,
        ownerTelegramChatId: true,
        createdAt: true,
        user: { select: { email: true, name: true } },
      },
    });

    if (!business) {
      return NextResponse.json({ error: "Бизнес не найден" }, { status: 404 });
    }

    // ─── 2) Staff список с TG-данными ───────────────────────────────────────
    const staff = await prisma.staff.findMany({
      where: { businessId },
      select: {
        id: true,
        name: true,
        role: true,
        telegramUsername: true,
        telegramChatId: true,
      },
    });

    // ─── 3) Подписка ────────────────────────────────────────────────────────
    const subscription = await prisma.subscription.findUnique({
      where: { businessId },
      select: {
        plan: true,
        status: true,
        messagesUsed: true,
        messagesLimit: true,
        expiresAt: true,
      },
    });

    // ─── 4) Все Notification за 72ч (видим был ли вообще any insert) ───────
    const sinceNotif = new Date(Date.now() - HOURS_72);
    const allNotifications = await prisma.notification.findMany({
      where: { businessId, createdAt: { gte: sinceNotif } },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        type: true,
        title: true,
        message: true,
        isRead: true,
        createdAt: true,
        metadata: true,
      },
    });
    const escalations = allNotifications.filter((n) => n.type === "manager_escalation");

    // ─── 5) Последние диалоги и сообщения (флагируем те где бот обещал) ────
    const since24 = new Date(Date.now() - HOURS_24);
    const recentConversations = await prisma.conversation.findMany({
      where: { businessId, updatedAt: { gte: since24 } },
      orderBy: { updatedAt: "desc" },
      take: 5,
      select: {
        id: true,
        clientName: true,
        clientTelegramId: true,
        messageCount: true,
        outcome: true,
        updatedAt: true,
        messages: {
          orderBy: { createdAt: "desc" },
          take: 8,
          select: { id: true, role: true, content: true, createdAt: true },
        },
      },
    });

    // Считаем сколько раз бот обещал и сравниваем с количеством manager_escalation
    let botPromisedCount = 0;
    const promiseDetails: Array<{
      conversationId: string;
      clientName: string | null;
      messageId: string;
      createdAt: Date;
      preview: string;
    }> = [];
    for (const conv of recentConversations) {
      for (const msg of conv.messages) {
        if (msg.role === "assistant" && botPromisedHandoff(msg.content)) {
          botPromisedCount++;
          promiseDetails.push({
            conversationId: conv.id,
            clientName: conv.clientName,
            messageId: msg.id,
            createdAt: msg.createdAt,
            preview: msg.content.slice(0, 200),
          });
        }
      }
    }

    // ─── 6) Probe Telegram API: getMe + chat info по ownerTelegramChatId ────
    type TgProbe = {
      botMe: { ok: boolean; result?: { id?: number; username?: string }; error?: string };
      ownerChat: {
        ok: boolean;
        result?: { id?: number; first_name?: string; last_name?: string; username?: string; type?: string };
        error?: string;
      } | null;
    };
    const tgProbe: TgProbe = { botMe: { ok: false }, ownerChat: null };

    if (business.botToken) {
      // decrypt() — envelope encryption; passthrough для plaintext
      const { decrypt } = await import("@/lib/crypto");
      const token = decrypt(business.botToken) || business.botToken;
      try {
        const meRes = await fetch(`https://api.telegram.org/bot${token}/getMe`);
        const meBody = await meRes.json().catch(() => ({}));
        tgProbe.botMe = meRes.ok
          ? { ok: true, result: meBody.result }
          : { ok: false, error: `HTTP ${meRes.status}: ${JSON.stringify(meBody).slice(0, 300)}` };
      } catch (e) {
        tgProbe.botMe = { ok: false, error: e instanceof Error ? e.message : String(e) };
      }

      if (business.ownerTelegramChatId) {
        try {
          const chatRes = await fetch(
            `https://api.telegram.org/bot${token}/getChat?chat_id=${business.ownerTelegramChatId}`
          );
          const chatBody = await chatRes.json().catch(() => ({}));
          tgProbe.ownerChat = chatRes.ok
            ? { ok: true, result: chatBody.result }
            : { ok: false, error: `HTTP ${chatRes.status}: ${JSON.stringify(chatBody).slice(0, 300)}` };
        } catch (e) {
          tgProbe.ownerChat = { ok: false, error: e instanceof Error ? e.message : String(e) };
        }
      }
    }

    // ─── 7) Финальная диагностика-вердикт ───────────────────────────────────
    const verdicts: string[] = [];

    if (!business.botToken) verdicts.push("❌ botToken не настроен у бизнеса");
    if (!business.botActive) verdicts.push("⚠️ botActive=false — бот выключен");
    if (!business.ownerTelegramChatId) verdicts.push("❌ ownerTelegramChatId не установлен");
    if (!business.ownerTelegramUsername) verdicts.push("ℹ️ ownerTelegramUsername пуст (это ОК если ставили chatId через Staff fallback)");
    if (subscription && subscription.status !== "active") verdicts.push(`⚠️ Подписка не активна: status=${subscription.status}`);
    if (subscription && subscription.messagesLimit > 0 && subscription.messagesUsed >= subscription.messagesLimit) {
      verdicts.push(`❌ Лимит сообщений исчерпан: ${subscription.messagesUsed}/${subscription.messagesLimit}`);
    }

    if (tgProbe.botMe && !tgProbe.botMe.ok) verdicts.push(`❌ Telegram getMe FAILED: ${tgProbe.botMe.error}`);
    if (tgProbe.ownerChat && !tgProbe.ownerChat.ok)
      verdicts.push(`❌ Telegram getChat для owner FAILED: ${tgProbe.ownerChat.error} — это значит бот НЕ может писать на этот chat_id`);

    if (botPromisedCount > escalations.length) {
      verdicts.push(
        `🔴 РАСХОЖДЕНИЕ: бот обещал передать менеджеру ${botPromisedCount} раз за 24ч, но Notification(manager_escalation) создано только ${escalations.length}. Значит ни tool, ни safety-net не сработали. Проверить что safety-net регекс матчит фразы (см. promiseDetails ниже).`
      );
    } else if (botPromisedCount === 0 && escalations.length === 0) {
      verdicts.push(
        "ℹ️ За 24ч бот ни разу не обещал передачу менеджеру в видимых диалогах. Возможно тесты были раньше окна или проблема не в этом."
      );
    } else if (escalations.length > 0 && tgProbe.ownerChat?.ok) {
      verdicts.push(
        `✅ Notification создавались (${escalations.length} штук) и chat_id владельца валидный. Если владелец не получил — возможно блокировка бота, или приходили beзtекста, или owner смотрит не туда.`
      );
    }

    return NextResponse.json({
      generatedAt: new Date().toISOString(),
      business: {
        ...business,
        botToken: maskToken(business.botToken),
        ownerTelegramChatId: business.ownerTelegramChatId?.toString() ?? null,
      },
      staff: staff.map((s) => ({
        ...s,
        telegramChatId: s.telegramChatId?.toString() ?? null,
      })),
      subscription,
      stats_24h: {
        notifications_total: allNotifications.length,
        manager_escalations: escalations.length,
        bot_promised_handoff_count: botPromisedCount,
        recent_conversations: recentConversations.length,
      },
      escalations_72h: escalations.map((n) => ({
        ...n,
        createdAt: n.createdAt.toISOString(),
      })),
      promiseDetails,
      recent_conversations: recentConversations.map((c) => ({
        id: c.id,
        clientName: c.clientName,
        messageCount: c.messageCount,
        outcome: c.outcome,
        updatedAt: c.updatedAt.toISOString(),
        last_messages_preview: c.messages
          .reverse()
          .map((m) => ({
            role: m.role,
            createdAt: m.createdAt.toISOString(),
            content: m.content.slice(0, 250),
          })),
      })),
      telegram_probe: tgProbe,
      verdicts,
    });
  } catch (error) {
    console.error("GET /api/admin/businesses/[id]/diagnostic:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Ошибка сервера" },
      { status: 500 }
    );
  }
}
