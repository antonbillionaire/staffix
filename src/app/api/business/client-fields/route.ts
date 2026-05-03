import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

// Custom fields config — определения полей карточки клиента.
// Хранятся как JSON-массив на Business.clientFieldsConfig.

const VALID_TYPES = ["text", "number", "date", "select"] as const;
type FieldType = (typeof VALID_TYPES)[number];

interface FieldDef {
  key: string;
  label: string;
  type: FieldType;
  options?: string[]; // для type=select
}

const MAX_FIELDS = 20;

function validateFields(input: unknown): { ok: true; fields: FieldDef[] } | { ok: false; error: string } {
  if (!Array.isArray(input)) return { ok: false, error: "Поля должны быть массивом" };
  if (input.length > MAX_FIELDS) return { ok: false, error: `Максимум ${MAX_FIELDS} полей` };

  const seenKeys = new Set<string>();
  const out: FieldDef[] = [];
  for (const f of input as Array<Record<string, unknown>>) {
    if (!f || typeof f !== "object") return { ok: false, error: "Каждое поле — объект с key/label/type" };
    const key = typeof f.key === "string" ? f.key.trim() : "";
    const label = typeof f.label === "string" ? f.label.trim() : "";
    const type = f.type as FieldType;
    if (!key || !/^[a-zA-Z0-9_]{1,40}$/.test(key)) {
      return { ok: false, error: `Ключ "${key}" должен быть латиницей/цифрами/подчёркиванием, до 40 символов` };
    }
    if (seenKeys.has(key)) return { ok: false, error: `Ключ "${key}" дублируется` };
    seenKeys.add(key);
    if (!label || label.length > 100) {
      return { ok: false, error: `Название поля обязательно, до 100 символов` };
    }
    if (!(VALID_TYPES as readonly string[]).includes(type)) {
      return { ok: false, error: `Тип поля "${type}" недопустим. Допустимо: ${VALID_TYPES.join(", ")}` };
    }
    let options: string[] | undefined;
    if (type === "select") {
      if (!Array.isArray(f.options) || f.options.length === 0) {
        return { ok: false, error: `Для поля "${label}" типа "выбор из списка" нужны варианты` };
      }
      options = f.options
        .map((o) => (typeof o === "string" ? o.trim() : ""))
        .filter((o): o is string => Boolean(o))
        .slice(0, 50);
      if (options.length === 0) {
        return { ok: false, error: `Поле "${label}": список вариантов пустой` };
      }
    }
    out.push({ key, label, type, ...(options ? { options } : {}) });
  }
  return { ok: true, fields: out };
}

// GET — текущая конфигурация полей (для UI настроек и для рендера карточки клиента)
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
    }

    const business = await prisma.business.findFirst({
      where: { userId: session.user.id },
      select: { clientFieldsConfig: true },
    });
    if (!business) {
      return NextResponse.json({ error: "Бизнес не найден" }, { status: 404 });
    }

    return NextResponse.json({
      fields: Array.isArray(business.clientFieldsConfig) ? business.clientFieldsConfig : [],
    });
  } catch (error) {
    console.error("Client-fields GET error:", error);
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}

// PUT — заменить конфигурацию полей целиком. Удалённые поля не очищают
// данные у клиентов — значения остаются в Client.customFields, просто
// перестают отображаться. Восстановить можно вернув определение.
export async function PUT(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
    }

    const business = await prisma.business.findFirst({
      where: { userId: session.user.id },
      select: { id: true },
    });
    if (!business) {
      return NextResponse.json({ error: "Бизнес не найден" }, { status: 404 });
    }

    const body = await request.json().catch(() => ({}));
    const result = validateFields(body.fields);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    await prisma.business.update({
      where: { id: business.id },
      // Prisma JSON-column types — cast through unknown so TS doesn't try to
      // map FieldDef[] into a generic JsonObject.
      data: { clientFieldsConfig: result.fields as unknown as object },
    });

    return NextResponse.json({ fields: result.fields });
  } catch (error) {
    console.error("Client-fields PUT error:", error);
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
