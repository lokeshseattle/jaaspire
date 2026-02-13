import axios from "axios";
import { normalizeApiError } from "./api.error";

const baseURL = "http://10.10.22.66:8004";

export const apiClient = axios.create({
  baseURL,
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    return Promise.reject(normalizeApiError(error));
  },
);
