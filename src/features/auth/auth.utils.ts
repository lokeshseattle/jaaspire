// auth.utils.ts
import { clearIapAccountToken } from "@/src/features/wallet/iap-account-token";
import { asyncStoragePersister } from "@/src/lib/persister";
import { disconnectPusherOnLogout } from "@/src/lib/pusher";
import { queryClient } from "@/src/lib/query-client";
import { tokenStorage } from "@/src/lib/secure-storage";
import {
  DEFAULT_SESSION_LOGOUT_NOTICE,
  type ForceLogoutOptions,
  type LogoutNotice,
} from "./auth.logout.types";
import { useAuthStore } from "./auth.store";

export function notifyLogout(notice: LogoutNotice): void {
  useAuthStore.getState().setLogoutNotice(notice);
}

export const forceLogout = async (options?: ForceLogoutOptions) => {
  if (!useAuthStore.getState().isAuthenticated) {
    return;
  }

  if (!options?.silent) {
    useAuthStore
      .getState()
      .setLogoutNotice(options?.notice ?? DEFAULT_SESSION_LOGOUT_NOTICE);
  }

  await disconnectPusherOnLogout();
  await tokenStorage.remove();
  await clearIapAccountToken();
  useAuthStore.getState().setToken(null);
  queryClient.clear();
  await asyncStoragePersister.removeClient();
};
