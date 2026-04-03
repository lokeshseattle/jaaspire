// Android: single feed-primary post is "focused" — only that row mounts full video + playback.
import Post from "@/src/components/home/posts/post.android";
import { usePostStore } from "@/src/features/post/post.store";
import { memo } from "react";

const PRELOAD_RADIUS = 1;

type PostItemProps = {
  id: number;
  feedIndex: number;
  visibleFeedIndex: number;
  nextId?: number | null;
  visiblePostId: number | null;
  isScreenFocused: boolean;
  openComments: (id: number) => void;
};

const PostItem = ({
  id,
  feedIndex,
  visibleFeedIndex,
  nextId,
  visiblePostId,
  isScreenFocused,
  openComments,
}: PostItemProps) => {
  const post = usePostStore((state) => state.posts[id]);

  const nextPost = usePostStore((state) =>
    nextId != null ? state.posts[nextId] : undefined,
  );

  if (!post) return null;

  const isFocused = visiblePostId === id && isScreenFocused;
  const inVideoWindow =
    visibleFeedIndex >= 0 &&
    Math.abs(feedIndex - visibleFeedIndex) <= PRELOAD_RADIUS;

  return (
    <Post
      {...post}
      isFocused={isFocused}
      inVideoWindow={inVideoWindow}
      onPressComments={() => openComments(id)}
      nextPost={nextPost}
    />
  );
};

export default memo(PostItem, (prevProps, nextProps) => {
  const prevInWindow =
    prevProps.visibleFeedIndex >= 0 &&
    Math.abs(prevProps.feedIndex - prevProps.visibleFeedIndex) <=
      PRELOAD_RADIUS;
  const nextInWindow =
    nextProps.visibleFeedIndex >= 0 &&
    Math.abs(nextProps.feedIndex - nextProps.visibleFeedIndex) <=
      PRELOAD_RADIUS;

  return (
    prevProps.id === nextProps.id &&
    prevProps.feedIndex === nextProps.feedIndex &&
    prevProps.nextId === nextProps.nextId &&
    prevProps.isScreenFocused === nextProps.isScreenFocused &&
    (prevProps.visiblePostId === prevProps.id) ===
      (nextProps.visiblePostId === nextProps.id) &&
    prevInWindow === nextInWindow
  );
});
