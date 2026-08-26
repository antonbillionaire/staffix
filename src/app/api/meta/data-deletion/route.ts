import { NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import {
  parseSignedRequest,
  processMetaDataDeletion,
  isDeletionStatsEmpty,
} from "@/lib/meta-data-deletion";

/**
 * Meta Data Deletion Callback.
 * Meta sends a signed request when a user removes your app.
 * We must delete their data and return a confirmation URL + code.
 *
 * Docs: https://developers.facebook.com/docs/development/create-an-app/app-dashboard/data-deletion-callback/
 *
 * Обрабатываем ОБА сценария — они не взаимоисключающие:
 *
 * 1. Owner-branch: `user_id` = Meta ID владельца бизнеса на нашей платформе
 *    (тот, кто в дашборде подключал FB Page / IG Business Account через
 *    Meta OAuth). Чистим соединения бизнеса и разговоры Meta-каналов. Это
 *    старая логика — оставлена как есть.
 *
 * 2. End-user branch (добавлено 26 августа 2026 после письма Meta про
 *    непокрытые запросы): `user_id` = ASID (App-Scoped ID) конечного
 *    клиента — человека, который писал в IG DM / FB Messenger в бота
 *    одного из наших бизнесов. Резолвим ASID через Graph API в PSID/IGSID,
 *    удаляем 6 таблиц (Client, ChannelClient, ChannelConversation,
 *    ChannelMessage, Lead, SalesLead) + обфусцируем Order + очищаем Task.
 *
 * Оба пути запускаются один за другим — они идемпотентные и работают
 * с разными данными, конфликта нет. Если оба возвращают пустой результат
 * (ни владельца, ни end-user'а не нашли) — всё равно отвечаем Мете
 * успехом с confirmation_code (см. FAQ: «если ID нет в базе, можете
 * игнорировать» — но ответ endpoint'а всё равно обязан быть валидным).
 */

const META_APP_ID = "1875270986685772";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const signedRequest = formData.get("signed_request") as string;

    if (!signedRequest) {
      return NextResponse.json({ error: "Missing signed_request" }, { status: 400 });
    }

    const appSecret = process.env.META_APP_SECRET;
    if (!appSecret) {
      console.error("[Meta Data Deletion] META_APP_SECRET not configured");
      return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
    }

    const parsed = parseSignedRequest(signedRequest, appSecret);
    if (!parsed) {
      return NextResponse.json({ error: "Invalid signed_request" }, { status: 400 });
    }

    const userId = parsed.user_id;
    console.log(`[Meta Data Deletion] Request for Meta user_id: ${userId}`);

    const confirmationCode = crypto.randomUUID();

    // ── 1. Owner-branch ────────────────────────────────────────────────
    // Владелец бизнеса удалил Staffix из своих Meta apps. Чистим соединения
    // и разговоры Meta-каналов у всех его бизнесов.
    const ownerStats = await deleteOwnerMetaConnections(userId);

    // ── 2. End-user branch (26 августа 2026) ──────────────────────────
    // Конечный клиент (writing to some business's bot via IG/FB) запросил
    // удаление. Резолвим ASID → PSID/IGSID через Graph API, чистим данные.
    let endUserStats;
    try {
      endUserStats = await processMetaDataDeletion(userId, META_APP_ID, appSecret);
    } catch (e) {
      console.error("[Meta Data Deletion] end-user branch failed:", e);
      endUserStats = { pageScopedIds: [], stats: null };
    }

    console.log(
      `[Meta Data Deletion] Completed. code=${confirmationCode}` +
        ` owner_businesses_cleared=${ownerStats.businessesCleared}` +
        ` resolved_page_scoped_ids=${endUserStats.pageScopedIds.length}` +
        ` end_user_stats=${JSON.stringify(endUserStats.stats)}`
    );

    // Если ничего не нашли ни в owner, ни в end-user ветке — по FAQ Meta
    // это ок (ID не в нашей БД), но всё равно должны вернуть валидный ответ.
    if (
      ownerStats.businessesCleared === 0 &&
      endUserStats.stats &&
      isDeletionStatsEmpty(endUserStats.stats)
    ) {
      console.log(`[Meta Data Deletion] No matching data found for user_id ${userId} — ack anyway`);
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://staffix.io";
    return NextResponse.json({
      url: `${appUrl}/meta/deletion-status?code=${confirmationCode}`,
      confirmation_code: confirmationCode,
    });
  } catch (error) {
    console.error("[Meta Data Deletion] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * Owner-branch: чистит Meta-соединения у бизнесов, привязанных к этому
 * Meta user ID через OAuth (Business.metaUserId). Это старая логика,
 * извлечена в отдельную функцию для читаемости.
 *
 * ChannelClient чистим ТОЛЬКО когда `lastChannel` = Meta-канал — это грубее
 * чем end-user branch (может задеть клиента, чей последний контакт был через
 * IG, но реально идентичность в TG). Оставлено потому что это owner-flow —
 * владелец удалил соединение целиком, у нас нет обязательства сохранять
 * клиентов от которых пропал канал.
 */
async function deleteOwnerMetaConnections(
  metaUserId: string
): Promise<{ businessesCleared: number }> {
  const businesses = await prisma.business.findMany({
    where: { metaUserId },
    select: { id: true, name: true },
  });

  const META_CHANNELS = ["facebook", "instagram", "messenger"] as const;

  for (const biz of businesses) {
    await prisma.channelConversation.deleteMany({
      where: {
        businessId: biz.id,
        channel: { in: META_CHANNELS as unknown as string[] },
      },
    });
    await prisma.channelMessage.deleteMany({
      where: {
        businessId: biz.id,
        channel: { in: META_CHANNELS as unknown as string[] },
      },
    });
    await prisma.channelClient.deleteMany({
      where: {
        businessId: biz.id,
        lastChannel: { in: META_CHANNELS as unknown as string[] },
      },
    });
    await prisma.lead.deleteMany({
      where: {
        businessId: biz.id,
        channel: { in: META_CHANNELS as unknown as string[] },
      },
    });
    await prisma.channelConnection.deleteMany({
      where: {
        businessId: biz.id,
        channel: { in: META_CHANNELS as unknown as string[] },
      },
    });
    await prisma.business.update({
      where: { id: biz.id },
      data: {
        fbPageId: null,
        fbPageAccessToken: null,
        fbActive: false,
        igBusinessAccountId: null,
        igUsername: null,
        igActive: false,
        metaUserId: null,
        metaUserAccessToken: null,
        metaTokenExpiresAt: null,
      },
    });
    console.log(
      `[Meta Data Deletion] Cleared Meta owner data for business ${biz.id} (${biz.name})`
    );
  }

  return { businessesCleared: businesses.length };
}
