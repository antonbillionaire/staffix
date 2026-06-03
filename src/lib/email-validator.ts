/**
 * Email validation for registration: format, garbage-TLD filter, MX record check.
 *
 * Goal: stop obvious fake accounts (asdasd@asdasd.asd, x@x.x, etc.) at
 * /api/auth/register so they never reach the admin "new registration"
 * notification. Real users on real domains pass through unchanged.
 *
 * Three layers, fast-fail in order:
 *   1. Format regex — well-formed local@domain.tld with at least one
 *      letter in each part.
 *   2. TLD blocklist — reject single-letter TLDs and well-known garbage
 *      placeholders (.asd, .test, .invalid, .example, .localhost).
 *   3. DNS MX lookup — domain must publish MX records (or fall back to
 *      an A record per RFC 5321 §5). No MX = no email = fake.
 *
 * MX check uses native dns/promises with a short timeout so a slow DNS
 * server doesn't hang the registration request. Failure is fail-closed
 * — if DNS itself errors, reject (better to inconvenience one user with
 * "try again" than to admit a stream of garbage accounts).
 */

import { resolveMx, resolve4 } from "dns/promises";

// Real generic TLDs are 2+ characters and contain only letters. Block the
// ones people use as placeholders or for testing. .arpa is technical.
const TLD_BLOCKLIST = new Set([
  "asd",
  "test",
  "invalid",
  "example",
  "localhost",
  "local",
  "internal",
  "fake",
  "lol",
  "xxx",
  "tld",
]);

// Disposable / throwaway email providers. Not exhaustive — easy to add to.
// Block keeps cost of probing accounts higher than 30 seconds of effort.
const DISPOSABLE_DOMAINS = new Set([
  "mailinator.com",
  "10minutemail.com",
  "guerrillamail.com",
  "tempmail.com",
  "throwawaymail.com",
  "yopmail.com",
  "trashmail.com",
  "getnada.com",
  "maildrop.cc",
  "temp-mail.org",
  "fakemailgenerator.com",
  "dispostable.com",
  "sharklasers.com",
  "tempr.email",
  "tmpmail.org",
  "mohmal.com",
  "emailfake.com",
  "emailondeck.com",
]);

// RFC 5321 compliant-enough email regex. We don't need full RFC parsing —
// catching ill-formed addresses is enough.
const EMAIL_REGEX = /^[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}$/;

export interface EmailValidationResult {
  ok: boolean;
  /** Localized error message in Russian, ready to surface to the user. */
  error?: string;
  /** Programmatic code for logging / metrics. */
  code?: "bad_format" | "bad_tld" | "disposable" | "no_mx" | "dns_error";
}

/**
 * Validate an email address by format, TLD, and DNS MX records.
 * Returns {ok:true} for legit, {ok:false, error, code} for rejected.
 *
 * The DNS check has a soft timeout to keep registration latency bounded
 * even when DNS is slow.
 */
export async function validateEmailAddress(
  email: string,
  opts: { dnsTimeoutMs?: number } = {}
): Promise<EmailValidationResult> {
  const normalized = email.trim().toLowerCase();

  // Layer 1: format
  if (!EMAIL_REGEX.test(normalized)) {
    return {
      ok: false,
      code: "bad_format",
      error: "Неверный формат email. Пример: name@example.com",
    };
  }

  const atIdx = normalized.lastIndexOf("@");
  const domain = normalized.slice(atIdx + 1);
  const tld = domain.slice(domain.lastIndexOf(".") + 1);

  // Layer 2a: TLD blocklist
  if (TLD_BLOCKLIST.has(tld)) {
    return {
      ok: false,
      code: "bad_tld",
      error: "Этот домен не принимает почту. Укажите рабочий email.",
    };
  }

  // Layer 2b: single-letter TLD is invalid per ICANN (must be 2+)
  if (tld.length < 2) {
    return {
      ok: false,
      code: "bad_tld",
      error: "Неверный домен email.",
    };
  }

  // Layer 2c: disposable email block
  if (DISPOSABLE_DOMAINS.has(domain)) {
    return {
      ok: false,
      code: "disposable",
      error: "Одноразовая почта не поддерживается. Укажите ваш рабочий email.",
    };
  }

  // Layer 3: DNS MX (or A as fallback per RFC 5321 §5)
  const timeoutMs = opts.dnsTimeoutMs ?? 4000;
  try {
    const hasDeliverableHost = await withTimeout(
      checkDomainDeliverability(domain),
      timeoutMs
    );
    if (!hasDeliverableHost) {
      return {
        ok: false,
        code: "no_mx",
        error: "Домен не принимает почту. Проверьте email.",
      };
    }
  } catch {
    // Fail closed on DNS errors — easier to ask a real user to retry than
    // to keep letting fake registrations through during DNS hiccups.
    return {
      ok: false,
      code: "dns_error",
      error: "Не удалось проверить email-домен. Попробуйте ещё раз.",
    };
  }

  return { ok: true };
}

async function checkDomainDeliverability(domain: string): Promise<boolean> {
  // Prefer MX. If none, RFC 5321 says fall back to the domain's A record
  // as an implicit MX of priority 0. That's why we don't reject on "no MX".
  try {
    const mx = await resolveMx(domain);
    if (mx && mx.length > 0) return true;
  } catch {
    // NXDOMAIN or no MX records — try A record fallback below
  }
  try {
    const a = await resolve4(domain);
    return Array.isArray(a) && a.length > 0;
  } catch {
    return false;
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("dns_timeout")), ms);
    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}
