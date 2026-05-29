import { apiClient } from "@/src/services/api/api.client";
import {
  AddCommentRequest,
  AddCommentResponse,
  CommentsResponse,
  OptimisticComment,
  OptimisticReply,
  ProfileResponse,
  TComment,
} from "@/src/services/api/api.types";
import { queryClient } from "@/src/lib/query-client";
import { useInfiniteQuery, useMutation } from "@tanstack/react-query";
import { postKeys } from "./post.query-keys";
import { usePostStore } from "./post.store";

/**
 * Get Post Comments (Infinite)
 */
export const useGetPostComments = (postId: number) => {
  const query = useInfiniteQuery<CommentsResponse>({
    queryKey: postKeys.comments(postId),
    initialPageParam: 1,
    queryFn: async ({ pageParam }) => {
      const { data } = await apiClient.get<CommentsResponse>(
        `posts/${postId}/comments?page=${pageParam}`,
      );
      return data;
    },
    getNextPageParam: (lastPage) => {
      const pagination = lastPage.data.pagination;
      return pagination.has_more ? pagination.current_page + 1 : undefined;
    },
    enabled: !!postId,
  });

  const comments: TComment[] =
    query.data?.pages.flatMap((page) => page.data.comments) ?? [];

  const hasMore =
    query.data?.pages?.[query.data.pages.length - 1]?.data.pagination.has_more ??
    false;

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
        { message, reply_id },
      );
      return data;
    },

    onMutate: async ({ postId, message, reply_id }) => {
      await queryClient.cancelQueries({ queryKey: postKeys.comments(postId) });

      const previousComments = queryClient.getQueryData<{
        pages: CommentsResponse[];
        pageParams: number[];
      }>(postKeys.comments(postId));
      const previousPost = usePostStore.getState().posts[postId];

      const profileData = queryClient.getQueryData<ProfileResponse>(["profile"]);
      const currentUser = profileData?.data;
      if (!currentUser || !previousComments) {
        return { previousComments, postId, previousPost };
      }

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

      if (reply_id === null) {
        const optimisticComment: OptimisticComment = {
          id: -Date.now() - Math.floor(Math.random() * 1000),
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
        }>(postKeys.comments(postId), (old) => {
          if (!old) return old;
          return {
            ...old,
            pages: old.pages.map((page, index) => {
              if (index !== 0) return page;
              return {
                ...page,
                data: {
                  ...page.data,
                  comments: [optimisticComment, ...page.data.comments],
                },
              };
            }),
          };
        });

        usePostStore
          .getState()
          .updatePost(postId, (post) => ({
            ...post,
            comments_count: (post.comments_count ?? 0) + 1,
          }));
      } else {
        const optimisticReply: OptimisticReply = {
          id: -Date.now() - Math.floor(Math.random() * 1000),
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
        }>(postKeys.comments(postId), (old) => {
          if (!old) return old;
          return {
            ...old,
            pages: old.pages.map((page) => ({
              ...page,
              data: {
                ...page.data,
                comments: page.data.comments.map((comment) => {
                  if (comment.id !== reply_id) return comment;
                  return {
                    ...comment,
                    reply_count: comment.reply_count + 1,
                    replies: [...comment.replies, optimisticReply],
                  };
                }),
              },
            })),
          };
        });
      }

      return { previousComments, postId, previousPost };
    },

    onError: (err, _variables, context) => {
      if (context?.previousComments) {
        queryClient.setQueryData(
          postKeys.comments(context.postId),
          context.previousComments,
        );
      }
      if (context?.previousPost) {
        usePostStore.getState().upsertPosts([context.previousPost]);
      }
      console.error("Failed to add comment:", err);
    },

    onSettled: (_data, _error, variables) => {
      queryClient.invalidateQueries({
        queryKey: postKeys.comments(variables.postId),
      });
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
      const { data } = await apiClient.delete(`posts/${postId}/comments/${commentId}`);
      return data;
    },
    onSuccess: (_, { postId }) => {
      queryClient.invalidateQueries({ queryKey: postKeys.comments(postId) });
      usePostStore
        .getState()
        .updatePost(postId, (post) => ({
          ...post,
          comments_count: Math.max((post.comments_count ?? 0) - 1, 0),
        }));
    },
    onError: (error) => {
      console.error("Failed to delete comment:", error);
    },
  });
};

export const useLikeComment = () => {
  return useMutation({
    mutationFn: async ({
      postId,
      commentId,
    }: {
      postId: number;
      commentId: number;
    }) => {
      const { data } = await apiClient.post(
        `posts/${postId}/comments/${commentId}/react`,
        { reaction_type: "love" },
      );
      return data;
    },

    onMutate: async ({ postId, commentId }) => {
      await queryClient.cancelQueries({ queryKey: postKeys.comments(postId) });

      const previous = queryClient.getQueryData(postKeys.comments(postId));

      queryClient.setQueryData(postKeys.comments(postId), (old: any) => {
        if (!old) return old;

        return {
          ...old,
          pages: old.pages.map((page: any) => ({
            ...page,
            data: {
              ...page.data,
              comments: page.data.comments.map((comment: TComment) => {
                if (comment.id === commentId) {
                  return {
                    ...comment,
                    is_liked: !comment.is_liked,
                    reactions: comment.is_liked
                      ? comment.reactions - 1
                      : comment.reactions + 1,
                  };
                }
                return {
                  ...comment,
                  replies: comment.replies.map((reply) =>
                    reply.id === commentId
                      ? {
                          ...reply,
                          is_liked: !reply.is_liked,
                          reactions: reply.is_liked
                            ? reply.reactions - 1
                            : reply.reactions + 1,
                        }
                      : reply,
                  ),
                };
              }),
            },
          })),
        };
      });

      return { previous, postId };
    },

    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(postKeys.comments(context.postId), context.previous);
      }
    },
  });
};