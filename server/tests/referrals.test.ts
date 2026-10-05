import { Prisma } from "@prisma/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import * as ids from "../lib/ids.js";
import { createWithReferralCode } from "../lib/referrals.js";

const collision = (meta: Record<string, unknown>, code = "P2002") => new Prisma.PrismaClientKnownRequestError(
  "Fixture de error Prisma", { code, clientVersion: "6.19.3", meta },
);

afterEach(() => vi.restoreAllMocks());

describe("Referrals · entropía y retry acotado", () => {
  it("conserva los 96 bits aleatorios en el código", () => {
    expect(ids.referralCode()).toMatch(/^AT-[0-9A-F]{24}$/);
  });

  it.each([
    { modelName: "provider_profile", target: ["referral_code"] },
    { modelName: "provider_profile", target: "referral_code" },
    { target: "provider_profile_referral_code_key" },
  ])("regenera el código únicamente para el unique de referido: %j", async (meta) => {
    vi.spyOn(ids, "referralCode").mockReturnValueOnce("first").mockReturnValueOnce("second");
    const create = vi.fn().mockRejectedValueOnce(collision(meta)).mockResolvedValueOnce({ id: "created" });

    await expect(createWithReferralCode(create)).resolves.toEqual({ id: "created" });
    expect(create.mock.calls).toEqual([["first"], ["second"]]);
  });

  it("propaga la última colisión después de tres intentos totales", async () => {
    const error = collision({ modelName: "provider_profile", target: ["referral_code"] });
    const create = vi.fn().mockRejectedValue(error);

    await expect(createWithReferralCode(create)).rejects.toBe(error);
    expect(create).toHaveBeenCalledTimes(3);
  });

  it.each([
    collision({ modelName: "provider_profile", target: ["user_id"] }),
    collision({ modelName: "provider_profile", target: ["referral_code", "user_id"] }),
    collision({ modelName: "other_model", target: ["referral_code"] }),
    collision({ target: ["referral_code"] }),
    collision({ modelName: "provider_profile", target: ["referral_code"] }, "P2003"),
    new Error("Base de datos no disponible"),
  ])("propaga otros errores sin reintentar (%#)", async (error) => {
    const create = vi.fn().mockRejectedValue(error);

    await expect(createWithReferralCode(create)).rejects.toBe(error);
    expect(create).toHaveBeenCalledTimes(1);
  });
});
