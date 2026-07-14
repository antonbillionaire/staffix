import { describe, it, expect } from "vitest";
import { classifyEmojiMessage } from "../emoji-classifier";

describe("classifyEmojiMessage", () => {
  describe("positive emoji", () => {
    it("classifies single thumbs-up as positive", () => {
      expect(classifyEmojiMessage("👍")).toBe("positive");
    });

    it("classifies red heart (with variation selector) as positive", () => {
      expect(classifyEmojiMessage("❤️")).toBe("positive");
    });

    it("classifies prayer hands as positive", () => {
      expect(classifyEmojiMessage("🙏")).toBe("positive");
    });

    it("classifies multiple positive emojis", () => {
      expect(classifyEmojiMessage("👍❤️🙏")).toBe("positive");
    });

    it("classifies positive with whitespace between", () => {
      expect(classifyEmojiMessage("👍 ❤️  🙏")).toBe("positive");
    });

    it("handles skin-tone modifiers on thumbs-up", () => {
      expect(classifyEmojiMessage("👍🏻")).toBe("positive");
      expect(classifyEmojiMessage("👍🏿")).toBe("positive");
    });

    it("classifies celebration emojis", () => {
      expect(classifyEmojiMessage("🎉🎊✨")).toBe("positive");
    });

    it("classifies checkmarks", () => {
      expect(classifyEmojiMessage("✅")).toBe("positive");
    });
  });

  describe("negative emoji", () => {
    it("classifies thumbs-down as negative", () => {
      expect(classifyEmojiMessage("👎")).toBe("negative");
    });

    it("classifies angry face as negative", () => {
      expect(classifyEmojiMessage("😡")).toBe("negative");
    });

    it("classifies swearing face as negative", () => {
      expect(classifyEmojiMessage("🤬")).toBe("negative");
    });

    it("classifies crying face as negative", () => {
      expect(classifyEmojiMessage("😭")).toBe("negative");
    });

    it("classifies red X as negative", () => {
      expect(classifyEmojiMessage("❌")).toBe("negative");
    });
  });

  describe("mixed emoji priority", () => {
    it("mixing positive and negative → negative wins", () => {
      expect(classifyEmojiMessage("❤️😡")).toBe("negative");
      expect(classifyEmojiMessage("👍👎")).toBe("negative");
      expect(classifyEmojiMessage("🙏😢👍")).toBe("negative");
    });

    it("positive + unknown → positive", () => {
      // 🦄 unicorn — not in our lists → treated as unknown, doesn't override positive
      expect(classifyEmojiMessage("👍🦄")).toBe("positive");
    });
  });

  describe("neutral (unknown-only) emoji", () => {
    it("classifies unknown emoji as neutral", () => {
      // 🦄 unicorn — not classified either way
      expect(classifyEmojiMessage("🦄")).toBe("neutral");
    });

    it("classifies exotic combinations as neutral", () => {
      expect(classifyEmojiMessage("🦕🦖")).toBe("neutral");
    });

    it("classifies food emojis as neutral (no positive/negative)", () => {
      expect(classifyEmojiMessage("🍕🍔")).toBe("neutral");
    });
  });

  describe("non-emoji-only text", () => {
    it("text with emoji is not_emoji_only", () => {
      expect(classifyEmojiMessage("спасибо 👍")).toBe("not_emoji_only");
    });

    it("plain text is not_emoji_only", () => {
      expect(classifyEmojiMessage("Здравствуйте")).toBe("not_emoji_only");
    });

    it("emoji + one letter is not_emoji_only", () => {
      expect(classifyEmojiMessage("👍a")).toBe("not_emoji_only");
    });

    it("empty string is not_emoji_only", () => {
      expect(classifyEmojiMessage("")).toBe("not_emoji_only");
    });

    it("whitespace only is not_emoji_only", () => {
      expect(classifyEmojiMessage("   ")).toBe("not_emoji_only");
    });

    it("numbers are not emoji", () => {
      expect(classifyEmojiMessage("123")).toBe("not_emoji_only");
    });
  });

  describe("edge cases", () => {
    it("multi-codepoint family emoji (with ZWJ) still classifies", () => {
      // 👨‍👩‍👧 = 👨 + ZWJ + 👩 + ZWJ + 👧 — after strip becomes «👨👩👧» — all neutral
      expect(classifyEmojiMessage("👨‍👩‍👧")).toBe("neutral");
    });

    it("very long positive-only spam is still positive", () => {
      expect(classifyEmojiMessage("👍👍👍👍👍👍👍👍👍👍")).toBe("positive");
    });
  });
});
