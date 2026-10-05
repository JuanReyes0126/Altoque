import { describe, expect, it } from "vitest";
import { managedTestDatabase } from "./test-database.js";

const runId = "a".repeat(32);
const managed = {
  ALTOQUE_TEST_DB_MANAGED: "1", ALTOQUE_TEST_RUN_ID: runId,
  TEST_DATABASE_URL: `postgresql://test:dummy@127.0.0.1:25432/altoque_test_${runId}`,
};

describe("Aislamiento de la base de integración", () => {
  it("acepta únicamente la base local exclusiva de la ejecución", () => {
    expect(Boolean(managedTestDatabase(managed))).toBe(true);
  });
  it("rechaza activar integración sin el runner", () => {
    expect(() => managedTestDatabase({ ...managed, ALTOQUE_TEST_DB_MANAGED: undefined })).toThrow("UNSAFE_TEST_DATABASE");
  });
  it("rechaza Neon aunque se declare como base de test", () => {
    expect(() => managedTestDatabase({ ...managed, TEST_DATABASE_URL: managed.TEST_DATABASE_URL.replace("127.0.0.1", "ep-preview.neon.tech") })).toThrow("UNSAFE_TEST_DATABASE");
  });
  it("rechaza una base local ajena a la ejecución", () => {
    expect(() => managedTestDatabase({ ...managed, TEST_DATABASE_URL: managed.TEST_DATABASE_URL.replace(`altoque_test_${runId}`, "neondb") })).toThrow("UNSAFE_TEST_DATABASE");
  });
  it("rechaza redirigir la conexión mediante parámetros", () => {
    expect(() => managedTestDatabase({ ...managed, TEST_DATABASE_URL: `${managed.TEST_DATABASE_URL}?host=ep-preview.neon.tech` })).toThrow("UNSAFE_TEST_DATABASE");
  });
  it("rechaza URLs inválidas y IDs de ejecución inválidos", () => {
    expect(() => managedTestDatabase({ ...managed, TEST_DATABASE_URL: "invalid" })).toThrow("UNSAFE_TEST_DATABASE");
    expect(() => managedTestDatabase({ ...managed, ALTOQUE_TEST_RUN_ID: "../shared" })).toThrow("UNSAFE_TEST_DATABASE");
  });
});
