import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock prisma before importing module
vi.mock("@/lib/prisma", () => ({
  prisma: {
    business: {
      findUnique: vi.fn(),
    },
    notification: {
      create: vi.fn(),
    },
    product: {
      findMany: vi.fn(),
    },
  },
}));

import { notifyManagerByTelegram } from "../sales-tools";
import { prisma } from "@/lib/prisma";

const BIZ_ID = "biz-rightflight";
const CLIENT_TG = BigInt(123456789);

const fetchMock = vi.fn();
beforeEach(() => {
  vi.clearAllMocks();
  global.fetch = fetchMock as unknown as typeof fetch;
  vi.mocked(prisma.notification.create).mockResolvedValue({} as never);
});

describe("notifyManagerByTelegram", () => {
  it("creates dashboard notification AND sends Telegram when owner is configured", async () => {
    vi.mocked(prisma.business.findUnique).mockResolvedValueOnce({
      botToken: "FAKE_TOKEN",
      ownerTelegramChatId: BigInt(987654321),
      name: "Right Flight",
    } as never);
    fetchMock.mockResolvedValueOnce({ ok: true } as Response);

    const result = await notifyManagerByTelegram(
      BIZ_ID,
      CLIENT_TG,
      "Клиент хочет узнать актуальные даты тура",
      "Farrukh",
      "normal"
    );

    expect(result.success).toBe(true);
    expect(result.dashboardCreated).toBe(true);
    expect(result.telegramDelivered).toBe(true);
    expect(prisma.notification.create).toHaveBeenCalledOnce();
    expect(fetchMock).toHaveBeenCalledOnce();

    const tgCall = fetchMock.mock.calls[0];
    expect(tgCall[0]).toContain("api.telegram.org/botFAKE_TOKEN/sendMessage");
    const body = JSON.parse(tgCall[1].body);
    expect(body.chat_id).toBe("987654321");
    // НЕ передаём parse_mode — иначе спецсимволы в reason ломают отправку.
    expect(body.parse_mode).toBeUndefined();
    expect(body.text).toContain("Farrukh");
    expect(body.text).toContain("актуальные даты тура");
  });

  it("creates dashboard notification even when ownerTelegramChatId is missing", async () => {
    vi.mocked(prisma.business.findUnique).mockResolvedValueOnce({
      botToken: "FAKE_TOKEN",
      ownerTelegramChatId: null,
      name: "Right Flight",
    } as never);

    const result = await notifyManagerByTelegram(
      BIZ_ID,
      CLIENT_TG,
      "нужен менеджер",
      "Иван",
      "urgent"
    );

    expect(result.success).toBe(true);
    expect(result.dashboardCreated).toBe(true);
    expect(result.telegramDelivered).toBe(false);
    expect(prisma.notification.create).toHaveBeenCalledOnce();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does not throw when reason contains markdown special chars (no parse_mode)", async () => {
    vi.mocked(prisma.business.findUnique).mockResolvedValueOnce({
      botToken: "FAKE_TOKEN",
      ownerTelegramChatId: BigInt(111),
      name: "Test",
    } as never);
    fetchMock.mockResolvedValueOnce({ ok: true } as Response);

    // Подчёркивания и звёздочки раньше ломали Telegram Markdown → 400 и тишина.
    const result = await notifyManagerByTelegram(
      BIZ_ID,
      CLIENT_TG,
      "почему_бот_не_работает *срочно*",
      "Test_User",
      "urgent"
    );

    expect(result.success).toBe(true);
    expect(result.telegramDelivered).toBe(true);
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    // Plain text, не Markdown — символы доходят как есть.
    expect(body.parse_mode).toBeUndefined();
    expect(body.text).toContain("почему_бот_не_работает");
  });

  it("logs Telegram failure and still returns success because dashboard worked", async () => {
    vi.mocked(prisma.business.findUnique).mockResolvedValueOnce({
      botToken: "FAKE_TOKEN",
      ownerTelegramChatId: BigInt(111),
      name: "Test",
    } as never);
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 400,
      text: () => Promise.resolve("bad request"),
    } as unknown as Response);

    const result = await notifyManagerByTelegram(
      BIZ_ID,
      CLIENT_TG,
      "тест",
      "Test",
      "normal"
    );

    expect(result.success).toBe(true);
    expect(result.dashboardCreated).toBe(true);
    expect(result.telegramDelivered).toBe(false);
    // Дашборд получил уведомление — даже при сбое TG владелец увидит у себя.
    expect(prisma.notification.create).toHaveBeenCalledOnce();
  });

  it("returns failure when business is not found", async () => {
    vi.mocked(prisma.business.findUnique).mockResolvedValueOnce(null as never);

    const result = await notifyManagerByTelegram(
      BIZ_ID,
      CLIENT_TG,
      "test",
      "Test",
      "normal"
    );

    expect(result.success).toBe(false);
    expect(prisma.notification.create).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
