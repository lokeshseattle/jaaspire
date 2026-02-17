export type StoryType = "image" | "video";

export interface StoryItem {
  id: string;
  type: StoryType;
  uri: string;
  duration?: number;
}
