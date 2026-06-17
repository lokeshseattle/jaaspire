import { apiClient } from "@/src/services/api/api.client";
import {
  PaymentsResponse,
  PossibleErrorResponse,
  SubmitVerificationResponse,
  SubscriptionsResponse,
  SubscriptionActiveTab,
  VerificationFile,
  VerificationStatusResponse,
} from "@/src/services/api/api.types";
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  UseMutationResult,
  UseQueryResult,
} from "@tanstack/react-query";

const multipartFormConfig = {
  headers: { "Content-Type": "multipart/form-data" },
  transformRequest: [(data: unknown) => data],
};

export type VerificationUploadFile = {
  uri: string;
  name: string;
  type: string;
  size?: number;
};

const normalizeVerificationFiles = (files: unknown): VerificationFile[] => {
  if (Array.isArray(files)) return files as VerificationFile[];
  if (files && typeof files === "object") {
    return Object.values(files as Record<string, VerificationFile>);
  }
  return [];
};

export const useVerificationQuery = (): UseQueryResult<
  VerificationStatusResponse,
  PossibleErrorResponse
> => {
  return useQuery({
    queryKey: ["settings", "verify"],
    queryFn: async () => {
      const { data } =
        await apiClient.get<VerificationStatusResponse>("/settings/verify");
      return {
        ...data,
        data: {
          ...data.data,
          files: normalizeVerificationFiles(data.data?.files),
        },
      };
    },
  });
};

export const useSubmitVerificationMutation = (): UseMutationResult<
  SubmitVerificationResponse,
  PossibleErrorResponse,
  VerificationUploadFile[]
> => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (files: VerificationUploadFile[]) => {
      const formData = new FormData();
      files.forEach((file) => {
        formData.append("files[]", {
          uri: file.uri,
          name: file.name,
          type: file.type,
        } as any);
      });

      const { data } = await apiClient.post<SubmitVerificationResponse>(
        "/settings/verify",
        formData,
        multipartFormConfig,
      );
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings", "verify"] });
      queryClient.invalidateQueries({ queryKey: ["profile"] });
    },
  });
};

export const useSubscriptionsQuery = (active: SubscriptionActiveTab) => {
  return useInfiniteQuery({
    queryKey: ["settings", "subscriptions", active],
    queryFn: async ({ pageParam = 1 }) => {
      const { data } = await apiClient.get<SubscriptionsResponse>(
        "/settings/subscriptions",
        {
          params: { active, page: pageParam },
        },
      );

      return data;
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.data.pagination.has_more
        ? lastPage.data.pagination.current_page + 1
        : undefined,
  });
};

export const usePaymentsQuery = () => {
  return useInfiniteQuery({
    queryKey: ["settings", "payments"],
    queryFn: async ({ pageParam = 1 }) => {
      const { data } = await apiClient.get<PaymentsResponse>("/settings/payments", {
        params: { page: pageParam },
      });

      return data;
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.data.pagination.has_more
        ? lastPage.data.pagination.current_page + 1
        : undefined,
  });
};
