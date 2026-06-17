import { isAxiosError } from "axios";

export class ApiError extends Error {
  status?: number;
  data?: unknown;
  isNetworkError?: boolean;

  constructor(message: string, status?: number, data?: unknown) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

export function isNetworkError(err: unknown): boolean {
  return err instanceof ApiError && err.isNetworkError === true;
}

/** Reads the server message from ApiError (interceptor) or raw Axios errors. */
export function getApiErrorMessage(
  err: unknown,
  fallback = "Something went wrong",
): string {
  if (err instanceof ApiError && err.message) return err.message;
  if (isAxiosError(err) && err.response?.data) {
    const data = err.response.data as { message?: string };
    if (typeof data.message === "string" && data.message.length > 0) {
      return data.message;
    }
  }
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}

export const normalizeApiError = (error: any) => {
  if (error.response) {
    return new ApiError(
      error.response.data?.message ?? "Something went wrong",
      error.response.status,
      error.response.data,
    );
  }

  if (error.request) {
    const apiError = new ApiError("Please check your internet connection.");
    apiError.isNetworkError = true;
    return apiError;
  }

  return new ApiError(error.message);
};
