import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

async function getUserBusiness(request: NextRequest): Promise<string | null> {
  const session = await auth();
  let userId: string | null = null;

  if (session?.user?.email) {
    const user = await prisma.user.findUnique({ where: { email: session.user.email } });
    userId = user?.id || null;
  }

  if (!userId) {
    const cookieStore = await cookies();
    userId = cookieStore.get("userId")?.value || null;
  }

  if (!userId) return null;

  const business = await prisma.business.findFirst({
    where: { userId },
    select: { id: true },
  });
  return business?.id || null;
}

// GET /api/products — список товаров
export async function GET(request: NextRequest) {
  try {
    const businessId = await getUserBusiness(request);
    if (!businessId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category");
    const onlyActive = searchParams.get("active") !== "false";

    const products = await prisma.product.findMany({
      where: {
        businessId,
        isActive: onlyActive ? true : undefined,
        category: category || undefined,
      },
      orderBy: [{ category: "asc" }, { name: "asc" }],
    });

    return NextResponse.json({ products });
  } catch (error) {
    console.error("GET /api/products:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// POST /api/products — создать товар
export async function POST(request: NextRequest) {
  try {
    const businessId = await getUserBusiness(request);
    if (!businessId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const { name, description, price, oldPrice, stock, sku, category, tags, imageUrl } = body;

    if (!name || price === undefined) {
      return NextResponse.json({ error: "name и price обязательны" }, { status: 400 });
    }

    if (typeof price !== "number" || price < 0) {
      return NextResponse.json({ error: "price должен быть положительным числом" }, { status: 400 });
    }

    const product = await prisma.product.create({
      data: {
        businessId,
        name,
        description: description || null,
        price: Math.round(price),
        oldPrice: oldPrice ? Math.round(oldPrice) : null,
        stock: stock !== undefined ? stock : null,
        sku: sku || null,
        category: category || null,
        tags: tags || [],
        imageUrl: imageUrl || null,
        isActive: true,
      },
    });

    return NextResponse.json({ product }, { status: 201 });
  } catch (error) {
    console.error("POST /api/products:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
