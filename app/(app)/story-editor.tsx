import StoryEditor from "@/src/components/home/story/story-editor/StoryEditor";
import { useLocalSearchParams } from "expo-router";

export default function StoryEditorScreen() {
  const { uri, mediaType } = useLocalSearchParams<{
    uri: string;
    mediaType?: "image" | "video";
  }>();

  if (!uri) return null;

  return (
    <StoryEditor
      mediaUri={uri}
      mediaType={mediaType === "video" ? "video" : "image"}
    />
  );
}
