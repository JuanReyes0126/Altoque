/** Evita activar integración sobre Preview, Production o una base local compartida. */
export function managedTestDatabase(environment: NodeJS.ProcessEnv): string {
  const fail = () => {
    throw new Error("UNSAFE_TEST_DATABASE: ejecuta npm run test:integration para crear una base local aislada");
  };
  const runId = environment.ALTOQUE_TEST_RUN_ID;
  if (environment.ALTOQUE_TEST_DB_MANAGED !== "1" || !runId || !/^[a-f0-9]{32}$/.test(runId)) return fail();
  const value = environment.TEST_DATABASE_URL;
  if (!value) return fail();
  let url: URL;
  try { url = new URL(value); } catch { return fail(); }
  if (url.protocol !== "postgresql:" || url.hostname !== "127.0.0.1" || !url.port || Number(url.port) < 1024 || Number(url.port) > 65535) return fail();
  if (url.pathname !== `/altoque_test_${runId}` || url.hash || !url.username || !url.password) return fail();
  for (const [key, val] of url.searchParams) {
    if (!["connection_limit", "pool_timeout", "connect_timeout"].includes(key) || !/^\d+$/.test(val)) return fail();
  }
  return value;
}
