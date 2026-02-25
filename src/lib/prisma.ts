import { PrismaClient } from "@prisma/client";

// Fix BigInt JSON serialization — Prisma returns BigInt for fields like telegramId,
// but JSON.stringify() can't handle BigInt by default, causing API routes to crash.
// This converts BigInt to string during serialization.
// eslint-disable-next-line @typescript-eslint/no-wrapper-object-types
(BigInt.prototype as BigInt & { toJSON: () => string }).toJSON = function () {
  return this.toString();
};

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
