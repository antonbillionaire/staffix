import { describe, it, expect } from "vitest";
import { buildChannelSystemPrompt } from "../channel-ai";

// Minimal business profile for testing
function makeBiz(overrides: Record<string, unknown> = {}) {
  return {
    name: "Test Salon",
    businessType: "salon",
    dashboardMode: "service",
    phone: "+998901234567",
    address: "ул. Тестовая, 1",
    workingHours: "09:00-18:00",
    welcomeMessage: "Добро пожаловать!",
    aiTone: "friendly" as const,
    aiRules: "Не обсуждать конкурентов",
    botDisplayName: null as string | null,
    language: "ru",
    city: "Ташкент",
    country: "UZ",
    services: [
      { name: "Стрижка", description: null, price: 50000, duration: 30 },
      { name: "Маникюр", description: null, price: 80000, duration: 60 },
    ],
    products: [] as Array<{ name: string; description: string | null; price: number; category: string | null; stock: number | null }>,
    faqs: [
      { question: "Где вы находитесь?", answer: "На улице Тестовой, 1" },
    ],
    staff: [
      { name: "Алия", role: "Мастер" },
    ],
    documents: [] as Array<{ name: string; extractedText: string | null }>,
    ...overrides,
  };
}

describe("buildChannelSystemPrompt", () => {
  it("includes business name in prompt", () => {
    const prompt = buildChannelSystemPrompt(makeBiz(), "whatsapp");
    expect(prompt).toContain("Test Salon");
  });

  it("includes channel name (WhatsApp)", () => {
    const prompt = buildChannelSystemPrompt(makeBiz(), "whatsapp");
    expect(prompt).toContain("WhatsApp");
  });

  it("includes channel name (Instagram DM)", () => {
    const prompt = buildChannelSystemPrompt(makeBiz(), "instagram");
    expect(prompt).toContain("Instagram DM");
  });

  it("includes services list", () => {
    const prompt = buildChannelSystemPrompt(makeBiz(), "whatsapp");
    expect(prompt).toContain("Стрижка");
    expect(prompt).toContain("Маникюр");
  });

  it("includes staff", () => {
    const prompt = buildChannelSystemPrompt(makeBiz(), "whatsapp");
    expect(prompt).toContain("Алия");
    expect(prompt).toContain("Мастер");
  });

  it("includes FAQ", () => {
    const prompt = buildChannelSystemPrompt(makeBiz(), "whatsapp");
    expect(prompt).toContain("Где вы находитесь?");
  });

  it("includes address and phone", () => {
    const prompt = buildChannelSystemPrompt(makeBiz(), "whatsapp");
    expect(prompt).toContain("ул. Тестовая, 1");
    expect(prompt).toContain("+998901234567");
  });

  it("includes welcome message", () => {
    const prompt = buildChannelSystemPrompt(makeBiz(), "whatsapp");
    expect(prompt).toContain("Добро пожаловать!");
  });

  it("includes AI rules", () => {
    const prompt = buildChannelSystemPrompt(makeBiz(), "whatsapp");
    expect(prompt).toContain("Не обсуждать конкурентов");
  });

  it("includes friendly tone description", () => {
    const prompt = buildChannelSystemPrompt(makeBiz({ aiTone: "friendly" }), "whatsapp");
    expect(prompt).toContain("дружелюбным");
  });

  it("includes professional tone description", () => {
    const prompt = buildChannelSystemPrompt(makeBiz({ aiTone: "professional" }), "whatsapp");
    expect(prompt).toContain("профессиональным");
  });

  it("includes casual tone description", () => {
    const prompt = buildChannelSystemPrompt(makeBiz({ aiTone: "casual" }), "whatsapp");
    expect(prompt).toContain("непринуждённым");
  });

  it("uses botDisplayName when set", () => {
    const prompt = buildChannelSystemPrompt(makeBiz({ botDisplayName: "Виктор" }), "whatsapp");
    expect(prompt).toContain("Виктор");
    expect(prompt).toContain("Ты — Виктор");
  });

  it("uses AI-помощник when botDisplayName is null", () => {
    const prompt = buildChannelSystemPrompt(makeBiz({ botDisplayName: null }), "whatsapp");
    expect(prompt).toContain("AI-помощник");
  });

  it("includes lead qualification rules", () => {
    const prompt = buildChannelSystemPrompt(makeBiz(), "whatsapp");
    expect(prompt).toContain("cold");
    expect(prompt).toContain("warm");
    expect(prompt).toContain("hot");
    expect(prompt).toContain("client");
  });

  it("includes today's date", () => {
    const prompt = buildChannelSystemPrompt(makeBiz(), "whatsapp");
    const today = new Date().toISOString().split("T")[0];
    expect(prompt).toContain(today);
  });

  it("includes city", () => {
    const prompt = buildChannelSystemPrompt(makeBiz(), "whatsapp");
    expect(prompt).toContain("Ташкент");
  });

  it("truncates documents when total exceeds 50000 chars", () => {
    const longText = "A".repeat(60000);
    const biz = makeBiz({
      documents: [{ name: "long.pdf", extractedText: longText }],
    });
    const prompt = buildChannelSystemPrompt(biz, "whatsapp");
    expect(prompt).toContain("long.pdf");
    expect(prompt).toContain("...");
    // Should not contain the full 60000 chars — capped at 50000
    expect(prompt.length).toBeLessThan(55000);
  });

  it("includes multiple documents within total limit", () => {
    const biz = makeBiz({
      documents: [
        { name: "doc1.pdf", extractedText: "Первый документ с текстом" },
        { name: "doc2.pdf", extractedText: "Второй документ с текстом" },
        { name: "doc3.pdf", extractedText: "Третий документ с текстом" },
      ],
    });
    const prompt = buildChannelSystemPrompt(biz, "whatsapp");
    expect(prompt).toContain("doc1.pdf");
    expect(prompt).toContain("doc2.pdf");
    expect(prompt).toContain("doc3.pdf");
    expect(prompt).toContain("Первый документ");
    expect(prompt).toContain("Третий документ");
  });

  it("includes products in prompt", () => {
    const biz = makeBiz({
      products: [
        { name: "Пинцет 6 см", description: "Для тонких волос", price: 5000, category: "Инструменты", stock: 10 },
        { name: "Пинцет 10 см", description: "Универсальный", price: 7000, category: "Инструменты", stock: 0 },
      ],
    });
    const prompt = buildChannelSystemPrompt(biz, "whatsapp");
    expect(prompt).toContain("Пинцет 6 см");
    expect(prompt).toContain("Для тонких волос");
    expect(prompt).toContain("Пинцет 10 см");
    expect(prompt).toContain("нет в наличии");
  });

  it("includes service description in prompt", () => {
    const biz = makeBiz({
      services: [
        { name: "Стрижка", description: "Мужская классическая", price: 50000, duration: 30 },
      ],
    });
    const prompt = buildChannelSystemPrompt(biz, "whatsapp");
    expect(prompt).toContain("Мужская классическая");
  });
});
