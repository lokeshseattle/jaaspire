import { useAuthStore } from "@/src/features/auth/auth.store";
import axios from "axios";
import { normalizeApiError } from "./api.error";

const baseURL = "http://10.10.22.66:8004/api/v1";

export const apiClient = axios.create({
  baseURL,
});

apiClient.interceptors.request.use(
  (config) => {
    const token = useAuthStore.getState().accessToken;

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error) => Promise.reject(error),
);

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    return Promise.reject(normalizeApiError(error));
  },
);
