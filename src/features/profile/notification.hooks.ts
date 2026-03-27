import { apiClient } from "@/src/services/api/api.client";
import {
  NotificationCountsResponse,
  NotificationsAPIResponse,
  PendingFollowRequestsResponse,
  PossibleErrorResponse,
} from "@/src/services/api/api.types";
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  UseMutationResult,
} from "@tanstack/react-query";

export type TFilter = "likes" | "subscriptions" | "tips" | "";

export const useGetNotifications = (filter: TFilter) => {
  return useInfiniteQuery<NotificationsAPIResponse, PossibleErrorResponse>({
    queryKey: ["notifications", filter],

    queryFn: async ({ pageParam = 1 }) => {
      const res = await apiClient.get<NotificationsAPIResponse>(
        "/notifications",
        {
          params: {
            page: pageParam,
            filter,
          },
        },
      );

      return res.data;
    },

    initialPageParam: 1,

    getNextPageParam: (lastPage) => {
      const { pagination } = lastPage.data;

      return pagination.has_more ? pagination.current_page + 1 : undefined;
    },
  });
};

export const notificationCountsQueryKey = ["notifications", "counts"] as const;

export const useNotificationCounts = () => {
  return useQuery<NotificationCountsResponse, PossibleErrorResponse>({
    queryKey: notificationCountsQueryKey,
    queryFn: async () => {
      const res = await apiClient.get<NotificationCountsResponse>(
        "/notifications/counts",
      );
      return res.data;
    },
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });
};

export const useUnreadMessengerCount = (): number => {
  const { data } = useNotificationCounts();

  const raw = data?.data?.messages ?? 0;
  const numeric =
    typeof raw === "string" ? parseInt(raw, 10) : Number(raw ?? 0);

  if (!Number.isFinite(numeric) || numeric < 0) {
    return 0;
  }

  return numeric;
};

export const useMarkNotificationReadMutation = (): UseMutationResult<
  void,
  PossibleErrorResponse,
  string[]
> => {
  return useMutation({
    mutationFn: (notification_ids: string[]) =>
      apiClient.post("/notifications/mark-read", { notification_ids }),
  });
};

export const useGetPendingRequests = () => {
  return useInfiniteQuery<PendingFollowRequestsResponse, PossibleErrorResponse>(
    {
      queryKey: ["pending_requests"],

      queryFn: async ({ pageParam = 1 }) => {
        const res = await apiClient.get<PendingFollowRequestsResponse>(
          "/follow-requests",
          {
            params: {
              page: pageParam,
            },
          },
        );

        return res.data;
      },

      initialPageParam: 1,

      getNextPageParam: (lastPage) => {
        const { pagination } = lastPage.data;

        return pagination.has_more ? pagination.current_page + 1 : undefined;
      },
    },
  );
};
