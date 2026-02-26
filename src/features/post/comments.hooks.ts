import { apiClient } from "@/src/services/api/api.client";
import { CommentsResponse, TComment } from "@/src/services/api/api.types";
import { useInfiniteQuery, useMutation } from "@tanstack/react-query";

/**
 * Get Post Comments (Infinite)
 */
export const useGetPostComments = (postId: number) => {
    const query = useInfiniteQuery<CommentsResponse>({
        queryKey: ["post-comments", postId],

        initialPageParam: 1,

        queryFn: async ({ pageParam }) => {
            const { data } = await apiClient.get<CommentsResponse>(
                `posts/${postId}/comments?page=${pageParam}`
            );
            return data;
        },

        getNextPageParam: (lastPage) => {
            const pagination = lastPage.data.pagination;

            return pagination.has_more
                ? pagination.current_page + 1
                : undefined;
        },

        enabled: !!postId,
    });

    const comments: TComment[] =
        query.data?.pages.flatMap((page) => page.data.comments) ?? [];

    const hasMore =
        query.data?.pages?.[query.data.pages.length - 1]?.data.pagination
            .has_more ?? false;

    return {
        ...query,
        comments,
        hasMore,
    };
};

/**
 * Add Comment / Reply
 */
export const useAddComment = () => {
    return useMutation({
        mutationFn: async ({
            postId,
            message,
            reply_id,
        }: {
            postId: number;
            message: string;
            reply_id: number | null;
        }) => {
            const { data } = await apiClient.post(
                `posts/${postId}/comments`,
                { message, reply_id }
            );
            return data;
        },
    });
};

/**
 * Delete Comment
 */
export const useDeleteComment = () => {
    return useMutation({
        mutationFn: async ({
            postId,
            commentId,
        }: {
            postId: number;
            commentId: number;
        }) => {
            const { data } = await apiClient.delete(
                `posts/${postId}/comments/${commentId}`
            );
            return data;
        },
    });
};