import { apiClient } from "@/src/services/api/api.client";
import { NotificationsAPIResponse, PossibleErrorResponse } from "@/src/services/api/api.types";
import { useInfiniteQuery } from "@tanstack/react-query";

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