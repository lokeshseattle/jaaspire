// src/stores/useImageEditStore.ts
import { create } from "zustand";
export interface PickedFile {
    uri: string;
    name: string;
    type: string;
    size?: number;
}

type ImageEditStore = {
    originalImage: PickedFile | null;
    editedImage: PickedFile | null;
    setOriginalImage: (file: PickedFile | null) => void;
    setEditedImage: (file: PickedFile | null) => void;
    reset: () => void;
};

export const useImageEditStore = create<ImageEditStore>((set) => ({
    originalImage: null,
    editedImage: null,
    setOriginalImage: (file) => set({ originalImage: file }),
    setEditedImage: (file) => set({ editedImage: file }),
    reset: () => set({ originalImage: null, editedImage: null }),
}));