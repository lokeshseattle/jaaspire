import { apiClient } from "@/src/services/api/api.client";
import { SKIP_AUTH_LOGOUT } from "@/src/services/api/api.client.types";
import type { InstallTrackRequest } from "@/src/services/api/api.types";

import { buildInstallSignatureHeaders } from "./attribution.signing";

export async function trackInstall(body: InstallTrackRequest): Promise<void> {
  try {
    const signatureHeaders = buildInstallSignatureHeaders(body.device_id);
    await apiClient.post("/install/track", body, {
      ...SKIP_AUTH_LOGOUT,
      headers: signatureHeaders,
    });
  } catch (error) {
    if (__DEV__) console.warn("[attribution] install track failed", error);
    throw error;
  }
}
