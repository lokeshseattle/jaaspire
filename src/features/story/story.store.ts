import { create } from "zustand";

interface StoryStore {
    isLoading: boolean;
    uploadProgress: number;  // Add this
    setIsLoading: (v: boolean) => void;
    setUploadProgress: (v: number) => void;  // Add this
}

export const useStoryStore = create<StoryStore>((set) => ({
    isLoading: false,
    uploadProgress: 0,
    setIsLoading: (v) => set({ isLoading: v }),
    setUploadProgress: (v) => set({ uploadProgress: v }),
}));