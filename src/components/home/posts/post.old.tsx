// src/components/home/posts/post.tsx
import { useCallback, useMemo } from "react";
import PostFooter from "./post-footer";
import PostHeader from "./post-header";
import PostMedia from "./post-media.old";

import PostContext from "@/src/context/post-context";
import { useToggleLikeMutation } from "@/src/features/post/post.hooks";
import type { Post as PostItem } from "@/src/services/api/api.types";
import { getMediaType } from "@/src/utils/helpers";

interface Props extends PostItem {
  isVisible: boolean;
  onPressComments: () => void;
  onPressShare: () => void;
  nextPost?: PostItem; // Add nextPost prop
}

export default function Post({
  isVisible,
  onPressComments,
  onPressShare,
  nextPost,
  ...post
}: Props) {
  const { attachments } = post;

  const isLiked = post.user_reaction === "love";
  const { mutate: toggleLike } = useToggleLikeMutation();

  const handleToggleLike = useCallback(() => {
    toggleLike(post.id);
  }, [post.id, toggleLike]);

  // Extract current media info
  const currentMedia = attachments[0];
  const mediaType = getMediaType(currentMedia?.type);

  // Extract next post's video info for preloading
  const nextVideoInfo = useMemo(() => {
    if (!nextPost?.attachments?.[0]) return null;

    const nextMedia = nextPost.attachments[0];
    const nextMediaType = getMediaType(nextMedia.type);

    // Only preload if next post is a video
    if (nextMediaType !== "video") return null;

    return {
      postId: nextPost.id,
      url: nextMedia.path,
    };
  }, [nextPost?.id, nextPost?.attachments]);

  // Context value - memoized to prevent unnecessary re-renders
  const contextValue = useMemo(
    () => ({
      post,
      isLiked,
      toggleLike: handleToggleLike,
      onPressComments,
      onPressShare,
    }),
    [post, isLiked, handleToggleLike, onPressComments, onPressShare],
  );

  return (
    <PostContext.Provider value={contextValue}>
      <PostHeader />
      <PostMedia
        postId={post.id}
        media={currentMedia?.path}
        type={mediaType}
        price={post.price}
        fullDuration={currentMedia?.duration}
        viewer={post.viewer}
        isExclusive={post.is_exclusive}
        isVisible={isVisible}
        isLiked={isLiked}
        onLike={handleToggleLike}
        // Forward next video info for preloading
        nextPostId={nextVideoInfo?.postId}
        nextPostUrl={nextVideoInfo?.url}
      />
      <PostFooter />
    </PostContext.Provider>
  );
}
