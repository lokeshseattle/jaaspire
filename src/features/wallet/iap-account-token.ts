import { iapAccountTokenStorage } from "@/src/lib/secure-storage";
import { apiClient } from "@/src/services/api/api.client";
import { SKIP_AUTH_LOGOUT } from "@/src/services/api/api.client.types";
import type { ProfileResponse, TUserProfile } from "@/src/services/api/api.types";

function normalizeIapAccountToken(
  token: string | null | undefined,
): string | null {
  if (typeof token !== "string") return null;
  const trimmed = token.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function extractIapAccountTokenFromProfile(
  profile: Pick<TUserProfile, "iap_account_token"> | null | undefined,
): string | null {
  return normalizeIapAccountToken(profile?.iap_account_token);
}

export async function persistIapAccountToken(token: string): Promise<void> {
  const normalized = normalizeIapAccountToken(token);
  if (!normalized) return;
  await iapAccountTokenStorage.save(normalized);
}

export async function clearIapAccountToken(): Promise<void> {
  await iapAccountTokenStorage.remove();
}

/** Fetch GET /auth/me and persist `iap_account_token` to secure storage. */
export async function syncIapAccountTokenFromMe(): Promise<string | null> {
  const { data } = await apiClient.get<ProfileResponse>(
    "/auth/me",
    SKIP_AUTH_LOGOUT,
  );
  const token = extractIapAccountTokenFromProfile(data.data);
  if (token) {
    await persistIapAccountToken(token);
  }
  return token;
}

/**
 * Read server-issued IAP account token from secure storage.
 * Re-fetches /auth/me when missing — never generates locally.
 */
export async function getIapAccountTokenForPurchase(): Promise<string> {
  const cached = normalizeIapAccountToken(await iapAccountTokenStorage.get());
  if (cached) return cached;

  const synced = await syncIapAccountTokenFromMe();
  if (synced) return synced;

  throw new Error(
    "Could not load your purchase account token. Sign in again and try once more.",
  );
}

type PurchaseRequestPlatforms = {
  apple?: Record<string, unknown> | null;
  google?: Record<string, unknown> | null;
};

/** Attach appAccountToken / obfuscatedAccountId before launching any store purchase. */
export async function applyIapAccountTokenToPurchaseRequest<
  T extends PurchaseRequestPlatforms,
>(request: T): Promise<T> {
  const token = await getIapAccountTokenForPurchase();
  return {
    ...request,
    ...(request.apple
      ? { apple: { ...request.apple, appAccountToken: token } }
      : {}),
    ...(request.google
      ? { google: { ...request.google, obfuscatedAccountId: token } }
      : {}),
  } as T;
}
