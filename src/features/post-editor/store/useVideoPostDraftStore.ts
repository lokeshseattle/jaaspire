import { create } from "zustand";

export interface PickedFile {
  uri: string;
  name: string;
  type: string;
  size?: number;
}

type VideoPostDraftStore = {
  video: PickedFile | null;
  thumbnail: PickedFile | null;
  thumbnailTimeMs: number | null;
  setVideo: (file: PickedFile | null) => void;
  setThumbnail: (file: PickedFile | null) => void;
  setThumbnailTimeMs: (ms: number | null) => void;
  reset: () => void;
};

export const useVideoPostDraftStore = create<VideoPostDraftStore>((set) => ({
  video: null,
  thumbnail: null,
  thumbnailTimeMs: null,
  setVideo: (file) => set({ video: file }),
  setThumbnail: (file) => set({ thumbnail: file }),
  setThumbnailTimeMs: (ms) => set({ thumbnailTimeMs: ms }),
  reset: () => set({ video: null, thumbnail: null, thumbnailTimeMs: null }),
}));

