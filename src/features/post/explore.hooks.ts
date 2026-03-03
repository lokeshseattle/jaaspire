import { apiClient } from "@/src/services/api/api.client";
import { ExplorePost, ExploreResponse, GridItem } from "@/src/services/api/api.types";
import { isLargeItem } from "@/src/utils/helpers";
import { useInfiniteQuery } from "@tanstack/react-query";

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
    const allPosts: ExplorePost[] = query.data?.pages.flatMap(
        (page) => page.data.posts
    ) ?? [];

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