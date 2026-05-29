import { apiClient } from "@/src/services/api/api.client";
import {
  PaymentsResponse,
  SubscriptionsResponse,
  SubscriptionActiveTab,
} from "@/src/services/api/api.types";
import { useInfiniteQuery } from "@tanstack/react-query";

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
