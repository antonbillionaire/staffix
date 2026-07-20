/**
 * Обработка команды /start.
 *
 * /start с параметром:
 *  - /start client_<cuid>  — invite-link из broadcast/CRM, привязывает placeholder
 *    клиента (импортированный с фейковым telegramId) к реальному chat_id. Если у
 *    business уже есть клиент с этим chat_id — placeholder удаляется (merge).
 *  - /start s_<staffId>    — seller link, привязывает клиента к продавцу
 *    (Client.assignedStaffId). Используется в sales-режиме для распределения комиссии.
 *
 * Owner/staff detection (только при наличии username у отправителя):
 *  По 3 сигналам от сильного к слабому:
 *   1. Business.ownerTelegramUsername === senderUsername — явная настройка владельцем
 *   2. Staff.role содержит "владелец/админ/директор/owner/admin/director"
 *   3. Sole-staff fallback: ровно один Staff с username + ownerTelegramChatId не задан
 *
 * Этот fallback автоматически восстанавливает кейс "владелец = единственный мастер,
 * username не настроил" — следующее /start ставит ownerTelegramChatId.
 *
 * Возвращает true если /start полностью обработан (welcome или confirm отправлен) —
 * webhook должен сразу отдать 200. Возвращает false для дальнейшей обработки
 * (теоретически невозможно сейчас, оставлено для будущей расширяемости).
 */

import { prisma } from "@/lib/prisma";
import { sendTelegramMessage } from "./api";

interface StartHandlerParams {
  botToken: string;
  businessId: string;
  chatId: number;
  telegramId: bigint;
  senderUsername: string; // already lowercase, без @
  userMessage: string;
  userName: string;
}

function getDefaultWelcome(name?: string | null, lang?: string | null): string {
  const bizRu = name || "нашу компанию";
  const bizEn = name || "our company";
  const bizUz = name || "kompaniyamiz";
  const bizKz = name || "біздің компания";
  // NOTE: не раскрываем что это AI (feedback-ai-disclosure-positioning).
  // Врать что человек — тоже запрещено. Просто вежливое приветствие
  // с приглашением задать вопрос. Владелец может переписать через
  // Business.welcomeMessage в дашборде.
  if (lang === "en")
    return `Hello! 👋 Welcome to ${bizEn}!\n\nHappy to help with your questions about our services, prices and bookings.\n\nHow can I help you?\n\n💡 /lang — change language`;
  if (lang === "uz")
    return `Salom! 👋 ${bizUz}ga xush kelibsiz!\n\nXizmatlar, narxlar va yozilish bo'yicha savollaringizga javob berishga tayyorman.\n\nQanday yordam bera olaman?\n\n💡 /lang — tilni o'zgartirish`;
  if (lang === "kz")
    return `Сәлеметсіз бе! 👋 ${bizKz}ға қош келдіңіз!\n\nҚызметтер, бағалар және жазылу туралы сұрақтарыңызға жауап беруге дайынмын.\n\nҚалай көмектесе аламын?\n\n💡 /lang — тілді ауыстыру`;
  return `Здравствуйте! 👋 Добро пожаловать в ${bizRu}!\n\nГотов ответить на ваши вопросы об услугах, ценах и помочь с записью.\n\nЧем могу помочь?\n\n💡 /lang — сменить язык`;
}

export async function handleStartCommand(params: StartHandlerParams): Promise<boolean> {
  const { botToken, businessId, chatId, telegramId, senderUsername, userMessage, userName } = params;

  const startParam = userMessage.split(" ")[1] || "";

  // Invite link from broadcast / CRM card: /start client_<cuid>
  if (startParam.startsWith("client_")) {
    const importedClientId = startParam.slice(7);
    try {
      const importedClient = await prisma.client.findFirst({
        where: { id: importedClientId, businessId },
        select: { id: true, telegramId: true, name: true },
      });
      // Sprint 3: telegramId стал nullable. Placeholder-клиент теперь может
      // иметь telegramId=null (импорт CSV без TG) ИЛИ telegramId=0 (legacy).
      // В обоих случаях привязываем к реальному TG chat_id.
      if (importedClient && (importedClient.telegramId === null || importedClient.telegramId <= BigInt(0))) {
        // Если уже есть реальный клиент с этим chat_id — placeholder удаляем (merge).
        // У реального клиента уже могут быть bookings/история, perdere её нельзя.
        const existingReal = await prisma.client.findUnique({
          where: { businessId_telegramId: { businessId, telegramId } },
          select: { id: true },
        });
        if (existingReal && existingReal.id !== importedClient.id) {
          await prisma.client.delete({ where: { id: importedClient.id } });
          console.log(
            `[Webhook] Invite link: dropped placeholder ${importedClient.id} (real client ${existingReal.id} already exists)`
          );
        } else {
          await prisma.client.update({
            where: { id: importedClient.id },
            data: { telegramId, name: importedClient.name || userName },
          });
          console.log(
            `[Webhook] Invite link: linked imported client ${importedClient.id} to chat ${telegramId}`
          );
        }
      }
    } catch (e) {
      console.error("[Webhook] Invite link error:", e);
    }
    // Continue to show welcome message
  }

  if (startParam.startsWith("s_")) {
    const sellerStaffId = startParam.slice(2);
    try {
      await prisma.client.upsert({
        where: { businessId_telegramId: { businessId, telegramId } },
        create: {
          businessId,
          telegramId,
          name: userName,
          assignedStaffId: sellerStaffId,
        },
        update: {
          assignedStaffId: sellerStaffId,
        },
      });
      console.log(`[Webhook] Client ${telegramId} assigned to staff ${sellerStaffId}`);
    } catch (e) {
      console.error("[Webhook] Failed to assign client to staff:", e);
    }
    // Continue to show welcome message
  }

  // С username — может быть owner / staff / обычный клиент
  if (senderUsername) {
    const businessData = await prisma.business.findUnique({
      where: { id: businessId },
      select: {
        ownerTelegramUsername: true,
        ownerTelegramChatId: true,
        name: true,
        welcomeMessage: true,
        language: true,
      },
    });

    const allStaff = await prisma.staff.findMany({
      where: { businessId, telegramUsername: { not: null } },
      select: { id: true, name: true, role: true, telegramUsername: true },
    });
    const matchedStaff = allStaff.find(
      (s) => s.telegramUsername?.toLowerCase().replace("@", "") === senderUsername
    );

    const ownerUsername =
      businessData?.ownerTelegramUsername?.toLowerCase().replace("@", "") || "";
    const explicitOwner = !!ownerUsername && ownerUsername === senderUsername;

    const ownerRoleRegex = /владел|админ|директор|owner|admin|director/i;
    const staffHasOwnerRole = !!matchedStaff?.role && ownerRoleRegex.test(matchedStaff.role);

    // Sole-staff fallback — ровно один Staff с username + ownerTelegramChatId не задан
    const totalStaffCount = await prisma.staff.count({ where: { businessId } });
    const ownerNotYetSet = !businessData?.ownerTelegramChatId;
    const soleStaffFallback = !!matchedStaff && totalStaffCount === 1 && ownerNotYetSet;

    const isOwner = explicitOwner || staffHasOwnerRole || soleStaffFallback;

    if (matchedStaff) {
      await prisma.staff.update({
        where: { id: matchedStaff.id },
        data: { telegramChatId: BigInt(chatId) },
      });
    }
    if (isOwner) {
      await prisma.business.update({
        where: { id: businessId },
        data: { ownerTelegramChatId: BigInt(chatId) },
      });
      console.log(
        `[Webhook] Owner connected business=${businessId} via ${
          explicitOwner ? "explicit username" : staffHasOwnerRole ? "staff role" : "sole-staff fallback"
        }`
      );
    }

    if (matchedStaff || isOwner) {
      let confirmText: string;
      if (matchedStaff && isOwner) {
        confirmText = `✅ ${matchedStaff.name}, вы подключены как администратор и как мастер.\n\nВсе уведомления о записях, эскалациях и срочных запросах от клиентов будут приходить сюда.`;
      } else if (isOwner) {
        confirmText = `✅ Вы подключены как администратор!\n\nВсе уведомления о записях, отменах и новых клиентах будут приходить сюда.`;
      } else {
        confirmText = `✅ ${matchedStaff!.name}, вы подключены к уведомлениям!\n\nТеперь вы будете получать новые записи клиентов сюда.`;
      }
      await sendTelegramMessage(botToken, chatId, confirmText);
      return true;
    }

    // Обычный клиент с username — показываем приветствие
    const welcomeMsg =
      businessData?.welcomeMessage ||
      getDefaultWelcome(businessData?.name, businessData?.language);

    await sendTelegramMessage(botToken, chatId, welcomeMsg);
    return true;
  }

  // Нет username — обычный клиент
  const businessData = await prisma.business.findUnique({
    where: { id: businessId },
    select: { welcomeMessage: true, name: true, language: true },
  });

  const welcomeMsg =
    businessData?.welcomeMessage ||
    getDefaultWelcome(businessData?.name, businessData?.language);

  await sendTelegramMessage(botToken, chatId, welcomeMsg);
  return true;
}
