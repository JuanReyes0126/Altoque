/** Better Auth puede registrar errores del adapter: jamás pasar sus textos o datos. */
import type { BetterAuthOptions } from "better-auth";
import { log } from "../lib/logger.js";

export const authLogger: NonNullable<BetterAuthOptions["logger"]> = {
  level: "warn",
  disableColors: true,
  log(level, _message, ...args) {
    const error = args.find((value): value is Error => value instanceof Error);
    const errorType = error && /^[a-z][a-z0-9_]{0,63}$/i.test(error.name) ? error.name : undefined;
    const context = { source: "better-auth", ...(errorType ? { errorType } : {}) };
    if (level === "error") log.error("better_auth_event", context);
    else if (level === "warn") log.warn("better_auth_event", context);
    else log.info("better_auth_event", context);
  },
};
