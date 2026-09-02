/**
 * GET /api/auth/meta/pages?businessId=XXX
 * Returns Facebook Pages the user manages (for page selection UI).
 * Tokens are read server-side and never exposed to the client.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { getUserPages } from "@/lib/meta-oauth";
import { decrypt } from "@/lib/crypto";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const businessId = searchParams.get("businessId");

  if (!businessId) {
    return NextResponse.json({ error: "Missing businessId" }, { status: 400 });
  }

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const business = await prisma.business.findFirst({
    where: { id: businessId, userId: session.user.id },
    select: { metaUserAccessToken: true },
  });

  if (!business?.metaUserAccessToken) {
    return NextResponse.json(
      { error: "No Meta token found. Please reconnect." },
      { status: 404 }
    );
  }

  try {
    // Токен в БД зашифрован (envelope AES-256-GCM формата v1:iv:ct:tag).
    // decrypt() расшифровывает, для старых plaintext-записей passthrough.
    // Пропуск decrypt здесь (регрессия июля 2026 при roll-out шифрования)
    // проявлялся у пользователей с ≥2 FB-страницами: Meta возвращала
    // «Invalid OAuth access token - Cannot parse access token» когда мы
    // передавали `v1:...` вместо реального токена. Одностраничные проходили,
    // потому что select-page/route.ts правильно расшифровывал (ветка callback
    // с одной страницей вообще не идёт через этот endpoint).
    const decryptedToken = decrypt(business.metaUserAccessToken);
    if (!decryptedToken) {
      return NextResponse.json(
        { error: "Meta token empty. Please reconnect." },
        { status: 404 }
      );
    }

    const pages = await getUserPages(decryptedToken);

    // Return only safe fields — no tokens
    const safePages = pages.map((p) => ({
      id: p.id,
      name: p.name,
      instagramAccount: p.instagram_business_account
        ? {
            id: p.instagram_business_account.id,
            username: p.instagram_business_account.username || null,
          }
        : null,
    }));

    return NextResponse.json({ pages: safePages });
  } catch (err) {
    // Sanitize: раньше raw Meta error message летел в UI (нарушение
    // CLAUDE.md «не раскрывать детали инфраструктуры»). Ekaterina Yun
    // видела «Invalid OAuth access token - Cannot parse access token» —
    // технически правдиво, но пользователю бесполезно и раскрывает
    // внутрянку. Оригинал остаётся в бэкенд-логах для диагностики.
    console.error("[Meta OAuth] GET /api/auth/meta/pages failed:", err);
    return NextResponse.json(
      {
        error:
          "Не удалось получить список Facebook-страниц. Попробуйте переподключить Facebook в настройках.",
      },
      { status: 500 }
    );
  }
}
