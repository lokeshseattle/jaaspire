import { create } from "zustand";
import type { LogoutNotice } from "./auth.logout.types";

export interface AuthState {
  accessToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  logoutNotice: LogoutNotice | null;

  setToken: (token: string | null) => void;
  setLoading: (value: boolean) => void;
  setLogoutNotice: (notice: LogoutNotice | null) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: null,
  isAuthenticated: false,
  isLoading: true,
  logoutNotice: null,

  setToken: (token) =>
    set({
      accessToken: token,
      isAuthenticated: !!token,
    }),

  setLoading: (value) =>
    set({
      isLoading: value,
    }),

  setLogoutNotice: (notice) =>
    set({
      logoutNotice: notice,
    }),
}));
