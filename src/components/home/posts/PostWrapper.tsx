// Android: single feed-primary post is "focused" — only that row mounts full video + playback.
import Post from "@/src/components/home/posts/post";
import { usePostStore } from "@/src/features/post/post.store";
import { memo, useCallback, useRef } from "react";
import { useShallow } from "zustand/react/shallow";

const PRELOAD_RADIUS = 1;

type PostItemProps = {
  id: number;
  feedIndex: number;
  visibleFeedIndex: number;
  nextId?: number | null;
  visiblePostId: number | null;
  isScreenFocused: boolean;
  openComments: (id: number) => void;
  openShare: (id: number) => void;
};

const PostItem = ({
  id,
  feedIndex,
  visibleFeedIndex,
  nextId,
  visiblePostId,
  isScreenFocused,
  openComments,
  openShare,
}: PostItemProps) => {
  const post = usePostStore(useShallow((state) => state.posts[id]));

  const nextPost = usePostStore(
    useShallow((state) => (nextId != null ? state.posts[nextId] : undefined)),
  );

  // Stabilize callback identity — `id` rarely changes for a mounted cell.
  const idRef = useRef(id);
  idRef.current = id;
  const stableOpenComments = useCallback(
    () => openComments(idRef.current),
    [openComments],
  );
  const stableOpenShare = useCallback(
    () => openShare(idRef.current),
    [openShare],
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
      onPressComments={stableOpenComments}
      onPressShare={stableOpenShare}
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
