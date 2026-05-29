import { usePostStore } from "@/src/features/post/post.store";
import { queryClient } from "@/src/lib/query-client";
import type { Post } from "@/src/services/api/api.types";
import type { InfiniteData, QueryKey } from "@tanstack/react-query";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useLayoutEffect, useMemo } from "react";

type SelectedWithPostIds = {
  data: {
    posts: number[];
  };
};

type UseHydratedInfiniteFeedOptions<TRawPage, TSelectedPage> = {
  queryKey: QueryKey;
  queryFn: (args: { pageParam: number }) => Promise<TRawPage>;
  getNextPageParam: (lastPage: TRawPage) => number | undefined;
  extractPostsFromRawPage: (page: TRawPage) => Post[];
  selectPage: (page: TRawPage) => TSelectedPage;
  extractPostIdsFromSelectedPage?: (page: TSelectedPage) => number[];
  enabled?: boolean;
  initialPageParam?: number;
};

export function useHydratedInfiniteFeed<
  TRawPage,
  TSelectedPage = SelectedWithPostIds,
>({
  queryKey,
  queryFn,
  getNextPageParam,
  extractPostsFromRawPage,
  selectPage,
  extractPostIdsFromSelectedPage,
  enabled = true,
  initialPageParam = 1,
}: UseHydratedInfiniteFeedOptions<TRawPage, TSelectedPage>) {
  const query = useInfiniteQuery({
    queryKey,
    queryFn: ({ pageParam }) => queryFn({ pageParam }),
    getNextPageParam,
    initialPageParam,
    enabled,
    select: (data) => ({
      ...data,
      pages: data.pages.map((page) => selectPage(page)),
    }),
  });

  useLayoutEffect(() => {
    const raw = queryClient.getQueryData<InfiniteData<TRawPage>>(queryKey);
    if (!raw?.pages?.length) return;
    const allPosts = raw.pages.flatMap((page) => extractPostsFromRawPage(page));
    if (allPosts.length > 0) {
      usePostStore.getState().upsertPosts(allPosts);
    }
  }, [query.dataUpdatedAt, queryKey, extractPostsFromRawPage]);

  const postIds = useMemo(() => {
    if (!query.data?.pages) return [] as number[];
    if (extractPostIdsFromSelectedPage) {
      return query.data.pages.flatMap((page) => extractPostIdsFromSelectedPage(page));
    }
    return (query.data.pages as SelectedWithPostIds[]).flatMap(
      (page) => page.data.posts,
    );
  }, [query.data?.pages, extractPostIdsFromSelectedPage]);

  return {
    ...query,
    postIds,
  };
}
