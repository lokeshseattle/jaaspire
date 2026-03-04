// src/components/home/posts/PostWrapper.tsx
import Post from "@/src/components/home/posts/post";
import { usePostStore } from "@/src/features/post/post.store";
import { memo } from "react";

type PostItemProps = {
    id: number;
    nextId?: number | null;
    visiblePostId: number | null;
    isScreenFocused: boolean;
    openComments: (id: number) => void;
};

const PostItem = ({
    id,
    nextId,
    visiblePostId,
    isScreenFocused,
    openComments,
}: PostItemProps) => {
    // Always call hooks unconditionally
    const post = usePostStore((state) => state.posts[id]);

    // Fix: Always call the hook, use a selector that handles missing nextId
    const nextPost = usePostStore((state) =>
        nextId != null ? state.posts[nextId] : undefined
    );

    if (!post) return null;

    const isVisible = visiblePostId === id && isScreenFocused;

    return (
        <Post
            {...post}
            isVisible={isVisible}
            onPressComments={() => openComments(id)}
            nextPost={nextPost}
        />
    );
};

// Memoize to prevent unnecessary re-renders when parent state changes
export default memo(PostItem, (prevProps, nextProps) => {
    // Only re-render if these specific props change
    return (
        prevProps.id === nextProps.id &&
        prevProps.nextId === nextProps.nextId &&
        prevProps.isScreenFocused === nextProps.isScreenFocused &&
        // Only care about visibility changes that affect THIS post
        (prevProps.visiblePostId === prevProps.id) === (nextProps.visiblePostId === nextProps.id)
    );
});