import { afterAll, describe, expect, it, vi } from "vitest";
import { prisma } from "../database/prisma.js";
import { consume } from "../lib/ratelimit.js";
import { ulid } from "../lib/ids.js";
import { HAS_DB } from "./setup.js";

describe.runIf(HAS_DB)("Rate limit · concurrencia en PostgreSQL aislado", () => {
  const bucket = `test:atomic-limit:${ulid()}`;
  const subject = "fixture-only";
  const rule = { bucket, max: 3, windowSec: 60 };

  afterAll(async () => {
    vi.useRealTimers();
    try { await prisma.rate_limit.deleteMany({ where: { bucket, subject } }); }
    finally { await prisma.$disconnect(); }
  });

  it("el cambio de ventana permite exactamente tres requests concurrentes", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const start = Math.floor(Date.now() / 60_000) * 60_000;
    vi.setSystemTime(start + 1000);
    await consume(prisma, rule, subject);
    vi.setSystemTime(start + 61_000);
    const outcomes = await Promise.allSettled(Array.from({ length: 20 }, () => consume(prisma, rule, subject)));
    expect(outcomes.filter((outcome) => outcome.status === "fulfilled").length).toBe(3);
    expect(outcomes.filter((outcome) => outcome.status === "rejected").length).toBe(17);
    for (const outcome of outcomes) {
      if (outcome.status === "rejected") expect(outcome.reason.code).toBe("RATE_LIMITED");
    }
    const row = await prisma.rate_limit.findUniqueOrThrow({ where: { bucket_subject: { bucket, subject } } });
    expect(row.count).toBe(4);
    expect(row.window_start.getTime()).toBe(start + 60_000);
    vi.useRealTimers();
  });
});
