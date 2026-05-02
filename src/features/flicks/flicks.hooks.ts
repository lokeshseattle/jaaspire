import { usePostStore } from "@/src/features/post/post.store";
import { queryClient } from "@/src/lib/query-client";
import { useSeedStore } from "@/src/lib/seed.store";
import { apiClient } from "@/src/services/api/api.client";
import type {
  FeedResponse,
  Post,
  SingleFlickApiResponse,
} from "@/src/services/api/api.types";
import type { InfiniteData } from "@tanstack/react-query";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useLayoutEffect, useMemo } from "react";

export type FlicksFeed = "following" | "explore";

export type UseGetFlicksQueryOptions = {
  /**
   * Separates infinite-query caches (e.g. main tab vs `/flick/[id]` deep link).
   * Default `"main"`.
   */
  instanceKey?: string | number;
  /**
   * Post IDs always included in `exclude` together with IDs from pages already in cache
   * (e.g. anchor post when opening the flick detail route).
   */
  extraExcludeIds?: number[];
  /** When false, no network requests (e.g. invalid `/flick/[id]`). Default true. */
  enabled?: boolean;
};

/** Backend paths remain `/reels/*`; UI naming is Flicks. */
function flicksApiPath(feed: FlicksFeed): string {
  return feed === "following" ? "/flicks" : "/flicks/explore";
}

function postsToIds(posts: readonly (Post | number)[]): number[] {
  return posts.map((p) => (typeof p === "number" ? p : p.id));
}

function buildExcludeParam(
  cached: InfiniteData<FeedResponse> | undefined,
  extraExcludeIds: number[],
): string | undefined {
  const priorIds =
    cached?.pages.flatMap((page) =>
      postsToIds(page.data.posts as (Post | number)[]),
    ) ?? [];
  const merged = [...new Set([...extraExcludeIds, ...priorIds])];
  return merged.length > 0 ? merged.join(",") : undefined;
}

/** Fetches one flick by id, normalizes to `Post`, upserts store. */
export async function fetchFlickById(postId: number): Promise<Post> {
  const res = await apiClient.get<SingleFlickApiResponse>(`/flicks/${postId}`);
  const raw = res.data.data;
  const { video: _omitVideo, ...rest } = raw;
  const post = rest as Post;
  usePostStore.getState().upsertPosts([post]);
  return post;
}

/** Flicks feed — same response shape as home feed; backend returns video-only posts. */
export const useGetFlicksQuery = (
  feed: FlicksFeed = "explore",
  options?: UseGetFlicksQueryOptions,
) => {
  const path = flicksApiPath(feed);
  const instanceKey = options?.instanceKey ?? "main";
  const extraExcludeIds = options?.extraExcludeIds ?? [];
  const enabled = options?.enabled ?? true;

  const queryKey = useMemo(
    () => ["flicks", feed, instanceKey] as const,
    [feed, instanceKey],
  );

  const { seed } = useSeedStore();

  const query = useInfiniteQuery({
    queryKey,
    enabled,
    queryFn: ({ pageParam }) => {
      const cached = queryClient.getQueryData<InfiniteData<FeedResponse>>(
        queryKey,
      );
      const exclude = buildExcludeParam(cached, extraExcludeIds);
      return apiClient
        .get<FeedResponse>(path, {
          params: { page: pageParam, exclude, seed },
        })
        .then((d) => d.data);
    },
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
    const raw = queryClient.getQueryData<InfiniteData<FeedResponse>>(queryKey);
    if (!raw?.pages?.length) return;
    const allPosts = raw.pages.flatMap((page) => page.data.posts);
    usePostStore.getState().upsertPosts(allPosts);
  }, [query.dataUpdatedAt, queryKey]);

  return query;
};

/** User-scoped flicks feed — same response shape; hits `/flicks/user/{userId}`. */
export const useGetUserFlicksQuery = (
  userId: number | undefined,
  options?: UseGetFlicksQueryOptions,
) => {
  const instanceKey = options?.instanceKey ?? "main";
  const extraExcludeIds = options?.extraExcludeIds ?? [];
  const enabled = (options?.enabled ?? true) && userId != null;

  const queryKey = useMemo(
    () => ["flicks", "user", userId, instanceKey] as const,
    [userId, instanceKey],
  );

  const { seed } = useSeedStore();

  const query = useInfiniteQuery({
    queryKey,
    enabled,
    queryFn: ({ pageParam }) => {
      const cached = queryClient.getQueryData<InfiniteData<FeedResponse>>(
        queryKey,
      );
      const exclude = buildExcludeParam(cached, extraExcludeIds);
      return apiClient
        .get<FeedResponse>(`/flicks/user/${userId}`, {
          params: { page: pageParam, exclude, seed },
        })
        .then((d) => d.data);
    },
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
    const raw = queryClient.getQueryData<InfiniteData<FeedResponse>>(queryKey);
    if (!raw?.pages?.length) return;
    const allPosts = raw.pages.flatMap((page) => page.data.posts);
    usePostStore.getState().upsertPosts(allPosts);
  }, [query.dataUpdatedAt, queryKey]);

  return query;
};
