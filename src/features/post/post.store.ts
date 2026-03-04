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
                updated[post.id] = {
                    ...(state.posts[post.id] ?? {}),
                    ...post,
                };
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