import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { safeExternalFetch, SafeFetchError } from "../safe-fetch";

// Мокаем dns/promises чтобы контролировать какой IP возвращается для каждого хоста
vi.mock("dns/promises", () => ({
  lookup: vi.fn(async (hostname: string) => {
    const map: Record<string, string> = {
      "external.com": "1.2.3.4",
      "cloudflare-cdn.com": "104.16.0.1",
      "aws-metadata.evil.com": "169.254.169.254",
      "internal.evil.com": "10.0.0.5",
      "loopback.evil.com": "127.0.0.1",
      "private-172.evil.com": "172.20.0.1",
      "private-192.evil.com": "192.168.1.1",
      "zero-net.evil.com": "0.0.0.1",
      "multicast.evil.com": "224.0.0.1",
      "ipv6-loopback.evil.com": "::1",
      "ipv6-private.evil.com": "fc00::1",
      "ipv6-mapped-private.evil.com": "::ffff:10.0.0.1",
      "unresolvable.evil.com": "",
    };
    if (!(hostname in map) || !map[hostname]) {
      throw new Error("ENOTFOUND");
    }
    return { address: map[hostname], family: map[hostname].includes(":") ? 6 : 4 };
  }),
}));

// Мокаем глобальный fetch чтобы не делать реальных сетевых запросов
const mockFetch = vi.fn();
beforeEach(() => {
  mockFetch.mockReset();
  globalThis.fetch = mockFetch as unknown as typeof fetch;
});

afterEach(() => {
  vi.clearAllMocks();
});

function makeResponse(status = 200, body = "ok", headers: Record<string, string> = {}): Response {
  return new Response(body, { status, headers });
}

describe("safeExternalFetch — SSRF protection", () => {
  it("allows public IPv4 external hosts", async () => {
    mockFetch.mockResolvedValueOnce(makeResponse(200, "hello"));
    const res = await safeExternalFetch("https://external.com/page");
    expect(res.status).toBe(200);
    expect(mockFetch).toHaveBeenCalledOnce();
  });

  it("allows Cloudflare/CDN public IPs (104.x)", async () => {
    mockFetch.mockResolvedValueOnce(makeResponse(200, "cdn"));
    const res = await safeExternalFetch("https://cloudflare-cdn.com/page");
    expect(res.status).toBe(200);
  });

  it("blocks AWS metadata endpoint (169.254.169.254)", async () => {
    await expect(safeExternalFetch("https://aws-metadata.evil.com/latest/meta-data/")).rejects.toThrow(SafeFetchError);
    await expect(safeExternalFetch("https://aws-metadata.evil.com/latest/meta-data/")).rejects.toMatchObject({ code: "blocked_host" });
  });

  it("blocks private 10.x network", async () => {
    await expect(safeExternalFetch("https://internal.evil.com/admin")).rejects.toMatchObject({ code: "blocked_host" });
  });

  it("blocks loopback 127.x", async () => {
    await expect(safeExternalFetch("https://loopback.evil.com/")).rejects.toMatchObject({ code: "blocked_host" });
  });

  it("blocks private 172.16-31 range", async () => {
    await expect(safeExternalFetch("https://private-172.evil.com/")).rejects.toMatchObject({ code: "blocked_host" });
  });

  it("blocks private 192.168.x", async () => {
    await expect(safeExternalFetch("https://private-192.evil.com/")).rejects.toMatchObject({ code: "blocked_host" });
  });

  it("blocks 0.0.0.0/8", async () => {
    await expect(safeExternalFetch("https://zero-net.evil.com/")).rejects.toMatchObject({ code: "blocked_host" });
  });

  it("blocks multicast 224.x", async () => {
    await expect(safeExternalFetch("https://multicast.evil.com/")).rejects.toMatchObject({ code: "blocked_host" });
  });

  it("blocks IPv6 loopback ::1", async () => {
    await expect(safeExternalFetch("https://ipv6-loopback.evil.com/")).rejects.toMatchObject({ code: "blocked_host" });
  });

  it("blocks IPv6 unique-local fc00::/7", async () => {
    await expect(safeExternalFetch("https://ipv6-private.evil.com/")).rejects.toMatchObject({ code: "blocked_host" });
  });

  it("blocks IPv4-mapped IPv6 with private IPv4 payload", async () => {
    // ::ffff:10.0.0.1 — bypass attempt через IPv6-mapped
    await expect(safeExternalFetch("https://ipv6-mapped-private.evil.com/")).rejects.toMatchObject({ code: "blocked_host" });
  });

  it("blocks direct IP literal to private address", async () => {
    // Хост — сам private IP-литерал, без DNS lookup
    await expect(safeExternalFetch("http://169.254.169.254/latest/meta-data/")).rejects.toMatchObject({ code: "blocked_host" });
  });

  it("blocks localhost by name (before DNS)", async () => {
    await expect(safeExternalFetch("http://localhost:5432/")).rejects.toMatchObject({ code: "blocked_host" });
  });

  it("blocks non-http/https protocols", async () => {
    await expect(safeExternalFetch("file:///etc/passwd")).rejects.toMatchObject({ code: "blocked_protocol" });
    await expect(safeExternalFetch("gopher://evil.com/")).rejects.toMatchObject({ code: "blocked_protocol" });
  });

  it("rejects unresolvable DNS", async () => {
    await expect(safeExternalFetch("https://unresolvable.evil.com/")).rejects.toMatchObject({ code: "dns_failed" });
  });

  it("follows redirect and re-checks target", async () => {
    // 1st hop: public → 2nd hop: public
    mockFetch
      .mockResolvedValueOnce(new Response(null, { status: 302, headers: { location: "https://cloudflare-cdn.com/page" } }))
      .mockResolvedValueOnce(makeResponse(200, "final"));
    const res = await safeExternalFetch("https://external.com/redirect");
    expect(res.status).toBe(200);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("blocks redirect to private host", async () => {
    // Public → редирект на 169.254.169.254 (AWS metadata) через имя
    mockFetch.mockResolvedValueOnce(
      new Response(null, { status: 302, headers: { location: "https://aws-metadata.evil.com/latest/" } })
    );
    await expect(safeExternalFetch("https://external.com/redirect-to-metadata")).rejects.toMatchObject({ code: "blocked_host" });
  });

  it("stops at MAX_REDIRECTS", async () => {
    // 6 редиректов подряд — должно упасть на redirect_loop
    for (let i = 0; i < 6; i++) {
      mockFetch.mockResolvedValueOnce(
        new Response(null, { status: 302, headers: { location: "https://external.com/next" } })
      );
    }
    await expect(safeExternalFetch("https://external.com/first")).rejects.toMatchObject({ code: "redirect_loop" });
  });

  it("blocks response with too-large Content-Length", async () => {
    mockFetch.mockResolvedValueOnce(
      new Response("body", { status: 200, headers: { "content-length": String(10 * 1024 * 1024) } })
    );
    await expect(safeExternalFetch("https://external.com/big")).rejects.toMatchObject({ code: "too_large" });
  });
});
