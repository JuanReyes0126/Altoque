import { http } from "./http";

export interface AddressZone { id: string; name: string; municipality: string }
export interface SavedAddress {
  id: string;
  label: string;
  line: string;
  zone_id: string;
  zone: AddressZone;
}
export interface AddressInput { label: string; line: string; zone_id: string }

/** Direcciones persistidas en el servidor; nunca usan localStorage. */
export const profileApi = {
  zones: async (): Promise<AddressZone[]> => {
    const result = await http<{ data: AddressZone[] }>("/api/v1/zones");
    return result.data;
  },
  addresses: {
    list: async (): Promise<SavedAddress[]> => {
      const result = await http<{ data: SavedAddress[] }>("/api/v1/me/addresses");
      return result.data;
    },
    create: async (data: AddressInput): Promise<SavedAddress> => {
      const result = await http<{ data: SavedAddress }>("/api/v1/me/addresses", { method: "POST", body: data });
      return result.data;
    },
    update: async (id: string, data: AddressInput): Promise<SavedAddress> => {
      const result = await http<{ data: SavedAddress }>(`/api/v1/me/addresses/${encodeURIComponent(id)}`, { method: "PATCH", body: data });
      return result.data;
    },
    remove: async (id: string): Promise<void> => {
      await http<{ data: { deleted: true } }>(`/api/v1/me/addresses/${encodeURIComponent(id)}`, { method: "DELETE" });
    },
  },
};

export const listZones = profileApi.zones;
