import { queryClient } from "@/src/lib/query-client";
import { apiClient } from "@/src/services/api/api.client";
import {
  BookmarkPostResponse,
  BookmarksResponse,
  CreateReportPayload,
  FeedResponse,
  PossibleErrorResponse,
  ReportTypesData,
  ReportTypesResponse,
  SinglePostResponse,
} from "@/src/services/api/api.types";
import {
  useInfiniteQuery,
  useMutation,
  UseMutationResult,
  useQuery,
  UseQueryResult,
} from "@tanstack/react-query";
import { usePostStore } from "./post.store";

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

    select: (data) => {
      const allPosts = data.pages.flatMap(
        (page) => page.data.posts, // adjust if your structure differs
      );

      // Normalize into Zustand
      usePostStore.getState().upsertPosts(allPosts);

      //Return only IDs instead of full post objects
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

export const useGetUserFeedQuery = (
  username: string | undefined,
  type: "video" | "" = "",
  options?: { enabled?: boolean },
) => {
  const enabledByOption = options?.enabled ?? true;

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
    enabled: enabledByOption && !!username,

    select: (data) => {
      const allPosts = data.pages.flatMap(
        (page) => page.data.posts, // adjust if your structure differs
      );

      // Normalize into Zustand
      usePostStore.getState().upsertPosts(allPosts);

      //Return only IDs instead of full post objects
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
  return useInfiniteQuery({
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
      const store = usePostStore.getState();

      const allRecommended: number[] = [];
      let mainPostId: number | null = null;

      for (const page of data.pages) {
        const mainPost = page.data.data.post;
        const recommended = page.data.data.recommended.posts;

        // 1️⃣ Normalize everything
        store.upsertPosts([mainPost, ...recommended]);

        // 2️⃣ Capture main post ID (same every page)
        mainPostId = mainPost.id;

        // 3️⃣ Collect recommended IDs
        allRecommended.push(...recommended.map((p) => p.id));
      }

      return {
        mainPostId,
        recommendedIds: allRecommended,
        pageParams: data.pageParams,
      };
    },
  });
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

export const useGetBookmarksQuery = (type?: "all" | "image" | "video") => {
  return useInfiniteQuery({
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

    select: (data) => {
      const allPosts = data.pages.flatMap(
        (page) => page.data.posts, // adjust if your structure differs
      );

      // Normalize into Zustand
      usePostStore.getState().upsertPosts(allPosts);

      //Return only IDs instead of full post objects
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
