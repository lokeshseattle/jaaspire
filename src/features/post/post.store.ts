import { Post } from "@/src/services/api/api.types";
import { create } from "zustand";

type PostStore = {
    posts: Record<number, Post>;

    upsertPosts: (posts: Post[]) => void;

    updatePost: (
        id: number,
        updater: (post: Post) => Post
    ) => void;

    removePost: (id: number) => void;
};

export const usePostStore = create<PostStore>((set, get) => ({
    posts: {},

    upsertPosts: (posts) =>
        set((state) => {
            const updated = { ...state.posts };

            posts.forEach((post) => {
                const existing = state.posts[post.id];
                const merged: Post = {
                    ...(existing ?? {}),
                    ...post,
                };
                // Search/explore payloads sometimes omit `user` or send null; don't wipe a good user from feed.
                if (post.user == null && existing?.user != null) {
                    merged.user = existing.user;
                }
                updated[post.id] = merged;
            });

            return { posts: updated };
        }),

    updatePost: (id, updater) =>
        set((state) => {
            const existing = state.posts[id];
            if (!existing) return state;

            return {
                posts: {
                    ...state.posts,
                    [id]: updater(existing),
                },
            };
        }),

    removePost: (id) =>
        set((state) => {
            const copy = { ...state.posts };
            delete copy[id];
            return { posts: copy };
        }),
}));