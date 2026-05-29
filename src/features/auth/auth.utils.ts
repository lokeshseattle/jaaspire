// auth.utils.ts
import { asyncStoragePersister } from "@/src/lib/persister";
import { queryClient } from "@/src/lib/query-client"; // IMPORTANT
import { clearIapAccountToken } from "@/src/features/wallet/iap-account-token";
import { tokenStorage } from "@/src/lib/secure-storage";
import { disconnectPusherOnLogout } from "@/src/lib/pusher";
import { useAuthStore } from "./auth.store";

export const forceLogout = async () => {
  if (!useAuthStore.getState().isAuthenticated) {
    return;
  }
  await disconnectPusherOnLogout();
  await tokenStorage.remove();
  await clearIapAccountToken();
  useAuthStore.getState().setToken(null);
  queryClient.clear();
  await asyncStoragePersister.removeClient();
};
