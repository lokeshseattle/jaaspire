import { API_BASE_URL } from "@/src/constants/app-env";
import { useAuthStore } from "@/src/features/auth/auth.store";
import { forceLogout } from "@/src/features/auth/auth.utils";
import axios, {
  AxiosError,
  AxiosResponse,
  InternalAxiosRequestConfig,
} from "axios";
import type { ApiRequestConfig } from "./api.client.types";
import "./api.client.types";
import { normalizeApiError } from "./api.error";

const baseURL = API_BASE_URL;

/** Set to true to test with local mock upload API (run: npm run mock:upload-api) */
// const USE_MOCK_UPLOAD_API = __DEV__ && false;
// const MOCK_UPLOAD_BASE_URL =
//   (typeof process !== "undefined" &&
//     process.env?.EXPO_PUBLIC_MOCK_UPLOAD_BASE_URL) ||
//   "http://localhost:3333/api/v1";

// Logger helper

const LOG_REQUEST = false;
const LOG_RESPONSE = false;
const LOG_ERROR = false;

const buildFullUrl = (config: InternalAxiosRequestConfig) => {
  if (!config.params) return config.url;

  const query = new URLSearchParams(config.params as any).toString();
  return `${config.url}?${query}`;
};

const logger = {
  request: (config: InternalAxiosRequestConfig, hasToken: boolean) => {
    if (!__DEV__ || !LOG_REQUEST) return;

    const fullUrl = buildFullUrl(config);

    // console.log(`\n🚀 ${config.method?.toUpperCase()} ${fullUrl}`);
    // console.log(`📦 Body: ${JSON.stringify(config.data) ?? "None"}`);
    // console.log(`🔑 Auth: ${hasToken ? "Yes" : "No"}\n`);
  },
  response: (response: AxiosResponse) => {
    if (!__DEV__ || !LOG_RESPONSE) return;
    // console.log(`\n✅ ${response.status} ${response.config.url}`);
    // console.log(`📥 ${JSON.stringify(response.data, null, 2)}\n`);
  },
  error: (error: AxiosError) => {
    if (!__DEV__ || !LOG_ERROR) return;
    // console.log(`\n❌ ${error.response?.status ?? "ERR"} ${error.config?.url}`);
    // console.log(`📛 ${error.message}`);
    // console.log(`📥 ${JSON.stringify(error.response?.data, null, 2)}\n`);
  },
};

export const apiClient = axios.create({
  baseURL,
  timeout: 60000, // 60 seconds
  maxContentLength: Infinity,
  maxBodyLength: Infinity,
});

apiClient.interceptors.request.use(
  (config) => {
    const token = useAuthStore.getState().accessToken;
    const requestConfig = config as ApiRequestConfig;

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    requestConfig.sentWithAuth = !!token;

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

    const requestConfig = error.config as ApiRequestConfig | undefined;
    const isUnauthenticated =
      error.response?.data?.message === "Unauthenticated.";
    const authState = useAuthStore.getState();

    if (
      isUnauthenticated &&
      !authState.isLoading &&
      requestConfig?.sentWithAuth &&
      !requestConfig.skipAuthLogout
    ) {
      const endpoint = requestConfig.url ?? "unknown endpoint";
      const status = error.response?.status ?? 401;
      const serverMessage =
        typeof error.response?.data?.message === "string"
          ? error.response.data.message
          : "Unauthenticated.";

      await forceLogout({
        notice: {
          title: "Signed out",
          message: `Your session is no longer valid (${status} ${serverMessage} on ${endpoint}). Please sign in again.`,
        },
      });
    }

    return Promise.reject(normalizeApiError(error));
  },
);
