import { memo, useCallback, useMemo, useRef } from "react";
import PostFooter from "./post-footer";
import PostHeader from "./post-header";
import PostMedia from "./post-media";

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
  onPressShare: () => void;
  nextPost?: PostItem;
}

function Post({
  isFocused,
  inVideoWindow,
  onPressComments,
  onPressShare,
  nextPost,
  ...post
}: Props) {
  const { attachments } = post;

  // Keep a ref so context consumers always read the latest post without
  // needing to be in the useMemo dependency array.
  const postRef = useRef(post);
  postRef.current = post;

  const isLiked = post.user_reaction === "love";
  const { mutate: toggleLike } = useToggleLikeMutation();

  const handleToggleLike = useCallback(() => {
    toggleLike(post.id);
  }, [post.id]);

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
      post: postRef.current,
      isLiked,
      toggleLike: handleToggleLike,
      onPressComments,
      onPressShare,
    }),
    // Fine-grained deps: only the fields PostHeader/PostFooter actually read.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      post.id,
      post.user?.id,
      post.user?.avatar,
      post.user?.username,
      post.user?.name,
      post.user_reaction,
      post.comments_count,
      post.views_count,
      post.is_bookmarked,
      post.text,
      post.created_at,
      isLiked,
      handleToggleLike,
      onPressComments,
      onPressShare,
    ],
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
