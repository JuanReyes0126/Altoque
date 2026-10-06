import { authApi } from "./api";
import { clearSession } from "./state";

/** Solo un null exitoso significa ausencia de sesión; una caída del API se propaga. */
export async function loadCurrentSession() {
  const session = await authApi.getSession();
  if (!session) return null;
  return authApi.me();
}

/** Si el servidor no confirma el logout, la UI conserva la sesión y permite reintentar. */
export async function endCurrentSession(): Promise<void> {
  await authApi.signOut();
  clearSession();
}
