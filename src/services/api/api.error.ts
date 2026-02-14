export class ApiError extends Error {
  status?: number;
  data?: unknown;

  constructor(message: string, status?: number, data?: unknown) {
    super(message);
    this.status = status;
    this.data = data;
  }
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
    return new ApiError("Network error. Please check connection.");
  }

  return new ApiError(error.message);
};
