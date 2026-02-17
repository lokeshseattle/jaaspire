import { tokenStorage } from "@/src/lib/secure-storage";
import { apiClient } from "@/src/services/api/api.client";
import {
  LoginRequest,
  LoginResponse,
  PossibleErrorResponse,
  RegisterRequest,
  ValidateUsernameResponse,
} from "@/src/services/api/api.types";
import {
  useMutation,
  UseMutationResult,
  useQuery,
  UseQueryResult,
} from "@tanstack/react-query";
import { router } from "expo-router";
import { useCallback } from "react";
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

export const useLogout = () => {
  return useMutation({
    mutationFn: (d) =>
      apiClient.post("/api/v1/auth/logout", d).then((d) => d.data),
  });
};

export const useAuth = () => {
  const accessToken = useAuthStore((s) => s.accessToken);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isLoading = useAuthStore((s) => s.isLoading);
  const setLoading = useAuthStore((s) => s.setLoading);
  const setToken = useAuthStore((s) => s.setToken);

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
    // const logoutMutation = useLogout();
    await tokenStorage.remove();
    setToken(null);
    router.replace("/(auth)/login");
    // logoutMutation.mutate();
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
