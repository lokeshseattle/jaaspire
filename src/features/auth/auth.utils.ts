// auth.utils.ts
import { asyncStoragePersister } from "@/src/lib/persister";
import { queryClient } from "@/src/lib/query-client"; // IMPORTANT
import { tokenStorage } from "@/src/lib/secure-storage";
import { router } from "expo-router";
import { useAuthStore } from "./auth.store";

export const forceLogout = async () => {
  await tokenStorage.remove();
  useAuthStore.getState().setToken(null);
  queryClient.clear();
  await asyncStoragePersister.removeClient();
  router.replace("/(auth)/login");
};
