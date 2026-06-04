import { useMediaPicker } from "@/hooks/use-media-picker";
import { useIsStoryUploading } from "@/src/features/upload/upload.hooks";
import { router } from "expo-router";
import { useCallback } from "react";

export function useAddStory() {
  const { openMediaPicker } = useMediaPicker();
  const isUploading = useIsStoryUploading();

  const openAddStory = useCallback(() => {
    openMediaPicker({
      mediaTypes: ["images", "videos"],
      allowsEditing: false,
      onChange: (file) => {
        if (file.type.startsWith("image/")) {
          router.push({
            pathname: "/story-editor",
            params: { uri: file.uri, mediaType: "image" },
          });
        }

        if (file.type.startsWith("video/")) {
          router.push({
            pathname: "/video-editor",
            params: { uri: file.uri, fileName: file.name },
          });
        }
      },
    });
  }, [openMediaPicker]);

  return { openAddStory, isUploading };
}
