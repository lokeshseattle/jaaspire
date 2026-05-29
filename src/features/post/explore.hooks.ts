import { apiClient } from "@/src/services/api/api.client";
import {
  ExplorePost,
  ExploreResponse,
  GlobalSearchPostsFilter,
  GridItem,
  SearchResponse,
} from "@/src/services/api/api.types";
import { isLargeItem } from "@/src/utils/helpers";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useHydratedInfiniteFeed } from "./internals/use-hydrated-infinite-feed";
import { postKeys } from "./post.query-keys";

export const useGetExploreQuery = () => {
  const query = useInfiniteQuery({
    queryKey: postKeys.explore(),
    queryFn: ({ pageParam }) =>
      apiClient
        .get<ExploreResponse>("/explore", {
          params: { page: pageParam },
        })
        .then((d) => d.data),
    getNextPageParam: (lastPage) =>
      lastPage.data.pagination.has_more
        ? lastPage.data.pagination.current_page + 1
        : undefined,

    initialPageParam: 1,
  });
  // Flatten all posts from all pages
  const allPosts: ExplorePost[] =
    query.data?.pages.flatMap((page) => page.data.posts) ?? [];

  // Transform posts to grid items with size info
  const gridItems: GridItem[] = allPosts.map((post, index) => ({
    post,
    isLarge: isLargeItem(index),
  }));

  return {
    ...query,
    posts: allPosts,
    gridItems,
  };
};

export type GlobalSearchFilter = "people" | GlobalSearchPostsFilter;

export const useGlobalSearchQuery = (
  query: string,
  filter: GlobalSearchFilter = "latest",
) => {
  return useInfiniteQuery({
    queryKey: postKeys.search(query, filter),
    queryFn: ({ pageParam }) =>
      apiClient
        .get<SearchResponse>("/search", {
          params: { page: pageParam, query, filter },
        })
        .then((d) => d.data),
    initialPageParam: 1,
    enabled: query.length > 0,
    getNextPageParam: (lastPage) =>
      lastPage.data.pagination.has_more
        ? lastPage.data.pagination.current_page + 1
        : undefined,
  });
};

/** Hydrates `usePostStore` and maps each page's `posts` to post ids (same pattern as `useGetFeedQuery`). */
export const useGlobalSearchPostsQuery = (
  query: string,
  filter: GlobalSearchPostsFilter,
) => {
  const infiniteQuery = useHydratedInfiniteFeed({
    queryKey: postKeys.search(query, filter),
    queryFn: ({ pageParam }) =>
      apiClient
        .get<SearchResponse>("/search", {
          params: { page: pageParam, query, filter },
        })
        .then((d) => d.data),
    enabled: query.length > 0,
    getNextPageParam: (lastPage) =>
      lastPage.data.pagination.has_more
        ? lastPage.data.pagination.current_page + 1
        : undefined,
    extractPostsFromRawPage: (page) =>
      page.data.filter === "people" ? [] : page.data.posts,
    selectPage: (page) => {
      if (page.data.filter === "people") return page;
      return {
        ...page,
        data: {
          ...page.data,
          posts: page.data.posts.map((post) => post.id),
        },
      };
    },
    extractPostIdsFromSelectedPage: (page) =>
      page.data.filter === "people"
        ? []
        : page.data.posts.map((post) =>
            typeof post === "number" ? post : post.id,
          ),
  });

  return infiniteQuery;
};
