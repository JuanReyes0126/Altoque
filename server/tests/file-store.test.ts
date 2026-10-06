import { afterEach, describe, expect, it, vi } from "vitest";
import { fileStore } from "../lib/files.js";

const { put } = vi.hoisted(() => ({ put: vi.fn() }));
vi.mock("@vercel/blob", () => ({ put }));
afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); });

describe("Almacenamiento · configuración y operaciones reales", () => {
  it("una carga privada exige su propio token sin iniciar llamadas al SDK", async () => {
    vi.stubEnv("BLOB_PRIVATE_READ_WRITE_TOKEN", "");
    await expect(fileStore().putPrivate("fixture/key.jpg", new Uint8Array([1]), "image/jpeg")).rejects.toMatchObject({ status: 503 });
    expect(put).not.toHaveBeenCalled();
  });

  it("una carga privada no depende de tener habilitado el store público", async () => {
    vi.stubEnv("BLOB_PRIVATE_READ_WRITE_TOKEN", "fixture-private-token");
    vi.stubEnv("BLOB_READ_WRITE_TOKEN", "");
    put.mockResolvedValueOnce({});
    await fileStore().putPrivate("fixture/key.jpg", new Uint8Array([1]), "image/jpeg");
    expect(put).toHaveBeenCalledWith("fixture/key.jpg", expect.any(Uint8Array), { access: "private", token: "fixture-private-token", contentType: "image/jpeg" });
  });

  it("propaga el fallo del proveedor en lugar de simular éxito", async () => {
    vi.stubEnv("BLOB_PRIVATE_READ_WRITE_TOKEN", "fixture-private-token");
    put.mockRejectedValueOnce(new Error("STORAGE_FAILURE"));
    await expect(fileStore().putPrivate("fixture/key.jpg", new Uint8Array([1]), "image/jpeg")).rejects.toThrow("STORAGE_FAILURE");
  });

  it("la lectura privada no implementada falla explícitamente sin inventar enlaces", async () => {
    await expect(fileStore().getPrivateSignedUrl("fixture/key.jpg", 60)).rejects.toMatchObject({ status: 503 });
    expect(put).not.toHaveBeenCalled();
  });
});
