import { create } from "zustand";

export interface AuthState {
  accessToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;

  setToken: (token: string | null) => void;
  setLoading: (value: boolean) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: null,
  isAuthenticated: false,
  isLoading: true,

  setToken: (token) =>
    set({
      accessToken: token,
      isAuthenticated: !!token,
    }),

  setLoading: (value) =>
    set({
      isLoading: value,
    }),
}));
