import { describe, expect, it } from "vitest";
import { authEmailRule, authLimitSubject, emailLimitSubject } from "../auth/rate-limit.js";

describe("Límites auth · sujetos privados y reglas", () => {
  const secret = "test-only-rate-limit-key";

  it("normaliza el email y almacena HMAC, sin texto personal", () => {
    const subject = emailLimitSubject(" Client@Example.com ", secret);
    expect(subject).toBe(emailLimitSubject("client@example.com", secret));
    expect(subject).toMatch(/^email:[a-f0-9]{64}$/);
    expect(subject.includes("client") || subject.includes("example.com")).toBe(false);
  });

  it("separa subjects por secret y por tipo", () => {
    const subject = authLimitSubject("ip", "192.0.2.1", secret);
    expect(subject).not.toBe(authLimitSubject("ip", "192.0.2.1", "other-test-key"));
    expect(subject).not.toBe(authLimitSubject("email", "192.0.2.1", secret));
    expect(subject.includes("192.0.2.1")).toBe(false);
  });

  it("reenvío y reset limitan a tres por 15 minutos; registro cinco por hora", () => {
    expect(authEmailRule("/send-verification-email")).toMatchObject({ max: 3, windowSec: 900 });
    expect(authEmailRule("/request-password-reset")).toMatchObject({ max: 3, windowSec: 900 });
    expect(authEmailRule("/sign-up/email")).toMatchObject({ max: 5, windowSec: 3600 });
    expect(authEmailRule("/sign-in/email")).toMatchObject({ max: 10, windowSec: 300 });
    expect(authEmailRule("/get-session")).toBeUndefined();
  });
});
