import StoryEditor from "@/src/components/home/story/story-editor/StoryEditor";
import { useLocalSearchParams } from "expo-router";

export default function StoryEditorScreen() {
  const { uri } = useLocalSearchParams<{ uri: string }>();

  if (!uri) return null;

  return <StoryEditor imageUri={uri} />;
}
