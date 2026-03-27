import { apiClient } from "@/src/services/api/api.client";
import {
    ExplorePost,
    ExploreResponse,
    GlobalSearchPostsFilter,
    GridItem,
    Post,
    SearchResponse,
} from "@/src/services/api/api.types";
import { isLargeItem } from "@/src/utils/helpers";
import { useInfiniteQuery } from "@tanstack/react-query";
import { usePostStore } from "./post.store";

export const useGetExploreQuery = () => {
  const query = useInfiniteQuery({
    queryKey: ["explore"],
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
    queryKey: ["global-search", query, filter],
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
  return useInfiniteQuery({
    queryKey: ["global-search", query, filter],
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
    select: (data) => {
      const allPosts: Post[] = data.pages.flatMap((page) =>
        page.data.filter === "people" ? [] : page.data.posts,
      );
      usePostStore.getState().upsertPosts(allPosts);
      return {
        ...data,
        pages: data.pages.map((page) => {
          if (page.data.filter === "people") {
            return page;
          }
          return {
            ...page,
            data: {
              ...page.data,
              posts: page.data.posts.map((post) => post.id),
            },
          };
        }),
      };
    },
  });
};
