import { apiClient } from "@/src/services/api/api.client";
import type {
  PushDeviceRegisterRequest,
  PushDeviceRegisterResponse,
} from "@/src/services/api/api.types";

export async function registerPushDevice(
  body: PushDeviceRegisterRequest,
): Promise<void> {
  try {
    await apiClient.post<PushDeviceRegisterResponse>("/push/devices", body);
  } catch (error) {
    if (__DEV__) {
      console.warn("Failed to register push device:", error);
    }
  }
}

export async function unregisterPushDevice(token: string): Promise<void> {
  try {
    await apiClient.delete(`/push/devices/${encodeURIComponent(token)}`);
  } catch (error) {
    if (__DEV__) {
      console.warn("Failed to unregister push device:", error);
    }
  }
}
