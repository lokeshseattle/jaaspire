import { queryClient } from "@/src/lib/query-client";
import { apiClient } from "@/src/services/api/api.client";
import { FeedResponse, SinglePostResponse } from "@/src/services/api/api.types";
import { useInfiniteQuery, useMutation } from "@tanstack/react-query";

export const useGetFeedQuery = (postId?: string) => {
  return useInfiniteQuery({
    queryKey: ["feed", postId],
    queryFn: ({ pageParam }) =>
      apiClient
        .get<FeedResponse>("/feed", {
          params: { page: pageParam, post_id: postId },
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

export const useToggleLikeMutation = () => {
  // const queryClient = useQueryClient();

  const updateInfiniteFeed = (oldData: any, postId: number) => {
    if (!oldData) return oldData;

    return {
      ...oldData,
      pages: oldData.pages.map((page: any) => ({
        ...page,
        data: {
          ...page.data,
          posts: page.data.posts.map((post: any) => {
            if (post.id !== postId) return post;

            const isLiked = post.user_reaction === "love";

            let updatedReactions;

            if (isLiked) {
              // UNLIKE
              updatedReactions = post.reactions
                .map((r: any) =>
                  r.name === "love"
                    ? { ...r, count: Math.max(r.count - 1, 0) }
                    : r
                )
                .filter((r: any) => r.count > 0);
            } else {
              // LIKE
              const hasLove = post.reactions.some(
                (r: any) => r.name === "love"
              );

              updatedReactions = hasLove
                ? post.reactions.map((r: any) =>
                  r.name === "love"
                    ? { ...r, count: r.count + 1 }
                    : r
                )
                : [...post.reactions, { name: "love", count: 1 }];
            }

            return {
              ...post,
              user_reaction: isLiked ? null : "love",
              reactions: updatedReactions,
            };
          }),
        },
      })),
    };
  };

  return useMutation({
    mutationFn: (postId: number) =>
      apiClient.post(`/posts/${postId}/react`, {
        reaction_type: "love",
      }),

    onMutate: async (postId) => {
      await queryClient.cancelQueries({ queryKey: ["feed"] });

      const previousFeed = queryClient.getQueryData(["feed"]);
      const previousUserFeeds = queryClient.getQueriesData({
        queryKey: ["user_feed"],
      });

      // Update home feed
      queryClient.setQueryData(["feed"], (old: any) =>
        updateInfiniteFeed(old, postId)
      );

      // Update all user_feed variations
      previousUserFeeds.forEach(([key]) => {
        queryClient.setQueryData(key, (old: any) =>
          updateInfiniteFeed(old, postId)
        );
      });

      return { previousFeed, previousUserFeeds };
    },

    onError: (_err, _postId, context) => {
      if (!context) return;

      queryClient.setQueryData(["feed"], context.previousFeed);

      context.previousUserFeeds.forEach(([key, data]: any) => {
        queryClient.setQueryData(key, data);
      });
    },


  });
};

export const useGetSinglePost = (postId: string, mode: "explore" | "profile" = "explore") => {
  return useInfiniteQuery({
    queryKey: ["single-post", postId, mode],
    queryFn: ({ pageParam = 1 }) =>
      apiClient.get<SinglePostResponse>(`/posts/${postId}`, {
        params: { page: pageParam, mode },
      }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      const pagination = lastPage.data.data.recommended.pagination;
      return pagination.has_more
        ? pagination.current_page + 1
        : undefined;
    },
  });
};