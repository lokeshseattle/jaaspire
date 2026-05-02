import { asyncStoragePersister } from "@/src/lib/persister";
import { queryClient } from "@/src/lib/query-client";
import { tokenStorage } from "@/src/lib/secure-storage";
import { apiClient } from "@/src/services/api/api.client";
import {
  LoginRequest,
  LoginResponse,
  PossibleErrorResponse,
  RegisterRequest,
  Resend2FARequest,
  Resend2FAResponse,
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
import { router } from "expo-router";
import { useCallback } from "react";
import { Alert } from "react-native";
import { useAuthStore } from "./auth.store";

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
    try {
      setLoading(true);

      const storedToken = await tokenStorage.get();

      if (storedToken) {
        setToken(storedToken);
      } else {
        setToken(null);
      }
    } catch (error) {
      console.error("Restore session failed:", error);
      setToken(null);
    } finally {
      setLoading(false);
    }
  }, [setLoading, setToken]);

  const login = useCallback(
    async (token: string): Promise<void> => {
      await tokenStorage.save(token);
      setToken(token);
      router.replace("/(app)/(tabs)");
    },
    [setToken],
  );

  // Logout
  const logout = useCallback(async (): Promise<void> => {
    try {
      await apiClient.post("/auth/logout");

      await tokenStorage.remove();
      setToken(null);
      queryClient.clear();
      await asyncStoragePersister.removeClient();
      router.replace("/(auth)/login");
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
