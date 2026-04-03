import { memo, useCallback, useMemo } from "react";
import PostFooter from "./post-footer";
import PostHeader from "./post-header";
import PostMedia from "./post-media.android";

import PostContext from "@/src/context/post-context";
import { useToggleLikeMutation } from "@/src/features/post/post.hooks";
import type { Post as PostItem } from "@/src/services/api/api.types";
import { getMediaType } from "@/src/utils/helpers";

interface Props extends PostItem {
  /** True when this post is the primary viewable item on the home feed (only one at a time). */
  isFocused: boolean;
  /** True when this row is within ±2 of the primary post — keep a native player mounted for preload. */
  inVideoWindow: boolean;
  onPressComments: () => void;
  nextPost?: PostItem;
}

function Post({
  isFocused,
  inVideoWindow,
  onPressComments,
  nextPost,
  ...post
}: Props) {
  const { attachments } = post;

  const isLiked = post.user_reaction === "love";
  const { mutate: toggleLike } = useToggleLikeMutation();

  const handleToggleLike = useCallback(() => {
    toggleLike(post.id);
  }, [post.id, toggleLike]);

  const currentMedia = attachments[0];
  const mediaType = getMediaType(currentMedia?.type);

  const nextVideoInfo = useMemo(() => {
    if (!nextPost?.attachments?.[0]) return null;

    const nextMedia = nextPost.attachments[0];
    const nextMediaType = getMediaType(nextMedia.type);

    if (nextMediaType !== "video") return null;

    return {
      postId: nextPost.id,
      url: nextMedia.path,
    };
  }, [nextPost?.id, nextPost?.attachments]);

  const contextValue = useMemo(
    () => ({
      post,
      isLiked,
      toggleLike: handleToggleLike,
      onPressComments,
    }),
    [post, isLiked, handleToggleLike, onPressComments],
  );

  return (
    <PostContext.Provider value={contextValue}>
      <PostHeader />
      <PostMedia
        postId={post.id}
        media={currentMedia?.path}
        thumbnail={currentMedia?.thumbnail}
        type={mediaType}
        price={post.price}
        fullDuration={currentMedia?.duration}
        viewer={post.viewer}
        isExclusive={post.is_exclusive}
        isFocused={isFocused}
        inVideoWindow={inVideoWindow}
        isLiked={isLiked}
        onLike={handleToggleLike}
        nextPostId={nextVideoInfo?.postId}
        nextPostUrl={nextVideoInfo?.url}
      />
      <PostFooter />
    </PostContext.Provider>
  );
}

export default memo(Post);
