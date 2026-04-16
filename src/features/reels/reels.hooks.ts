import { usePostStore } from "@/src/features/post/post.store";
import { apiClient } from "@/src/services/api/api.client";
import type { FeedResponse } from "@/src/services/api/api.types";
import { useInfiniteQuery } from "@tanstack/react-query";

/** Reels feed — same response shape as home feed; backend returns video-only posts. */
export const useGetReelsQuery = () => {
  return useInfiniteQuery({
    queryKey: ["reels"],
    queryFn: ({ pageParam }) =>
      apiClient
        .get<FeedResponse>("/users/Yojo306/posts?type=video", {
          params: { page: pageParam },
        })
        .then((d) => d.data),
    getNextPageParam: (lastPage) =>
      lastPage.data.pagination.has_more
        ? lastPage.data.pagination.current_page + 1
        : undefined,
    initialPageParam: 1,
    select: (data) => {
      const allPosts = data.pages.flatMap((page) => page.data.posts);

      usePostStore.getState().upsertPosts(allPosts);

      return {
        ...data,
        pages: data.pages.map((page) => ({
          ...page,
          data: {
            ...page.data,
            posts: page.data.posts.map((post) => post.id),
          },
        })),
      };
    },
  });
};
