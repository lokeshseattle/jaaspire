import { useAuthStore } from "@/src/features/auth/auth.store";
import { forceLogout } from "@/src/features/auth/auth.utils";
import axios, {
  AxiosError,
  AxiosResponse,
  InternalAxiosRequestConfig,
} from "axios";
import { normalizeApiError } from "./api.error";

const baseURL = "https://jaaspire.com/api/v1";

// Logger helper
const logger = {
  request: (config: InternalAxiosRequestConfig, hasToken: boolean) => {
    if (!__DEV__) return;
    console.log(`\n🚀 ${config.method?.toUpperCase()} ${config.url}`);
    console.log(`📦 Body: ${JSON.stringify(config.data) ?? "None"}`);
    console.log(`🔑 Auth: ${hasToken ? "Yes" : "No"}\n`);
  },
  response: (response: AxiosResponse) => {
    if (!__DEV__) return;
    console.log(`\n✅ ${response.status} ${response.config.url}`);
    console.log(`📥 ${JSON.stringify(response.data, null, 2)}\n`);
  },
  error: (error: AxiosError) => {
    if (!__DEV__) return;
    console.log(`\n❌ ${error.response?.status ?? "ERR"} ${error.config?.url}`);
    console.log(`📛 ${error.message}`);
    console.log(`📥 ${JSON.stringify(error.response?.data, null, 2)}\n`);
  },
};

export const apiClient = axios.create({
  baseURL,
});

apiClient.interceptors.request.use(
  (config) => {
    const token = useAuthStore.getState().accessToken;

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    logger.request(config, !!token);

    return config;
  },
  (error) => {
    logger.error(error);
    return Promise.reject(error);
  },
);

apiClient.interceptors.response.use(
  (response) => {
    logger.response(response);
    return response;
  },
  async (error) => {
    logger.error(error);

    if (error.response?.data?.message === "Unauthenticated.")
      await forceLogout();

    return Promise.reject(normalizeApiError(error));
  },
);
