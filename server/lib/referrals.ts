import { Prisma } from "@prisma/client";
import { referralCode } from "./ids.js";

const MAX_REFERRAL_ATTEMPTS = 3;

function isReferralCodeCollision(error: unknown): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") return false;

  const model = error.meta?.modelName;
  const target = error.meta?.target;
  if (model !== undefined && model !== "provider_profile") return false;
  if (target === "provider_profile_referral_code_key") return true;

  return model === "provider_profile" && (
    target === "referral_code"
    || (Array.isArray(target) && target.length === 1 && target[0] === "referral_code")
  );
}

/** El callback debe abrir una transacción nueva: P2002 aborta la anterior en PostgreSQL. */
export async function createWithReferralCode<T>(create: (code: string) => Promise<T>): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await create(referralCode());
    } catch (error) {
      if (attempt >= MAX_REFERRAL_ATTEMPTS || !isReferralCodeCollision(error)) throw error;
    }
  }
}
