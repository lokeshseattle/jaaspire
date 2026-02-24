import { apiClient } from "@/src/services/api/api.client";
import { FeedResponse } from "@/src/services/api/api.types";
import { useInfiniteQuery } from "@tanstack/react-query";

export const useGetFeedQuery = () => {
  return useInfiniteQuery({
    queryKey: ["feed"],
    queryFn: ({ pageParam }) =>
      apiClient
        .get<FeedResponse>("/feed", {
          params: { page: pageParam },
        })
        .then((d) => d.data),
    getNextPageParam: (lastPage) =>
      lastPage.data.pagination.has_more
        ? lastPage.data.pagination.current_page + 1
        : undefined,

    initialPageParam: 1,
  });
};

export const useGetUserFeedQuery = (
  username: string | undefined,
  type: "video" | "" = "",
) => {
  return useInfiniteQuery({
    queryKey: ["user_feed", username, type],
    queryFn: ({ pageParam }) =>
      apiClient
        .get<FeedResponse>(`/users/${username}/posts`, {
          params: { page: pageParam, type },
        })
        .then((d) => d.data),
    getNextPageParam: (lastPage) =>
      lastPage.data.pagination.has_more
        ? lastPage.data.pagination.current_page + 1
        : undefined,

    initialPageParam: 1,
    enabled: !!username,
  });
};
