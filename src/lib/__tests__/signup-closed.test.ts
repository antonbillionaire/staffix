import { describe, it, expect, afterEach } from "vitest";
import { isSignupClosed } from "@/lib/signup-closed";

const ORIG = process.env.STAFFIX_SIGNUP_CLOSED;
afterEach(() => {
  if (ORIG === undefined) delete process.env.STAFFIX_SIGNUP_CLOSED;
  else process.env.STAFFIX_SIGNUP_CLOSED = ORIG;
});

describe("isSignupClosed", () => {
  it("переменной нет — регистрация работает", () => {
    delete process.env.STAFFIX_SIGNUP_CLOSED;
    expect(isSignupClosed()).toBe(false);
  });

  it("STAFFIX_SIGNUP_CLOSED=1 — закрыта", () => {
    process.env.STAFFIX_SIGNUP_CLOSED = "1";
    expect(isSignupClosed()).toBe(true);
  });

  it("опечатка не закрывает регистрацию случайно", () => {
    for (const v of ["0", "", "true", "yes", "on"]) {
      process.env.STAFFIX_SIGNUP_CLOSED = v;
      expect(isSignupClosed()).toBe(false);
    }
  });
});
