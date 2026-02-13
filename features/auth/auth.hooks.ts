import { apiClient } from "@/services/api/api.client";
import {
    LoginRequest,
    LoginResponse,
    PossibleErrorResponse,
} from "@/services/api/api.types";
import { useMutation, UseMutationResult } from "@tanstack/react-query";

export const useLogin = (): UseMutationResult<
  LoginResponse,
  PossibleErrorResponse,
  LoginRequest
> => {
  return useMutation({
    mutationFn: (d: LoginRequest) => apiClient.post("/api/v1/auth/login", d),
  });
};
