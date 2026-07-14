import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { randomBytes } from "crypto";
import {
  encrypt,
  decrypt,
  isEncrypted,
  encryptIfNeeded,
  timingSafeStringEqual,
  __resetKeyCacheForTests,
} from "../crypto";

// Валидный тестовый ключ — 32 байта в base64
const TEST_KEY = randomBytes(32).toString("base64");

function withKey(key: string | undefined, fn: () => void) {
  const original = process.env.ENCRYPTION_MASTER_KEY;
  if (key === undefined) delete process.env.ENCRYPTION_MASTER_KEY;
  else process.env.ENCRYPTION_MASTER_KEY = key;
  __resetKeyCacheForTests();
  try {
    fn();
  } finally {
    if (original === undefined) delete process.env.ENCRYPTION_MASTER_KEY;
    else process.env.ENCRYPTION_MASTER_KEY = original;
    __resetKeyCacheForTests();
  }
}

describe("crypto — encrypt/decrypt with key", () => {
  beforeEach(() => __resetKeyCacheForTests());
  afterEach(() => __resetKeyCacheForTests());

  it("roundtrips a simple string", () => {
    withKey(TEST_KEY, () => {
      const plain = "1234567890:ABCDEFGHIJKLMNOPQRSTUVWXYZ";
      const enc = encrypt(plain);
      expect(enc).not.toBe(plain);
      expect(enc?.startsWith("v1:")).toBe(true);
      expect(decrypt(enc)).toBe(plain);
    });
  });

  it("roundtrips Cyrillic (Russian tokens sometimes have unicode)", () => {
    withKey(TEST_KEY, () => {
      const plain = "секретный_токен_с_кириллицей_🔑";
      const enc = encrypt(plain);
      expect(decrypt(enc)).toBe(plain);
    });
  });

  it("produces different ciphertext each time (IV randomness)", () => {
    withKey(TEST_KEY, () => {
      const plain = "same-input";
      const enc1 = encrypt(plain);
      const enc2 = encrypt(plain);
      expect(enc1).not.toBe(enc2);
      // Но оба расшифровываются в одинаковый plaintext
      expect(decrypt(enc1)).toBe(plain);
      expect(decrypt(enc2)).toBe(plain);
    });
  });

  it("doesn't re-encrypt already encrypted value (idempotent)", () => {
    withKey(TEST_KEY, () => {
      const plain = "token-xyz";
      const enc1 = encrypt(plain);
      const enc2 = encrypt(enc1); // повторный encrypt того же
      expect(enc2).toBe(enc1); // не поменялось
    });
  });

  it("passes plaintext through decrypt (backwards compat)", () => {
    withKey(TEST_KEY, () => {
      const plain = "old-plaintext-token";
      expect(decrypt(plain)).toBe(plain);
    });
  });

  it("passes null/undefined/empty through both functions", () => {
    withKey(TEST_KEY, () => {
      expect(encrypt(null)).toBe(null);
      expect(encrypt(undefined)).toBe(null);
      expect(encrypt("")).toBe("");
      expect(decrypt(null)).toBe(null);
      expect(decrypt(undefined)).toBe(null);
      expect(decrypt("")).toBe("");
    });
  });

  it("throws on tampered ciphertext (GCM auth catches it)", () => {
    withKey(TEST_KEY, () => {
      const enc = encrypt("real-token") as string;
      // Меняем последний символ auth tag — should fail GCM verification
      const tampered = enc.slice(0, -2) + "XX";
      expect(() => decrypt(tampered)).toThrow();
    });
  });

  it("throws when trying to decrypt with wrong key", () => {
    let encrypted: string | null = "";
    withKey(TEST_KEY, () => {
      encrypted = encrypt("token");
    });
    // Другой ключ
    const OTHER_KEY = randomBytes(32).toString("base64");
    withKey(OTHER_KEY, () => {
      expect(() => decrypt(encrypted)).toThrow();
    });
  });
});

describe("crypto — passthrough mode (no key)", () => {
  beforeEach(() => __resetKeyCacheForTests());
  afterEach(() => __resetKeyCacheForTests());

  it("encrypt returns plaintext when key missing", () => {
    withKey(undefined, () => {
      expect(encrypt("my-token")).toBe("my-token");
    });
  });

  it("decrypt returns plaintext when value is not encrypted (works without key)", () => {
    withKey(undefined, () => {
      expect(decrypt("my-token")).toBe("my-token");
    });
  });

  it("decrypt THROWS if encrypted value present but no key", () => {
    // Сначала шифруем с ключом
    let enc: string | null = "";
    withKey(TEST_KEY, () => {
      enc = encrypt("secret");
    });
    // Убираем ключ, пробуем расшифровать
    withKey(undefined, () => {
      expect(() => decrypt(enc)).toThrow(/ENCRYPTION_MASTER_KEY not set/);
    });
  });
});

describe("crypto — invalid key rejection", () => {
  beforeEach(() => __resetKeyCacheForTests());
  afterEach(() => __resetKeyCacheForTests());

  it("wrong key length falls back to passthrough (with error log)", () => {
    withKey("dGVzdA==", () => {
      // 4-байтный ключ вместо 32 → passthrough
      expect(encrypt("token")).toBe("token");
    });
  });

  it("invalid base64 → passthrough", () => {
    withKey("not-valid-base64-!!!", () => {
      // Node.js Buffer.from() с invalid base64 не бросает, но даёт мало байт
      // → длина != 32 → passthrough
      expect(encrypt("token")).toBe("token");
    });
  });
});

describe("isEncrypted", () => {
  it("returns true for v1-prefixed values with 4 parts", () => {
    expect(isEncrypted("v1:abc:def:xyz")).toBe(true);
  });

  it("returns false for plaintext", () => {
    expect(isEncrypted("some-token")).toBe(false);
    expect(isEncrypted("123456:ABCDEF")).toBe(false); // 2 parts, no v1
  });

  it("returns false for null/undefined/empty", () => {
    expect(isEncrypted(null)).toBe(false);
    expect(isEncrypted(undefined)).toBe(false);
    expect(isEncrypted("")).toBe(false);
  });

  it("returns false for v1 with wrong number of parts", () => {
    expect(isEncrypted("v1:only-two")).toBe(false);
    expect(isEncrypted("v1:a:b:c:d")).toBe(false); // 5 parts
  });

  it("returns false for other version prefixes", () => {
    expect(isEncrypted("v2:a:b:c")).toBe(false);
  });
});

describe("encryptIfNeeded", () => {
  beforeEach(() => __resetKeyCacheForTests());
  afterEach(() => __resetKeyCacheForTests());

  it("encrypts plaintext, marks updated=true", () => {
    withKey(TEST_KEY, () => {
      const r = encryptIfNeeded("plain-token");
      expect(r.updated).toBe(true);
      expect(r.value).not.toBe("plain-token");
      expect(isEncrypted(r.value ?? "")).toBe(true);
    });
  });

  it("skips already-encrypted, marks updated=false", () => {
    withKey(TEST_KEY, () => {
      const enc = encrypt("plain") as string;
      const r = encryptIfNeeded(enc);
      expect(r.updated).toBe(false);
      expect(r.value).toBe(enc);
    });
  });

  it("passes null through unchanged", () => {
    withKey(TEST_KEY, () => {
      const r = encryptIfNeeded(null);
      expect(r.updated).toBe(false);
      expect(r.value).toBe(null);
    });
  });

  it("passes empty string through unchanged", () => {
    withKey(TEST_KEY, () => {
      const r = encryptIfNeeded("");
      expect(r.updated).toBe(false);
      expect(r.value).toBe("");
    });
  });
});

describe("timingSafeStringEqual", () => {
  it("equal strings match", () => {
    expect(timingSafeStringEqual("abc", "abc")).toBe(true);
  });

  it("different-length strings return false without timing leak", () => {
    expect(timingSafeStringEqual("abc", "abcd")).toBe(false);
  });

  it("different content same length returns false", () => {
    expect(timingSafeStringEqual("abc", "xyz")).toBe(false);
  });

  it("empty strings match", () => {
    expect(timingSafeStringEqual("", "")).toBe(true);
  });
});
