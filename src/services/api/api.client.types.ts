import type { InternalAxiosRequestConfig } from "axios";

declare module "axios" {
  interface AxiosRequestConfig {
    /** When true, a 401 Unauthenticated response will not trigger forceLogout. */
    skipAuthLogout?: boolean;
  }
}

export type ApiRequestConfig = InternalAxiosRequestConfig & {
  sentWithAuth?: boolean;
};

/** Pass as the second argument to apiClient requests that must never trigger logout on 401. */
export const SKIP_AUTH_LOGOUT = { skipAuthLogout: true } as const;
