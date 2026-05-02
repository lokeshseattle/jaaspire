import { queryClient } from "@/src/lib/query-client";
import { apiClient } from "@/src/services/api/api.client";
import {
  BookmarkPostResponse,
  BookmarksResponse,
  CreateReportPayload,
  DeletePostResponse,
  FeedResponse,
  PinPostResponse,
  PossibleErrorResponse,
  ReportTypesData,
  ReportTypesResponse,
  SinglePostResponse,
} from "@/src/services/api/api.types";
import type { InfiniteData } from "@tanstack/react-query";
import {
  useInfiniteQuery,
  useMutation,
  UseMutationResult,
  useQuery,
  UseQueryResult,
} from "@tanstack/react-query";
import type { AxiosResponse } from "axios";
import { useLayoutEffect } from "react";
import { usePostStore } from "./post.store";

/** Feed-like infinite queries whose `pages[].data.posts` should drop a deleted post id. */
const INFINITE_POST_LIST_ROOT_KEYS = new Set([
  "feed",
  "user_feed",
  "bookmarks",
  "flicks",
  "explore",
  "global-search",
]);

function filterPostsArrayRemovingId(
  posts: unknown[],
  postId: number,
): unknown[] {
  return posts.filter((item) => {
    if (typeof item === "number") return item !== postId;
    if (item && typeof item === "object" && "id" in item) {
      return (item as { id: number }).id !== postId;
    }
    return true;
  });
}

function stripDeletedPostFromInfiniteCaches(postId: number) {
  queryClient.setQueriesData(
    {
      predicate: (query) => {
        const root = query.queryKey[0];
        return (
          typeof root === "string" && INFINITE_POST_LIST_ROOT_KEYS.has(root)
        );
      },
    },
    (oldData: unknown) => {
      if (!oldData || typeof oldData !== "object" || !("pages" in oldData))
        return oldData;
      const infinite = oldData as InfiniteData<{ data: { posts?: unknown[] } }>;
      if (!Array.isArray(infinite.pages)) return oldData;
      return {
        ...infinite,
        pages: infinite.pages.map((page) => {
          const posts = page?.data?.posts;
          if (!Array.isArray(posts)) return page;
          return {
            ...page,
            data: {
              ...page.data,
              posts: filterPostsArrayRemovingId(posts, postId),
            },
          };
        }),
      };
    },
  );
}

export const useGetFeedQuery = () => {
  const query = useInfiniteQuery({
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

    select: (data) => ({
      ...data,
      pages: data.pages.map((page) => ({
        ...page,
        data: {
          ...page.data,
          posts: page.data.posts.map((post) => post.id),
        },
      })),
    }),
  });

  useLayoutEffect(() => {
    const raw = queryClient.getQueryData<InfiniteData<FeedResponse>>(["feed"]);
    if (!raw?.pages?.length) return;
    const allPosts = raw.pages.flatMap((page) => page.data.posts);
    usePostStore.getState().upsertPosts(allPosts);
  }, [query.dataUpdatedAt]);

  return query;
};

export const useGetUserFeedQuery = (
  username: string | undefined,
  type: "video" | "" | "exclusive" = "",
  options?: { enabled?: boolean },
) => {
  const enabledByOption = options?.enabled ?? true;

  const query = useInfiniteQuery({
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
    enabled: enabledByOption && !!username,

    select: (data) => ({
      ...data,
      pages: data.pages.map((page) => ({
        ...page,
        data: {
          ...page.data,
          posts: page.data.posts.map((post) => post.id),
        },
      })),
    }),
  });

  useLayoutEffect(() => {
    if (!username) return;
    const raw = queryClient.getQueryData<InfiniteData<FeedResponse>>([
      "user_feed",
      username,
      type,
    ]);
    if (!raw?.pages?.length) return;
    const allPosts = raw.pages.flatMap((page) => page.data.posts);
    usePostStore.getState().upsertPosts(allPosts);
  }, [query.dataUpdatedAt, username, type]);

  return query;
};

// export const useToggleLikeMutation = () => {
//   // const queryClient = useQueryClient();

//   const updateInfiniteFeed = (oldData: any, postId: number) => {
//     if (!oldData) return oldData;

//     return {
//       ...oldData,
//       pages: oldData.pages.map((page: any) => ({
//         ...page,
//         data: {
//           ...page.data,
//           posts: page.data.posts.map((post: any) => {
//             if (post.id !== postId) return post;

//             const isLiked = post.user_reaction === "love";

//             let updatedReactions;

//             if (isLiked) {
//               // UNLIKE
//               updatedReactions = post.reactions
//                 .map((r: any) =>
//                   r.name === "love"
//                     ? { ...r, count: Math.max(r.count - 1, 0) }
//                     : r
//                 )
//                 .filter((r: any) => r.count > 0);
//             } else {
//               // LIKE
//               const hasLove = post.reactions.some(
//                 (r: any) => r.name === "love"
//               );

//               updatedReactions = hasLove
//                 ? post.reactions.map((r: any) =>
//                   r.name === "love"
//                     ? { ...r, count: r.count + 1 }
//                     : r
//                 )
//                 : [...post.reactions, { name: "love", count: 1 }];
//             }

//             return {
//               ...post,
//               user_reaction: isLiked ? null : "love",
//               reactions: updatedReactions,
//             };
//           }),
//         },
//       })),
//     };
//   };

//   return useMutation({
//     mutationFn: (postId: number) =>
//       apiClient.post(`/posts/${postId}/react`, {
//         reaction_type: "love",
//       }),

//     onMutate: async (postId) => {
//       await queryClient.cancelQueries({ queryKey: ["feed"] });

//       const previousFeed = queryClient.getQueryData(["feed"]);
//       const previousUserFeeds = queryClient.getQueriesData({
//         queryKey: ["user_feed"],
//       });

//       // Update home feed
//       queryClient.setQueryData(["feed"], (old: any) =>
//         updateInfiniteFeed(old, postId)
//       );

//       // Update all user_feed variations
//       previousUserFeeds.forEach(([key]) => {
//         queryClient.setQueryData(key, (old: any) =>
//           updateInfiniteFeed(old, postId)
//         );
//       });

//       return { previousFeed, previousUserFeeds };
//     },

//     onError: (_err, _postId, context) => {
//       if (!context) return;

//       queryClient.setQueryData(["feed"], context.previousFeed);

//       context.previousUserFeeds.forEach(([key, data]: any) => {
//         queryClient.setQueryData(key, data);
//       });
//     },

//   });
// };

export const useToggleLikeMutation = () => {
  return useMutation({
    mutationFn: (postId: number) =>
      apiClient.post(`/posts/${postId}/react`, {
        reaction_type: "love",
      }),

    onMutate: async (postId) => {
      // 1️⃣ Cancel running feed queries
      await queryClient.cancelQueries({ queryKey: ["feed"] });

      const { posts, updatePost } = usePostStore.getState();
      const previousPost = posts[postId];

      if (!previousPost) return;

      // 2️⃣ Optimistic update in Zustand ONLY
      updatePost(postId, (post) => {
        const isLiked = post.user_reaction === "love";

        const currentTotal = post.reactions_count ?? 0;

        let updatedReactions;
        let updatedTotal;

        if (isLiked) {
          // UNLIKE

          updatedReactions = post.reactions
            .map((r: any) =>
              r.name === "love" ? { ...r, count: r.count - 1 } : r,
            )
            .filter((r: any) => r.count > 0);

          updatedTotal = currentTotal - 1;

          return {
            ...post,
            user_reaction: null,
            reactions: updatedReactions,
            reactions_count: updatedTotal === 0 ? null : updatedTotal,
          };
        }

        // LIKE

        const hasLove = post.reactions.some((r: any) => r.name === "love");

        updatedReactions = hasLove
          ? post.reactions.map((r: any) =>
              r.name === "love" ? { ...r, count: r.count + 1 } : r,
            )
          : [...post.reactions, { name: "love", count: 1 }];

        updatedTotal = currentTotal + 1;

        return {
          ...post,
          user_reaction: "love",
          reactions: updatedReactions,
          reactions_count: updatedTotal,
        };
      });

      // 3️⃣ Return rollback snapshot
      return { previousPost };
    },

    onError: (_err, postId, context) => {
      if (!context?.previousPost) return;

      // Rollback
      usePostStore.getState().upsertPosts([context.previousPost]);
    },

    onSettled: () => {
      // Optional: refetch to ensure server truth
      // queryClient.invalidateQueries({ queryKey: ["feed"] });
    },
  });
};

export const useGetSinglePost = (
  postId: string,
  mode: "explore" | "user" = "explore",
) => {
  const query = useInfiniteQuery({
    queryKey: ["single-post", postId, mode],
    queryFn: ({ pageParam }) =>
      apiClient.get<SinglePostResponse>(`/posts/${postId}`, {
        params: { page: pageParam, mode },
      }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      const pagination = lastPage.data.data.recommended.pagination;
      return pagination.has_more ? pagination.current_page + 1 : undefined;
    },

    select: (data) => {
      const allRecommended: number[] = [];
      let mainPostId: number | null = null;

      for (const page of data.pages) {
        const mainPost = page.data.data.post;
        const recommended = page.data.data.recommended.posts;

        mainPostId = mainPost.id;

        allRecommended.push(...recommended.map((p) => p.id));
      }

      return {
        mainPostId,
        recommendedIds: allRecommended,
        pageParams: data.pageParams,
      };
    },
  });

  useLayoutEffect(() => {
    const raw = queryClient.getQueryData<
      InfiniteData<AxiosResponse<SinglePostResponse>>
    >(["single-post", postId, mode]);
    if (!raw?.pages?.length) return;

    for (const page of raw.pages) {
      const mainPost = page.data.data.post;
      const recommended = page.data.data.recommended.posts;
      usePostStore.getState().upsertPosts([mainPost, ...recommended]);
    }
  }, [postId, mode, query.dataUpdatedAt]);

  return query;
};

export const useBookmarkPostMutation = (): UseMutationResult<
  BookmarkPostResponse,
  PossibleErrorResponse,
  { postId: number; action: "add" | "remove" }
> => {
  return useMutation({
    mutationFn: ({
      postId,
      action,
    }: {
      postId: number;
      action: "add" | "remove";
    }) =>
      apiClient
        .post<BookmarkPostResponse>(`/posts/${postId}/bookmark`, { action })
        .then((d) => d.data),
    onMutate: async ({ postId, action }) => {
      await queryClient.cancelQueries({ queryKey: ["feed"] });
      const { posts, updatePost } = usePostStore.getState();
      const previousPost = posts[postId];

      if (!previousPost) return;

      updatePost(postId, (post) => {
        if (action === "add") {
          return {
            ...post,
            is_bookmarked: true,
          };
        }

        return {
          ...post,
          is_bookmarked: false,
        };
      });

      return { previousPost };
    },
    onError: (_err, { postId }, context) => {
      if (!context?.previousPost) return;

      // Rollback
      usePostStore.getState().upsertPosts([context.previousPost]);
    },
  });
};

export const useDeletePostMutation = (): UseMutationResult<
  DeletePostResponse,
  PossibleErrorResponse,
  number
> => {
  return useMutation({
    mutationFn: (postId: number) =>
      apiClient
        .delete<DeletePostResponse>(`/posts/${postId}`)
        .then((d) => d.data),
    onSuccess: (_data, postId) => {
      usePostStore.getState().removePost(postId);
      stripDeletedPostFromInfiniteCaches(postId);
      queryClient.removeQueries({
        predicate: (q) =>
          q.queryKey[0] === "single-post" && q.queryKey[1] === postId,
      });
      queryClient.removeQueries({ queryKey: ["post-comments", postId] });
      // queryClient.invalidateQueries({ queryKey: ["profile"] });
    },
  });
};

export const usePinPostMutation = (): UseMutationResult<
  PinPostResponse,
  PossibleErrorResponse,
  { postId: number; action: "add" | "remove" }
> => {
  return useMutation({
    mutationFn: ({
      postId,
      action,
    }: {
      postId: number;
      action: "add" | "remove";
    }) =>
      apiClient
        .post<PinPostResponse>(`/posts/${postId}/pin`, { action })
        .then((d) => d.data),
    onMutate: async ({ postId, action }) => {
      await queryClient.cancelQueries({ queryKey: ["feed"] });
      const { posts, updatePost } = usePostStore.getState();
      const previousPost = posts[postId];

      if (!previousPost) return;

      updatePost(postId, (post) => {
        if (action === "add") {
          return {
            ...post,
            is_pinned: true,
          };
        }

        return {
          ...post,
          is_pinned: false,
        };
      });

      return { previousPost };
    },
    onError: (_err, { postId }, context) => {
      if (!context?.previousPost) return;

      // Rollback
      usePostStore.getState().upsertPosts([context.previousPost]);
    },
    onSettled: () => {
      // queryClient.invalidateQueries({ queryKey: ["feed"] });
      queryClient.invalidateQueries({ queryKey: ["user_feed"] });
      queryClient.invalidateQueries({ queryKey: ["single-post"] });
    },
  });
};

export const useGetBookmarksQuery = (type?: "all" | "photos" | "videos") => {
  const query = useInfiniteQuery({
    queryKey: ["bookmarks", type],
    queryFn: ({ pageParam }) =>
      apiClient
        .get<BookmarksResponse>("/bookmarks", {
          params: { page: pageParam, type },
        })
        .then((d) => d.data),
    getNextPageParam: (lastPage) =>
      lastPage.data.pagination.has_more
        ? lastPage.data.pagination.current_page + 1
        : undefined,

    initialPageParam: 1,

    select: (data) => ({
      ...data,
      pages: data.pages.map((page) => ({
        ...page,
        data: {
          ...page.data,
          posts: page.data.posts.map((post) => post.id),
        },
      })),
    }),
  });

  useLayoutEffect(() => {
    const raw = queryClient.getQueryData<InfiniteData<BookmarksResponse>>([
      "bookmarks",
      type,
    ]);
    if (!raw?.pages?.length) return;
    const allPosts = raw.pages.flatMap((page) => page.data.posts);
    usePostStore.getState().upsertPosts(allPosts);
  }, [query.dataUpdatedAt, type]);

  return query;
};

export const useGetReport = (): UseQueryResult<
  ReportTypesData,
  PossibleErrorResponse
> => {
  return useQuery({
    queryKey: ["report"],
    queryFn: () =>
      apiClient
        .get<ReportTypesResponse>("/report/types")
        .then((d) => d.data.data),
    staleTime: 1000 * 60 * 60 * 24,
    gcTime: 1000 * 60 * 60 * 24,
  });
};

export const useCreateReportMutation = (): UseMutationResult<
  void,
  PossibleErrorResponse,
  CreateReportPayload
> => {
  return useMutation({
    mutationFn: (payload: CreateReportPayload) =>
      apiClient.post<void>("/report/content", payload).then((d) => d.data),
  });
};

export const useTrackPostView = (): UseMutationResult<
  void,
  PossibleErrorResponse,
  number
> => {
  return useMutation({
    mutationFn: (postId: number) =>
      apiClient.post<void>(`/posts/${postId}/track-view`).then((d) => d.data),
  });
};
