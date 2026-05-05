export async function register() {
  // Глобальный сериализатор BigInt → строка для JSON.stringify / NextResponse.json.
  // Без этого любой ответ с BigInt-полем (telegramId, chatId) бросает
  // "TypeError: Do not know how to serialize a BigInt". Раньше код вручную делал
  // .toString() в каждом endpoint'е — легко пропустить. Делаем глобально и навсегда.
  if (typeof BigInt !== "undefined" && !("toJSON" in BigInt.prototype)) {
    Object.defineProperty(BigInt.prototype, "toJSON", {
      value: function toJSON() {
        return this.toString();
      },
      configurable: true,
      writable: true,
    });
  }

  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("../sentry.server.config");
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    await import("../sentry.edge.config");
  }
}

export const onRequestError = async (...args: unknown[]) => {
  const Sentry = await import("@sentry/nextjs");
  return (Sentry.captureRequestError as (...a: unknown[]) => void)(...args);
};
