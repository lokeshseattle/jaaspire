import { registerPushDevice, unregisterPushDevice } from "@/src/features/push/push-device.api";
import { asyncStoragePersister } from "@/src/lib/persister";
import { queryClient } from "@/src/lib/query-client";
import {
  clearIapAccountToken,
  syncIapAccountTokenFromMe,
} from "@/src/features/wallet/iap-account-token";
import { clearIapPendingStorage } from "@/src/features/wallet/iap-pending.storage";
import { disconnectPusherOnLogout } from "@/src/lib/pusher";
import { pushTokenStorage, tokenStorage } from "@/src/lib/secure-storage";
import { apiClient } from "@/src/services/api/api.client";
import {
  getPushDeviceName,
  getPushPlatform,
  registerForPushNotificationsAsync,
} from "@/src/utils/notifications";
import {
  DeleteAccountRequest,
  DeleteAccountResponse,
  ForgotPasswordRequest,
  ForgotPasswordResponse,
  LoginRequest,
  LoginResponse,
  PossibleErrorResponse,
  RegisterRequest,
  Resend2FARequest,
  Resend2FAResponse,
  ResendEmailVerificationResponse,
  ValidateUsernameResponse,
  Verify2FARequest,
  Verify2FAResponse,
} from "@/src/services/api/api.types";
import {
  useMutation,
  UseMutationResult,
  useQuery,
  UseQueryResult,
} from "@tanstack/react-query";
import { useCallback } from "react";
import { Alert } from "react-native";
import { notifyLogout } from "./auth.utils";
import { useAuthStore } from "./auth.store";

/** True once SecureStore restore finished and the user has a valid in-memory session. */
export function useAuthQueryReady(): boolean {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isLoading = useAuthStore((s) => s.isLoading);
  return isAuthenticated && !isLoading;
}

async function runPostLoginSetup(): Promise<void> {
  try {
    await syncIapAccountTokenFromMe();
  } catch (error) {
    if (__DEV__) {
      // console.warn("[auth] iap account token sync on login failed", error);
    }
  }

  try {
    const pushToken = await registerForPushNotificationsAsync();
    const platform = getPushPlatform();
    if (pushToken && platform) {
      const device_name = await getPushDeviceName();
      await registerPushDevice({ token: pushToken, platform, device_name });
      await pushTokenStorage.save(pushToken);
    }
  } catch (error) {
    if (__DEV__) {
      // console.warn("[auth] push registration on login failed", error);
    }
  }
}

export const useLogin = (): UseMutationResult<
  LoginResponse,
  PossibleErrorResponse,
  LoginRequest
> => {
  return useMutation({
    mutationFn: async (data) => {
      const response = await apiClient.post("/auth/login", data);
      return response.data;
    },
  });
};

export const useRegister = (): UseMutationResult<
  LoginResponse,
  PossibleErrorResponse,
  RegisterRequest
> => {
  return useMutation({
    mutationFn: (d) => apiClient.post("/auth/register", d).then((d) => d.data),
  });
};

export const useResend2FA = (): UseMutationResult<
  Resend2FAResponse,
  PossibleErrorResponse,
  Resend2FARequest
> => {
  return useMutation({
    mutationFn: (body) =>
      apiClient.post("/auth/resend-2fa", body).then((r) => r.data),
  });
};

export const useVerify2FA = (): UseMutationResult<
  Verify2FAResponse,
  PossibleErrorResponse,
  Verify2FARequest
> => {
  return useMutation({
    mutationFn: (body) =>
      apiClient.post("/auth/verify-2fa", body).then((r) => r.data),
  });
};

export const useForgotPassword = (): UseMutationResult<
  ForgotPasswordResponse,
  PossibleErrorResponse,
  ForgotPasswordRequest
> => {
  return useMutation({
    mutationFn: (body) =>
      apiClient.post("/auth/password/forgot", body).then((r) => r.data),
  });
};

export const useResendEmailVerification = (): UseMutationResult<
  ResendEmailVerificationResponse,
  PossibleErrorResponse,
  void
> => {
  return useMutation({
    mutationFn: () =>
      apiClient.post("/auth/email/resend-verification").then((r) => r.data),
  });
};

export const useDeleteAccountMutation = (): UseMutationResult<
  DeleteAccountResponse,
  PossibleErrorResponse,
  DeleteAccountRequest
> => {
  return useMutation({
    mutationFn: (body) =>
      apiClient.delete("/auth/account", { data: body }).then((r) => r.data),
  });
};

export const useAuth = () => {
  const accessToken = useAuthStore((s) => s.accessToken);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isLoading = useAuthStore((s) => s.isLoading);
  const setLoading = useAuthStore((s) => s.setLoading);
  const setToken = useAuthStore((s) => s.setToken);

  // const logoutMutation = useMutation({
  //   mutationFn: () =>
  //     apiClient.post("/api/v1/auth/logout").then((res) => res.data),
  //   onSuccess: async () => {
  //     await tokenStorage.remove();
  //     setToken(null);
  //     queryClient.clear();
  //     await asyncStoragePersister.removeClient();
  //     router.replace("/(auth)/login");
  //   },
  //   onError: () => {
  //     Alert.alert("Error", "Something went wrong. Try restarting the app.");
  //   },
  // });

  // Restore session on app start
  const restoreSession = useCallback(async (): Promise<void> => {
    let storedToken: string | null = null;

    try {
      setLoading(true);
      storedToken = await tokenStorage.get();

      if (storedToken) {
        setToken(storedToken);
      } else {
        setToken(null);
        await clearIapAccountToken();
        await clearIapPendingStorage();
      }
    } catch (error) {
      // console.error("Restore session failed:", error);
      notifyLogout({
        title: "Signed out",
        message:
          "Could not restore your saved session from secure storage. Please sign in again.",
      });
      setToken(null);
    } finally {
      setLoading(false);
    }

    if (storedToken) {
      void syncIapAccountTokenFromMe().catch(() => {
        /* non-fatal; must not affect session */
      });
    }
  }, [setLoading, setToken]);

  const login = useCallback(
    async (token: string): Promise<void> => {
      await tokenStorage.save(token);
      setToken(token);
      void runPostLoginSetup();
    },
    [setToken],
  );

  // Logout
  const logout = useCallback(async (): Promise<void> => {
    try {
      const pushToken = await pushTokenStorage.get();
      if (pushToken) {
        await unregisterPushDevice(pushToken);
      }

      await apiClient.post("/auth/logout");

      await disconnectPusherOnLogout();
      await tokenStorage.remove();
      await pushTokenStorage.remove();
      await clearIapAccountToken();
      await clearIapPendingStorage();
      setToken(null);
      queryClient.clear();
      await asyncStoragePersister.removeClient();
    } catch (error) {
      Alert.alert("Error", "Something went wrong. Try restarting the app.");
    }
  }, [setToken]);
  return {
    accessToken,
    isAuthenticated,
    isLoading,
    login,
    logout,
    restoreSession,
  };
};

export const useCheckUsername = (
  username: string,
): UseQueryResult<ValidateUsernameResponse, PossibleErrorResponse> => {
  return useQuery({
    queryKey: ["validate-username", username],
    queryFn: () =>
      apiClient
        .post("/auth/validate/username", { username })
        .then((res) => res.data),
    enabled: !!username && username.length >= 3,
    refetchOnWindowFocus: false,
  });
};
