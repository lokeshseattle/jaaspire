import { apiClient } from "@/src/services/api/api.client";
import { NotificationsAPIResponse, PendingFollowRequestsResponse, PossibleErrorResponse } from "@/src/services/api/api.types";
import { useInfiniteQuery, useMutation, UseMutationResult } from "@tanstack/react-query";

export type TFilter = "likes" | "subscriptions" | "tips" | ""

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
                }
            );

            return res.data;
        },

        initialPageParam: 1,

        getNextPageParam: (lastPage) => {
            const { pagination } = lastPage.data;

            return pagination.has_more
                ? pagination.current_page + 1
                : undefined;
        },
    });
};

export const useMarkNotificationReadMutation = (): UseMutationResult<void, PossibleErrorResponse
    , string[]> => {
    return useMutation({
        mutationFn: (notification_ids: string[]) => apiClient.post("/notifications/mark-read", { notification_ids })
    })
}

export const useGetPendingRequests = () => {
    return useInfiniteQuery<PendingFollowRequestsResponse, PossibleErrorResponse>({
        queryKey: ["pending_requests"],

        queryFn: async ({ pageParam = 1 }) => {
            const res = await apiClient.get<PendingFollowRequestsResponse>(
                "/follow-requests",
                {
                    params: {
                        page: pageParam,
                    },
                }
            );

            return res.data;
        },

        initialPageParam: 1,

        getNextPageParam: (lastPage) => {
            const { pagination } = lastPage.data;

            return pagination.has_more
                ? pagination.current_page + 1
                : undefined;
        },
    });
};