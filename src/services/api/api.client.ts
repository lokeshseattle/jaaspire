import { useAuthStore } from "@/src/features/auth/auth.store";
import { forceLogout } from "@/src/features/auth/auth.utils";
import axios, {
  AxiosError,
  AxiosResponse,
  InternalAxiosRequestConfig,
} from "axios";
import { normalizeApiError } from "./api.error";

const baseURL = "https://stgx.jaaspire.com/api/v1";

/** Set to true to test with local mock upload API (run: npm run mock:upload-api) */
// const USE_MOCK_UPLOAD_API = __DEV__ && false;
// const MOCK_UPLOAD_BASE_URL =
//   (typeof process !== "undefined" &&
//     process.env?.EXPO_PUBLIC_MOCK_UPLOAD_BASE_URL) ||
//   "http://localhost:3333/api/v1";

// Logger helper

const LOG_REQUEST = true;
const LOG_RESPONSE = true;
const LOG_ERROR = false;

const logger = {
  request: (config: InternalAxiosRequestConfig, hasToken: boolean) => {
    if (!__DEV__ || !LOG_REQUEST) return;
    console.log(`\n🚀 ${config.method?.toUpperCase()} ${config.url}`);
    console.log(`📦 Body: ${JSON.stringify(config.data) ?? "None"}`);
    console.log(`🔑 Auth: ${hasToken ? "Yes" : "No"}\n`);
  },
  response: (response: AxiosResponse) => {
    if (!__DEV__ || !LOG_RESPONSE) return;
    console.log(`\n✅ ${response.status} ${response.config.url}`);
    console.log(`📥 ${JSON.stringify(response.data, null, 2)}\n`);
  },
  error: (error: AxiosError) => {
    if (!__DEV__ || !LOG_ERROR) return;
    console.log(`\n❌ ${error.response?.status ?? "ERR"} ${error.config?.url}`);
    console.log(`📛 ${error.message}`);
    console.log(`📥 ${JSON.stringify(error.response?.data, null, 2)}\n`);
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
