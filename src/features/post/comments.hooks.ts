import { queryClient } from "@/src/lib/query-client";
import { apiClient } from "@/src/services/api/api.client";
import { AddCommentRequest, AddCommentResponse, CommentsResponse, OptimisticComment, OptimisticReply, ProfileResponse, TComment } from "@/src/services/api/api.types";
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
        mutationFn: async ({ postId, message, reply_id }: AddCommentRequest) => {
            const { data } = await apiClient.post<AddCommentResponse>(
                `posts/${postId}/comments`,
                { message, reply_id }
            );
            return data;
        },

        onMutate: async ({ postId, message, reply_id }) => {
            // 1. Cancel outgoing refetches
            await queryClient.cancelQueries({ queryKey: ["post-comments", postId] });

            // 2. Get previous data for rollback
            const previousComments = queryClient.getQueryData<{
                pages: CommentsResponse[];
                pageParams: number[];
            }>(["post-comments", postId]);

            // 3. Get current user
            const profileData = queryClient.getQueryData<ProfileResponse>(["profile"]);
            const currentUser = profileData?.data;

            if (!currentUser || !previousComments) {
                return { previousComments, postId };
            }

            // 4. Create optimistic user object
            const optimisticUser: TComment["user"] = {
                id: currentUser.id,
                name: currentUser.name,
                username: currentUser.username,
                avatar: currentUser.avatar,
                verified_user: currentUser.verified_user,
                story_status: {
                    has_stories: false,
                    all_viewed: true,
                    story_count: 0,
                },
            };

            // 5. Update cache based on whether it's a comment or reply
            if (reply_id === null) {
                // ===== ADDING A MAIN COMMENT =====
                const optimisticComment: OptimisticComment = {
                    id: Date.now(), // Temporary ID
                    message,
                    user: optimisticUser,
                    reactions: 0,
                    replies: [],
                    reply_count: 0,
                    is_liked: false,
                    created_at: new Date().toISOString(),
                    _isOptimistic: true,
                };

                queryClient.setQueryData<{
                    pages: CommentsResponse[];
                    pageParams: number[];
                }>(["post-comments", postId], (old) => {
                    if (!old) return old;

                    return {
                        ...old,
                        pages: old.pages.map((page, index) => {
                            if (index === 0) {
                                // Add to first page
                                return {
                                    ...page,
                                    data: {
                                        ...page.data,
                                        comments: [optimisticComment, ...page.data.comments],
                                    },
                                };
                            }
                            return page;
                        }),
                    };
                });
            } else {
                // ===== ADDING A REPLY TO A COMMENT =====
                const optimisticReply: OptimisticReply = {
                    id: Date.now(),
                    message,
                    user: optimisticUser,
                    reactions: 0,
                    is_liked: false,
                    created_at: new Date().toISOString(),
                    _isOptimistic: true,
                };

                queryClient.setQueryData<{
                    pages: CommentsResponse[];
                    pageParams: number[];
                }>(["post-comments", postId], (old) => {
                    if (!old) return old;

                    return {
                        ...old,
                        pages: old.pages.map((page) => ({
                            ...page,
                            data: {
                                ...page.data,
                                comments: page.data.comments.map((comment) => {
                                    if (comment.id === reply_id) {
                                        // Found the parent comment, add reply
                                        return {
                                            ...comment,
                                            reply_count: comment.reply_count + 1,
                                            replies: [...comment.replies, optimisticReply],
                                        };
                                    }
                                    return comment;
                                }),
                            },
                        })),
                    };
                });
            }

            // 6. Return context for rollback
            return { previousComments, postId };
        },

        onError: (err, variables, context) => {
            // Rollback on error
            if (context?.previousComments) {
                queryClient.setQueryData(
                    ["post-comments", context.postId],
                    context.previousComments
                );
            }
            // TODO: Show error toast
            console.error("Failed to add comment:", err);
        },

        onSettled: (data, error, variables) => {
            // Refetch to sync with server
            queryClient.invalidateQueries({
                queryKey: ["post-comments", variables.postId]
            });
        },
    });
};
/**
 * Delete Comment
 */
export const useDeleteComment = () => {

    return useMutation({
        mutationFn: async ({ postId, commentId }: { postId: number; commentId: number }) => {
            const { data } = await apiClient.delete(`posts/${postId}/comments/${commentId}`);
            return data;
        },
        onSuccess: (_, { postId }) => {
            // Refetch comments after successful delete
            queryClient.invalidateQueries({ queryKey: ["post-comments", postId] });
        },
        onError: (error) => {
            console.error("Failed to delete comment:", error);
            // TODO: Show error toast
        },
    });
};

export const useLikeComment = () => {

    return useMutation({
        mutationFn: async ({ postId, commentId }: { postId: number; commentId: number }) => {
            const { data } = await apiClient.post(
                `posts/${postId}/comments/${commentId}/react`,
                { reaction_type: "love" }
            );
            return data;
        },

        onMutate: async ({ postId, commentId }) => {
            await queryClient.cancelQueries({ queryKey: ["post-comments", postId] });

            const previous = queryClient.getQueryData(["post-comments", postId]);

            queryClient.setQueryData(["post-comments", postId], (old: any) => {
                if (!old) return old;

                return {
                    ...old,
                    pages: old.pages.map((page: any) => ({
                        ...page,
                        data: {
                            ...page.data,
                            comments: page.data.comments.map((comment: TComment) => {
                                // Main comment match
                                if (comment.id === commentId) {
                                    return {
                                        ...comment,
                                        is_liked: !comment.is_liked,
                                        reactions: comment.is_liked ? comment.reactions - 1 : comment.reactions + 1,
                                    };
                                }
                                // Check replies
                                return {
                                    ...comment,
                                    replies: comment.replies.map((reply) =>
                                        reply.id === commentId
                                            ? {
                                                ...reply,
                                                is_liked: !reply.is_liked,
                                                reactions: reply.is_liked ? reply.reactions - 1 : reply.reactions + 1,
                                            }
                                            : reply
                                    ),
                                };
                            }),
                        },
                    })),
                };
            });

            return { previous, postId };
        },

        onError: (_, __, context) => {
            if (context?.previous) {
                queryClient.setQueryData(["post-comments", context.postId], context.previous);
            }
        },
    });
};